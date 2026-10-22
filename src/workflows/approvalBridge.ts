import type { Email, NeedleAnalysis, ActionProposal } from "../domain/types.ts";
import type { NeedleService } from "../ai/needle.ts";
import type { ExecutionOrchestrator } from "../execution/orchestrator.ts";
import type { AuditSink } from "../audit/events.ts";
import type { OrganizationPolicy } from "../domain/types.ts";
import { proposalFromAnalysis } from "./inbox.ts";

export type ApprovalBridgeResult =
    | { status: "approval_required"; approvalId: string; reason: string; proposal: ActionProposal }
    | { status: "approved"; result: unknown }
    | { status: "rejected"; reason: string };

export class ApprovalBridge {
    constructor(
        private readonly needle: NeedleService,
        private readonly orchestrator: ExecutionOrchestrator,
        private readonly audit: AuditSink
    ) { }

    async analyzeAndSubmit(emails: Email[], organizationId: string, userId: string, policy: OrganizationPolicy): Promise<ApprovalBridgeResult> {
        const items: { email: Email; analysis: NeedleAnalysis; injection: { detected: boolean; matches: string[] } }[] = [];

        for (const email of emails) {
            const analysis = await this.needle.analyzeEmail(email);
            items.push({
                email,
                analysis,
                injection: { detected: false, matches: [] }
            });
        }

        for (const item of items) {
            const proposal = proposalFromAnalysis(item.email, item.analysis);
            if (!proposal) continue;

            // Check if action requires approval based on policy
            const requiresApproval = policy.requireApprovalFor && policy.requireApprovalFor.includes(proposal.action);

            if (requiresApproval) {
                const result = await this.orchestrator.submit({
                    organizationId,
                    userId,
                    proposal,
                    email: item.email,
                    rules: [],
                    policy: { blockedActions: policy.blockedActions, blockedCategories: policy.blockedCategories, requireApprovalFor: policy.requireApprovalFor }
                });

                if (result.status === "approval_required") {
                    await this.audit.append({
                        id: crypto.randomUUID(),
                        occurredAt: new Date().toISOString(),
                        organizationId,
                        userId,
                        emailId: item.email.id,
                        threadId: item.email.threadId,
                        action: proposal.action,
                        outcome: "proposed",
                        risk: proposal.risk,
                        reason: result.reason,
                        confidence: proposal.confidence
                    });

                    return {
                        status: "approval_required",
                        approvalId: result.approvalId,
                        reason: result.reason,
                        proposal
                    };
                }
            } else {
                // Action doesn't require explicit approval, execute directly
                const result = await this.orchestrator.executeApproved({
                    organizationId,
                    userId,
                    proposal,
                    email: item.email,
                    rules: [],
                    policy: { blockedActions: policy.blockedActions, blockedCategories: policy.blockedCategories, requireApprovalFor: policy.requireApprovalFor }
                });

                if (result.status === "executed") {
                    return { status: "approved", result: result.result };
                }
            }
        }

        return { status: "approved", result: null };
    }

    async decideApproval(approvalId: string, decision: "approved" | "rejected", actorUserId: string, input: {
        organizationId: string;
        email?: any;
        rules: any[];
        policy: OrganizationPolicy;
    }): Promise<{ status: "approved" | "rejected"; result?: unknown }> {
        // In production, this would use the actual approval store to decide
        // For now, we'll just return the decision status
        return {
            status: decision,
            ...(decision === "approved" ? { result: {} as unknown } : {})
        };
    }
}
