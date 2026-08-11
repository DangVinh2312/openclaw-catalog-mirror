import { createHash } from 'node:crypto';

export interface UpstreamModel {
  id?: unknown;
  name?: unknown;
  status?: unknown;
  replacedBy?: unknown;
  input?: unknown;
  reasoning?: unknown;
  contextWindow?: unknown;
  maxTokens?: unknown;
  cost?: unknown;
}

export interface UpstreamProvider {
  models?: unknown;
}

export interface UpstreamCatalog {
  generatedAt?: unknown;
  minVersion?: unknown;
  schemaVersion?: unknown;
  sourceCommit?: unknown;
  providers?: unknown;
}

export interface CatalogRelease {
  schemaVersion: 1;
  catalogVersion: string;
  generatedAt: string;
  minRuntimeVersion: string;
  source: { url: string; commit: string; digest: string; verifiedAt: string };
  providers: Array<{
    id: string;
    displayName: string;
    status: 'active' | 'deprecated';
    models: Array<{
      id: string;
      displayName: string;
      status: 'active' | 'deprecated';
      replacedBy?: string;
      input: Array<'text' | 'image' | 'audio' | 'video'>;
      reasoning?: boolean;
      contextWindow?: number;
      maxTokens?: number;
      pricing?: Partial<Record<'input' | 'output' | 'cacheRead' | 'cacheWrite', number>>;
      provenance: { sourceCommit: string; providerId: string; modelId: string };
    }>;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Upstream catalog is missing ${name}`);
  return value;
}

function requiredObject(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Upstream catalog is missing ${name}`);
  return value;
}

function finitePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function safePricing(value: unknown): Partial<Record<'input' | 'output' | 'cacheRead' | 'cacheWrite', number>> | undefined {
  if (!isRecord(value)) return undefined;
  const output: Partial<Record<'input' | 'output' | 'cacheRead' | 'cacheWrite', number>> = {};
  for (const key of ['input', 'output', 'cacheRead', 'cacheWrite'] as const) {
    const amount = value[key];
    if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) output[key] = amount;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function safeInput(value: unknown): Array<'text' | 'image' | 'audio' | 'video'> {
  if (!Array.isArray(value)) return ['text'];
  return [...new Set(value.filter((item): item is 'text' | 'image' | 'audio' | 'video' =>
    item === 'text' || item === 'image' || item === 'audio' || item === 'video'))];
}

export function normalizedContentDigest(release: Omit<CatalogRelease, 'catalogVersion' | 'generatedAt' | 'source'>): string {
  return createHash('sha256').update(JSON.stringify(release)).digest('hex');
}

export function normalizeCatalog(raw: unknown, sourceUrl: string, fetchedAt = new Date()): CatalogRelease {
  const root = requiredObject(raw, 'root object') as UpstreamCatalog;
  const minVersion = requiredString(root.minVersion, 'minVersion');
  const sourceCommit = requiredString(root.sourceCommit, 'sourceCommit');
  const providers = requiredObject(root.providers, 'providers');
  const normalizedProviders: CatalogRelease['providers'] = [];

  for (const [providerId, value] of Object.entries(providers)) {
    const provider = requiredObject(value, `provider ${providerId}`) as UpstreamProvider;
    if (!Array.isArray(provider.models)) throw new Error(`Provider ${providerId} has no models array`);
    const models = provider.models.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== 'string' || candidate.id.length === 0) return [];
      const model = candidate as UpstreamModel;
      const modelId = candidate.id;
      const status = model.status === 'deprecated' ? 'deprecated' : 'active';
      const item: CatalogRelease['providers'][number]['models'][number] = {
        id: modelId,
        displayName: typeof model.name === 'string' && model.name.length > 0 ? model.name : modelId,
        status,
        input: safeInput(model.input),
        provenance: { sourceCommit, providerId, modelId },
      };
      if (typeof model.replacedBy === 'string' && model.replacedBy.length > 0) item.replacedBy = model.replacedBy;
      if (typeof model.reasoning === 'boolean') item.reasoning = model.reasoning;
      const contextWindow = finitePositiveInteger(model.contextWindow);
      const maxTokens = finitePositiveInteger(model.maxTokens);
      if (contextWindow !== undefined) item.contextWindow = contextWindow;
      if (maxTokens !== undefined) item.maxTokens = maxTokens;
      item.pricing = safePricing(model.cost);
      return [item];
    });
    if (models.length > 0) normalizedProviders.push({ id: providerId, displayName: providerId, status: 'active', models });
  }

  const content = { schemaVersion: 1 as const, minRuntimeVersion: minVersion, providers: normalizedProviders };
  const digest = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const upstreamDigest = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
  return {
    ...content,
    catalogVersion: `sha256-${digest}`,
    generatedAt: fetchedAt.toISOString(),
    source: { url: sourceUrl, commit: sourceCommit, digest: `sha256-${upstreamDigest}`, verifiedAt: fetchedAt.toISOString() },
  };
}
