# NeedleMail Roadmap

## Foundation completed
- Typed email/action/permission domain
- ASK / AUTO / DENY permission engine
- Organization policy overrides
- Action risk classification
- Needle 2 runtime boundary
- Structured response planning and draft boundary
- Provider abstraction
- Mock provider
- Gmail REST provider for inbox, labels, archive, restore, read/unread, star, move, delete, drafts, reply and forward
- Approval request store and approval decision service
- Approval-aware execution orchestrator
- Action argument validation
- Prompt-injection detection layer
- Authenticated secret encryption helper
- OAuth PKCE state helpers
- Idempotency and rate-limit primitives
- PostgreSQL production schema
- Audit event abstraction
- Automation-rule primitive
- Security and core tests
- CI workflow
- Dashboard prototype

## Production completion
1. Wire the exact Needle 2 / cactus-needle runtime and structured-output adapter.
2. Build PostgreSQL repositories and migrations around `db/schema.sql`.
3. Implement secure server-side Google OAuth callback, token refresh and account lifecycle.
4. Add Gmail History API / watch push synchronization and incremental indexing.
5. Build authenticated web application and real API endpoints.
6. Build inbox search, thread view, AI summary, reply editor and approval center.
7. Build permission/rule UI with explainable "why this action was allowed" details.
8. Add background job queue, retries, deduplication and dead-letter handling.
9. Add robust model evaluation suite with adversarial email/prompt-injection fixtures.
10. Add organization/team roles, billing, usage quotas and observability.
11. Add data retention, export, disconnect and account deletion workflows.
12. Load-test the Gmail sync and AI pipeline before production launch.

## Non-negotiables
- Needle 2 remains the sole AI model.
- Model output never directly controls provider APIs.
- No email instruction can grant itself permission.
- Send/delete/forward are approval-first unless explicitly authorized by the user's current policy.
- Organization policy can always override user automation.
- OAuth credentials and refresh tokens never enter model context or browser code.
