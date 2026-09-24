'use client';

import { MetricCard } from '@/components/dashboard/metric-card';
import { TabsCard } from '@/components/dashboard/tabs-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function TrainingDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-aqua-600 dark:text-aqua-400">
          Análise de Treino
        </p>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Painel</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
          Volume, intensidade, zonas e comparações por atleta.
        </p>
      </header>

      {/* KPI Row 1: Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Volume Semana"
          value="18.5"
          unit="km"
          trend={{ value: 8.3, isPositive: true }}
          variant="aqua"
          icon="📊"
        />

        <MetricCard
          label="Treinos Completados"
          value="5"
          unit="/ 6"
          variant="success"
          icon="✅"
          hint="83% compliance"
        />

        <MetricCard
          label="TSS Média"
          value="342"
          trend={{ value: 12, isPositive: true }}
          variant="aqua"
          icon="⚡"
        />

        <MetricCard
          label="Duração Total"
          value="12:45"
          unit="horas"
          trend={{ value: 15, isPositive: true }}
          variant="aqua"
          icon="⏱️"
        />
      </div>

      {/* Zone Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Zone Pie Chart */}
        <Card variant="gradient">
          <CardHeader>
            <CardTitle>Distribuição de Intensidade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zone-z1" />
                  <span className="text-sm">Z1 - Aeróbio Baixo</span>
                </div>
                <Badge variant="zone-z1">10%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zone-z2" />
                  <span className="text-sm">Z2 - Aeróbio Médio</span>
                </div>
                <Badge variant="zone-z2">20%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zone-z3" />
                  <span className="text-sm">Z3 - Limiar</span>
                </div>
                <Badge variant="zone-z3">35%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zone-z4" />
                  <span className="text-sm">Z4 - Tolerância</span>
                </div>
                <Badge variant="zone-z4">25%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zone-z5" />
                  <span className="text-sm">Z5 - VO2 Máx</span>
                </div>
                <Badge variant="zone-z5">10%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Volume by Zone */}
        <Card variant="gradient">
          <CardHeader>
            <CardTitle>Volume por Zona (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-slate-500">
              Chart: Volume semanal por zona
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Athlete Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Comparação de Atletas</span>
            <Button variant="ghost" size="sm">
              📥 Exportar
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-3 font-semibold text-slate-900 dark:text-slate-50">
                    Atleta
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-900 dark:text-slate-50">
                    Completado
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-900 dark:text-slate-50">
                    Tempo Médio
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-900 dark:text-slate-50">
                    Volume
                  </th>
                  <th className="text-center py-3 px-3 font-semibold text-slate-900 dark:text-slate-50">
                    Zona
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'João Silva', completed: true, time: '1:15"38', volume: '2.5km', zone: 'Z3' },
                  { name: 'Maria Santos', completed: true, time: '1:18"42', volume: '2.3km', zone: 'Z2-Z3' },
                  { name: 'Pedro Costa', completed: false, time: '—', volume: '1.8km', zone: 'Z1-Z2' },
                  { name: 'Ana Oliveira', completed: true, time: '1:12"15', volume: '2.7km', zone: 'Z4' },
                ].map((athlete) => (
                  <tr
                    key={athlete.name}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-3 text-slate-900 dark:text-slate-50 font-medium">{athlete.name}</td>
                    <td className="py-3 px-3 text-center">
                      {athlete.completed ? (
                        <Badge variant="success" dot>
                          Completo
                        </Badge>
                      ) : (
                        <Badge variant="default" dot>
                          Incompleto
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-900 dark:text-slate-50 font-mono">
                      {athlete.time}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-900 dark:text-slate-50">
                      {athlete.volume}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant="aqua">{athlete.zone}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-l-4 border-l-gold-500">
        <CardHeader>
          <CardTitle>💡 Recomendações</CardTitle>
        </CardHeader>

        <CardContent>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-gold-500">→</span>
              <span className="text-slate-700 dark:text-slate-300">Aumentar volume em Z3 (limiar) - treino de força</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-500">→</span>
              <span className="text-slate-700 dark:text-slate-300">João Silva: SR caiu no final — fadiga detectada</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold-500">→</span>
              <span className="text-slate-700 dark:text-slate-300">Rebalancear próxima semana com mais recuperação (Z1-Z2)</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
