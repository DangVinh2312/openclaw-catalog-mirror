# OpenClaw Catalog Mirror

Versioned, validated, self-hosted OpenClaw model catalog mirror.

The refresh job consumes the official OpenClaw catalog, keeps only the bounded provider
and model metadata needed by downstream consumers, records source provenance and SHA-256
digests, and fails closed on malformed input. It does not copy credentials, endpoints,
headers, user configuration, or arbitrary upstream fields.

## Local commands

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm refresh -- --output models/v1/catalog.json
```

The scheduled workflow commits and publishes only changed normalized content. The release
asset is suitable for the OpenClaw `models.catalogRefresh.url` mirror configuration; the
raw branch path is also available at `models/v1/catalog.json`.
