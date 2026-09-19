/**
 * India repair benchmark catalogue, version 2026.09.1.
 *
 * Ranges are advisory. They are derived from published service rates and
 * market observation for a standard urban apartment, then adjusted by a city
 * factor. No single figure is a quote. The catalogue is versioned so every
 * audit can record which edition priced it.
 */

export const BENCHMARKS_VERSION = '2026.09.1';

export const SUPPORTED_CITIES = [
  'bengaluru',
  'mumbai',
  'delhi',
  'chennai',
  'pune',
  'hyderabad',
] as const;

export type City = (typeof SUPPORTED_CITIES)[number];

export const CITY_FACTORS: Record<City, number> = {
  bengaluru: 1.0,
  mumbai: 1.3,
  delhi: 1.12,
  chennai: 0.95,
  pune: 0.95,
  hyderabad: 0.9,
};

export type BenchmarkKey =
  | 'minor_wall_scuff'
  | 'paint_fade_sunlight'
  | 'nail_holes'
  | 'worn_floor_finish'
  | 'repaint_normal_wear'
  | 'switchboard_broken'
  | 'exhaust_fan_broken'
  | 'floor_tile_cracked'
  | 'kitchen_counter_burn'
  | 'marble_deep_stain'
  | 'door_damage'
  | 'window_glass_broken'
  | 'plumbing_leak_damage'
  | 'wall_dent_hole_large';

export interface BenchmarkItem {
  key: BenchmarkKey;
  label: string;
  classification: 'WEAR_AND_TEAR' | 'DAMAGE';
  unit: string;
  baseLowPaise: number;
  baseHighPaise: number;
  keywords: string[];
  source: string;
}

const WEAR_SOURCE = 'Model Tenancy Act 2021, Section 15(1): normal wear and tear is excluded.';
const MARKET_SOURCE = 'Aggregated urban service rates (2026), range not quote.';

