import type { Email, NeedleAnalysis, ActionProposal, PermissionRule, OrganizationPolicy } from "../domain/types.ts";
import type { NeedleService } from "../ai/needle.ts";
import { detectPromptInjection } from "../security/prompt-injection.ts";
import { ApprovalBridge, type ApprovalBridgeResult } from "./approvalBridge.ts";

export interface InboxItem {
    email: Email;
    analysis: NeedleAnalysis;
    injection: { detected: boolean; matches: string[] };
}

export class InboxWorkflow {
    constructor(private readonly needle: NeedleService, private readonly bridge: ApprovalBridge) { }

    async analyze(emails: Email[]): Promise<InboxItem[]> {
        const out: InboxItem[] = [];
        for (const email of emails) {
            const analysis = await this.needle.analyzeEmail(email);
            out.push({ email, analysis, injection: detectPromptInjection(email.subject + "\n" + email.body) });
        }
        return out;
    }

    async processWithApproval(emails: Email[], organizationId: string, userId: string, policy: OrganizationPolicy): Promise<ApprovalBridgeResult> {
        return this.bridge.analyzeAndSubmit(emails, organizationId, userId, policy);
    }
}

export function proposalFromAnalysis(email: Email, a: NeedleAnalysis): ActionProposal | undefined {
    if (!a.actionRequired || !a.requestedAction) return;
    return {
        id: crypto.randomUUID(),
        action: "create_task",
        emailId: email.id,
        threadId: email.threadId,
        args: { title: a.requestedAction },
        reason: a.priorityReasons.join("; ") || "Needle identified an action.",
        confidence: a.confidence,
        risk: "medium"
    };
}
