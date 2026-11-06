import type { TelemetryItem } from '@/lib/agent/telemetry';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelemetryDetailDrawer } from './telemetry-detail-drawer';

const mockItem: TelemetryItem = {
  id: 'intent-uuid-12345678',
  createdAt: '2026-11-06T12:00:00.000Z',
  prompt: 'Buy 5 Figma Pro licenses',
  itemDescription: 'Figma Enterprise Workspace Annual',
  merchantName: 'Figma Inc.',
  merchantCategory: 'software',
  amountCents: 45000,
  currency: 'USD',
  status: 'completed',
  paypalOrderId: 'ORDER-9999',
  paypalCaptureId: 'CAPTURE-8888',
  transactionStatus: 'COMPLETED',
  approvalRequestId: null,
  approvalStatus: null,
  ruleTriggered: null,
  triggerDetails: null,
  reasoningLog: [
    {
      step: 1,
      toolName: 'evaluatePolicy',
      thought: 'Evaluating budget limits for Figma Inc.',
      input: { amountCents: 45000, category: 'software' },
      output: { allowed: true },
      timestamp: '2026-11-06T12:00:01.000Z',
    },
  ],
  reasoningStepCount: 1,
  rawPaypalResponse: { id: 'CAPTURE-8888', status: 'COMPLETED' },
  rejectionReason: null,
};

describe('TelemetryDetailDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when item is null', () => {
    const { container } = render(
      <TelemetryDetailDrawer item={null} open={true} onOpenChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders header, description, and status badge when open', () => {
    render(
      <TelemetryDetailDrawer
        item={mockItem}
        open={true}
        onOpenChange={vi.fn()}
        currentIndex={2}
        totalCount={10}
      />,
    );

    expect(screen.getByText('Figma Enterprise Workspace Annual')).toBeInTheDocument();
    expect(screen.getByText(/Figma Inc\./)).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('2 of 10')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();
    expect(screen.getByText(/Buy 5 Figma Pro licenses/)).toBeInTheDocument();
  });

  it('handles row navigation previous and next clicks', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <TelemetryDetailDrawer
        item={mockItem}
        open={true}
        onOpenChange={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={true}
        hasNext={true}
        currentIndex={2}
        totalCount={5}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: /Previous transaction/i });
    const nextBtn = screen.getByRole('button', { name: /Next transaction/i });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPrevious).toHaveBeenCalledTimes(1);

    fireEvent.click(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables previous button when on first item and next when on last item', () => {
    render(
      <TelemetryDetailDrawer
        item={mockItem}
        open={true}
        onOpenChange={vi.fn()}
        hasPrevious={false}
        hasNext={false}
        currentIndex={1}
        totalCount={1}
      />,
    );

    const prevBtn = screen.getByRole('button', { name: /Previous transaction/i });
    const nextBtn = screen.getByRole('button', { name: /Next transaction/i });

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeDisabled();
  });

  it('navigates via arrow keys (Left and Right) and vim keys (k and j)', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <TelemetryDetailDrawer
        item={mockItem}
        open={true}
        onOpenChange={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={true}
        hasNext={true}
      />,
    );

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPrevious).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'k' });
    expect(onPrevious).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'j' });
    expect(onNext).toHaveBeenCalledTimes(2);

    // Verify ArrowUp and ArrowDown are not triggering drawer navigation
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(onPrevious).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('switches tabs to Reasoning Trace and Payloads & Ledger', async () => {
    const user = userEvent.setup();
    render(<TelemetryDetailDrawer item={mockItem} open={true} onOpenChange={vi.fn()} />);

    // Switch to Reasoning Trace tab
    const traceTab = screen.getByRole('tab', { name: /Reasoning Trace/i });
    await user.click(traceTab);

    expect(await screen.findByText('evaluatePolicy')).toBeInTheDocument();
    expect(screen.getByText(/Evaluating budget limits for Figma Inc\./)).toBeInTheDocument();

    // Switch to Payloads tab
    const payloadsTab = screen.getByRole('tab', { name: /Payloads & Ledger/i });
    await user.click(payloadsTab);

    expect(await screen.findByText(/PayPal Gateway API Response/i)).toBeInTheDocument();
    expect(screen.getByText(/Export Complete Audit Record/i)).toBeInTheDocument();
  });

  it('renders rejection reason when item is rejected', () => {
    const rejectedItem: TelemetryItem = {
      ...mockItem,
      status: 'rejected',
      rejectionReason: 'Exceeded daily limit of $100.00',
    };

    render(<TelemetryDetailDrawer item={rejectedItem} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Policy Violation & Rejection')).toBeInTheDocument();
    expect(screen.getByText('Exceeded daily limit of $100.00')).toBeInTheDocument();
  });

  it('renders success alert when item is completed', () => {
    render(<TelemetryDetailDrawer item={mockItem} open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Autonomous Execution Approved')).toBeInTheDocument();
    expect(
      screen.getByText(/All transaction criteria satisfied automated spending limit rules/),
    ).toBeInTheDocument();
  });

  it('renders copy prompt button and copyable order id chip', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<TelemetryDetailDrawer item={mockItem} open={true} onOpenChange={vi.fn()} />);

    const copyPromptBtn = screen.getByRole('button', { name: /Copy operator prompt/i });
    expect(copyPromptBtn).toBeInTheDocument();
    await user.click(copyPromptBtn);
    expect(writeTextSpy).toHaveBeenCalledWith('Buy 5 Figma Pro licenses');

    const copyOrderChip = screen.getByRole('button', { name: /Click to copy Order ID/i });
    expect(copyOrderChip).toBeInTheDocument();
    await user.click(copyOrderChip);
    expect(writeTextSpy).toHaveBeenCalledWith('ORDER-9999');

    writeTextSpy.mockRestore();
  });
});
