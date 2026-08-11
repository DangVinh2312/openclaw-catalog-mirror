import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { defaultOutputPath, refreshCatalog } from './refresh.js';

const args = process.argv.slice(2);
if (args[0] !== 'refresh') {
  console.error('Usage: pnpm refresh -- [--url URL] [--output PATH]');
  process.exit(2);
}

const valueAfter = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const outputPath = path.resolve(valueAfter('--output') ?? defaultOutputPath());
await mkdir(path.dirname(outputPath), { recursive: true });
const result = await refreshCatalog({ url: valueAfter('--url') ?? process.env.UPSTREAM_CATALOG_URL, outputPath });
console.log(JSON.stringify({ changed: result.changed, catalogVersion: result.release.catalogVersion, outputPath: result.outputPath }));
