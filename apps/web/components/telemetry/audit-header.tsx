import * as React from 'react';

interface AuditHeaderProps {
  children?: React.ReactNode;
}

export function AuditHeader({ children }: AuditHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Audit Logs
        </h1>
        <p className="text-muted-foreground text-sm">
          Interactive real-time audit log of all autonomous purchase intents, spending policy
          decisions, and PayPal order captures.
        </p>
      </div>

      {children}
    </div>
  );
}
