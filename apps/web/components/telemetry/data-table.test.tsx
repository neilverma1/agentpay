import type { TelemetryItem } from '@/lib/agent/telemetry';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditDataTable } from './data-table';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
  usePathname: () => '/audit',
  useSearchParams: () => currentSearchParams,
}));

const mockItems: TelemetryItem[] = [
  {
    id: 'intent-uuid-1',
    createdAt: '2026-11-06T12:00:00.000Z',
    prompt: 'Buy Figma Pro',
    itemDescription: 'Figma Enterprise Workspace Annual',
    merchantName: 'Figma Inc.',
    merchantCategory: 'software',
    amountCents: 45000,
    currency: 'USD',
    status: 'completed',
    paypalOrderId: 'ORDER-1',
    paypalCaptureId: 'CAPTURE-1',
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
        input: { amountCents: 45000 },
        output: { allowed: true },
        timestamp: '2026-11-06T12:00:01.000Z',
      },
    ],
    reasoningStepCount: 1,
    rawPaypalResponse: { id: 'CAPTURE-1', status: 'COMPLETED' },
    rejectionReason: null,
  },
  {
    id: 'intent-uuid-2',
    createdAt: '2026-11-06T13:00:00.000Z',
    prompt: 'Buy AWS Cloud Compute',
    itemDescription: 'AWS EC2 Reserved Instance',
    merchantName: 'Amazon Web Services',
    merchantCategory: 'cloud_infrastructure',
    amountCents: 12000,
    currency: 'USD',
    status: 'completed',
    paypalOrderId: 'ORDER-2',
    paypalCaptureId: 'CAPTURE-2',
    transactionStatus: 'COMPLETED',
    approvalRequestId: null,
    approvalStatus: null,
    ruleTriggered: null,
    triggerDetails: null,
    reasoningLog: [],
    reasoningStepCount: 0,
    rawPaypalResponse: null,
    rejectionReason: null,
  },
];

describe('AuditDataTable URL Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
  });

  it('renders table headers and row items', () => {
    render(<AuditDataTable data={mockItems} />);

    expect(screen.getByText('Figma Inc.')).toBeInTheDocument();
    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByText('Figma Enterprise Workspace Annual')).toBeInTheDocument();
  });

  it('opens drawer and pushes id to URL when a row is clicked', async () => {
    const user = userEvent.setup();
    render(<AuditDataTable data={mockItems} />);

    const figmaRow = screen.getByText('Figma Inc.');
    await user.click(figmaRow);

    // Verifies router.push was called with the intent ID
    expect(pushMock).toHaveBeenCalledWith('/audit?id=intent-uuid-1', { scroll: false });

    // Drawer should now be visible with Figma item
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('switches tabs and updates tab param in URL using router.replace', async () => {
    const user = userEvent.setup();
    render(<AuditDataTable data={mockItems} />);

    // Click row to open drawer
    await user.click(screen.getByText('Figma Inc.'));

    // Switch to Reasoning Trace tab
    const traceTab = screen.getByRole('tab', { name: /Reasoning Trace/i });
    await user.click(traceTab);

    // Verifies router.replace was used so back button is not cluttered
    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('tab=trace'), {
      scroll: false,
    });
  });

  it('opens drawer automatically on initial load when URL contains id query param', () => {
    currentSearchParams = new URLSearchParams('id=intent-uuid-2');
    render(<AuditDataTable data={mockItems} />);

    // Drawer should automatically open with item 2 as title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AWS EC2 Reserved Instance' })).toBeInTheDocument();
  });

  it('navigates to next record and replaces id in URL', async () => {
    // Note: Table default sort is createdAt desc (newest first).
    // intent-uuid-2 is 13:00 (index 0), intent-uuid-1 is 12:00 (index 1).
    currentSearchParams = new URLSearchParams('id=intent-uuid-2');
    render(<AuditDataTable data={mockItems} />);

    const nextBtn = screen.getByRole('button', { name: /Next transaction/i });
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    expect(replaceMock).toHaveBeenCalledWith(expect.stringContaining('id=intent-uuid-1'), {
      scroll: false,
    });
  });

  it('cleans up query parameters on drawer close', async () => {
    const user = userEvent.setup();
    currentSearchParams = new URLSearchParams('id=intent-uuid-1&tab=trace');
    render(<AuditDataTable data={mockItems} />);

    // Close button (Close icon in Sheet)
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    await user.click(closeBtn);

    expect(replaceMock).toHaveBeenCalledWith('/audit', { scroll: false });
  });
});
