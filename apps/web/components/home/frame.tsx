import { cn } from '@workspace/ui/lib/utils';
import type { ComponentProps, ReactElement } from 'react';

/**
 * Layout primitives ported from efferd blocks (full-width-divider, decor-icon).
 * The page sits inside one bordered column; full-bleed rules mark section edges
 * and small crosses mark where they meet the column, like a ruled ledger.
 */

type DividerProps = ComponentProps<'div'> & { position: 'top' | 'bottom' };

export function FullWidthDivider({ className, position, ...props }: DividerProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-border pointer-events-none absolute left-1/2 h-px w-screen -translate-x-1/2',
        position === 'top' ? '-top-px' : '-bottom-px',
        className,
      )}
      {...props}
    />
  );
}

type CrossPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CROSS_POSITION: Record<CrossPosition, string> = {
  'top-left': 'top-0 left-0 -translate-x-[calc(50%+0.5px)] -translate-y-[calc(50%+0.5px)]',
  'top-right': 'top-0 right-0 translate-x-[calc(50%+0.5px)] -translate-y-[calc(50%+0.5px)]',
  'bottom-left': 'bottom-0 left-0 -translate-x-[calc(50%+0.5px)] translate-y-[calc(50%+0.5px)]',
  'bottom-right': ' right-0 bottom-0 translate-x-[calc(50%+0.5px)] translate-y-[calc(50%+0.5px)]',
};

export function Cross({ position }: { position: CrossPosition }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      className={cn(
        'text-muted-foreground pointer-events-none absolute z-10 hidden size-4 lg:block',
        CROSS_POSITION[position],
      )}
    >
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

type FrameSectionProps = ComponentProps<'section'> & {
  /** Draws crosses where the top rule meets the column rails. */
  marked?: boolean;
  /** Muted band behind the column. */
  muted?: boolean;
};

/** One horizontal band of the page: a full-bleed top rule plus the column rails. */
export function FrameSection({
  className,
  marked = false,
  muted = false,
  children,
  ...props
}: FrameSectionProps): ReactElement {
  return (
    <section className={cn('relative scroll-mt-14', muted && 'bg-muted/40', className)} {...props}>
      <div className="relative mx-auto w-full max-w-6xl border-x">
        <FullWidthDivider position="top" />
        {marked ? (
          <>
            <Cross position="top-left" />
            <Cross position="top-right" />
          </>
        ) : null}
        {children}
      </div>
    </section>
  );
}
