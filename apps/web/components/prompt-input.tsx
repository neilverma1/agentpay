'use client';

import { ArrowUpIcon, CornerDownLeft, PlusIcon, SquareIcon } from 'lucide-react';
import * as React from 'react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@workspace/ui/components/input-group';
import { Kbd } from '@workspace/ui/components/kbd';
import { cn } from '@workspace/ui/lib/utils';

export interface PromptInputProps extends Omit<
  React.ComponentProps<'form'>,
  'onSubmit' | 'onChange'
> {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (e?: React.FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  modelSlot?: React.ReactNode;
  budgetSlot?: React.ReactNode;
  hintText?: string;
  onAttachClick?: () => void;
  children?: React.ReactNode;
  compact?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  placeholder = 'Ask the agent to change your code...',
  disabled = false,
  modelSlot,
  budgetSlot,
  hintText,
  onAttachClick,
  children,
  className,
  compact = false,
  ...props
}: PromptInputProps) {
  const [internalText, setInternalText] = React.useState('');
  const text = value !== undefined ? value : internalText;
  const setText = (newText: string) => {
    if (value === undefined) {
      setInternalText(newText);
    }
    onChange?.(newText);
  };

  const inputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const canSend = Boolean(text.trim()) && !disabled && !isLoading;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) {
      onStop?.();
      return;
    }
    if (canSend) {
      onSubmit?.(event);
      if (value === undefined) {
        setInternalText('');
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        formRef.current?.requestSubmit();
      }
    }
  };

  if (children) {
    return (
      <form
        ref={formRef}
        onSubmit={onSubmit ? handleSubmit : undefined}
        className={cn('w-full', className)}
        {...props}
      >
        <InputGroup>{children}</InputGroup>
      </form>
    );
  }

  if (compact) {
    return (
      <form ref={formRef} onSubmit={handleSubmit} className={cn('w-full', className)} {...props}>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          multiple
          tabIndex={-1}
          aria-hidden="true"
        />
        <InputGroup className="bg-card/90 border-border/80 focus-within:border-primary/50 focus-within:ring-primary/10 min-h-12 rounded-2xl shadow-xs transition-all duration-200 focus-within:ring-4">
          {onAttachClick && (
            <InputGroupAddon align="inline-start" className="gap-2 self-center py-1.5 pl-2.5">
              <InputGroupButton
                size="icon-sm"
                variant="outline"
                className="rounded-full"
                aria-label="Attach files"
                type="button"
                onClick={onAttachClick}
              >
                <PlusIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}

          <InputGroupTextarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="max-h-36 min-h-9 resize-none py-3 pr-2 pl-4 text-sm leading-relaxed sm:text-base"
          />

          <InputGroupAddon align="inline-end" className="gap-2 self-center py-1.5 pr-2.5">
            {hintText && (
              <span className="text-muted-foreground hidden items-center gap-1.5 text-[11px] select-none sm:inline-flex">
                <Kbd className="gap-1 px-1.5 text-[10px]">
                  <span>Enter</span>
                  <CornerDownLeft className="size-2.5" />
                </Kbd>
              </span>
            )}

            {isLoading ? (
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="destructive"
                className="rounded-full"
                onClick={onStop}
                aria-label="Stop agent response"
              >
                <SquareIcon className="size-3.5 fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                className={cn(
                  'rounded-full transition-all duration-150',
                  canSend
                    ? 'bg-primary text-primary-foreground shadow-xs hover:scale-105 active:scale-95'
                    : 'opacity-40',
                )}
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUpIcon className="size-4" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className={cn('w-full', className)} {...props}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        multiple
        tabIndex={-1}
        aria-hidden="true"
      />
      <InputGroup className="bg-card/90 border-border/80 focus-within:border-primary/50 focus-within:ring-primary/10 rounded-2xl shadow-xs transition-all duration-200 focus-within:ring-4">
        <InputGroupTextarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-21 px-4 pt-3.5 pb-2 text-sm leading-relaxed sm:text-base"
        />
        <InputGroupAddon align="block-end" className="px-3 pt-0 pb-3">
          {onAttachClick && (
            <InputGroupButton
              size="icon-sm"
              variant="outline"
              className="rounded-full"
              aria-label="Attach files"
              type="button"
              onClick={onAttachClick}
            >
              <PlusIcon />
            </InputGroupButton>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {modelSlot}
            {budgetSlot}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {hintText && (
              <span className="text-muted-foreground hidden items-center gap-1.5 text-[11px] select-none sm:inline-flex">
                <Kbd className="gap-1 px-1.5 text-[10px]">
                  <span>Enter</span>
                  <CornerDownLeft className="size-2.5" />
                </Kbd>
              </span>
            )}

            {isLoading ? (
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="destructive"
                className="rounded-full"
                onClick={onStop}
                aria-label="Stop agent response"
              >
                <SquareIcon className="size-3.5 fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                size="icon-sm"
                variant="default"
                className={cn(
                  'rounded-full transition-all duration-150',
                  canSend
                    ? 'bg-primary text-primary-foreground shadow-xs hover:scale-105 active:scale-95'
                    : 'opacity-40',
                )}
                disabled={!canSend}
                aria-label="Send"
              >
                <ArrowUpIcon className="size-4" />
              </InputGroupButton>
            )}
          </div>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea };
