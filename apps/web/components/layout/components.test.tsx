import { AppSidebar, resetSidebarThreadsCache } from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthUserMock = vi.fn();
const useSidebarMock = vi.fn();

vi.mock('@/hooks/use-auth-user', () => ({
  useAuthUser: () => useAuthUserMock(),
}));

vi.mock('@/components/layout/nav-user', () => ({
  NavUser: () => <div>NavUser Mock</div>,
}));

vi.mock('@/components/ui/theme-switcher', () => ({
  __esModule: true,
  default: () => <div>Theme Switcher</div>,
}));

vi.mock('@/components/ui/logo', () => ({
  Logo: () => <div>Logo</div>,
}));

vi.mock('@/components/ui/theme-switch', () => ({
  __esModule: true,
  default: () => <div>Theme Switch</div>,
  ThemeSwitch: () => <div>Theme Switch</div>,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/config/site', () => ({
  config: {
    nav: [{ title: 'New Chat', href: '/chat', icon: () => <span>Icon</span> }],
  },
}));

vi.mock('@workspace/ui/components/sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarRail: () => <div>Rail</div>,
  SidebarTrigger: () => <button type="button">Trigger</button>,
  useSidebar: () => useSidebarMock(),
}));

describe('Layout Components (AppSidebar, Header)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('agentpay:sidebar:recents-open', 'true');
    resetSidebarThreadsCache();
    useSidebarMock.mockReturnValue({ state: 'expanded', isMobile: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        threads: [
          {
            id: 'thread-1',
            title: 'Order Anthropic API Credits',
            status: 'active',
          },
        ],
      }),
    }) as unknown as typeof fetch;
  });

  it('shows auth actions in sidebar when user is not authenticated', () => {
    useAuthUserMock.mockReturnValue({ isAuthenticated: false, isLoading: false, error: null });

    render(<AppSidebar />);

    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('NavUser Mock')).not.toBeInTheDocument();
  });

  it('renders skeleton only during initial active loading without errors', () => {
    useAuthUserMock.mockReturnValue({ isAuthenticated: false, isLoading: true, error: null });

    const { container } = render(<AppSidebar />);

    // Skeleton elements are present and buttons are not rendered
    expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByText('NavUser Mock')).not.toBeInTheDocument();
    expect(
      container.querySelector('footer [data-slot="skeleton"]') ||
        container.querySelector('footer .animate-pulse'),
    ).not.toBeNull();
  });

  it('renders sign up and sign in when session is not fetched correctly or returns error', () => {
    useAuthUserMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      error: { message: 'Failed to fetch session' },
    });

    render(<AppSidebar />);

    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('NavUser Mock')).not.toBeInTheDocument();
  });

  it('renders sign up and sign in even if isAuthLoading was true but an error exists', () => {
    useAuthUserMock.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      error: { message: 'Network connection failed' },
    });

    render(<AppSidebar />);

    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText('NavUser Mock')).not.toBeInTheDocument();
  });

  it('shows nav user when authenticated', () => {
    useAuthUserMock.mockReturnValue({ isAuthenticated: true, isLoading: false, error: null });

    render(<AppSidebar />);

    expect(screen.getByText('NavUser Mock')).toBeInTheDocument();
  });

  it('updates thread in place seamlessly when receiving threads-updated event without refetching', async () => {
    useAuthUserMock.mockReturnValue({ isAuthenticated: true, isLoading: false, error: null });

    render(<AppSidebar />);

    // Initial fetch completed
    await screen.findByText('Order Anthropic API Credits');

    // Clear fetch mock call counts
    (global.fetch as unknown as { mockClear: () => void }).mockClear();

    // Dispatch update event with granular details
    act(() => {
      window.dispatchEvent(
        new CustomEvent('agentpay:threads-updated', {
          detail: {
            action: 'update',
            threadId: 'thread-1',
            title: 'Updated Anthropic Order',
            status: 'completed',
          },
        }),
      );
    });

    // Title updated in-place immediately without triggering a full network refetch
    expect(screen.getByText('Updated Anthropic Order')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('adds and removes threads in place without showing loading skeleton', async () => {
    useAuthUserMock.mockReturnValue({ isAuthenticated: true, isLoading: false, error: null });

    const { container } = render(<AppSidebar />);
    await screen.findByText('Order Anthropic API Credits');

    (global.fetch as unknown as { mockClear: () => void }).mockClear();

    // Create thread
    act(() => {
      window.dispatchEvent(
        new CustomEvent('agentpay:threads-updated', {
          detail: {
            action: 'create',
            thread: {
              id: 'thread-2',
              title: 'Buy AWS Credits',
              status: 'active',
            },
          },
        }),
      );
    });

    expect(screen.getByText('Buy AWS Credits')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    // Delete thread
    act(() => {
      window.dispatchEvent(
        new CustomEvent('agentpay:threads-updated', {
          detail: {
            action: 'delete',
            threadId: 'thread-1',
          },
        }),
      );
    });

    expect(screen.queryByText('Order Anthropic API Credits')).not.toBeInTheDocument();
    expect(screen.getByText('Buy AWS Credits')).toBeInTheDocument();
    // No skeletons should be rendered in Recents during updates
    expect(container.querySelectorAll('.space-y-1 [data-slot="skeleton"]')).toHaveLength(0);
  });

  it('renders mobile header when sidebar says mobile', () => {
    render(<Header />);

    expect(screen.getByRole('banner')).toHaveClass('flex');
    expect(screen.getByText('Theme Switch')).toBeInTheDocument();
  });

  it('renders header on desktop state', () => {
    useSidebarMock.mockReturnValue({ state: 'expanded', isMobile: false });
    render(<Header />);

    expect(screen.getByRole('banner')).toHaveClass('flex');
    expect(screen.getByText('Theme Switch')).toBeInTheDocument();
  });
});
