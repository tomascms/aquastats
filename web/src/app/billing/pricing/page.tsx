'use client';

import { useEffect, useState } from 'react';
import { PricingCard } from '@/components/billing/pricing-card';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Plan {
  id: string;
  name: string;
  price_eur: number;
  features: Record<string, any>;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/v1/billing/plans');
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPlan = async () => {
    try {
      const response = await fetch('/api/v1/billing/subscription');
      const data = await response.json();
      setCurrentPlan(data.plan);
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Carregando planos...</div>;
  }

  return (
    <div className="space-y-12 py-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold">Planos de Preços</h1>
        <p className="text-xl text-slate-600 dark:text-slate-400">
          Escolha o plano perfeito para sua equipe
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto px-4">
        {plans.map((plan) => {
          const featuresList = Object.entries(plan.features)
            .map(([key, value]) => {
              if (value === true) return key.replace(/_/g, ' ');
              if (value === false) return null;
              if (value === 'unlimited') return `${key.replace(/_/g, ' ')} ilimitado`;
              return `${key.replace(/_/g, ' ')}: ${value}`;
            })
            .filter(Boolean) as string[];

          return (
            <PricingCard
              key={plan.id}
              name={plan.name}
              price={plan.price_eur}
              description={
                plan.id === 'starter'
                  ? 'Para equipas pequenas'
                  : plan.id === 'professional'
                    ? 'Para equipas em crescimento'
                    : plan.id === 'elite'
                      ? 'Para empresas'
                      : 'Testar gratuitamente'
              }
              features={featuresList}
              isPopular={plan.id === 'professional'}
              isCurrentPlan={currentPlan === plan.id}
              disabled={plan.id === 'free'}
              onSelect={() => handleSelectPlan(plan.id)}
            />
          );
        })}
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-4 space-y-4">
        <h2 className="text-2xl font-bold">Perguntas Frequentes</h2>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Posso mudar de plano a qualquer momento?</CardTitle>
            </CardHeader>
            <CardContent>
              Sim! Pode fazer upgrade ou downgrade do seu plano a qualquer momento. O valor será ajustado
              proporcionalmente.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Qual é a política de cancelamento?</CardTitle>
            </CardHeader>
            <CardContent>
              Pode cancelar a qualquer momento. Seu acesso será mantido até ao final do período de
              cobrança atual.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Oferecem período de teste?</CardTitle>
            </CardHeader>
            <CardContent>
              Sim! O plano Starter inclui 14 dias de teste grátis. Nenhum cartão de crédito é necessário.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E se eu precisar de um plano personalizado?</CardTitle>
            </CardHeader>
            <CardContent>
              Contacte nossa equipa para discutir um plano empresarial personalizado.{' '}
              <Button variant="ghost" size="sm">
                Contactar Sales
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
