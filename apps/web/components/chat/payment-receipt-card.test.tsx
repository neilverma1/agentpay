import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentReceiptCard, cleanItemName } from './payment-receipt-card';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PaymentReceiptCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('cleans item name properly', () => {
    expect(cleanItemName('Purchase Logitech MX Master 3S for $99.99')).toBe(
      'Logitech MX Master 3S',
    );
    expect(cleanItemName('Order Keychron K2 Mechanical Keyboard for $79.99 USD')).toBe(
      'Keychron K2 Mechanical Keyboard',
    );
    expect(cleanItemName('Buy Anker Fast Charger')).toBe('Anker Fast Charger');
  });

  it('renders captured receipt card with policy compliant badge and request refund button for refundable items', () => {
    render(
      <PaymentReceiptCard
        details={{
          purchaseIntentId: 'intent-101',
          transactionId: 'tx-101',
          paypalCaptureId: 'CAP-LOGITECH-99',
          itemDescription: 'Logitech MX Master 3S',
          merchantName: 'BestBuy Electronics',
          merchantCategory: 'electronics',
          amountCents: 9999,
          currency: 'USD',
          refundable: true,
          status: 'completed',
        }}
      />,
    );

    expect(screen.getByText('Payment Settled & Captured')).toBeInTheDocument();
    expect(screen.getByText('Policy Compliant')).toBeInTheDocument();
    expect(screen.getByText('Logitech MX Master 3S')).toBeInTheDocument();
    expect(screen.getByText('BestBuy Electronics')).toBeInTheDocument();
    expect(screen.getByText('$99.99 USD')).toBeInTheDocument();
    expect(screen.getByText('Refund Eligible (14-Day)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request Refund/i })).toBeInTheDocument();
  });

  it('renders final sale badge and restricts refund button for non-refundable items', () => {
    render(
      <PaymentReceiptCard
        details={{
          purchaseIntentId: 'intent-102',
          transactionId: 'tx-102',
          paypalCaptureId: 'CAP-COFFEE-24',
          itemDescription: 'Blue Bottle Coffee Blend',
          merchantName: 'Blue Bottle Coffee',
          merchantCategory: 'digital_goods',
          amountCents: 2400,
          currency: 'USD',
          refundable: false,
          refundTerms: 'Perishable food consumable: non-refundable once shipped',
          status: 'completed',
        }}
      />,
    );

    expect(screen.getByText('Final Sale (Non-refundable)')).toBeInTheDocument();
    expect(screen.getByText(/Final Sale • Ineligible for refund/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Refund/i })).not.toBeInTheDocument();
  });

  it('renders refunded state with reversal banner and strikethrough amount when status is refunded', () => {
    render(
      <PaymentReceiptCard
        details={{
          purchaseIntentId: 'intent-103',
          transactionId: 'tx-103',
          paypalCaptureId: 'CAP-REFUNDED-88',
          itemDescription: 'Keychron K2 Mechanical Keyboard',
          merchantName: 'Keychron Official Store',
          amountCents: 7999,
          currency: 'USD',
          refundable: true,
          status: 'refunded',
          refundId: 'REFUND-888',
        }}
      />,
    );

    expect(screen.getByText('Payment Settled & Refunded')).toBeInTheDocument();
    expect(screen.getByText('Refunded via PayPal')).toBeInTheDocument();
    expect(screen.getByText('Captured Amount (Reversed)')).toBeInTheDocument();
    expect(screen.getByText('Net: $0.00 (Refunded)')).toBeInTheDocument();
    expect(screen.getByText(/restored to agent 24h spending ledger/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request Refund/i })).not.toBeInTheDocument();
  });

  it('handles refund button click and transitions into refunded state', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        refundId: 'REFUND-NEW-123',
        status: 'refunded',
        refundedAmountCents: 9999,
      }),
    } as Response);

    const onRefundSuccess = vi.fn();

    render(
      <PaymentReceiptCard
        details={{
          purchaseIntentId: 'intent-104',
          transactionId: 'tx-104',
          paypalCaptureId: 'CAP-CLICK-REFUND',
          itemDescription: 'Logitech MX Master 3S',
          amountCents: 9999,
          currency: 'USD',
          refundable: true,
          status: 'completed',
        }}
        onRefundSuccess={onRefundSuccess}
      />,
    );

    const refundBtn = screen.getByRole('button', { name: /Request Refund/i });
    fireEvent.click(refundBtn);

    await waitFor(() => {
      expect(screen.getByText('Payment Settled & Refunded')).toBeInTheDocument();
      expect(screen.getByText('Refunded via PayPal')).toBeInTheDocument();
      expect(onRefundSuccess).toHaveBeenCalledWith('REFUND-NEW-123');
    });
  });
});
