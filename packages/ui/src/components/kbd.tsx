import { cn } from 'cn';
import * as React from 'react';

function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'bg-muted/80 text-foreground border-border/80 inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border px-1.5 font-mono text-[10px] font-semibold shadow-2xs select-none',
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
