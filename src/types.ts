/** Tuna SDK types — typed interfaces for all API responses. */

export interface Receipt {
  bank: string;
  payerName: string | null;
  payerAccount: string | null;
  receiverName: string | null;
  receiverAccount: string | null;
  amount: string | null;
  currency: string;
  reference: string | null;
  status: string | null;
  paidAt: string | null;
  sourceUrl: string | null;
}

export interface VerifyResult {
  bank: string;
  verified: boolean;
  durationMs: number;
  receipt: Receipt | null;
}

export interface BatchItem {
  bank: string;
  ref: string;
  extras?: Record<string, string>;
}

export interface BatchResult {
  total: number;
  verified: number;
  failed: number;
  results: VerifyResult[];
}

export interface ParseResult {
  ocrText: string | null;
  qrContent: string | null;
  bank: string | null;
  ref: string | null;
  amount: string | null;
  account: string | null;
  extras: Record<string, unknown>;
}

export interface BankInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  requires: string[];
}

export interface HealthStatus {
  status: string;
  banks: string[];
}

export interface TunaOptions {
  baseUrl?: string;
  timeout?: number;
  headers?: Record<string, string>;
}
