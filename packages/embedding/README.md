# Embeddings

Voyage-only lifecycle and offline document-vector generation. The selected
four-day trial contract is `voyage-4`, 1024 dimensions, using the existing
DOC-01 `embedding_text` with `input_type=document`.

```sh
pnpm embeddings:generate --config packages/embedding/configs/voyage-4-trial-v1.json
pnpm embeddings:generate --config packages/embedding/configs/voyage-4-trial-v1.json --retry-rate-limited
pnpm embeddings:report
```

The offline generator batches up to 4,000 conservatively estimated input tokens,
uses one provider request at a time, and spaces calls by at least 31 seconds.
Use `--retry-rate-limited` to retry only documents whose latest compatible
failure is `PROVIDER_RATE_LIMIT`; each retry creates a new attempt row. Use
`--retry-failed` only for an explicit retry of other failure classes.
Neither command generates query vectors or performs semantic retrieval.
