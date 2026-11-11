'use client';

import { cn } from '@workspace/ui/lib/utils';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function renderWithLucideWarning(nodes: React.ReactNode): React.ReactNode {
  return React.Children.map(nodes, (child) => {
    if (typeof child === 'string' && child.includes('⚠️')) {
      const segments = child.split('⚠️');
      return segments.flatMap((seg, i) =>
        i === 0
          ? [seg]
          : [
              <AlertTriangle
                key={`warning-icon-${i}`}
                className="mr-1.5 inline-block size-4 shrink-0 align-text-bottom text-amber-500"
                aria-hidden="true"
              />,
              seg,
            ],
      );
    }
    if (
      React.isValidElement(child) &&
      child.props &&
      (child.props as { children?: React.ReactNode }).children
    ) {
      return React.cloneElement(
        child as React.ReactElement<{ children?: React.ReactNode }>,
        undefined,
        renderWithLucideWarning((child.props as { children?: React.ReactNode }).children),
      );
    }
    return child;
  });
}

export interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={cn('space-y-2 text-sm leading-relaxed break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed last:mb-0">{renderWithLucideWarning(children)}</p>
          ),
          strong: ({ children }) => (
            <strong className="text-foreground font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === 'string';
            if (isInline) {
              return (
                <code
                  className="bg-muted/80 text-foreground border-border/50 rounded border px-1.5 py-0.5 font-mono text-xs font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={cn(
                  'bg-muted block overflow-x-auto rounded-lg p-3 font-mono text-xs',
                  className,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-primary/40 text-muted-foreground my-2 border-l-2 pl-3 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            const isInternal = href?.startsWith('/') || href?.startsWith('#');
            return (
              <a
                href={href}
                {...(!isInternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-primary font-medium underline underline-offset-4 hover:opacity-80"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
