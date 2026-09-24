"""Redis caching strategies for Aquastats."""
import json
from typing import Optional, TypeVar, Callable, Any
from datetime import datetime, timedelta
import redis.asyncio as redis
import structlog

logger = structlog.get_logger(__name__)

T = TypeVar('T')

# Singleton Redis client
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client."""
    global _redis_client

    if _redis_client is None:
        from .config import get_settings
        settings = get_settings()

        _redis_client = await redis.from_url(
            settings.redis_url,
            encoding='utf-8',
            decode_responses=True
        )

    return _redis_client


async def cache_key(*parts: str) -> str:
    """Build cache key from parts."""
    return ':'.join(['aquastats'] + list(parts))


async def get_cached(key: str) -> Optional[dict]:
    """Get value from cache."""
    try:
        redis_client = await get_redis()
        value = await redis_client.get(key)

        if value:
            logger.debug('cache_hit', key=key)
            return json.loads(value)

        logger.debug('cache_miss', key=key)
        return None
    except Exception as e:
        logger.warning('cache_get_error', key=key, error=str(e))
        return None


async def set_cached(
    key: str,
    value: Any,
    ttl_seconds: int = 3600
) -> bool:
    """Set value in cache with TTL."""
    try:
        redis_client = await get_redis()

        await redis_client.setex(
            key,
            ttl_seconds,
            json.dumps(value, default=str)
        )

        logger.debug('cache_set', key=key, ttl=ttl_seconds)
        return True
    except Exception as e:
        logger.warning('cache_set_error', key=key, error=str(e))
        return False


async def delete_cached(key: str) -> bool:
    """Delete value from cache."""
    try:
        redis_client = await get_redis()
        await redis_client.delete(key)

        logger.debug('cache_delete', key=key)
        return True
    except Exception as e:
        logger.warning('cache_delete_error', key=key, error=str(e))
        return False


async def invalidate_pattern(pattern: str) -> int:
    """Delete all keys matching pattern."""
    try:
        redis_client = await get_redis()

        # Get all keys matching pattern
        keys = await redis_client.keys(pattern)

        if keys:
            await redis_client.delete(*keys)
            logger.info('cache_invalidate_pattern', pattern=pattern, count=len(keys))

        return len(keys)
    except Exception as e:
        logger.warning('cache_invalidate_error', pattern=pattern, error=str(e))
        return 0


# Cache strategies for different data types

CACHE_TTL = {
    'athlete_pb': 3600,  # 1 hour
    'team_snapshot': 300,  # 5 minutes
    'user_session': 86400,  # 24 hours
    'prediction': 1800,  # 30 minutes
    'competition': 3600,  # 1 hour
}


async def cache_athlete_pb(athlete_id: str, data: dict) -> bool:
    """Cache athlete's personal best."""
    key = await cache_key('athlete', athlete_id, 'pb')
    return await set_cached(key, data, CACHE_TTL['athlete_pb'])


async def get_athlete_pb(athlete_id: str) -> Optional[dict]:
    """Get cached athlete PB."""
    key = await cache_key('athlete', athlete_id, 'pb')
    return await get_cached(key)


async def cache_team_snapshot(team_id: str, data: dict) -> bool:
    """Cache team snapshot (athletes, workouts, etc)."""
    key = await cache_key('team', team_id, 'snapshot')
    return await set_cached(key, data, CACHE_TTL['team_snapshot'])


async def get_team_snapshot(team_id: str) -> Optional[dict]:
    """Get cached team snapshot."""
    key = await cache_key('team', team_id, 'snapshot')
    return await get_cached(key)


async def invalidate_team_cache(team_id: str) -> int:
    """Invalidate all team-related caches."""
    pattern = await cache_key('team', team_id, '*')
    return await invalidate_pattern(pattern)


async def cache_prediction(athlete_id: str, distance: int, stroke: str, data: dict) -> bool:
    """Cache performance prediction."""
    key = await cache_key('predict', athlete_id, str(distance), stroke)
    return await set_cached(key, data, CACHE_TTL['prediction'])


