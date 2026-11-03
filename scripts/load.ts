import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawItem } from '../src/core/schema';
import type { AllowedPair } from '../src/core/validate';

export const BATCH_DIR = 'data/batches';
export const ZIPF_FILE = 'data/generated/zipf.json';

export interface LoadedItem extends RawItem {
  batch: string;
}

export function loadBatches(): LoadedItem[] {
  return readdirSync(BATCH_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((file) => {
      const items = JSON.parse(readFileSync(join(BATCH_DIR, file), 'utf8')) as RawItem[];
      return items.map((item) => ({ ...item, batch: file.replace('.json', '') }));
    });
}

export function loadAllowlist(): AllowedPair[] {
  return JSON.parse(readFileSync('data/dedupe-allow.json', 'utf8')) as AllowedPair[];
}

export function loadZipf(): Record<string, number> {
  return existsSync(ZIPF_FILE) ? JSON.parse(readFileSync(ZIPF_FILE, 'utf8')) : {};
}
