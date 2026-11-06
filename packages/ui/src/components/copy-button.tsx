'use client';

import { Button } from '@workspace/ui/components/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip';
import { cn } from 'cn';
import { CheckIcon, CopyIcon } from 'lucide-react';
import * as React from 'react';

export interface CopyButtonProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  value: string;
  label?: string;
  copiedLabel?: string;
  tooltip?: string;
  copiedTooltip?: string;
  onCopy?: () => void;
  iconOnly?: boolean;
}

export function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  tooltip = 'Copy to clipboard',
  copiedTooltip = 'Copied!',
  onCopy,
  iconOnly = false,
  className,
  variant = 'ghost',
  size = 'sm',
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('Failed to copy to clipboard', err);
      }
    },
    [value, onCopy],
  );

  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn('inline-flex items-center gap-1.5 transition-colors', className)}
      aria-label={copied ? copiedTooltip : tooltip}
      {...props}
    >
      {copied ? (
        <CheckIcon className="size-3.5 scale-110 text-emerald-500 transition-transform" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
      {!iconOnly && label && (
        <span className={cn('text-xs', copied && 'font-medium text-emerald-500')}>
          {copied ? copiedLabel : label}
        </span>
      )}
    </Button>
  );

  if (iconOnly || tooltip) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {copied ? copiedTooltip : tooltip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
}

export interface CopyableChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  displayValue?: string;
  tooltip?: string;
  copiedTooltip?: string;
  onCopy?: () => void;
}

export function CopyableChip({
  value,
  displayValue,
  tooltip = 'Click to copy',
  copiedTooltip = 'Copied to clipboard!',
  onCopy,
  className,
  ...props
}: CopyableChipProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy?.();
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.warn('Failed to copy to clipboard', err);
      }
    },
    [value, onCopy],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'group/chip border-border/80 bg-muted/60 text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-xs transition-all',
              'hover:border-foreground/30 hover:bg-muted cursor-pointer active:scale-98',
              className,
            )}
            aria-label={copied ? copiedTooltip : tooltip}
            {...props}
          >
            <span className="truncate">{displayValue || value}</span>
            {copied ? (
              <CheckIcon className="size-3 shrink-0 text-emerald-500" />
            ) : (
              <CopyIcon className="text-muted-foreground/60 group-hover/chip:text-foreground size-3 shrink-0 transition-colors" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? copiedTooltip : tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
