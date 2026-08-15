# Embeddings

Voyage-only lifecycle and offline document-vector generation. The selected
four-day trial contract is `voyage-4`, 1024 dimensions, using the existing
DOC-01 `embedding_text` with `input_type=document`.

```sh
pnpm embeddings:generate --config packages/embedding/configs/voyage-4-trial-v1.json
pnpm embeddings:report
```

Use `--retry-failed` only for an explicit retry; it creates new attempt rows.
Neither command generates query vectors or performs semantic retrieval.
