/**
 * Pure TypeScript implementation of standard DES (Data Encryption Standard)
 * in Electronic Codebook (ECB) mode with PKCS#5/PKCS#7 padding.
 *
 * Runs anywhere (Node, browsers, workers, test environments) without
 * OpenSSL legacy provider flags or external native libraries.
 */

// Initial Permutation (IP)
const IP = [
  58, 50, 42, 34, 26, 18, 10, 2,
  60, 52, 44, 36, 28, 20, 12, 4,
  62, 54, 46, 38, 30, 22, 14, 6,
  64, 56, 48, 40, 32, 24, 16, 8,
  57, 49, 41, 33, 25, 17, 9, 1,
  59, 51, 43, 35, 27, 19, 11, 3,
  61, 53, 45, 37, 29, 21, 13, 5,
  63, 55, 47, 39, 31, 23, 15, 7,
];

// Final Permutation (FP / Inverse IP)
const FP = [
  40, 8, 48, 16, 56, 24, 64, 32,
  39, 7, 47, 15, 55, 23, 63, 31,
  38, 6, 46, 14, 54, 22, 62, 30,
  37, 5, 45, 13, 53, 21, 61, 29,
  36, 4, 44, 12, 52, 20, 60, 28,
  35, 3, 43, 11, 51, 19, 59, 27,
  34, 2, 42, 10, 50, 18, 58, 26,
  33, 1, 41, 9, 49, 17, 57, 25,
];

// Permuted Choice 1 (PC-1)
const PC1 = [
  57, 49, 41, 33, 25, 17, 9,
  1, 58, 50, 42, 34, 26, 18,
  10, 2, 59, 51, 43, 35, 27,
  19, 11, 3, 60, 52, 44, 36,
  63, 55, 47, 39, 31, 23, 15,
  7, 62, 54, 46, 38, 30, 22,
  14, 6, 61, 53, 45, 37, 29,
  21, 13, 5, 28, 20, 12, 4,
];

// Permuted Choice 2 (PC-2)
const PC2 = [
  14, 17, 11, 24, 1, 5,
  3, 28, 15, 6, 21, 10,
  23, 19, 12, 4, 26, 8,
  16, 7, 27, 20, 13, 2,
  41, 52, 31, 37, 47, 55,
  30, 40, 51, 45, 33, 48,
  44, 49, 39, 56, 34, 53,
  46, 42, 50, 36, 29, 32,
];

// Key Schedule Shifts
const SHIFTS = [1, 1, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1];

// Expansion Table (E)
const E = [
  32, 1, 2, 3, 4, 5,
  4, 5, 6, 7, 8, 9,
  8, 9, 10, 11, 12, 13,
  12, 13, 14, 15, 16, 17,
  16, 17, 18, 19, 20, 21,
  20, 21, 22, 23, 24, 25,
  24, 25, 26, 27, 28, 29,
  28, 29, 30, 31, 32, 1,
];

// Permutation Table (P)
const P = [
  16, 7, 20, 21,
  29, 12, 28, 17,
  1, 15, 23, 26,
  5, 18, 31, 10,
  2, 8, 24, 14,
  32, 27, 3, 9,
  19, 13, 30, 6,
  22, 11, 4, 25,
];

