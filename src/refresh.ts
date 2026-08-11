import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import * as formatsModule from 'ajv-formats';
import schema from '../catalog.schema.json' with { type: 'json' };
import { normalizeCatalog, type CatalogRelease } from './normalize.js';

const DEFAULT_UPSTREAM_URL = 'https://catalog.openclaw.ai/models/v1/catalog.json';
const ajv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = ((formatsModule as { default?: unknown }).default ?? formatsModule) as (instance: Ajv2020) => void;
addFormats(ajv);
const validate = ajv.compile<CatalogRelease>(schema);

export interface RefreshResult {
  changed: boolean;
  release: CatalogRelease;
  outputPath: string;
}

export async function fetchUpstream(url: string, fetchImpl = fetch): Promise<unknown> {
  const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Upstream catalog returned HTTP ${response.status}`);
  return response.json();
}

export async function refreshCatalog({
  url = DEFAULT_UPSTREAM_URL,
  outputPath,
  fetchImpl = fetch,
  now = new Date(),
}: { url?: string; outputPath: string; fetchImpl?: typeof fetch; now?: Date }): Promise<RefreshResult> {
  const raw = await fetchUpstream(url, fetchImpl);
  const release = normalizeCatalog(raw, url, now);
  if (!validate(release)) throw new Error(`Normalized catalog failed schema validation: ${ajv.errorsText(validate.errors)}`);

  let previous: CatalogRelease | undefined;
  try {
    previous = JSON.parse(await readFile(outputPath, 'utf8')) as CatalogRelease;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous?.catalogVersion === release.catalogVersion) return { changed: false, release: previous, outputPath };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(release, null, 2)}\n`, 'utf8');
  return { changed: true, release, outputPath };
}

export function defaultOutputPath(): string {
  return path.resolve(process.cwd(), 'models/v1/catalog.json');
}
