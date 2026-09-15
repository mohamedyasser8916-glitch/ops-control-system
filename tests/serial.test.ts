import { describe, it, expect } from 'vitest';
import { toSerialKey, toTidSerialKey } from '@/lib/serial';

describe('toSerialKey', () => {
  it('zero-pads a purely numeric serial to 10 digits (matches workbook helper column)', () => {
    // Confirmed against the real workbook: 821747085 -> "0821747085"
    expect(toSerialKey(821747085)).toBe('0821747085');
    expect(toSerialKey('821747085')).toBe('0821747085');
  });

  it('leaves an already-10-digit numeric string unchanged', () => {
    expect(toSerialKey('1850083230')).toBe('1850083230');
  });

  it('uppercases and trims a non-numeric serial without padding', () => {
    expect(toSerialKey('v9e0012100')).toBe('V9E0012100');
    expect(toSerialKey('  v9e0012100  ')).toBe('V9E0012100');
  });

  it('returns null for empty input', () => {
    expect(toSerialKey(null)).toBeNull();
    expect(toSerialKey(undefined)).toBeNull();
    expect(toSerialKey('')).toBeNull();
  });
});

describe('toTidSerialKey', () => {
  it('joins TID and normalized serial with a pipe — the ONLY valid Warehouse Cancel match key', () => {
    expect(toTidSerialKey('922416', 822239700)).toBe('922416|0822239700');
  });

  it('never matches on serial alone: two different TIDs with the same serial produce different keys', () => {
    const a = toTidSerialKey('111', 822239700);
    const b = toTidSerialKey('222', 822239700);
    expect(a).not.toBe(b);
  });
});