async def get_prediction(athlete_id: str, distance: int, stroke: str) -> Optional[dict]:
    """Get cached prediction."""
    key = await cache_key('predict', athlete_id, str(distance), stroke)
    return await get_cached(key)


async def invalidate_athlete_predictions(athlete_id: str) -> int:
    """Invalidate all predictions for an athlete."""
    pattern = await cache_key('predict', athlete_id, '*')
    return await invalidate_pattern(pattern)


class CachedFunction:
    """Decorator for caching function results."""

    def __init__(
        self,
        ttl_seconds: int = 3600,
        key_prefix: Optional[str] = None
    ):
        self.ttl_seconds = ttl_seconds
        self.key_prefix = key_prefix

    def __call__(self, func: Callable) -> Callable:
        """Wrap function with caching."""

        async def wrapper(*args, **kwargs) -> Any:
            # Build cache key
            cache_key_str = await cache_key(
                self.key_prefix or func.__name__,
                str(args),
                str(kwargs)
            )

            # Try to get from cache
            cached = await get_cached(cache_key_str)
            if cached:
                return cached

            # Execute function
            result = await func(*args, **kwargs)

            # Cache result
            await set_cached(cache_key_str, result, self.ttl_seconds)

            return result

        return wrapper


# Caching middleware helper
async def with_cache(
    cache_key_parts: list,
    func: Callable[..., Any],
    ttl: int = 3600,
    *args,
    **kwargs
) -> Any:
    """
    Execute function with caching.

    Args:
        cache_key_parts: Parts to build cache key
        func: Function to execute
        ttl: Cache TTL in seconds
        *args, **kwargs: Arguments for func

    Returns:
        Cached or fresh result
    """
    cache_key_str = await cache_key(*[str(p) for p in cache_key_parts])

    # Try cache
    cached = await get_cached(cache_key_str)
    if cached:
        logger.debug('cache_hit_with_cache', key=cache_key_str)
        return cached

    # Execute
    result = await func(*args, **kwargs)

    # Cache
    await set_cached(cache_key_str, result, ttl)

    return result


# Example usage:
example_usage = """
# In routes/data_routes.py

from ..core.caching import (
    cache_athlete_pb, get_athlete_pb,
    invalidate_team_cache, with_cache
)

@router.get("/api/v1/athletes/{athlete_id}/pb")
async def get_athlete_pb_endpoint(
    athlete_id: str,
    session: Session = Depends(get_session),
):
    '''Get athlete PB (from cache if available).'''

    # Try cache first
    cached_pb = await get_athlete_pb(athlete_id)
    if cached_pb:
        return cached_pb

    # Fetch from DB
    pb_records = session.scalars(
        select(TimeLog).where(TimeLog.athlete_id == UUID(athlete_id))
        .order_by(TimeLog.time_seconds)
        .limit(1)
    ).all()

    if pb_records:
        pb = pb_records[0]
        data = {
            'time_seconds': (pb.mm * 60 + pb.ss + pb.cc / 100),
            'stroke': pb.stroke,
            'date': pb.recorded_at.isoformat(),
        }

        # Cache for 1 hour
        await cache_athlete_pb(athlete_id, data)
        return data

    raise HTTPException(status_code=404, detail='No times recorded')


@router.post("/api/v1/times")
async def save_time(
    body: dict,
    payload: dict = Depends(require_coach),
    session: Session = Depends(get_session),
):
    '''Save time and invalidate relevant caches.'''

    result = commands.save_time(session, payload, body)

    # Invalidate athlete PB cache
    athlete_id = body.get('athlete_id')
    if athlete_id:
        await invalidate_athlete_predictions(athlete_id)
        await delete_cached(await cache_key('athlete', athlete_id, 'pb'))

    # Invalidate team cache
    team_id = payload.get('team_uuid')
    if team_id:
        await invalidate_team_cache(team_id)

    return result
"""
