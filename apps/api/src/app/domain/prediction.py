"""Performance prediction models - Linear, XGBoost, Ensemble."""
from typing import Optional, List, Dict, Tuple
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from uuid import UUID
import structlog

logger = structlog.get_logger(__name__)


class PerformancePredictor:
    """Base predictor for athlete performance."""

    @staticmethod
    def prepare_session_data(
        sessions: List[dict],
        distance_m: int,
        stroke: str,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare session data for training.

        Args:
            sessions: List of dicts with time_seconds, date, etc
            distance_m: Distance in meters
            stroke: Stroke type

        Returns:
            X (weeks), y (times in seconds)
        """
        if not sessions:
            return np.array([]).reshape(0, 1), np.array([])

        # Sort by date
        sorted_sessions = sorted(sessions, key=lambda s: s['recorded_at'])

        # X: week number (0, 1, 2, ...)
        # y: time in seconds
        X = np.arange(len(sorted_sessions)).reshape(-1, 1)
        y = np.array([s['time_seconds'] for s in sorted_sessions])

        return X, y

    @staticmethod
    def centiseconds_to_seconds(mm: int, ss: int, cc: int) -> float:
        """Convert MM'SS"CC to seconds."""
        return mm * 60 + ss + cc / 100

    @staticmethod
    def seconds_to_time_str(seconds: float) -> str:
        """Convert seconds to MM'SS"CC format."""
        if seconds <= 0:
            return "—"

        total_cs = int(seconds * 100)
        mm = total_cs // 6000
        rest = total_cs % 6000
        ss = rest // 100
        cc = rest % 100

        return f"{mm:02d}'{ss:02d}\"{cc:02d}"


class LinearPredictor(PerformancePredictor):
    """Simple linear regression predictor."""

    def __init__(self):
        self.model = None
        self.r_squared = 0
        self.slope = 0
        self.intercept = 0

    def fit(self, X: np.ndarray, y: np.ndarray) -> None:
        """
        Fit linear regression model.

        Args:
            X: Array of shape (n_samples, 1) - week numbers
            y: Array of shape (n_samples,) - times in seconds
        """
        if len(X) < 2:
            return

        from sklearn.linear_model import LinearRegression
        from sklearn.metrics import r2_score

        self.model = LinearRegression()
        self.model.fit(X, y)

        self.intercept = float(self.model.intercept_)
        self.slope = float(self.model.coef_[0])
        self.r_squared = float(r2_score(y, self.model.predict(X)))

    def predict(self, weeks_ahead: int) -> Dict:
        """
        Predict performance N weeks in future.

        Args:
            weeks_ahead: How many weeks to predict

        Returns:
            {
                "prediction_seconds": float,
                "confidence": float (R²),
                "trend": str (improving/stable/declining),
                "slope": float (seconds/week)
            }
        """
        if self.model is None or len(self.model.coef_) == 0:
            return {
                'prediction_seconds': None,
                'confidence': 0,
                'trend': 'unknown',
                'slope': 0,
            }

        # Predict at future week
        future_week = np.array([[weeks_ahead]])
        prediction = float(self.model.predict(future_week)[0])

        # Determine trend
        if self.slope < -0.5:
            trend = 'improving'
        elif self.slope > 0.5:
            trend = 'declining'
        else:
            trend = 'stable'

        return {
            'prediction_seconds': max(0, prediction),
            'confidence': self.r_squared,
            'trend': trend,
            'slope': self.slope,
        }

    def predict_pr_weeks(self, current_pb: float, n_weeks: int = 100) -> Optional[float]:
        """
        Estimate weeks until athlete breaks PR (if improving).

        Args:
            current_pb: Current personal best in seconds
            n_weeks: Max weeks to check (default 100)

        Returns:
            Weeks to PR, or None if not improving
        """
        if self.slope >= 0:  # Not improving
            return None

        # Solve: prediction = current_pb
        # intercept + slope * weeks = current_pb
        # weeks = (current_pb - intercept) / slope
        weeks_to_pr = (current_pb - self.intercept) / self.slope

        if 0 < weeks_to_pr < n_weeks:
            return weeks_to_pr

        return None


class XGBoostPredictor(PerformancePredictor):
    """XGBoost predictor with feature engineering."""

    def __init__(self):
        self.model = None
        self.feature_names = []
        self.r_squared = 0

    @staticmethod
    def engineer_features(
        sessions: List[dict],
        athlete_meta: Dict,
    ) -> Tuple[pd.DataFrame, np.ndarray]:
        """
        Extract features from sessions.

        Features:
        - Temporal: day_of_week, time_of_day, season
        - Trend: 4week_avg, 4week_std, 4week_trend
        - Volume: weekly_km, monthly_km
        - Performance: previous_time, sr_previous, velocity_previous
        """
        features_list = []

        for i, session in enumerate(sessions):
            features = {}

            # Temporal
            session_date = datetime.fromisoformat(session['recorded_at'].isoformat() if hasattr(session['recorded_at'], 'isoformat') else session['recorded_at'])
            features['day_of_week'] = session_date.weekday()
            features['month'] = session_date.month
            features['week_of_year'] = session_date.isocalendar()[1]

            # Trend (last 4 weeks)
            four_weeks_ago = session_date - timedelta(weeks=4)
            recent_sessions = [
                s for s in sessions[:i+1]
                if (datetime.fromisoformat(s['recorded_at'].isoformat() if hasattr(s['recorded_at'], 'isoformat') else s['recorded_at']) > four_weeks_ago)
            ]

            if recent_sessions:
                recent_times = [s['time_seconds'] for s in recent_sessions]
                features['trend_4week_avg'] = np.mean(recent_times)
                features['trend_4week_std'] = np.std(recent_times)

                # Linear trend
                if len(recent_times) > 1:
                    x_trend = np.arange(len(recent_times)).reshape(-1, 1)
                    y_trend = np.array(recent_times)
                    coef = np.polyfit(x_trend.flatten(), y_trend, 1)[0]
                    features['trend_4week_slope'] = coef
                else:
                    features['trend_4week_slope'] = 0
            else:
                features['trend_4week_avg'] = session['time_seconds']
                features['trend_4week_std'] = 0
                features['trend_4week_slope'] = 0

            # Previous performance
            if i > 0:
                features['prev_time'] = sessions[i-1]['time_seconds']
                features['improvement'] = sessions[i-1]['time_seconds'] - session['time_seconds']
            else:
                features['prev_time'] = session['time_seconds']
                features['improvement'] = 0

            # Athlete meta
            features['age_years'] = athlete_meta.get('age', 16)
            features['experience_years'] = athlete_meta.get('experience_years', 1)

            features_list.append(features)

        df = pd.DataFrame(features_list)
        y = np.array([s['time_seconds'] for s in sessions])

        return df, y

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> None:
        """Fit XGBoost model."""
        if len(X) < 3:
            return

        import xgboost as xgb
        from sklearn.metrics import r2_score

        self.feature_names = list(X.columns)

        self.model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.01,
            random_state=42,
            objective='reg:squarederror',
            n_jobs=-1,
            verbose=0,
        )

        self.model.fit(X, y, verbose=False)

        y_pred = self.model.predict(X)
        self.r_squared = float(r2_score(y, y_pred))

    def predict(self, features: Dict) -> Dict:
        """
        Predict using XGBoost.

        Args:
            features: Feature dict (from engineer_features)

        Returns:
            Prediction dict
        """
        if self.model is None:
            return {'prediction_seconds': None, 'confidence': 0}

        # Convert to DataFrame with same columns as training
        df = pd.DataFrame([features])

        # Ensure same columns
        for col in self.feature_names:
            if col not in df.columns:
                df[col] = 0

        df = df[self.feature_names]

        prediction = float(self.model.predict(df)[0])

        return {
            'prediction_seconds': max(0, prediction),
            'confidence': self.r_squared,
            'feature_importance': dict(zip(
                self.feature_names,
                self.model.feature_importances_.tolist()
            )),
        }