// Substitution Boxes (S-Boxes)
const S_BOXES = [
  [
    [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7],
    [0, 15, 7, 4, 14, 2, 13, 1, 10, 6, 12, 11, 9, 5, 3, 8],
    [4, 1, 14, 8, 13, 6, 2, 11, 15, 12, 9, 7, 3, 10, 5, 0],
    [15, 12, 8, 2, 4, 9, 1, 7, 5, 11, 3, 14, 10, 0, 6, 13],
  ],
  [
    [15, 1, 8, 14, 6, 11, 3, 4, 9, 7, 2, 13, 12, 0, 5, 10],
    [3, 13, 4, 7, 15, 2, 8, 14, 12, 0, 1, 10, 6, 9, 11, 5],
    [0, 14, 7, 11, 10, 4, 13, 1, 5, 8, 12, 6, 9, 3, 2, 15],
    [13, 8, 10, 1, 3, 15, 4, 2, 11, 6, 7, 12, 0, 5, 14, 9],
  ],
  [
    [10, 0, 9, 14, 6, 3, 15, 5, 1, 13, 12, 7, 11, 4, 2, 8],
    [13, 7, 0, 9, 3, 4, 6, 10, 2, 8, 5, 14, 12, 11, 15, 1],
    [13, 6, 4, 9, 8, 15, 3, 0, 11, 1, 2, 12, 5, 10, 14, 7],
    [1, 10, 13, 0, 6, 9, 8, 7, 4, 15, 14, 3, 11, 5, 2, 12],
  ],
  [
    [7, 13, 14, 3, 0, 6, 9, 10, 1, 2, 8, 5, 11, 12, 4, 15],
    [13, 8, 11, 5, 6, 15, 0, 3, 4, 7, 2, 12, 1, 10, 14, 9],
    [10, 6, 9, 0, 12, 11, 7, 13, 15, 1, 3, 14, 5, 2, 8, 4],
    [3, 15, 0, 6, 10, 1, 13, 8, 9, 4, 5, 11, 12, 7, 2, 14],
  ],
  [
    [2, 12, 4, 1, 7, 10, 11, 6, 8, 5, 3, 15, 13, 0, 14, 9],
    [14, 11, 2, 12, 4, 7, 13, 1, 5, 0, 15, 10, 3, 9, 8, 6],
    [4, 2, 1, 11, 10, 13, 7, 8, 15, 9, 12, 5, 6, 3, 0, 14],
    [11, 8, 12, 7, 1, 14, 2, 13, 6, 15, 0, 9, 10, 4, 5, 3],
  ],
  [
    [12, 1, 10, 15, 9, 2, 6, 8, 0, 13, 3, 4, 14, 7, 5, 11],
    [10, 15, 4, 2, 7, 12, 9, 5, 6, 1, 13, 14, 0, 11, 3, 8],
    [9, 14, 15, 5, 2, 8, 12, 3, 7, 0, 4, 10, 1, 13, 11, 6],
    [4, 3, 2, 12, 9, 5, 15, 10, 11, 14, 1, 7, 6, 0, 8, 13],
  ],
  [
    [4, 11, 2, 14, 15, 0, 8, 13, 3, 12, 9, 7, 5, 10, 6, 1],
    [13, 0, 11, 7, 4, 9, 1, 10, 14, 3, 5, 12, 2, 15, 8, 6],
    [1, 4, 11, 13, 12, 3, 7, 14, 10, 15, 6, 8, 0, 5, 9, 2],
    [6, 11, 13, 8, 1, 4, 10, 7, 9, 5, 0, 15, 14, 2, 3, 12],
  ],
  [
    [13, 2, 8, 4, 6, 15, 11, 1, 10, 9, 3, 14, 5, 0, 12, 7],
    [1, 15, 13, 8, 10, 3, 7, 4, 12, 5, 6, 11, 0, 14, 9, 2],
    [7, 11, 4, 1, 9, 12, 14, 2, 0, 6, 10, 13, 15, 3, 5, 8],
    [2, 1, 14, 7, 4, 10, 8, 13, 15, 12, 9, 0, 3, 5, 6, 11],
  ],
];

function permute(src: number[], table: number[]): number[] {
  const out: number[] = new Array(table.length);
  for (let i = 0; i < table.length; i++) {
    out[i] = src[table[i]! - 1]!;
  }
  return out;
}

function leftShift(bits: number[], n: number): number[] {
  return bits.slice(n).concat(bits.slice(0, n));
}

function generateSubkeys(keyBits: number[]): number[][] {
  const pc1 = permute(keyBits, PC1);
  let c = pc1.slice(0, 28);
  let d = pc1.slice(28, 56);
  const subkeys: number[][] = [];
  for (let i = 0; i < 16; i++) {
    c = leftShift(c, SHIFTS[i]!);
    d = leftShift(d, SHIFTS[i]!);
    subkeys.push(permute(c.concat(d), PC2));
  }
  return subkeys;
}

