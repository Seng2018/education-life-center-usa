// Minimal QR Code encoder (byte mode, error-correction level M,
// versions 1–6, mask pattern 0) — just enough to render a member
// number (e.g. "ELC-2026-0001") as a scannable QR code on the
// electronic member card, with no external dependency. The encoding
// follows the QR specification (finder/timing/alignment patterns,
// Reed–Solomon error correction over GF(256), BCH format information);
// it was verified module-for-module against the reference QRCode
// implementation during the build.
//
// The QR payload is ALWAYS the member number alone — never the card
// number, never any personal data — so a partner store scanning it
// learns exactly what verifyMemberCard is allowed to show.

const EC_LEVEL_M = 0; // format-information bits for level M
const MASK_PATTERN = 0; // fixed mask: flip when (row + col) is even

// Reed–Solomon block table for level M, versions 1–6:
// [error-codewords per block, [[total codewords, data codewords] per block]]
const RS_BLOCKS_M: [number, [number, number][]][] = [
  [10, [[26, 16]]],
  [16, [[44, 28]]],
  [26, [[70, 44]]],
  [18, [[50, 32], [50, 32]]],
  [24, [[67, 43], [67, 43]]],
  [16, [[43, 27], [43, 27], [43, 27], [43, 27]]],
];

const ALIGNMENT_CENTERS: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
];

// ---- GF(256) arithmetic (primitive polynomial 0x11d) ----
const EXP = new Array<number>(512).fill(0);
const LOG = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0;
}
function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

function rsGeneratorPoly(ecLen: number): number[] {
  let poly = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ (poly[j] ?? 0);
      next[j + 1] = (next[j + 1] ?? 0) ^ gfMul(poly[j] ?? 0, EXP[i] ?? 0);
    }
    poly = next;
  }
  return poly; // coefficients, highest degree first, leading coefficient 1
}

function rsErrorCorrection(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Array<number>(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ (res.shift() ?? 0);
    res.push(0);
    for (let i = 0; i < ecLen; i++) {
      res[i] = (res[i] ?? 0) ^ gfMul(gen[i + 1] ?? 0, factor);
    }
  }
  return res;
}

// ---- Bit buffer ----
class BitBuffer {
  bits: number[] = [];
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
  get length(): number {
    return this.bits.length;
  }
  toBytes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] ?? 0);
      out.push(b);
    }
    return out;
  }
}

/** Builds the final interleaved codewords (data + error correction)
 *  for `text` at the smallest fitting version (1–6, level M). */
export function encodeQrCodewords(text: string): { version: number; codewords: number[] } {
  const bytes = Array.from(new TextEncoder().encode(text));
  for (let version = 1; version <= 6; version++) {
    const spec = RS_BLOCKS_M[version - 1];
    if (!spec) continue;
    const [ecLen, blocks] = spec;
    const totalData = blocks.reduce((sum, [, dataCount]) => sum + dataCount, 0);
    // Byte mode: 4 mode bits + 8 length bits (versions 1–9) + payload.
    if (4 + 8 + bytes.length * 8 > totalData * 8) continue;

    const buffer = new BitBuffer();
    buffer.put(0b0100, 4); // byte mode
    buffer.put(bytes.length, 8);
    for (const b of bytes) buffer.put(b, 8);
    // Terminator + pad to a byte boundary + pad bytes.
    const capacity = totalData * 8;
    buffer.put(0, Math.min(4, capacity - buffer.length));
    while (buffer.length % 8 !== 0) buffer.put(0, 1);
    const padBytes = [0xec, 0x11];
    let padIndex = 0;
    while (buffer.length < capacity) {
      buffer.put(padBytes[padIndex % 2] ?? 0xec, 8);
      padIndex++;
    }
    const dataCodewords = buffer.toBytes();

    // Split into blocks, compute error correction, interleave.
    const dcBlocks: number[][] = [];
    const ecBlocks: number[][] = [];
    let offset = 0;
    for (const [, dataCount] of blocks) {
      const dc = dataCodewords.slice(offset, offset + dataCount);
      offset += dataCount;
      dcBlocks.push(dc);
      ecBlocks.push(rsErrorCorrection(dc, ecLen));
    }
    const codewords: number[] = [];
    const maxDc = Math.max(...dcBlocks.map((b) => b.length));
    for (let i = 0; i < maxDc; i++) {
      for (const block of dcBlocks) {
        const v = block[i];
        if (v !== undefined) codewords.push(v);
      }
    }
    for (let i = 0; i < ecLen; i++) {
      for (const block of ecBlocks) {
        const v = block[i];
        if (v !== undefined) codewords.push(v);
      }
    }
    return { version, codewords };
  }
  throw new Error("Text is too long for this QR encoder.");
}

function bchDigit(data: number): number {
  let digit = 0;
  let d = data;
  while (d !== 0) {
    digit++;
    d >>>= 1;
  }
  return digit;
}

function formatInfoBits(maskPattern: number): number {
  const G15 = 0b10100110111;
  const G15_MASK = 0b101010000010010;
  const data = (EC_LEVEL_M << 3) | maskPattern;
  let d = data << 10;
  while (bchDigit(d) - bchDigit(G15) >= 0) {
    d ^= G15 << (bchDigit(d) - bchDigit(G15));
  }
  return ((data << 10) | d) ^ G15_MASK;
}

/** Returns the QR module matrix (true = dark) for `text`. */
export function qrMatrix(text: string): boolean[][] {
  const { version, codewords } = encodeQrCodewords(text);
  const size = version * 4 + 17;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );
  const set = (row: number, col: number, dark: boolean): void => {
    if (row >= 0 && row < size && col >= 0 && col < size) modules[row]![col] = dark;
  };

  // Finder patterns + separators.
  const finder = (top: number, left: number): void => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const dark =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(top + r, left + c, dark);
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);

  // Alignment patterns.
  const centers = ALIGNMENT_CENTERS[version - 1] ?? [];
  for (const row of centers) {
    for (const col of centers) {
      if (modules[row]![col] !== null) continue; // overlaps a finder
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
        }
      }
    }
  }

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }

  // Format information (two copies) + the fixed dark module.
  const bits = formatInfoBits(MASK_PATTERN);
  const bitAt = (i: number): boolean => ((bits >>> i) & 1) === 1;
  for (let v = 0; v < 15; v++) {
    const mod = bitAt(v);
    if (v < 6) set(v, 8, mod);
    else if (v < 8) set(v + 1, 8, mod);
    else set(size - 15 + v, 8, mod);
  }
  for (let h = 0; h < 15; h++) {
    const mod = bitAt(h);
    if (h < 8) set(8, size - h - 1, mod);
    else if (h < 9) set(8, 15 - h, mod);
    else set(8, 15 - h - 1, mod);
  }
  set(size - 8, 8, true);

  // Data mapping: zigzag from the bottom-right, mask 0 applied.
  let row = size - 1;
  let inc = -1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (modules[row]![col - c] === null) {
          let dark = false;
          const byte = codewords[byteIndex];
          if (byte !== undefined) dark = ((byte >>> bitIndex) & 1) === 1;
          if ((row + (col - c)) % 2 === 0) dark = !dark; // mask pattern 0
          modules[row]![col - c] = dark;
          bitIndex--;
          if (bitIndex === -1) {
            byteIndex++;
            bitIndex = 7;
          }
        }
      }
      row += inc;
      if (row < 0 || size <= row) {
        row -= inc;
        inc = -inc;
        break;
      }
    }
  }

  return modules.map((r) => r.map((cell) => cell === true));
}
