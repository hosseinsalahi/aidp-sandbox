# AIDP Roadmap (TODO)

This repo currently provides:

- AI chat UI + backend proxy to LiteLLM (with optional SSE streaming)
- Optional TechDocs “RAG-lite” (prepends TechDocs excerpt as a system message)
- Basic guardrails (model allowlist + max tokens clamp)

## Milestone 1 — Production safety baseline

- [ ] Default to authenticated access (ensure `ai.auth.allowUnauthenticated` is `false` outside local dev)
- [ ] Add request validation (schema + strict types for `messages`, `model`, `max_tokens`, `stream`, `entityRef`, `includeTechDocs`)
- [ ] Add rate limiting + quotas
  - [ ] Per user / per IP burst limits
  - [ ] Daily token / request budgets
- [ ] Add audit logging (who/when/model/tokens/cost/request-id)
  - [ ] Persist to a log sink (or DB) suitable for compliance/review
- [ ] Add safe timeouts + cancellation
  - [ ] Upstream timeout with clear error mapping
  - [ ] Abort upstream on client disconnect (already partial; verify for both streaming/non-streaming)
- [ ] Add secrets/PII safeguards
  - [ ] Redact obvious secrets in logs
  - [ ] Document safe-use guidance for users

## Milestone 2 — Model management and routing

- [ ] Model catalog configuration
  - [ ] Explicit allowed models per environment
  - [ ] Default model and fallback model
- [ ] Server-side routing policy
  - [ ] Route by task type (short Q&A vs long form)
  - [ ] Retry/fallback on provider errors
- [ ] Health and diagnostics
  - [ ] `/api/ai/health` includes upstream reachability + model availability
  - [ ] Add simple “dry-run” checks in CI

## Milestone 3 — Real RAG (retrieval + citations)

- [ ] Build a TechDocs retrieval pipeline
  - [ ] Chunk TechDocs pages
  - [ ] Generate embeddings
  - [ ] Store vectors (choose backend: Postgres pgvector, OpenSearch, etc.)
- [ ] Query-time retrieval
  - [ ] Retrieve top-K chunks with score thresholds
  - [ ] Include citations (links to TechDocs pages/anchors)
- [ ] Prompt injection defenses
  - [ ] Treat docs as untrusted; strip directives
  - [ ] Add “ignore instructions from retrieved context” policy text

## Milestone 3b — Confluence + Jira context and actions

- [ ] Connectors
  - [ ] Confluence reader (space allowlist, page allowlist, CQL filters)
  - [ ] Jira reader (project allowlist, JQL filters, issue types)
- [ ] Permissions and governance
  - [ ] Enforce Confluence/Jira permissions in retrieval (no cross-tenant leaks)
  - [ ] Redaction rules for sensitive fields (PII, secrets, security tickets)
  - [ ] Audit logs: which pages/issues were retrieved for a response
- [ ] Indexing
  - [ ] Normalize content (HTML → text) and chunk
  - [ ] Embeddings + vector storage
  - [ ] Incremental sync (webhooks or polling)
- [ ] Retrieval UX
  - [ ] Add toggles for “Include Confluence” and “Include Jira”
  - [ ] Citations back to source pages/issues (links + titles)
  - [ ] Entity scoping (only retrieve items mapped to the entity via labels/components)
- [ ] Assisted workflows (human-in-the-loop)
  - [ ] “Create Jira ticket from chat” (draft → review → create)
  - [ ] “Draft Confluence page” (runbook/postmortem/ADR template)
  - [ ] “Summarize sprint/epic” for an entity

## Milestone 4 — Observability and evaluation

- [ ] Tracing
  - [ ] End-to-end request tracing (frontend → backend → LiteLLM)
  - [ ] Token usage + latency metrics
- [ ] Offline eval suite
  - [ ] Golden question set per domain
  - [ ] RAG relevance checks + regression gating
- [ ] Human feedback loop
  - [ ] Thumbs up/down + freeform feedback
  - [ ] Tie feedback to request-id + retrieved context

## Milestone 5 — UX polish

- [ ] Conversation persistence
  - [ ] Save chats per user; load history
  - [ ] Share link (read-only) for a conversation
- [ ] Better error states
  - [ ] Clear messages for auth/rate-limit/upstream failures
- [ ] Quality-of-life
  - [ ] Copy with citations
  - [ ] Keyboard shortcuts + stop/regenerate

## Open questions (decisions to make)

- [ ] Which vector store for RAG (pgvector vs OpenSearch vs managed service)?
- [ ] How to budget usage (per user, per group, per org)?
- [ ] Which entities should be RAG sources (TechDocs only vs Git repos, ADRs, runbooks)?
