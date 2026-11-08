'use client';

import { useHeader } from '@/components/layout/header-context';
import ThemeSwitch from '@/components/ui/theme-switch';
import { Separator } from '@workspace/ui/components/separator';
import { SidebarTrigger } from '@workspace/ui/components/sidebar';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { usePathname } from 'next/navigation';

function Header() {
  const { title, actions } = useHeader();
  const pathname = usePathname();
  const isChatThreadRoute = /^\/chat\/[^/]+/.test(pathname ?? '');
  const hasContent = Boolean(title || isChatThreadRoute);

  // The landing page renders its own marketing header.
  if (pathname === '/') return null;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="mr-4 flex min-w-0 flex-1 items-center gap-2">
        <SidebarTrigger className="-ml-1 shrink-0" />
        {hasContent && (
          <Separator
            orientation="vertical"
            className="mr-2 shrink-0 data-[orientation=vertical]:h-4"
          />
        )}
        {title ? (
          <div className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
            {title}
          </div>
        ) : isChatThreadRoute ? (
          <div className="min-w-0 flex-1 py-1">
            <Skeleton className="h-4 w-48 max-w-[50vw] sm:w-64" />
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <ThemeSwitch />
      </div>
    </header>
  );
}

export default Header;
