import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64 } from '@scure/base';
import * as Crypto from 'expo-crypto';

/*
 * Every message between paired phones is encrypted and authenticated with the
 * family key (XChaCha20-Poly1305). The key is shared once, by scanning a QR code
 * on the other phone. A phone on the same Wi-Fi without the key can neither read
 * the data nor send fake rewards.
 */

// UTF-8 by hand: not every phone JavaScript engine has TextEncoder/TextDecoder
function utf8Encode(str: string): Uint8Array {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

function utf8Decode(b: Uint8Array): string {
  let out = '';
  let chunk: number[] = [];
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    chunk.push(c);
    if (chunk.length >= 4096) {
      out += String.fromCodePoint(...chunk);
      chunk = [];
    }
  }
  return out + String.fromCodePoint(...chunk);
}

export function newFamilyKey(): string {
  return base64.encode(Crypto.getRandomBytes(32));
}

// A public label for the family, safe to send in the clear. Lets a phone check
// "are you one of mine?" before any real data is exchanged.
export function familyIdFor(key: string): string {
  const digest = sha256(utf8Encode('clink-family:' + key));
  return Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function seal(key: string, value: unknown): { n: string; b: string } {
  const nonce = Crypto.getRandomBytes(24);
  const cipher = xchacha20poly1305(base64.decode(key), nonce);
  const box = cipher.encrypt(utf8Encode(JSON.stringify(value)));
  return { n: base64.encode(nonce), b: base64.encode(box) };
}

// Throws if the message was not sealed with this key or has been tampered with
export function open<T>(key: string, msg: { n: string; b: string }): T {
  const cipher = xchacha20poly1305(base64.decode(key), base64.decode(msg.n));
  const plain = cipher.decrypt(base64.decode(msg.b));
  return JSON.parse(utf8Decode(plain)) as T;
}
