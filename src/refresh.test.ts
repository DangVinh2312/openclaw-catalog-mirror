import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { refreshCatalog } from './refresh.js';

const upstream = {
  minVersion: '2026.7.0',
  sourceCommit: 'abc123',
  providers: { openai: { models: [{ id: 'gpt-5', input: ['text'] }] } },
};

describe('refreshCatalog', () => {
  it('writes a release then reports unchanged content without rewriting it', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'catalog-mirror-'));
    const outputPath = path.join(directory, 'models', 'v1', 'catalog.json');
    const fetchImpl = async () => new Response(JSON.stringify(upstream), { status: 200 });
    const first = await refreshCatalog({ outputPath, fetchImpl, now: new Date('2026-08-11T00:00:00.000Z') });
    const firstContents = await readFile(outputPath, 'utf8');
    const second = await refreshCatalog({ outputPath, fetchImpl, now: new Date('2026-08-12T00:00:00.000Z') });
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(await readFile(outputPath, 'utf8')).toBe(firstContents);
  });

  it('fails closed for an unavailable or malformed upstream response', async () => {
    const outputPath = path.join(await mkdtemp(path.join(os.tmpdir(), 'catalog-mirror-')), 'catalog.json');
    await expect(refreshCatalog({ outputPath, fetchImpl: async () => new Response('bad', { status: 503 }) })).rejects.toThrow('HTTP 503');
    await expect(refreshCatalog({ outputPath, fetchImpl: async () => new Response('{}', { status: 200 }) })).rejects.toThrow(/minVersion/);
  });
});
