import type { TelemetryItem } from '@/lib/agent/telemetry';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgGridAuditTable, StatusColumnFilter } from './ag-grid-table';

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

describe('AgGridAuditTable Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
  });

  it('renders AG Grid toolbar with search input and Export CSV button', () => {
    render(<AgGridAuditTable data={mockItems} />);

    expect(screen.getByPlaceholderText(/filter by merchant, item, prompt/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export csv/i })).toBeInTheDocument();
  });

  it('filters with quick search input and clears on reset', async () => {
    render(<AgGridAuditTable data={mockItems} />);
    const searchInput = screen.getByPlaceholderText(/filter by merchant, item, prompt/i);

    fireEvent.change(searchInput, { target: { value: 'Figma' } });
    expect(searchInput).toHaveValue('Figma');

    // Reset button should now be visible
    const resetButton = screen.getByRole('button', { name: /reset/i });
    expect(resetButton).toBeInTheDocument();

    fireEvent.click(resetButton);
    expect(searchInput).toHaveValue('');
  });

  it('renders responsive non-scrollable pagination bar with records and navigation', () => {
    render(<AgGridAuditTable data={mockItems} />);

    expect(screen.getByText(/showing \d+ of 2 records/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('renders StatusColumnFilter custom component with all status options and triggers onModelChange', async () => {
    const onModelChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StatusColumnFilter
        {...({
          model: null,
          onModelChange,
          onUiChange: vi.fn(),
          api: {},
          column: {},
          colDef: {},
          context: {},
          getValue: vi.fn(),
        } as unknown as Parameters<typeof StatusColumnFilter>[0])}
      />,
    );

    expect(screen.getByText(/filter by status/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all statuses/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /needs approval/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /failed \/ rejected/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /completed/i }));
    expect(onModelChange).toHaveBeenCalledWith('completed');

    await user.click(screen.getByRole('button', { name: /all statuses/i }));
    expect(onModelChange).toHaveBeenCalledWith(null);
  });
});
