'use client';

import { config } from '@/config/site';
import { useSidebar } from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';
import { type LucideIcon } from 'lucide-react';
import Image from 'next/image';

export type LogoProps = {
  variant: 'default' | 'home' | 'sidebar' | 'notFound' | 'error' | 'text-only';
  icon?: LucideIcon;
  showText?: boolean;
  classes?: {
    container?: string;
    logo?: string;
    icon?: string;
    text?: string;
  };
};

export function Logo({ variant, icon: CustomIcon, showText: showTextProp, classes }: LogoProps) {
  const { state } = useSidebar();
  const defaults = getDefaults(variant);
  const showLogo = variant !== 'text-only';

  const shouldShowText =
    showTextProp ??
    (['default', 'text-only'].includes(variant) || (variant === 'sidebar' && state === 'expanded'));

  const brandName = config.name || 'AgentPay';

  return (
    <div className={cn(defaults.container, classes?.container ?? '')}>
      {showLogo && (
        <div className={cn(defaults.logo, classes?.logo ?? '')}>
          {CustomIcon ? (
            <CustomIcon className={cn(defaults.icon, classes?.icon ?? '')} />
          ) : (
            <Image
              src="/icon.png"
              alt={brandName}
              width={64}
              height={64}
              priority
              className={cn('size-full shrink-0 rounded-full object-cover', classes?.icon ?? '')}
            />
          )}
        </div>
      )}
      {shouldShowText && (
        <span className={cn(defaults.text, classes?.text ?? '')}>
          {brandName.toLowerCase() === 'agentpay' ? (
            <>
              <span className="text-foreground font-semibold">Agent</span>
              <span className="text-primary font-bold">Pay</span>
            </>
          ) : (
            brandName
          )}
        </span>
      )}
    </div>
  );
}

function getDefaults(variant: LogoProps['variant']) {
  const containerBaseClass = 'flex items-center gap-2.5 select-none';
  const logoBaseClass =
    'flex aspect-square size-7 shrink-0 items-center justify-center rounded-full overflow-hidden shadow-xs transition-colors';
  const iconBaseClass = 'size-4 shrink-0';
  const textBaseClass = 'text-base tracking-tight leading-none';

  switch (variant) {
    case 'sidebar':
      return {
        container: cn(containerBaseClass),
        logo: cn(logoBaseClass),
        icon: cn(iconBaseClass),
        text: cn(textBaseClass, 'text-base font-semibold'),
      };
    case 'home':
    case 'error':
    case 'notFound':
      return {
        container: cn(containerBaseClass, 'flex-col justify-center gap-3'),
        logo: cn(logoBaseClass, 'size-16 rounded-2xl shadow-sm'),
        icon: cn(iconBaseClass, 'size-8'),
        text: cn(textBaseClass, 'text-xl font-bold'),
      };
    case 'text-only':
      return {
        container: cn(containerBaseClass),
        logo: '',
        icon: '',
        text: cn(textBaseClass, 'text-lg sm:text-xl font-semibold'),
      };
    case 'default':
    default:
      return {
        container: cn(containerBaseClass),
        logo: cn(logoBaseClass),
        icon: cn(iconBaseClass),
        text: cn(textBaseClass, 'text-base font-semibold'),
      };
  }
}
