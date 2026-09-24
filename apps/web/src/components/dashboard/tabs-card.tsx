'use client';

import { ReactNode, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsCardProps {
  title: string;
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'default' | 'gradient';
}

export function TabsCard({
  title,
  tabs,
  defaultTab,
  variant = 'default',
}: TabsCardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeTabContent = tabs.find((t) => t.id === activeTab);

  return (
    <Card variant={variant}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      {/* Tabs */}
      <div className="flex gap-1 px-4 lg:px-6 border-b border-slate-200 dark:border-slate-700 -mb-4 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-aqua-500 text-aqua-600 dark:text-aqua-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <CardContent className="pt-6">
        {activeTabContent && activeTabContent.content}
      </CardContent>
    </Card>
  );
}
