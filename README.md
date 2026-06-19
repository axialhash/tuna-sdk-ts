# tuna-sdk

TypeScript SDK for [Tuna](https://txna.me) — Ethiopian receipt verification.

## Install

```bash
npm install tuna-sdk
# or from GitHub
npm install github:axialhash/tuna-sdk-ts
```

## Quick Start

```ts
import { Tuna } from 'tuna-sdk';

const tuna = new Tuna();

// Verify a CBE receipt
const result = await tuna.verify('CBETETAA', 'FT25211G11JQ', { account: '12345678' });
console.log(result.verified);    // true
console.log(result.receipt?.amount);  // "5000.00"

// Auto-detect from a URL
const urlResult = await tuna.verify('auto', 'https://apps.cbe.com.et/cbe-tx/...');

// Parse a receipt image
const parsed = await tuna.parseImage(fileInput);
console.log(parsed.bank, parsed.ref, parsed.amount);

// List supported banks
const banks = await tuna.info();
for (const bank of banks) {
  console.log(`${bank.name} — ${bank.status}`);
}

// Batch verify
const batch = await tuna.verifyBatch([
  { bank: 'CBETETAA', ref: 'FT25211G11JQ', extras: { account: '12345678' } },
  { bank: 'telebirr', ref: 'CHQ0FJ403O' },
]);
console.log(`${batch.verified}/${batch.total} verified`);
```

## Error Handling

```ts
import { Tuna, BankNotSupportedError, RefError, EndpointError } from 'tuna-sdk';

const tuna = new Tuna();

try {
  const result = await tuna.verify('XYZ', 'FT123');
} catch (e) {
  if (e instanceof BankNotSupportedError) {
    console.log(`Bank not supported: ${e.message}`);
    console.log(`Did you mean: ${e.suggestion}`);
  } else if (e instanceof RefError) {
    console.log(`Bad reference: ${e.message}`);
  } else if (e instanceof EndpointError) {
    console.log(`Bank endpoint down: ${e.message}`);
  }
}
```

## API Reference

### `new Tuna(options?)`

| Option | Default | Description |
|--------|---------|-------------|
| `baseUrl` | `https://api.txna.me` | API endpoint |
| `timeout` | `30000` | Request timeout in ms |
| `headers` | `{}` | Extra HTTP headers |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `verify(bank, ref, extras?)` | `Promise<VerifyResult>` | Verify a receipt |
| `verifyBatch(items)` | `Promise<BatchResult>` | Verify multiple receipts |
| `parseImage(file)` | `Promise<ParseResult>` | OCR + QR from image |
| `info()` | `Promise<BankInfo[]>` | List supported banks |
| `health()` | `Promise<HealthStatus>` | API health check |

### Types

- **`VerifyResult`** — `bank`, `verified`, `durationMs`, `receipt`
- **`Receipt`** — `bank`, `payerName`, `payerAccount`, `receiverName`, `receiverAccount`, `amount`, `currency`, `reference`, `status`, `paidAt`, `sourceUrl`
- **`BatchResult`** — `total`, `verified`, `failed`, `results`
- **`BatchItem`** — `bank`, `ref`, `extras?`
- **`ParseResult`** — `ocrText`, `qrContent`, `bank`, `ref`, `amount`, `account`, `extras`
- **`BankInfo`** — `id`, `name`, `type`, `status`, `requires`
- **`HealthStatus`** — `status`, `banks`

## Configuration

```typescript
// Custom API endpoint (e.g. self-hosted)
const tuna = new Tuna({ baseUrl: 'http://localhost:8765' });

// With API key (when auth is enabled)
const tuna = new Tuna({ apiKey: 'tuna_sk_your_key_here' });
```

## License

MIT
