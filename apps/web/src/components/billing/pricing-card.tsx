'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

interface PricingCardProps {
  name: string;
  price: number;
  currency?: string;
  description?: string;
  features: string[];
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  onSelect?: () => void;
  disabled?: boolean;
}

export function PricingCard({
  name,
  price,
  currency = 'EUR',
  description,
  features,
  isPopular = false,
  isCurrentPlan = false,
  onSelect,
  disabled = false,
}: PricingCardProps) {
  return (
    <Card
      variant={isPopular ? 'gradient' : 'default'}
      className={isPopular ? 'border-2 border-aqua-500 scale-105' : ''}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{name}</CardTitle>
            {description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{description}</p>
            )}
          </div>
          {isPopular && <Badge variant="aqua">Popular</Badge>}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pricing */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">€{price}</span>
            <span className="text-slate-600 dark:text-slate-400">/mês</span>
          </div>
          {price === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Sempre grátis</p>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-aqua-500 font-bold">✓</span>
              <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onSelect}
          disabled={disabled || isCurrentPlan}
          fullWidth
          variant={isPopular ? 'primary' : 'secondary'}
        >
          {isCurrentPlan ? 'Plano Atual' : price === 0 ? 'Começar' : 'Selecionar'}
        </Button>
      </CardFooter>
    </Card>
  );
}
