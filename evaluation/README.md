# Versioned evaluation artifacts

EVAL-01 owns corpus identity, split allocation, judgments, dataset manifests, and invariant files.

`pnpm eval:validate-corpus` validates the immutable corpus, checksums, frozen allocation, language pairs, Active Taxonomy references, and scaffold pins. Ordinary tuning judgment access accepts only explicit `DEV`; `SEALED`, `ADVERSARIAL`, and `all` are rejected. EVAL-01 does not execute search or calculate metrics.
