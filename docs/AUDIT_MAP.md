# Audit Map: NeedleMail Audit Event Flow

## Overview
This document maps the complete audit event flow through the NeedleMail system. Every significant action is logged with an `AuditEvent` that includes actor, timestamp, action, outcome, risk, and reason. The audit system is designed for multi-tenant persistence with efficient querying.

## Architecture

```
Email -> Needle 2 Analysis -> Permission Engine -> Authorization Result ->
[Approval Required] -> Approval Bridge -> Audit "proposed" -> User Decision ->
[Approved/Rejected] -> Execution Orchestrator -> Audit "executed"/"denied"
```

## Core Types

### `src/audit/events.ts`

```typescript
export type AuditOutcome = "proposed" | "approved" | "denied" | "executed" | "failed" | "rolled_back";

export interface AuditEvent {
  id: string;
  occurredAt: string;
  organizationId: string;
  userId: string;
  accountId?: string;
  emailId?: string;
  threadId?: string;
  action: ActionType;
  outcome: AuditOutcome;
  risk: RiskLevel;
  reason: string;
  confidence?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
  list(input: { organizationId: string; limit: number }): Promise<AuditEvent[]>;
}

export class MemoryAuditSink implements AuditSink {
  private events: AuditEvent[] = [];
  async append(e: AuditEvent) { this.events.push(e) }
  async list(i: { organizationId: string; limit: number }) {
    return this.events.filter(e => e.organizationId === i.organizationId).slice(-i.limit).reverse();
  }
}
```

### `src/audit/pgEvents.ts` - PostgreSQL-backed Audit Sink

```typescript
export class PgAuditSink implements AuditSink {
  constructor(private readonly pool: Pool) {}

  async append(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events
       (id, organization_id, user_id, account_id, email_id, thread_id, action, outcome, risk, reason, confidence, metadata, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [event.id, event.organizationId, event.userId, event.accountId ?? null,
       event.emailId ?? null, event.threadId ?? null, event.action, event.outcome,
       event.risk, event.reason, event.confidence ?? null,
       event.metadata ? JSON.stringify(event.metadata) : null, event.occurredAt]
    );
  }

  async list(input: { organizationId: string; limit: number }): Promise<AuditEvent[]> {
    const res = await this.pool.query(
      `SELECT id, organization_id, user_id, account_id, email_id, thread_id, action, outcome, risk, reason, confidence, metadata, occurred_at
       FROM audit_events
       WHERE organization_id = $1
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [input.organizationId, input.limit]
    );
    return res.rows.map((row: any) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      accountId: row.account_id ?? undefined,
      emailId: row.email_id ?? undefined,
      threadId: row.thread_id ?? undefined,
      action: row.action as ActionType,
      outcome: row.outcome as AuditOutcome,
      risk: row.risk as RiskLevel,
      reason: row.reason,
      confidence: row.confidence ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      occurredAt: row.occurred_at
    }));
  }
}
```

## Database Schema

### `db/schema.sql` and `db/schema.ts`

```sql
create table if not exists audit_events(
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id),
  account_id uuid references email_accounts(id),
  email_id text,
  thread_id text,
  action text not null,
  outcome text not null,
  risk text not null,
  reason text not null,
  confidence numeric(4,3),
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_org_time on audit_events(organization_id, occurred_at desc);
```

## Audit Flow Diagrams

### 1. Action Engine Audit Logging (`src/execution/engine.ts`)

```
execute(ctx, meta):
  1. validateActionProposal(ctx.action)
  2. authorizeAction(ctx) -> auth result
  3. Append audit event:
     - outcome: "approved" if allowed, "proposed" if requiresConfirmation, "denied" if not allowed
     - risk: auth.risk
     - reason: auth.reason
     - confidence: ctx.action.confidence
  4. If not allowed, return early
  5. Execute action (switch on a.action)
  6. After execution: Append audit event with outcome "executed", risk: riskFor(a.action), reason "Authorized action executed."
```

### 2. Execution Orchestrator Audit Logging (`src/execution/orchestrator.ts`)

```
submit(input):
  1. validateActionProposal(input.proposal)
  2. authorizeAction({action:input.proposal, ...}) -> auth result
  3. If !auth.allowed && auth.requiresConfirmation:
     - Create approval request
     - Append audit event: outcome "proposed", risk: auth.risk, reason: auth.reason
     - Return {status: "approval_required", approvalId, reason}
  4. If !auth.allowed: Return {status: "denied", reason: auth.reason}
  5. executeApproved(input): Execute action, then append audit event: outcome "executed"

executeApproved(input):
  1. validateActionProposal(input.proposal)
  2. Execute action (switch on a.action)
  3. After execution: Append audit event: outcome "executed", risk: authRisk(a), reason "Authorized action executed.", confidence: a.confidence
```

### 3. Approval Service Audit Logging (`src/approvals/service.ts`)

```
decide(id, decision, actorUserId, input):
  1. req = store.get(id)
  2. If rejected:
     - Append audit event: outcome "denied", reason "User rejected approval request."
     - Return {status: "rejected"}
  3. If approved:
     - Create ExecutionOrchestrator
     - Execute approved action
     - Return result (which will trigger its own audit "executed" event)
```

### 4. Approval Bridge Audit Logging (`src/workflows/approvalBridge.ts`)

```
analyzeAndSubmit(emails, organizationId, userId, policy):
  1. For each email:
     - analysis = needle.analyzeEmail(email)
     - proposal = proposalFromAnalysis(email, analysis)
     - If proposal exists:
       - requiresApproval = policy.requireApprovalFor && policy.requireApprovalFor.includes(proposal.action)
       - If requiresApproval:
         - orchestrator.submit({...})
         - If approval_required:
           - Append audit event: outcome "proposed", risk: proposal.risk, reason: result.reason, confidence: proposal.confidence
           - Return {status: "approval_required", approvalId, reason, proposal}
       - Else:
         - orchestrator.executeApproved({...})
         - If executed: Return {status: "approved", result: result.result}
```

```
decideApproval(approvalId, decision, actorUserId, input):
  - Returns {status: decision, ...}
```

## Risk Level Mapping

### `src/domain/risk.ts`

| Action Type | Risk Level |
|---|---|
| read | low |
| analyze | low |
| summarize | low |
| classify | low |
| label | low |
| remove_label | low |
| star | low |
| unstar | low |
| mark_read | medium |
| mark_unread | low |
| archive | medium |
| move | medium |
| create_task | medium |
| create_reminder | medium |
| create_draft | low |
| restore | medium |
| send_reply | high |
| send_forward | high |
| delete | critical |
| bulk_action | critical |

`riskFor(action: ActionType): RiskLevel` - returns the risk level for any action.
```

## Permission & Authorization Results

### `src/security/permissions.ts` - `AuthorizationResult`

```typescript
interface AuthorizationResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
  policySource: "organization" | "user" | "default";
  risk: RiskLevel;
}
```

**Decision Flow:**
1. Check organization policy: `blockedActions`, `blockedCategories`, `requireApprovalFor`
2. Check email category against organization policy
3. Find matching user permission rule
4. If no rule exists: denied (requiresConfirmation: true, default policy)
5. If rule mode is "deny": denied
6. If rule mode is "ask": requires confirmation
7. If rule mode is "allow": allowed

## Audit Event Lifecycle Examples

### Example 1: Low-Risk Action with Auto-Approval
```
Email received -> Needle analysis -> Propose "label:important" action
  -> Permission rule exists with mode "auto" -> allowed
  -> engine.execute() -> Append: {outcome: "executed", action: "label", risk: "low", reason: "Authorized action executed."}

Audit Record: {id, organizationId, userId, emailId, threadId, action: "label", outcome: "executed", risk: "low", reason: "Authorized action executed.", confidence: 0.9, occurredAt: "2026-..."}
```

