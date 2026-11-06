import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FreezeControl } from './freeze-control';

describe('FreezeControl Component (AC-5, AC-8)', () => {
  const onToggleFreeze = vi.fn();
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders active state with emergency freeze button when agent is active', () => {
    render(
      <FreezeControl
        agentId="agent-1"
        agentName="Autonomous Buyer Agent"
        isFrozen={false}
        isFetching={false}
        onRefresh={onRefresh}
        onToggleFreeze={onToggleFreeze}
        isToggling={false}
      />,
    );

    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    expect(screen.getByText('Emergency Freeze')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh telemetry/i })).toBeInTheDocument();
    expect(screen.queryByText('Emergency Wallet Freeze Active')).not.toBeInTheDocument();
  });

  it('renders prominent banner and unfreeze button when agent is frozen (AC-8)', () => {
    render(
      <FreezeControl
        agentId="agent-1"
        agentName="Autonomous Buyer Agent"
        isFrozen={true}
        isFetching={false}
        onRefresh={onRefresh}
        onToggleFreeze={onToggleFreeze}
        isToggling={false}
      />,
    );

    expect(screen.getByText('Wallet Frozen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wallet Frozen/i })).toBeDisabled();
    expect(screen.getByText('Emergency Wallet Freeze Active')).toBeInTheDocument();
    expect(
      screen.getByText(/All autonomous purchase intents and PayPal transactions are blocked/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unfreeze Wallet/i })).toBeInTheDocument();
  });

  it('prompts confirmation before executing emergency freeze', async () => {
    render(
      <FreezeControl
        agentId="agent-1"
        agentName="Autonomous Buyer Agent"
        isFrozen={false}
        isFetching={false}
        onRefresh={onRefresh}
        onToggleFreeze={onToggleFreeze}
        isToggling={false}
      />,
    );

    fireEvent.click(screen.getByText('Emergency Freeze'));

    expect(screen.getByText('Confirm Freeze')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Confirm Freeze'));
    expect(onToggleFreeze).toHaveBeenCalledWith('freeze', 'Operator emergency manual freeze');
  });

  it('triggers unfreeze directly when clicking unfreeze button (AC-5)', async () => {
    render(
      <FreezeControl
        agentId="agent-1"
        agentName="Autonomous Buyer Agent"
        isFrozen={true}
        isFetching={false}
        onRefresh={onRefresh}
        onToggleFreeze={onToggleFreeze}
        isToggling={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Unfreeze Wallet/i }));
    expect(onToggleFreeze).toHaveBeenCalledWith('unfreeze');
  });
});
