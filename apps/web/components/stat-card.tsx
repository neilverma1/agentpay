import { TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';

import { Card } from '@workspace/ui/components/card';
import { cn } from '@workspace/ui/lib/utils';

export interface StatCardProps extends React.ComponentProps<typeof Card> {
  title: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: number | string;
    label: string;
    positive: boolean;
  };
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function StatCard({
  title,
  value,
  subtext,
  trend,
  icon,
  badge,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card
      data-slot="stat-card"
      className={cn('relative p-5 transition-shadow hover:shadow-sm', className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
        <div className="flex items-center gap-2">
          {badge}
          {icon && (
            <div className="text-muted-foreground bg-muted/60 flex size-8 shrink-0 items-center justify-center rounded-lg border">
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-mono text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      </div>

      {(subtext || trend) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-1 font-medium tabular-nums',
                trend.positive
                  ? 'text-[var(--spend-approved-subtle-foreground)]'
                  : 'text-destructive',
              )}
            >
              {trend.positive ? (
                <TrendingUp aria-hidden="true" className="size-3.5" />
              ) : (
                <TrendingDown aria-hidden="true" className="size-3.5" />
              )}
              <span>
                {typeof trend.value === 'number' && trend.value > 0
                  ? `+${trend.value}%`
                  : trend.value}
              </span>
            </span>
          )}
          {subtext && <span className="text-muted-foreground">{subtext}</span>}
          {trend && <span className="text-muted-foreground">vs {trend.label}</span>}
        </div>
      )}
    </Card>
  );
}