function feistel(r: number[], subkey: number[]): number[] {
  const er = permute(r, E);
  const xored = er.map((b, i) => b ^ subkey[i]!);
  const sOutput: number[] = [];
  for (let i = 0; i < 8; i++) {
    const block = xored.slice(i * 6, (i + 1) * 6);
    const row = (block[0]! << 1) | block[5]!;
    const col = (block[1]! << 3) | (block[2]! << 2) | (block[3]! << 1) | block[4]!;
    const val = S_BOXES[i]![row]![col]!;
    sOutput.push((val >> 3) & 1, (val >> 2) & 1, (val >> 1) & 1, val & 1);
  }
  return permute(sOutput, P);
}

function decryptBlock(blockBits: number[], subkeys: number[][]): number[] {
  const ip = permute(blockBits, IP);
  let l = ip.slice(0, 32);
  let r = ip.slice(32, 64);
  for (let i = 15; i >= 0; i--) {
    const f = feistel(r, subkeys[i]!);
    const nextL = r;
    const nextR = l.map((b, idx) => b ^ f[idx]!);
    l = nextL;
    r = nextR;
  }
  return permute(r.concat(l), FP);
}

function bytesToBits(bytes: Uint8Array | number[]): number[] {
  const bits: number[] = new Array(bytes.length * 8);
  let cursor = 0;
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!;
    for (let j = 7; j >= 0; j--) {
      bits[cursor++] = (byte >> j) & 1;
    }
  }
  return bits;
}

function bitsToBytes(bits: number[]): Uint8Array {
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j]!;
    }
    bytes[i / 8] = byte;
  }
  return bytes;
}

/**
 * Decrypts a base64 encoded ciphertext using DES-ECB with a given 8-byte string key.
 * Removes standard PKCS#5/7 padding.
 */
export function decryptDesEcbBase64(base64Cipher: string, keyString: string): string {
  try {
    if (!base64Cipher.trim()) return '';

    // Decode base64 to bytes
    let binaryStr = '';
    if (typeof atob === 'function') {
      binaryStr = atob(base64Cipher);
    } else {
      const g = globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } };
      binaryStr = g.Buffer ? g.Buffer.from(base64Cipher, 'base64').toString('binary') : '';
    }
    const cipherBytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      cipherBytes[i] = binaryStr.charCodeAt(i);
    }

    if (cipherBytes.length === 0 || cipherBytes.length % 8 !== 0) {
      return '';
    }

    // Key bytes (UTF-8, 8 bytes)
    const keyBytes = new Uint8Array(8);
    for (let i = 0; i < 8 && i < keyString.length; i++) {
      keyBytes[i] = keyString.charCodeAt(i);
    }

    const subkeys = generateSubkeys(bytesToBits(keyBytes));
    const decryptedBytes: number[] = [];

    for (let i = 0; i < cipherBytes.length; i += 8) {
      const block = cipherBytes.slice(i, i + 8);
      const bits = bytesToBits(block);
      const decBits = decryptBlock(bits, subkeys);
      const blockBytes = bitsToBytes(decBits);
      for (let b = 0; b < blockBytes.length; b++) {
        decryptedBytes.push(blockBytes[b]!);
      }
    }

    // PKCS#5 unpadding
    const pad = decryptedBytes[decryptedBytes.length - 1];
    let unpadded = decryptedBytes;
    if (pad !== undefined && pad >= 1 && pad <= 8) {
      let valid = true;
      for (let i = decryptedBytes.length - pad; i < decryptedBytes.length; i++) {
        if (decryptedBytes[i] !== pad) {
          valid = false;
          break;
        }
      }
      if (valid) {
        unpadded = decryptedBytes.slice(0, decryptedBytes.length - pad);
      }
    }

    return new TextDecoder('utf-8').decode(new Uint8Array(unpadded)).trim();
  } catch (err) {
    console.warn('DES ECB decryption failed:', err);
    return '';
  }
}
