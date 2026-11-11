import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DecisionStream, rowsForTick } from './decision-stream';

function mockReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('rowsForTick', () => {
  it('shows four rows, newest first, and advances by one per tick', () => {
    expect(rowsForTick(0).map((r) => r.key)).toEqual(['3', '2', '1', '0']);
    expect(rowsForTick(1).map((r) => r.key)).toEqual(['4', '3', '2', '1']);
  });

  it('cycles through the scripted events', () => {
    const rows = rowsForTick(100);
    expect(rows).toHaveLength(4);
    rows.forEach((row) => expect(row.event.id).toMatch(/^evt-/));
  });
});

describe('DecisionStream', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('labels every outcome with text, not color alone', () => {
    mockReducedMotion(false);
    render(<DecisionStream />);
    const region = screen.getByRole('region', { name: 'Example policy decisions' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(4);
    expect(within(region).getByText('Needs approval')).toBeInTheDocument();
    expect(within(region).getByText('Blocked')).toBeInTheDocument();
    expect(within(region).getByText('$74.50')).toBeInTheDocument();
  });

  it('adds a new decision on each tick and stops when paused', async () => {
    mockReducedMotion(false);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<DecisionStream />);
    expect(screen.queryByText('Annual design tool seat')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(screen.getByText('Annual design tool seat')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveAttribute('aria-pressed', 'true');
    act(() => {
      vi.advanceTimersByTime(2600 * 3);
    });
    expect(screen.queryByText('Dataset license')).not.toBeInTheDocument();
  });

  it('stays static with no pause control when reduced motion is requested', () => {
    mockReducedMotion(true);
    render(<DecisionStream />);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2600 * 2);
    });
    expect(screen.queryByText('Annual design tool seat')).not.toBeInTheDocument();
  });
});
