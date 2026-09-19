/**
 * Identifier helpers. Ids are prefixed, URL safe and collision resistant.
 *
 * The format is `<prefix>_<26 lowercase base32 chars>`, for example
 * `ten_01j9z3m8qk7v2p4r6s8t0w1x2y`.
 */

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

export type IdPrefix =
  'usr' | 'prp' | 'ten' | 'ins' | 'evd' | 'fin' | 'stm' | 'dsp' | 'cns' | 'log' | 'ses';

let counter = 0;
const MAX_COUNTER = 32 ** 4;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && typeof globalCrypto.getRandomValues === 'function') {
    globalCrypto.getRandomValues(bytes);
    return bytes;
  }
  throw new Error('A secure random source is required to generate ids');
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function newId(prefix: IdPrefix): string {
  counter = (counter + 1) % MAX_COUNTER;
  const timePart = Date.now().toString(32).padStart(9, '0');
  const counterPart = counter.toString(32).padStart(4, '0');
  const randomPart = encodeBase32(randomBytes(8)).slice(0, 13);
  return `${prefix}_${timePart}${counterPart}${randomPart}`;
}

export function isId(value: string, prefix: IdPrefix): boolean {
  return new RegExp(`^${prefix}_[0-9a-z]{26}$`).test(value);
}
