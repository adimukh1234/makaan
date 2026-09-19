import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { EvidenceStore, StoredObject } from './types';

export class LocalEvidenceStore implements EvidenceStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const full = resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + '/')) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<void> {
    const full = this.pathFor(key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const data = await readFile(this.pathFor(key));
      return { data, contentType: 'application/octet-stream' };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