export const BENCHMARKS: Record<BenchmarkKey, BenchmarkItem> = {
  minor_wall_scuff: {
    key: 'minor_wall_scuff',
    label: 'Minor wall scuffs and contact marks',
    classification: 'WEAR_AND_TEAR',
    unit: 'area',
    baseLowPaise: 0,
    baseHighPaise: 0,
    keywords: ['scuff', 'scrape', 'wall mark', 'skirting', 'baseboard', 'wall'],
    source: WEAR_SOURCE,
  },
  paint_fade_sunlight: {
    key: 'paint_fade_sunlight',
    label: 'Paint fading and discoloration from normal living',
    classification: 'WEAR_AND_TEAR',
    unit: 'area',
    baseLowPaise: 0,
    baseHighPaise: 0,
    keywords: [
      'fade',
      'fading',
      'discoloration',
      'discolour',
      'paint',
      'painting',
      'repaint',
      'whitewash',
      'white wash',
      'weathering',
    ],
    source: WEAR_SOURCE,
  },
  nail_holes: {
    key: 'nail_holes',
    label: 'Picture hook and nail holes from ordinary use',
    classification: 'WEAR_AND_TEAR',
    unit: 'area',
    baseLowPaise: 0,
    baseHighPaise: 0,
    keywords: ['nail', 'screw', 'picture hook', 'hook hole'],
    source: WEAR_SOURCE,
  },
  worn_floor_finish: {
    key: 'worn_floor_finish',
    label: 'Ordinary wear to floor finish',
    classification: 'WEAR_AND_TEAR',
    unit: 'area',
    baseLowPaise: 0,
    baseHighPaise: 0,
    keywords: ['worn floor', 'floor finish', 'dull floor', 'laminate wear'],
    source: WEAR_SOURCE,
  },
  repaint_normal_wear: {
    key: 'repaint_normal_wear',
    label: 'Repainting attributable to normal use',
    classification: 'WEAR_AND_TEAR',
    unit: 'area',
    baseLowPaise: 0,
    baseHighPaise: 0,
    keywords: ['repainting charge', 'painting charge', 'full painting', 'repaint full'],
    source: WEAR_SOURCE,
  },
  switchboard_broken: {
    key: 'switchboard_broken',
    label: 'Broken modular switchboard or socket',
    classification: 'DAMAGE',
    unit: 'unit',
    baseLowPaise: 30000,
    baseHighPaise: 70000,
    keywords: [
      'switch',
      'switchboard',
      'socket',
      'plug point',
      'electrical plate',
      'modular switch',
    ],
    source: MARKET_SOURCE,
  },
  exhaust_fan_broken: {
    key: 'exhaust_fan_broken',
    label: 'Bathroom or kitchen exhaust fan replacement',
    classification: 'DAMAGE',
    unit: 'unit',
    baseLowPaise: 90000,
    baseHighPaise: 160000,
    keywords: ['exhaust', 'exhaust fan', 'ventilation', 'blower', 'chimney'],
    source: MARKET_SOURCE,
  },
  floor_tile_cracked: {
    key: 'floor_tile_cracked',
    label: 'Cracked or broken floor tile replacement',
    classification: 'DAMAGE',
    unit: 'tile',
    baseLowPaise: 120000,
    baseHighPaise: 260000,
    keywords: ['tile', 'cracked tile', 'broken tile', 'vitrified', 'flooring'],
    source: MARKET_SOURCE,
  },
  kitchen_counter_burn: {
    key: 'kitchen_counter_burn',
    label: 'Burn or scorch damage to kitchen counter',
    classification: 'DAMAGE',
    unit: 'area',
    baseLowPaise: 180000,
    baseHighPaise: 420000,
    keywords: ['counter', 'granite top', 'kitchen top', 'burn', 'scorch', 'hob'],
    source: MARKET_SOURCE,
  },
  marble_deep_stain: {
    key: 'marble_deep_stain',
    label: 'Deep stain or chemical damage to marble',
    classification: 'DAMAGE',
    unit: 'area',
    baseLowPaise: 90000,
    baseHighPaise: 260000,
    keywords: ['marble', 'acid', 'oil stain', 'deep stain', 'marble polish'],
    source: MARKET_SOURCE,
  },
  door_damage: {
    key: 'door_damage',
    label: 'Door, shutter or frame damage',
    classification: 'DAMAGE',
    unit: 'unit',
    baseLowPaise: 150000,
    baseHighPaise: 520000,
    keywords: ['door', 'shutter', 'hinge', 'door handle', 'door frame', 'latch'],
    source: MARKET_SOURCE,
  },
  window_glass_broken: {
    key: 'window_glass_broken',
    label: 'Broken window glass or pane',
    classification: 'DAMAGE',
    unit: 'pane',
    baseLowPaise: 80000,
    baseHighPaise: 320000,
    keywords: ['window glass', 'broken glass', 'pane', 'glazing', 'sliding window'],
    source: MARKET_SOURCE,
  },
  plumbing_leak_damage: {
    key: 'plumbing_leak_damage',
    label: 'Tap, sanitaryware or plumbing damage',
    classification: 'DAMAGE',
    unit: 'fixture',
    baseLowPaise: 100000,
    baseHighPaise: 420000,
    keywords: [
      'tap',
      'faucet',
      'plumbing',
      'pipe',
      'leak',
      'water damage',
      'flush',
      'commode',
      'basin',
      'shower',
    ],
    source: MARKET_SOURCE,
  },
  wall_dent_hole_large: {
    key: 'wall_dent_hole_large',
    label: 'Large wall dent or hole beyond ordinary use',
    classification: 'DAMAGE',
    unit: 'area',
    baseLowPaise: 50000,
    baseHighPaise: 220000,
    keywords: ['dent', 'hole in wall', 'large hole', 'drill hole', 'crack in wall', 'wall crack'],
    source: MARKET_SOURCE,
  },
};

export interface BenchmarkQuote {
  key: BenchmarkKey;
  label: string;
  classification: 'WEAR_AND_TEAR' | 'DAMAGE';
  unit: string;
  city: string;
  lowPaise: number;
  highPaise: number;
  midPaise: number;
  source: string;
  version: string;
}

function cityFactor(city: string): number {
  const normalized = city.trim().toLowerCase() as City;
  return CITY_FACTORS[normalized] ?? 1.0;
}

function roundTo100(value: number): number {
  return Math.round(value / 100) * 100;
}

export function getBenchmark(key: BenchmarkKey, city: string): BenchmarkQuote {
  const item = BENCHMARKS[key];
  if (!item) {
    throw new Error(`Unknown benchmark key: ${key}`);
  }
  const factor = item.classification === 'DAMAGE' ? cityFactor(city) : 1;
  const lowPaise = roundTo100(item.baseLowPaise * factor);
  const highPaise = roundTo100(item.baseHighPaise * factor);
  return {
    key: item.key,
    label: item.label,
    classification: item.classification,
    unit: item.unit,
    city: city.trim().toLowerCase(),
    lowPaise,
    highPaise,
    midPaise: roundTo100((lowPaise + highPaise) / 2),
    source: item.source,
    version: BENCHMARKS_VERSION,
  };
}

export function isWearAndTear(key: BenchmarkKey): boolean {
  return BENCHMARKS[key].classification === 'WEAR_AND_TEAR';
}

export function listBenchmarks(): BenchmarkItem[] {
  return Object.values(BENCHMARKS);
}

export function allBenchmarkKeys(): BenchmarkKey[] {
  return Object.keys(BENCHMARKS) as BenchmarkKey[];
}