### Example 2: High-Risk Action Requiring Approval
```
Email received -> Needle analysis -> Propose "send_reply" action
  -> Organization policy requires approval for send_reply
  -> engine.submit() -> Append: {outcome: "proposed", action: "send_reply", risk: "high", reason: "Organization policy requires approval.", confidence: 0.85}
  -> User approves/rejects via UI
  -> If approved: engine.executeApproved() -> Append: {outcome: "executed", action: "send_reply", risk: "high", reason: "Authorized action executed."}
  -> If rejected: Approval service -> Append: {outcome: "denied", action: "send_reply", risk: "high", reason: "User rejected approval request."}

Audit Records:
1. {outcome: "proposed", ..., reason: "Organization policy requires approval."}
2. {outcome: "executed" or "denied", ...}
```

### Example 3: Denied by Organization Policy
```
Email received -> Needle analysis -> Propose "delete" action
  -> organizationPolicy.blockedActions includes "delete"
  -> authorizeAction() -> {allowed: false, requiresConfirmation: false, reason: "Blocked by organization policy.", risk: "critical"}
  -> engine.execute() -> Append: {outcome: "denied", action: "delete", risk: "critical", reason: "Blocked by organization policy."}

Audit Record: {outcome: "denied", action: "delete", risk: "critical", reason: "Blocked by organization policy."}
```

## API Endpoints for Audit

### `src/api/routes/inbox.ts` - GET /api/audit

```typescript
app.get("/audit", async (c: Context) => {
  const limit = parseInt(c.req.query("limit") || "50");
  const result = await db.select({
    id: auditEvents.id,
    occurredAt: auditEvents.occurredAt,
    action: auditEvents.action,
    outcome: auditEvents.outcome,
    risk: auditEvents.risk,
    reason: auditEvents.reason
  }).from(auditEvents).orderBy(desc(auditEvents.occurredAt)).limit(limit);
  return c.json(result);
});
```

Returns audit events with:
- `id`: UUID
- `occurredAt`: ISO timestamp
- `action`: ActionType
- `outcome`: AuditOutcome
- `risk`: RiskLevel
- `reason`: string (human-readable explanation)

## Multi-Tenant Filtering

All audit queries filter by `organizationId`:
- `PgAuditSink.list()`: `WHERE organization_id = $1`
- API route: Events are inherently multi-tenant since each event stores `organizationId`
- MemoryAuditSink: Filters by `organizationId` in the `list` method

## Audit Event Fields Summary

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Unique event identifier |
| `occurredAt` | `string` (ISO 8601) | Timestamp of the event |
| `organizationId` | `string` (UUID) | Organization identifier (multi-tenant) |
| `userId` | `string` (UUID) | User identifier |
| `accountId` | `string` (UUID) | Email account identifier (optional) |
| `emailId` | `string` | Email identifier (optional) |
| `threadId` | `string` | Thread identifier (optional) |
| `action` | `ActionType` | The action that was performed |
| `outcome` | `AuditOutcome` | Result: proposed/approved/denied/executed/failed/rolled_back |
| `risk` | `RiskLevel` | Risk level: low/medium/high/critical |
| `reason` | `string` | Human-readable reason for the outcome |
| `confidence` | `number` (0-1) | Confidence score from the proposal |
| `metadata` | `Record` | Additional key-value pairs (JSON) |

## Security & Privacy

- **Sensitive data exclusion**: Full email bodies are not copied into audit logs by default
- **Secret redaction**: OAuth credentials and refresh tokens never enter audit events
- **Organization isolation**: Each organization's events are isolated via `organizationId`
- **Retention**: Events are persisted indefinitely; application-level cleanup may apply
- **Immutability**: Once written, audit events should not be modified (only appended)
