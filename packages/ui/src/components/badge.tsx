import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PauseCircleIcon,
  ShieldAlertIcon,
} from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from 'cn';

const variantDefaultIcons: Record<
  string,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
> = {
  approved: CheckCircle2Icon,
  success: CheckCircle2Icon,
  pending: ClockIcon,
  warning: ClockIcon,
  blocked: ShieldAlertIcon,
  captured: CheckCircle2Icon,
  info: CheckCircle2Icon,
  paused: PauseCircleIcon,
  destructive: AlertTriangleIcon,
};

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3 select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90',
        outline:
          'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        ghost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 [a&]:hover:underline',
        success:
          'border-[var(--spend-approved)]/30 bg-[var(--spend-approved-subtle)] text-[var(--spend-approved-subtle-foreground)] [a&]:hover:bg-[var(--spend-approved-subtle)]/90',
        warning:
          'border-[var(--spend-pending)]/40 bg-[var(--spend-pending-subtle)] text-[var(--spend-pending-subtle-foreground)] [a&]:hover:bg-[var(--spend-pending-subtle)]/90',
        info: 'border-[var(--spend-captured)]/30 bg-[var(--spend-captured-subtle)] text-[var(--spend-captured-subtle-foreground)] [a&]:hover:bg-[var(--spend-captured-subtle)]/90',
        approved:
          'border-[var(--spend-approved)]/30 bg-[var(--spend-approved-subtle)] text-[var(--spend-approved-subtle-foreground)] [a&]:hover:bg-[var(--spend-approved-subtle)]/90',
        pending:
          'border-[var(--spend-pending)]/40 bg-[var(--spend-pending-subtle)] text-[var(--spend-pending-subtle-foreground)] [a&]:hover:bg-[var(--spend-pending-subtle)]/90',
        blocked:
          'border-[var(--spend-blocked)]/30 bg-[var(--spend-blocked-subtle)] text-[var(--spend-blocked-subtle-foreground)] [a&]:hover:bg-[var(--spend-blocked-subtle)]/90',
        captured:
          'border-[var(--spend-captured)]/30 bg-[var(--spend-captured-subtle)] text-[var(--spend-captured-subtle-foreground)] [a&]:hover:bg-[var(--spend-captured-subtle)]/90',
        paused:
          'border-[var(--spend-paused)]/30 bg-[var(--spend-paused-subtle)] text-[var(--spend-paused-subtle-foreground)] [a&]:hover:bg-[var(--spend-paused-subtle)]/90',
      },
      size: {
        default: 'px-2 py-0.5 text-xs',
        sm: 'px-1.5 py-0.5 text-[11px] leading-tight [&>svg]:size-2.5',
        lg: 'px-3 py-1 text-sm [&>svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface BadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
  icon?: boolean | React.ReactNode;
  showDot?: boolean;
}

function Badge({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  icon,
  showDot = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span';

  if (asChild) {
    return (
      <Comp
        data-slot="badge"
        data-variant={variant}
        data-size={size}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }

  const renderIcon = () => {
    if (showDot) {
      return (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-80" />
      );
    }

    if (icon === true && variant) {
      const DefaultIcon = variantDefaultIcons[variant];
      return DefaultIcon ? <DefaultIcon aria-hidden="true" className="shrink-0" /> : null;
    }

    if (React.isValidElement(icon)) {
      return icon;
    }

    return null;
  };

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {renderIcon()}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