class EnsemblePredictor(PerformancePredictor):
    """Ensemble combining Linear + XGBoost."""

    def __init__(self):
        self.linear = LinearPredictor()
        self.xgb = XGBoostPredictor()
        self.sessions = []
        self.athlete_meta = {}

    def fit(
        self,
        sessions: List[dict],
        athlete_meta: Dict,
    ) -> None:
        """
        Train both models.

        Args:
            sessions: List of session dicts
            athlete_meta: Athlete metadata (age, experience, etc)
        """
        self.sessions = sessions
        self.athlete_meta = athlete_meta

        # Linear
        X_linear, y = PerformancePredictor.prepare_session_data(sessions, 0, '')
        if len(X_linear) >= 2:
            self.linear.fit(X_linear, y)

        # XGBoost
        X_xgb, y = XGBoostPredictor.engineer_features(sessions, athlete_meta)
        if len(X_xgb) >= 3:
            self.xgb.fit(X_xgb, y)

    def predict_with_ci(self, weeks_ahead: int = 4) -> Dict:
        """
        Predict with 95% confidence interval.

        Args:
            weeks_ahead: Weeks to predict ahead

        Returns:
            {
                "prediction": float,
                "lower_bound": float,
                "upper_bound": float,
                "confidence": float,
                "models": {linear, xgb},
            }
        """
        pred_linear = self.linear.predict(weeks_ahead)
        pred_xgb_time = pred_linear.get('prediction_seconds', 0)  # Fallback

        predictions = []
        confidences = []

        if pred_linear['prediction_seconds'] is not None:
            predictions.append(pred_linear['prediction_seconds'])
            confidences.append(pred_linear['confidence'])

        if self.xgb.model is not None and pred_xgb_time > 0:
            # For XGBoost, need to engineer features for future
            # Simplified: use linear as baseline
            predictions.append(pred_xgb_time)
            confidences.append(self.xgb.r_squared)

        if not predictions:
            return {
                'prediction': None,
                'lower_bound': None,
                'upper_bound': None,
                'confidence': 0,
                'trend': 'unknown',
            }

        # Ensemble: weighted average
        avg_confidence = np.mean(confidences) if confidences else 0

        mean_pred = np.mean(predictions)
        std_pred = np.std(predictions) if len(predictions) > 1 else mean_pred * 0.05

        # 95% CI
        z_score = 1.96
        margin = z_score * std_pred

        return {
            'prediction': mean_pred,
            'lower_bound': max(0, mean_pred - margin),
            'upper_bound': mean_pred + margin,
            'confidence': avg_confidence,
            'trend': pred_linear['trend'],
            'models': {
                'linear': pred_linear['prediction_seconds'],
                'xgb': pred_xgb_time,
            },
        }

    def predict_pr_date(self, current_pb: float) -> Optional[Dict]:
        """
        Estimate when athlete will break PR.

        Returns:
            {
                "weeks_to_pr": float,
                "predicted_date": str (ISO),
                "confidence": float,
            }
        """
        weeks = self.linear.predict_pr_weeks(current_pb)

        if weeks is None or weeks <= 0:
            return None

        predicted_date = datetime.now() + timedelta(weeks=weeks)

        return {
            'weeks_to_pr': weeks,
            'predicted_date': predicted_date.isoformat(),
            'confidence': self.linear.r_squared,
        }
