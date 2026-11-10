'use client';

import { NavUser } from '@/components/layout/nav-user';
import { Logo } from '@/components/ui/logo';
import ThemeSwitcher from '@/components/ui/theme-switcher';
import { config } from '@/config/site';
import { useAuthUser } from '@/hooks/use-auth-user';
import { Button } from '@workspace/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@workspace/ui/components/sidebar';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { cn } from '@workspace/ui/lib/utils';
import { ChevronRight, LogIn, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

interface SidebarThread {
  id: string;
  title: string;
  status: string;
}

const RECENTS_STORAGE_KEY = 'agentpay:sidebar:recents-open';

function getStatusDotColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-emerald-500 animate-pulse';
    case 'pending_approval':
    case 'requires_approval':
    case 'paused':
      return 'bg-amber-500';
    case 'completed':
    case 'settled':
      return 'bg-sky-500';
    case 'archived':
      return 'bg-muted-foreground/50';
    case 'failed':
    case 'rejected':
      return 'bg-rose-500';
    default:
      return 'bg-sky-500';
  }
}

function getStatusLabel(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'In Progress';
    case 'pending_approval':
    case 'requires_approval':
      return 'Needs Approval';
    case 'completed':
    case 'settled':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'rejected':
      return 'Policy Rejected';
    case 'archived':
      return 'Archived';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthUser();
  const isSidebarExpanded = state === 'expanded';

  const [threads, setThreads] = React.useState<SidebarThread[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = React.useState(true);
  const [isRecentsOpen, setIsRecentsOpen] = React.useState(false);
  const hasInitializedPref = React.useRef(false);

  // Read saved preference from browser storage or auto-open on active chat if no preference exists
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(RECENTS_STORAGE_KEY);
      if (saved !== null) {
        setIsRecentsOpen(saved === 'true');
        hasInitializedPref.current = true;
      } else if (pathname.startsWith('/chat/') && !hasInitializedPref.current) {
        setIsRecentsOpen(true);
      }
    } catch {
      // Storage access blocked or restricted
    }
  }, [pathname]);

  const handleRecentsOpenChange = React.useCallback((open: boolean) => {
    setIsRecentsOpen(open);
    hasInitializedPref.current = true;
    try {
      localStorage.setItem(RECENTS_STORAGE_KEY, String(open));
    } catch {
      // Storage access blocked or restricted
    }
  }, []);

  const fetchThreads = React.useCallback(async () => {
    try {
      const res = await fetch('/api/v1/chat/threads?limit=20');
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch (err) {
      console.error('Failed to load recent threads for sidebar', err);
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setIsLoadingThreads(false);
      return;
    }
    setIsLoadingThreads(true);
    fetchThreads();

    const handleUpdate = () => {
      fetchThreads();
    };

    window.addEventListener('agentpay:threads-updated', handleUpdate);
    return () => {
      window.removeEventListener('agentpay:threads-updated', handleUpdate);
    };
  }, [isAuthenticated, isAuthLoading, pathname, fetchThreads]);

  // The landing page is for signed-out visitors and has no app sidebar.
  if (pathname === '/') return null;

  return (
    <Sidebar collapsible={config.layout?.sidebarCollapsible ?? 'offcanvas'} {...props}>
      <SidebarHeader className="border-sidebar-border flex h-14 justify-center border-b px-2">
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              asChild
              tooltip="AgentPay"
              className="group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0! data-[slot=sidebar-menu-button]:p-1.5"
            >
              <Link
                href="/"
                className="flex w-full items-center justify-start group-data-[collapsible=icon]:justify-center"
              >
                <Logo
                  variant="sidebar"
                  classes={{
                    container:
                      'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
                  }}
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        <SidebarGroup className="shrink-0 pb-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {config.nav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title} asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible
          open={isRecentsOpen}
          onOpenChange={handleRecentsOpenChange}
          className="group/collapsible flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden data-[state=closed]:flex-initial"
        >
          <SidebarGroup className="flex min-h-0 flex-1 flex-col pb-0">
            <SidebarGroupLabel asChild className="mb-0.5 shrink-0">
              <CollapsibleTrigger className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1 text-xs font-medium">
                <span>Recents</span>
                <ChevronRight className="size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="min-h-0 flex-1 overflow-y-auto pt-1 pr-1">
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {(isLoadingThreads || isAuthLoading) && threads.length === 0 ? (
                    <>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <SidebarMenuItem key={i}>
                          <div className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5">
                            <Skeleton className="size-2 shrink-0 rounded-full" />
                            <Skeleton className="h-3.5 flex-1 rounded" />
                          </div>
                        </SidebarMenuItem>
                      ))}
                    </>
                  ) : threads.length === 0 ? (
                    <div className="text-muted-foreground px-2.5 py-2 text-xs">
                      No previous missions
                    </div>
                  ) : (
                    threads.map((thread) => (
                      <SidebarMenuItem key={thread.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={pathname === `/chat/${thread.id}`}
                          tooltip={thread.title}
                          className="h-8 w-full gap-2.5 px-2.5"
                        >
                          <Link
                            href={`/chat/${thread.id}`}
                            className="flex w-full min-w-0 items-center gap-2.5"
                          >
                            <span
                              className={cn(
                                'size-2 shrink-0 rounded-full',
                                getStatusDotColor(thread.status),
                              )}
                              title={`Status: ${getStatusLabel(thread.status)}`}
                            />
                            <span className="truncate">{thread.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t">
        {isAuthLoading ? (
          <div className="flex h-12 w-full items-center gap-2 px-2">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            {isSidebarExpanded && (
              <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
            )}
          </div>
        ) : isAuthenticated ? (
          <>
            {!config.layout?.showHeader ? <ThemeSwitcher /> : null}
            <NavUser />
          </>
        ) : (
          <div className={cn('flex flex-col gap-2', { 'self-center': !isSidebarExpanded })}>
            {!config.layout?.showHeader ? <ThemeSwitcher /> : null}
            <Button size={isSidebarExpanded ? 'sm' : 'icon'} aria-label="Sign up">
              <Link
                href="/sign-up"
                className={`flex flex-row items-center justify-center ${isSidebarExpanded ? 'space-x-2' : ''}`}
              >
                <UserPlus className="h-4 w-4" />
                <span>{isSidebarExpanded ? 'Sign up' : ''}</span>
              </Link>
            </Button>
            <Button
              variant="secondary"
              size={isSidebarExpanded ? 'sm' : 'icon'}
              aria-label="Sign in"
            >
              <Link
                href="/sign-in"
                className={`flex flex-row items-center justify-center ${isSidebarExpanded ? 'space-x-2' : ''}`}
              >
                <LogIn className="h-4 w-4" />
                <span>{isSidebarExpanded ? 'Sign in' : ''}</span>
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
