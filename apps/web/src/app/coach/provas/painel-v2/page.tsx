'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { TabsCard } from '@/components/dashboard/tabs-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatSwimTime, formatImprovement } from '@/lib/utils';

interface RaceSession {
  id: string;
  athleteId: string;
  athleteName: string;
  date: string;
  distanceM: number;
  stroke: string;
  course: 'lcm' | 'scm';
  timeSeconds: number;
  srAvg: number;
  velocity: number;
  tournament?: string;
}

interface PredictionData {
  prediction: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  trend: string;
  weeksToPr?: number;
  predictedPrDate?: string;
  currentPb: number;
}

export default function RaceDashboardV2() {
  const searchParams = useSearchParams();
  const [sessions] = useState<RaceSession[]>([
    // TODO: Load from API
  ]);
  const [prediction] = useState<PredictionData | null>(null);

  const stats = useMemo(() => {
    if (!sessions.length) return null;

    const times = sessions.map((s) => s.timeSeconds);
    const pb = Math.min(...times);
    const lastTime = sessions[sessions.length - 1]?.timeSeconds;
    const improvement = lastTime ? ((lastTime - pb) / lastTime) * 100 : 0;

    const srAvgs = sessions.map((s) => s.srAvg).filter((v) => v > 0);
    const avgSr = srAvgs.length ? srAvgs.reduce((a, b) => a + b) / srAvgs.length : 0;

    const velocities = sessions.map((s) => s.velocity).filter((v) => v > 0);
    const avgVelocity = velocities.length ? velocities.reduce((a, b) => a + b) / velocities.length : 0;

    return { pb, lastTime, improvement, avgSr, avgVelocity, sessions };
  }, [sessions]);

  if (!stats) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Análise de Prova (v2)</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            9 gráficos, voltas, SR, submerso e DPS
          </p>
        </header>

        <Card className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Sem sessões de prova registadas</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-aqua-600 dark:text-aqua-400">
          Análise de Prova
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Painel</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          9 gráficos, voltas, SR, submerso e DPS — para cruzar com o treino.
        </p>
      </header>

      {/* KPI Row 1: Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Tempo Médio"
          value={formatSwimTime(stats.lastTime || 0)}
          trend={
            stats.improvement !== 0
              ? {
                  value: Math.abs(stats.improvement),
                  isPositive: stats.improvement < 0,
                  icon: stats.improvement < 0 ? '↓' : '↑',
                }
              : undefined
          }
          variant="aqua"
          icon="⏱️"
          hint={stats.pb !== stats.lastTime ? `PB: ${formatSwimTime(stats.pb)}` : undefined}
        />

        <MetricCard
          label="SR Médio"
          value={stats.avgSr.toFixed(1)}
          unit="cyc/min"
          variant="aqua"
          icon="🔄"
        />

        <MetricCard
          label="Velocidade Média"
          value={stats.avgVelocity.toFixed(3)}
          unit="m/s"
          variant="aqua"
          icon="💨"
        />

        {prediction && (
          <MetricCard
            label="Próx PR em"
            value={prediction.weeksToPr ? prediction.weeksToPr.toFixed(1) : '—'}
            unit="semanas"
            variant="coral"
            icon="🎯"
          />
        )}
      </div>

      {/* Prediction Section */}
      {prediction && (
        <Card variant="gradient" className="border-aqua-200 dark:border-aqua-800">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Previsão de Performance</span>
              <Badge variant="aqua">Confiança: {(prediction.confidence * 100).toFixed(0)}%</Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Confidence Interval Visualization */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-50">
                Intervalo de confiança (95%)
              </p>

              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pessimista</p>
                  <p className="font-bold text-danger-600">
                    {formatSwimTime(prediction.lowerBound)}
                  </p>
                </div>

                <div className="flex-1 mx-4 h-2 bg-gradient-to-r from-danger-500 via-aqua-500 to-success-500 rounded-full" />

                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Otimista</p>
                  <p className="font-bold text-success-600">
                    {formatSwimTime(prediction.upperBound)}
                  </p>
                </div>
              </div>

              <div className="text-center mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Previsão esperada
                </p>
                <p className="text-2xl font-bold text-aqua-600 dark:text-aqua-400">
                  {formatSwimTime(prediction.prediction)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Trend: {prediction.trend}
                </p>
              </div>
            </div>

            {prediction.weeksToPr && (
              <div className="p-3 bg-gold-100 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-lg text-center">
                <p className="text-sm font-semibold text-gold-900 dark:text-gold-200">
                  🏅 Quebra PR em {prediction.weeksToPr.toFixed(1)} semanas
                </p>
                {prediction.predictedPrDate && (
                  <p className="text-xs text-gold-700 dark:text-gold-300 mt-1">
                    {new Date(prediction.predictedPrDate).toLocaleDateString('pt-PT')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs: Charts and Analysis */}
      <TabsCard
        title="Análise Detalhada"
        tabs={[
          {
            id: 'evolution',
            label: '📈 Evolução',
            content: (
              <div className="text-center py-12 text-slate-500">
                Chart: Evolução semanal (12 semanas)
              </div>
            ),
          },
          {
            id: 'splits',
            label: '⚡ Splits',
            content: (
              <div className="text-center py-12 text-slate-500">
                Chart: Splits vs Limite
              </div>
            ),
          },
          {
            id: 'zones',
            label: '🎯 Zonas',
            content: (
              <div className="text-center py-12 text-slate-500">
                Chart: Distribuição de zona de prova
              </div>
            ),
          },
          {
            id: 'sr',
            label: '🔄 SR Trend',
            content: (
              <div className="text-center py-12 text-slate-500">
                Chart: Stroke Rate ao longo do tempo
              </div>
            ),
          },
        ]}
      />

      {/* Export Section */}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm">
          📥 Importar CSV
        </Button>
        <Button variant="primary" size="sm">
          📤 Exportar PDF
        </Button>
      </div>
    </div>
  );
}
