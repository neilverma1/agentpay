import { ApiError, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
import { getOrdersController, isPayPalConfigured } from './client';

export function centsToCurrencyString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function currencyStringToCents(amountString: string): number {
  const parsed = parseFloat(amountString);
  if (isNaN(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

export function sanitizeDetails(details: unknown): Record<string, unknown> {
  if (!details) return {};
  if (typeof details !== 'object') return { info: String(details) };
  try {
    return JSON.parse(
      JSON.stringify(details, (_key, val) => {
        if (val instanceof Error) {
          return {
            name: val.name,
            message: val.message,
          };
        }
        return val;
      }),
    );
  } catch {
    return { message: String(details) };
  }
}

export function isSimulationMode(): boolean {
  if (process.env.PAYPAL_SIMULATION === 'true') {
    return true;
  }
  return !isPayPalConfigured() && process.env.NODE_ENV !== 'production';
}

export interface CreateOrderParams {
  purchaseIntentId: string;
  amountCents: number;
  currency?: string;
  itemDescription: string;
  merchantName: string;
}

export interface CreateOrderResult {
  orderId: string;
  rawResponse: Record<string, unknown>;
}

export interface CaptureOrderResult {
  captureId: string;
  status: string;
  capturedAmountCents: number;
  rawResponse: Record<string, unknown>;
}

export class PayPalServiceError extends Error {
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'PayPalServiceError';
    this.statusCode = statusCode;
    this.details = sanitizeDetails(details);
  }
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  if (isSimulationMode()) {
    const simulatedOrderId = `SIMULATED-ORDER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      orderId: simulatedOrderId,
      rawResponse: {
        id: simulatedOrderId,
        status: 'CREATED',
        mode: 'simulated_sandbox',
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: params.purchaseIntentId,
            description: params.itemDescription,
            amount: {
              currency_code: params.currency ?? 'USD',
              value: centsToCurrencyString(params.amountCents),
            },
          },
        ],
      },
    };
  }

  if (!isPayPalConfigured()) {
    throw new PayPalServiceError(
      'PayPal Sandbox credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local, or set PAYPAL_SIMULATION=true.',
      422,
      { code: 'MISSING_PAYPAL_CREDENTIALS' },
    );
  }

  const controller = getOrdersController();
  const currency = params.currency ?? 'USD';
  const amountValue = centsToCurrencyString(params.amountCents);

  try {
    const response = await controller.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            customId: params.purchaseIntentId,
            description: params.itemDescription,
            amount: {
              currencyCode: currency,
              value: amountValue,
            },
          },
        ],
      },
      prefer: 'return=representation',
    });

    const result = response.result;
    if (!result.id) {
      throw new PayPalServiceError(
        'PayPal order creation succeeded but no order identifier was returned.',
        502,
        result,
      );
    }

    return {
      orderId: result.id,
      rawResponse: sanitizeDetails(result),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal order creation failed: ${error.message || 'API error'}`,
        error.statusCode || 502,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) {
      throw error;
    }
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during order creation',
      500,
      error,
    );
  }
}

export async function capturePayPalOrder(orderId: string): Promise<CaptureOrderResult> {
  if (isSimulationMode() || orderId.startsWith('SIMULATED-ORDER-')) {
    const simulatedCaptureId = `SIMULATED-CAPTURE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return {
      captureId: simulatedCaptureId,
      status: 'COMPLETED',
      capturedAmountCents: 1000,
      rawResponse: {
        id: simulatedCaptureId,
        status: 'COMPLETED',
        mode: 'simulated_sandbox',
        order_id: orderId,
      },
    };
  }

  const controller = getOrdersController();

  try {
    const response = await controller.captureOrder({
      id: orderId,
      prefer: 'return=representation',
    });

    const result = response.result;
    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];

    if (!capture?.id) {
      throw new PayPalServiceError(
        'PayPal order capture completed without returning a capture identifier.',
        502,
        result,
      );
    }

    const capturedValue = capture.amount?.value ? currencyStringToCents(capture.amount.value) : 0;

    return {
      captureId: capture.id,
      status: capture.status || result.status || 'COMPLETED',
      capturedAmountCents: capturedValue,
      rawResponse: sanitizeDetails(result),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PayPalServiceError(
        `PayPal order capture failed: ${error.message || 'API error'}`,
        error.statusCode || 422,
        error.result ?? error.body,
      );
    }
    if (error instanceof PayPalServiceError) {
      throw error;
    }
    throw new PayPalServiceError(
      error instanceof Error ? error.message : 'Unknown PayPal error during order capture',
      500,
      error,
    );
  }
}
