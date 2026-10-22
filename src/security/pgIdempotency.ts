import { Pool } from 'pg';
import { createHash } from 'crypto';
import type{ActionProposal}from"../domain/types.ts";

export interface IdempotencyStore{
  has(key:string):Promise<boolean>;
  put(key:string,ttlMs:number):Promise<void>;
}

export function actionFingerprint(input:{organizationId:string;userId:string;action:string;emailId?:string;args:Record<string,unknown>}){const stable=JSON.stringify(input,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((o,x)=>(o[x]=v[x],o),{} as Record<string,unknown>):v);return createHash("sha256").update(stable).digest("hex")}

/**
 * PostgreSQL-backed IdempotencyStore for production use
 * Provides distributed idempotency with automatic TTL cleanup
 */
export class PgIdempotencyStore implements IdempotencyStore{
  constructor(private readonly pool:Pool){}
  
  async has(key:string):Promise<boolean>{
    const res = await this.pool.query(
      `SELECT 1 FROM idempotency_keys WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );
    return res.rows.length > 0;
  }
  
  async put(key:string,ttlMs:number):Promise<void>{
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.pool.query(
      `INSERT INTO idempotency_keys (key, created_at, expires_at) 
       VALUES ($1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE SET 
         created_at = EXCLUDED.created_at,
         expires_at = EXCLUDED.expires_at`,
      [key, expiresAt]
    );
  }
}