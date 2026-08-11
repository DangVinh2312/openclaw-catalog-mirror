import { describe, expect, it } from 'vitest';
import { normalizeCatalog } from './normalize.js';

const base = {
  minVersion: '2026.7.0',
  sourceCommit: 'abc123',
  providers: {
    openai: {
      models: [
        { id: 'gpt-5', name: 'GPT-5', input: ['text', 'image'], contextWindow: 128000, maxTokens: 16000, cost: { input: 1, output: 2 } },
        { id: 'old', status: 'deprecated', replacedBy: 'gpt-5', input: ['text'] },
      ],
    },
  },
};

describe('normalizeCatalog', () => {
  it('normalizes providers/models and preserves only approved metadata', () => {
    const release = normalizeCatalog({ ...base, secret: 'must-not-appear' }, 'https://example.test/catalog.json', new Date('2026-08-11T00:00:00.000Z'));
    expect(release.providers[0]).toMatchObject({ id: 'openai', displayName: 'openai', status: 'active' });
    expect(release.providers[0].models).toEqual([
      expect.objectContaining({ id: 'gpt-5', displayName: 'GPT-5', input: ['text', 'image'], contextWindow: 128000 }),
      expect.objectContaining({ id: 'old', status: 'deprecated', replacedBy: 'gpt-5' }),
    ]);
    expect(JSON.stringify(release)).not.toContain('secret');
  });

  it('fails closed when required upstream fields are missing', () => {
    expect(() => normalizeCatalog({ providers: {} }, 'https://example.test/catalog.json')).toThrow(/minVersion/);
    expect(() => normalizeCatalog({ ...base, providers: { broken: {} } }, 'https://example.test/catalog.json')).toThrow(/models array/);
  });
});
