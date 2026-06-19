/**
 * Tuna SDK — TypeScript client for Ethiopian receipt verification.
 *
 * @example
 * ```ts
 * import { Tuna } from 'tuna-sdk';
 *
 * const tuna = new Tuna();
 * const result = await tuna.verify('CBETETAA', 'FT25211G11JQ', { account: '12345678' });
 * console.log(result.verified, result.receipt?.amount);
 * ```
 */

import type {
  BatchItem,
  BatchResult,
  BankInfo,
  HealthStatus,
  ParseResult,
  Receipt,
  TunaOptions,
  VerifyResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.txna.me';
const DEFAULT_TIMEOUT = 30_000;

// ── Errors ──────────────────────────────────────────────────────────────

export class TunaError extends Error {
  readonly bank?: string;
  readonly statusCode: number;

  constructor(message: string, bank?: string, statusCode = 500) {
    super(message);
    this.name = 'TunaError';
    this.bank = bank;
    this.statusCode = statusCode;
  }
}

export class BankNotSupportedError extends TunaError {
  readonly suggestion: string;

  constructor(message: string, bank = '', suggestion = '') {
    super(message, bank, 404);
    this.name = 'BankNotSupportedError';
    this.suggestion = suggestion;
  }
}

export class RefError extends TunaError {
  constructor(message: string, bank = '') {
    super(message, bank, 400);
    this.name = 'RefError';
  }
}

export class EndpointError extends TunaError {
  constructor(message: string, bank = '') {
    super(message, bank, 502);
    this.name = 'EndpointError';
  }
}

export class ExtractionError extends TunaError {
  constructor(message: string, bank = '') {
    super(message, bank, 422);
    this.name = 'ExtractionError';
  }
}

// ── Parsers ─────────────────────────────────────────────────────────────

export function parseReceipt(raw: Record<string, unknown>): Receipt {
  return {
    bank: (raw.bank as string) ?? '',
    payerName: (raw.payer_name as string) ?? (raw.sender_name as string) ?? null,
    payerAccount: (raw.payer_account as string) ?? (raw.sender_account as string) ?? null,
    receiverName: (raw.receiver_name as string) ?? (raw.merchant_name as string) ?? null,
    receiverAccount: (raw.receiver_account as string) ?? null,
    amount: (raw.amount as string) ?? null,
    currency: (raw.currency as string) ?? 'ETB',
    reference: (raw.reference as string) ?? (raw.ref as string) ?? null,
    status: (raw.status as string) ?? null,
    paidAt: (raw.paid_at as string) ?? (raw.date as string) ?? (raw.timestamp as string) ?? null,
    sourceUrl: (raw.source_url as string) ?? null,
  };
}

export function parseVerifyResult(data: Record<string, unknown>): VerifyResult {
  const receipt = data.receipt as Record<string, unknown> | null | undefined;
  return {
    bank: (data.bank as string) ?? '',
    verified: (data.verified as boolean) ?? false,
    durationMs: (data.duration_ms as number) ?? 0,
    receipt: receipt ? parseReceipt(receipt) : null,
  };
}

export function parseBatchResult(data: Record<string, unknown>): BatchResult {
  const results = ((data.results as Record<string, unknown>[]) ?? []).map(parseVerifyResult);
  return {
    total: results.length,
    verified: results.filter(r => r.verified).length,
    failed: results.filter(r => !r.verified).length,
    results,
  };
}

// ── Error handler ───────────────────────────────────────────────────────

async function handleError(response: Response): Promise<never> {
  let data: Record<string, unknown> = {};
  try {
    data = await response.json() as Record<string, unknown>;
  } catch { /* ignore */ }

  const message = (data.error as string)
    ?? ((data.detail as Record<string, unknown>)?.error as string)
    ?? 'Unknown error';
  const bank = (data.bank as string) ?? '';

  let suggestion = '';
  if (response.status === 404) {
    const lower = message.toLowerCase();
    const idx = lower.indexOf('did you mean');
    if (idx >= 0) suggestion = message.slice(idx);
  }

  switch (response.status) {
    case 404: throw new BankNotSupportedError(message, bank, suggestion);
    case 400: throw new RefError(message, bank);
    case 502: throw new EndpointError(message, bank);
    case 422: throw new ExtractionError(message, bank);
    default: throw new TunaError(message, bank, response.status);
  }
}

// ── Client ──────────────────────────────────────────────────────────────

export class Tuna {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;

  constructor(options: TunaOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.headers = options.headers ?? {};
  }

  /**
   * Verify a receipt.
   *
   * @param bank - Bank SWIFT code or wallet name (e.g., "CBETETAA", "telebirr").
   *               Use "auto" to auto-detect from the reference.
   * @param ref - Receipt reference number, transaction ID, or receipt URL.
   * @param extras - Bank-specific extras (e.g., `{ account: "12345678" }` for CBE FT refs).
   */
  async verify(bank: string, ref: string, extras?: Record<string, string>): Promise<VerifyResult> {
    const body: Record<string, unknown> = { bank, ref };
    if (extras) body.extras = extras;

    const response = await fetch(`${this.baseUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) await handleError(response);
    return parseVerifyResult(await response.json() as Record<string, unknown>);
  }

  /**
   * Verify multiple receipts in a single request.
   *
   * @param items - Array of `{ bank, ref, extras? }` objects.
   */
  async verifyBatch(items: BatchItem[]): Promise<BatchResult> {
    const response = await fetch(`${this.baseUrl}/verify/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify({ receipts: items }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) await handleError(response);
    return parseBatchResult(await response.json() as Record<string, unknown>);
  }

  /**
   * Parse a receipt image (OCR + QR detection).
   *
   * @param file - Image as Blob, File, Buffer, or Uint8Array.
   */
  async parseImage(file: Blob | File | ArrayBuffer | Uint8Array): Promise<ParseResult> {
    const formData = new FormData();
    let blob: Blob;
    if (file instanceof Blob || file instanceof File) {
      blob = file;
    } else if (file instanceof ArrayBuffer) {
      blob = new Blob([new Uint8Array(file)]);
    } else {
      blob = new Blob([new Uint8Array(file)]);
    }
    formData.append('file', blob);

    const response = await fetch(`${this.baseUrl}/parse-image`, {
      method: 'POST',
      headers: this.headers,
      body: formData,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) await handleError(response);
    const data = await response.json() as Record<string, unknown>;
    return {
      ocrText: (data.ocr_text as string) ?? null,
      qrContent: (data.qr_content as string) ?? null,
      bank: (data.bank as string) ?? null,
      ref: (data.ref as string) ?? null,
      amount: (data.amount as string) ?? null,
      account: (data.account as string) ?? null,
      extras: (data.extras as Record<string, unknown>) ?? {},
    };
  }

  /**
   * List all supported banks with metadata.
   */
  async info(): Promise<BankInfo[]> {
    const response = await fetch(`${this.baseUrl}/info`, {
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) await handleError(response);
    const data = await response.json() as Record<string, unknown>;
    const banks = (data.banks as Record<string, unknown>[]) ?? [];
    return banks.map(b => ({
      id: (b.id as string) ?? '',
      name: (b.name as string) ?? '',
      type: (b.type as string) ?? '',
      status: (b.status as string) ?? 'unknown',
      requires: (b.requires as string[]) ?? [],
    }));
  }

  /**
   * Check API health and supported bank IDs.
   */
  async health(): Promise<HealthStatus> {
    const response = await fetch(`${this.baseUrl}/health`, {
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) await handleError(response);
    const data = await response.json() as Record<string, unknown>;
    return {
      status: (data.status as string) ?? 'unknown',
      banks: (data.banks as string[]) ?? [],
    };
  }
}
