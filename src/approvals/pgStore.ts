import { Pool } from 'pg';
import type{ActionProposal,RiskLevel}from"../domain/types.ts";

export type ApprovalStatus="pending"|"approved"|"rejected"|"expired";

export interface ApprovalRequest{
  id:string;
  organizationId:string;
  userId:string;
  proposal:ActionProposal;
  risk:RiskLevel;
  status:ApprovalStatus;
  createdAt:string;
  expiresAt:string;
  decidedAt?:string;
  decidedBy?:string;
}

export interface ApprovalStore{
  create(r:ApprovalRequest):Promise<void>;
  get(id:string):Promise<ApprovalRequest|undefined>;
  decide(id:string,status:"approved"|"rejected",userId:string):Promise<ApprovalRequest>;
}

/**
 * PostgreSQL-backed ApprovalStore for production use
 * Provides persistent, multi-tenant approval storage
 */
export class PgApprovalStore implements ApprovalStore{
  constructor(private readonly pool:Pool){}
  
  async create(r:ApprovalRequest):Promise<void>{
    await this.pool.query(
      `INSERT INTO approval_requests 
       (id, organization_id, user_id, proposal, risk, status, created_at, expires_at, decided_at, decided_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.id,
        r.organizationId,
        r.userId,
        JSON.stringify(r.proposal),
        r.risk,
        r.status,
        r.createdAt,
        r.expiresAt,
        r.decidedAt ?? null,
        r.decidedBy ?? null
      ]
    );
  }
  
  async get(id:string):Promise<ApprovalRequest|undefined>{
    const res = await this.pool.query(
      `SELECT id, organization_id, user_id, proposal, risk, status, created_at, expires_at, decided_at, decided_by 
       FROM approval_requests WHERE id = $1`,
      [id]
    );
    
    if(res.rows.length === 0) return undefined;
    
    const row = res.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      proposal: JSON.parse(row.proposal),
      risk: row.risk as RiskLevel,
      status: row.status as ApprovalStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      decidedAt: row.decided_at ?? undefined,
      decidedBy: row.decided_by ?? undefined
    };
  }
  
  async decide(id:string,status:"approved"|"rejected",userId:string):Promise<ApprovalRequest>{
    const res = await this.pool.query(
      `UPDATE approval_requests 
       SET status = $2, decided_at = $3, decided_by = $4
       WHERE id = $1 AND status = 'pending'
       RETURNING id, organization_id, user_id, proposal, risk, status, created_at, expires_at, decided_at, decided_by`,
      [id, status, new Date().toISOString(), userId]
    );
    
    if(res.rows.length === 0){
      throw new Error("Approval not found or not pending");
    }
    
    const row = res.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      proposal: JSON.parse(row.proposal),
      risk: row.risk as RiskLevel,
      status: row.status as ApprovalStatus,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      decidedAt: row.decided_at ?? undefined,
      decidedBy: row.decided_by ?? undefined
    };
  }
}