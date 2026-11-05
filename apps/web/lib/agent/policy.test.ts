// @vitest-environment node
import type { AgentPolicy } from '@workspace/db';
import { describe, expect, it } from 'vitest';
import { evaluateSpendingPolicy } from './policy';

const mockPolicy: AgentPolicy = {
  id: '00000000-0000-0000-0000-000000000001',
  agentId: '11111111-1111-1111-1111-111111111111',
  maxDailySpendCents: 10000, // $100.00
  singleTransactionLimitCents: 5000, // $50.00
  requireApprovalAboveCents: 2500, // $25.00
  allowedMerchantCategories: [],
  blockedMerchantCategories: ['gambling', 'adult_content', 'crypto_exchange'],
  currency: 'USD',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('evaluateSpendingPolicy', () => {
  it('auto-approves transactions below approval threshold within budget (AC-1)', () => {
    const result = evaluateSpendingPolicy({
      policy: mockPolicy,
      spentLast24HoursCents: 2000, // $20.00 already spent
      estimatedAmountCents: 1500, // $15.00 intent (< $25 threshold)
      merchantCategory: 'cloud_infrastructure',
    });

    expect(result.decision).toBe('auto_approve');
    expect(result.ruleTriggered).toBeUndefined();
    expect(result.spentLast24HoursCents).toBe(2000);
  });

  it('rejects transactions exceeding single transaction limit (AC-3)', () => {
    const result = evaluateSpendingPolicy({
      policy: mockPolicy,
      spentLast24HoursCents: 0,
      estimatedAmountCents: 5500, // $55.00 > $50.00 limit
      merchantCategory: 'digital_goods',
    });

    expect(result.decision).toBe('rejected');
    expect(result.ruleTriggered).toBe('single_limit_exceeded');
    expect(result.triggerDetails?.singleTransactionLimitCents).toBe(5000);
  });

  it('rejects transactions exceeding daily 24-hour spend cap (AC-2, AC-3)', () => {
    const result = evaluateSpendingPolicy({
      policy: mockPolicy,
      spentLast24HoursCents: 8500, // $85.00 already spent
      estimatedAmountCents: 2000, // $20.00 -> $105 total > $100 daily cap
      merchantCategory: 'software_licenses',
    });

    expect(result.decision).toBe('rejected');
    expect(result.ruleTriggered).toBe('daily_cap_exceeded');
    expect(result.triggerDetails?.projectedDailySpend).toBe(10500);
  });

  it('rejects transactions matching blocked merchant categories (AC-3)', () => {
    const result = evaluateSpendingPolicy({
      policy: mockPolicy,
      spentLast24HoursCents: 0,
      estimatedAmountCents: 1000,
      merchantCategory: 'gambling',
    });

    expect(result.decision).toBe('rejected');
    expect(result.ruleTriggered).toBe('blocked_category');
    expect(result.triggerDetails?.merchantCategory).toBe('gambling');
  });

  it('requires human approval when amount exceeds requireApprovalAboveCents (AC-4)', () => {
    const result = evaluateSpendingPolicy({
      policy: mockPolicy,
      spentLast24HoursCents: 1000,
      estimatedAmountCents: 3500, // $35.00 > $25.00 threshold, but < $50 single cap
      merchantCategory: 'cloud_infrastructure',
    });

    expect(result.decision).toBe('requires_approval');
    expect(result.ruleTriggered).toBe('require_approval_above_cents');
    expect(result.triggerDetails?.requireApprovalAboveCents).toBe(2500);
  });

  it('requires human approval when category is not in allowed list (AC-4)', () => {
    const policyWithAllowed: AgentPolicy = {
      ...mockPolicy,
      allowedMerchantCategories: ['cloud_infrastructure', 'developer_tools'],
    };

    const result = evaluateSpendingPolicy({
      policy: policyWithAllowed,
      spentLast24HoursCents: 0,
      estimatedAmountCents: 1000,
      merchantCategory: 'marketing_services',
    });

    expect(result.decision).toBe('requires_approval');
    expect(result.ruleTriggered).toBe('category_review_required');
  });
});
