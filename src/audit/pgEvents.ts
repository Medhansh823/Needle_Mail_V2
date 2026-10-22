import { Pool } from 'pg';
import type{ActionType,RiskLevel}from"../domain/types.ts";

export type AuditOutcome="proposed"|"approved"|"denied"|"executed"|"failed"|"rolled_back";

export interface AuditEvent{
  id:string;
  occurredAt:string;
  organizationId:string;
  userId:string;
  accountId?:string;
  emailId?:string;
  threadId?:string;
  action:ActionType;
  outcome:AuditOutcome;
  risk:RiskLevel;
  reason:string;
  confidence?:number;
  metadata?:Record<string,string|number|boolean|null>;
}

export interface AuditSink{
  append(event:AuditEvent):Promise<void>;
  list(input:{organizationId:string;limit:number}):Promise<AuditEvent[]>;
}

/**
 * PostgreSQL-backed AuditSink for production use
 * Provides persistent, multi-tenant audit logging with efficient querying
 */
export class PgAuditSink implements AuditSink{
  constructor(private readonly pool:Pool){}
  
  async append(event:AuditEvent):Promise<void>{
    await this.pool.query(
      `INSERT INTO audit_events 
       (id, organization_id, user_id, account_id, email_id, thread_id, action, outcome, risk, reason, confidence, metadata, occurred_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        event.id,
        event.organizationId,
        event.userId,
        event.accountId ?? null,
        event.emailId ?? null,
        event.threadId ?? null,
        event.action,
        event.outcome,
        event.risk,
        event.reason,
        event.confidence ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.occurredAt
      ]
    );
  }
  
  async list(input:{organizationId:string;limit:number}):Promise<AuditEvent[]>{
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