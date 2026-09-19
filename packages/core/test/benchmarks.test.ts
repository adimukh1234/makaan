import { describe, expect, it } from 'vitest';
import { BENCHMARKS_VERSION, getBenchmark, isWearAndTear, listBenchmarks } from '../src/benchmarks';

describe('benchmarks', () => {
  it('marks wear and tear items as zero cost', () => {
    expect(isWearAndTear('minor_wall_scuff')).toBe(true);
    expect(getBenchmark('paint_fade_sunlight', 'bengaluru').highPaise).toBe(0);
    expect(getBenchmark('nail_holes', 'mumbai').lowPaise).toBe(0);
  });

  it('prices damage with a positive range', () => {
    const quote = getBenchmark('floor_tile_cracked', 'bengaluru');
    expect(quote.classification).toBe('DAMAGE');
    expect(quote.lowPaise).toBeGreaterThan(0);
    expect(quote.highPaise).toBeGreaterThan(quote.lowPaise);
    expect(quote.midPaise).toBeGreaterThanOrEqual(quote.lowPaise);
    expect(quote.midPaise).toBeLessThanOrEqual(quote.highPaise);
  });

  it('applies a higher city factor to a costlier city', () => {
    const bengaluru = getBenchmark('door_damage', 'bengaluru');
    const mumbai = getBenchmark('door_damage', 'mumbai');
    expect(mumbai.highPaise).toBeGreaterThan(bengaluru.highPaise);
  });

  it('falls back to factor one for an unknown city', () => {
    const unknown = getBenchmark('door_damage', 'atlantis');
    const bengaluru = getBenchmark('door_damage', 'bengaluru');
    expect(unknown.highPaise).toBe(bengaluru.highPaise);
  });

  it('carries a version and a source', () => {
    const quote = getBenchmark('exhaust_fan_broken', 'chennai');
    expect(quote.version).toBe(BENCHMARKS_VERSION);
    expect(quote.source.length).toBeGreaterThan(0);
  });

  it('throws for an unknown key', () => {
    // @ts-expect-error testing an invalid key at runtime
    expect(() => getBenchmark('does_not_exist', 'bengaluru')).toThrow();
  });

  it('lists every catalogue item', () => {
    const items = listBenchmarks();
    expect(items.length).toBeGreaterThanOrEqual(12);
    expect(items.filter((item) => item.classification === 'WEAR_AND_TEAR').length).toBeGreaterThan(
      0,
    );
    expect(items.filter((item) => item.classification === 'DAMAGE').length).toBeGreaterThan(0);
  });
});
