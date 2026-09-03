/**
 * Finora AI Foundation — Postgres Bytea Wire Encoding/Decoding
 * Phase 11 — Security Core
 *
 * PostgreSQL hex format encodes binary data as \x<hex-string>.
 * Strict parser rejects missing \x prefix, odd-length hex, invalid characters, and incorrect lengths.
 */

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
 * Validates canonical prefix, even length, valid hexadecimal characters, and expected length if specified.
 */
export function decodePostgresBytea(raw: string, expectedLength?: number): Buffer {
  if (typeof raw !== 'string') {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea wire data must be a string.',
    });
  }

  // Canonical prefix is \x. Handle single or double backslash.
  let hexData: string;
  if (raw.startsWith('\\x') || raw.startsWith('\\X')) {
    hexData = raw.slice(2);
  } else if (raw.startsWith('\x18')) {
    // Escaped binary artifact protection
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Invalid bytea prefix.',
    });
  } else {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: "Postgres bytea wire data missing '\\x' prefix.",
    });
  }

  if (hexData.length % 2 !== 0) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea hex data has odd length.',
    });
  }

  if (hexData.length > 0 && !/^[0-9a-fA-F]+$/.test(hexData)) {
    throw new AiError({
      code: 'AI_CREDENTIAL_CORRUPTED',
      message: 'Postgres bytea hex data contains non-hex characters.',
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
