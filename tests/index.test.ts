import { describe, it, expect } from 'vitest';
import {
  parseReceipt,
  parseVerifyResult,
  parseBatchResult,
} from '../src/index.js';
import type {
  VerifyResult,
  BatchResult,
  BankInfo,
  HealthStatus,
} from '../src/types.js';

// ── Receipt parsing ─────────────────────────────────────────────────────

describe('Receipt parsing', () => {
  it('parses new field names', () => {
    const raw = {
      bank: 'CBETETAA',
      payer_name: 'John',
      payer_account: '123',
      receiver_name: 'Shop',
      amount: '5000.00',
      reference: 'FT123',
      status: 'success',
      currency: 'ETB',
      paid_at: '2025-01-15',
    };
    const r = parseReceipt(raw);
    expect(r.bank).toBe('CBETETAA');
    expect(r.payerName).toBe('John');
    expect(r.amount).toBe('5000.00');
    expect(r.reference).toBe('FT123');
  });

  it('parses legacy field names', () => {
    const raw = { sender_name: 'Ali', sender_account: '123', merchant_name: 'Shop' };
    const r = parseReceipt(raw);
    expect(r.payerName).toBe('Ali');
    expect(r.payerAccount).toBe('123');
    expect(r.receiverName).toBe('Shop');
  });

  it('returns null for missing fields', () => {
    const r = parseReceipt({});
    expect(r.bank).toBe('');
    expect(r.payerName).toBeNull();
    expect(r.amount).toBeNull();
  });
});

// ── VerifyResult ────────────────────────────────────────────────────────

describe('VerifyResult parsing', () => {
  it('parses with receipt', () => {
    const data = {
      bank: 'CBETETAA',
      verified: true,
      duration_ms: 1200,
      receipt: { bank: 'CBETETAA', amount: '1000' },
    };
    const v = parseVerifyResult(data);
    expect(v.verified).toBe(true);
    expect(v.durationMs).toBe(1200);
    expect(v.receipt?.amount).toBe('1000');
  });

  it('handles null receipt', () => {
    const v = parseVerifyResult({ bank: 'CBETETAA', verified: false, duration_ms: 0 });
    expect(v.receipt).toBeNull();
  });
});

// ── BatchResult ─────────────────────────────────────────────────────────

describe('BatchResult parsing', () => {
  it('counts verified and failed', () => {
    const data = {
      results: [
        { bank: 'CBETETAA', verified: true },
        { bank: 'telebirr', verified: false },
        { bank: 'boa', verified: true },
      ],
    };
    const b = parseBatchResult(data);
    expect(b.total).toBe(3);
    expect(b.verified).toBe(2);
    expect(b.failed).toBe(1);
  });

  it('handles empty results', () => {
    const b = parseBatchResult({ results: [] });
    expect(b.total).toBe(0);
    expect(b.verified).toBe(0);
  });
});

// ── Error classes ───────────────────────────────────────────────────────

describe('Error classes', () => {
  it('BankNotSupportedError has suggestion', async () => {
    const { BankNotSupportedError } = await import('../src/index.js');
    const e = new BankNotSupportedError('Bank not found', 'XYZ', 'Did you mean CBETETAA?');
    expect(e.suggestion).toBe('Did you mean CBETETAA?');
    expect(e.statusCode).toBe(404);
    expect(e.bank).toBe('XYZ');
  });

  it('RefError has correct status', async () => {
    const { RefError } = await import('../src/index.js');
    const e = new RefError('Bad ref', 'CBE');
    expect(e.statusCode).toBe(400);
  });
});
