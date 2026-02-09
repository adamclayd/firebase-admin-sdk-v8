/**
 * Firebase Admin SDK v8 - X.509 Certificate Parser
 * Parses X.509 certificates to extract public keys for JWT verification
 */

/**
 * Base64 decode helper
 */
function decodeBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * ASN.1 Element structure
 */
interface ASN1Element {
  byteLength: number;
  contents: Uint8Array;
  raw: Uint8Array;
}

/**
 * Parse a single ASN.1 element (DER encoding)
 */
function parseElement(bytes: Uint8Array): ASN1Element {
  let position = 0;

  // Parse Tag
  let tag = bytes[0] & 0x1f;
  position++;

  if (tag === 0x1f) {
    tag = 0;
    while (bytes[position] >= 0x80) {
      tag = tag * 128 + bytes[position] - 0x80;
      position++;
    }
    tag = tag * 128 + bytes[position] - 0x80;
    position++;
  }

  // Parse Length
  let length = 0;

  if (bytes[position] < 0x80) {
    // Short form
    length = bytes[position];
    position++;
  } else if (bytes[position] === 0x80) {
    // Indefinite form
    length = 0;
    while (bytes[position + length] !== 0 || bytes[position + length + 1] !== 0) {
      if (length > bytes.byteLength) {
        throw new TypeError('Invalid indefinite form length');
      }
      length++;
    }
    const byteLength = position + length + 2;
    return {
      byteLength,
      contents: bytes.subarray(position, position + length),
      raw: bytes.subarray(0, byteLength),
    };
  } else {
    // Long form
    const numberOfDigits = bytes[position] & 0x7f;
    position++;
    length = 0;
    for (let i = 0; i < numberOfDigits; i++) {
      length = length * 256 + bytes[position];
      position++;
    }
  }

  const byteLength = position + length;
  return {
    byteLength,
    contents: bytes.subarray(position, byteLength),
    raw: bytes.subarray(0, byteLength),
  };
}

/**
 * Parse ASN.1 sequence
 */
function getElement(seq: Uint8Array): ASN1Element[] {
  const result: ASN1Element[] = [];
  let next = 0;

  while (next < seq.length) {
    const nextPart = parseElement(seq.subarray(next));
    result.push(nextPart);
    next += nextPart.byteLength;
  }

  return result;
}

/**
 * Extract SubjectPublicKeyInfo (SPKI) from X.509 certificate
 */
async function spkiFromX509(buf: Uint8Array): Promise<CryptoKey> {
  // Parse certificate structure
  const tbsCertificate = getElement(
    getElement(parseElement(buf).contents)[0].contents
  );

  // Get SPKI (index depends on whether version field is present)
  const spki = tbsCertificate[tbsCertificate[0].raw[0] === 0xa0 ? 6 : 5].raw;

  return await crypto.subtle.importKey(
    'spki',
    spki as BufferSource,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    true,
    ['verify']
  );
}

/**
 * Import public key from X.509 certificate (PEM format)
 */
export async function importPublicKeyFromX509(pem: string): Promise<CryptoKey> {
  // Remove PEM headers and whitespace
  const base64 = pem.replace(/(?:-----(?:BEGIN|END) CERTIFICATE-----|\s)/g, '');
  
  // Decode base64 to binary
  const raw = decodeBase64(base64);
  
  // Extract and import SPKI
  return await spkiFromX509(raw);
}
