function rotateLeft32(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function normalizeSeedHex(seedHex: string): string {
  const trimmed = seedHex
    .trim()
    .toLowerCase()
    .replace(/[^a-f0-9]/g, '');
  if (trimmed.length === 0) {
    return '1'.padStart(64, '0');
  }

  if (trimmed.length >= 64) {
    return trimmed.slice(0, 64);
  }

  return trimmed.padEnd(64, trimmed);
}

function seedWords(seedHex: string): [number, number, number, number] {
  const normalized = normalizeSeedHex(seedHex);
  const words: [number, number, number, number] = [0, 0, 0, 0];

  for (let index = 0; index < 4; index += 1) {
    const chunk = normalized.slice(index * 8, index * 8 + 8);
    words[index] = Number.parseInt(chunk, 16) >>> 0;
  }

  if ((words[0] | words[1] | words[2] | words[3]) === 0) {
    words[0] = 1;
  }

  return words;
}

export interface DeterministicPrng {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  nextDie(sides?: number): number;
  shuffleInPlace<T>(items: T[]): T[];
}

export function createDeterministicPrng(seedHex: string): DeterministicPrng {
  const state = seedWords(seedHex);

  function nextUint32(): number {
    const result = Math.imul(rotateLeft32(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (state[1] << 9) >>> 0;

    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = rotateLeft32(state[3], 11);

    return result >>> 0;
  }

  function nextFloat(): number {
    return nextUint32() / 2 ** 32;
  }

  function nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error('maxExclusive must be a positive integer');
    }

    return Math.floor(nextFloat() * maxExclusive);
  }

  function nextDie(sides = 6): number {
    if (!Number.isInteger(sides) || sides <= 0) {
      throw new Error('sides must be a positive integer');
    }

    return nextInt(sides) + 1;
  }

  function shuffleInPlace<T>(items: T[]): T[] {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = nextInt(index + 1);
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }

  return {
    nextUint32,
    nextFloat,
    nextInt,
    nextDie,
    shuffleInPlace
  };
}
