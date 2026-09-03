/**
 * Finora AI Foundation — Postgres Bytea Wire Encoding/Decoding
 * Phase 11 — Security Core
 *
 * PostgreSQL hex format encodes binary data as \x<hex-string>.
 * Strict parser rejects missing \x prefix, odd-length hex, invalid characters, and incorrect lengths.
 */

import 'server-only';

import { AiError } from '../errors';

/**
 * Encodes a Node Buffer into PostgreSQL canonical hex bytea string (\x<lowercase-hex>).
 */
export function encodePostgresBytea(buf: Buffer): string {
  if (!Buffer.isBuffer(buf)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Expected Buffer for postgres bytea encoding.',
    });
  }
  return `\\x${buf.toString('hex').toLowerCase()}`;
}

/**
 * Decodes a PostgreSQL bytea hex string (\x...) into a Buffer.
 * Validates canonical prefix (\x), strictly lowercase hexadecimal characters,
 * even length, non-empty content, and expected length if specified.
 */
export function decodePostgresBytea(raw: string, expectedLength?: number): Buffer {
  if (typeof raw !== 'string') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea wire data must be a string.',
    });
  }

  // Canonical prefix is strictly \x. No uppercase \X or raw escapes allowed.
  if (!raw.startsWith('\\x')) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: "Postgres bytea wire data missing canonical '\\x' prefix.",
    });
  }

  const hexData = raw.slice(2);

  if (hexData.length === 0) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea hex data cannot be empty.',
    });
  }

  if (hexData.length % 2 !== 0) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea hex data has odd length.',
    });
  }

  // Strictly lowercase hex digits only (canonical format)
  if (!/^[0-9a-f]+$/.test(hexData)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea hex data contains non-canonical or non-hex characters.',
    });
  }

  const buf = Buffer.from(hexData, 'hex');

  if (expectedLength !== undefined && buf.length !== expectedLength) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: `Postgres bytea length mismatch: expected ${expectedLength} bytes, received ${buf.length} bytes.`,
    });
  }

  return buf;
}
