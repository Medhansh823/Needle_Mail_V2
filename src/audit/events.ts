import type{ActionType,RiskLevel}from"../domain/types.ts";
export type AuditOutcome="proposed"|"approved"|"denied"|"executed"|"failed"|"rolled_back";
export interface AuditEvent{id:string;occurredAt:string;organizationId:string;userId:string;accountId?:string;emailId?:string;threadId?:string;action:ActionType;outcome:AuditOutcome;risk:RiskLevel;reason:string;confidence?:number;metadata?:Record<string,string|number|boolean|null>}
export interface AuditSink{append(event:AuditEvent):Promise<void>;list(input:{organizationId:string;limit:number}):Promise<AuditEvent[]>}
export class MemoryAuditSink implements AuditSink{private events:AuditEvent[]=[];async append(e:AuditEvent){this.events.push(e)}async list(i:{organizationId:string;limit:number}){return this.events.filter(e=>e.organizationId===i.organizationId).slice(-i.limit).reverse()}}
