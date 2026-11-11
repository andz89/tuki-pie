// HMAC-SHA-256 with Web Crypto, which both Chrome and Pie Launcher have.
// The pairing code is the key, and it never leaves either side.

const encoder = new TextEncoder();

const toHex = (bytes) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export function randomNonce() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export const isNonce = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

export async function sign(code, text) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(code),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return toHex(new Uint8Array(signature));
}

// Takes the same time however early the two differ.
export function sameText(first, second) {
  if (
    typeof first !== 'string' ||
    typeof second !== 'string' ||
    first.length !== second.length
  ) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}
