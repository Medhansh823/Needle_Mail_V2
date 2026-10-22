import { Hono } from "hono";
import { db } from "../../../db/client.ts";
import { emails, organizationPolicies, permissionRules, automationRules, approvalRequests, auditEvents } from "../../../db/schema.ts";
import { eq, and, count, desc, sql } from "drizzle-orm";
import type { Context } from "hono";
import { detectPromptInjection } from "../../security/prompt-injection.ts";
import { RateLimitResult, MemoryRateLimiter } from "../../security/rate-limit.ts";

const app = new Hono();

// Rate limiter: 100 requests per 15 minutes per IP
const rateLimiter = new MemoryRateLimiter(100, 15 * 60 * 1000);

// Authentication helper - checks for auth header
function requireAuth(c: Context) {
    const authHeader = c.req.header("Authorization") || c.req.header("authorization");
    if (!authHeader) {
        return c.json({ error: "Unauthorized - missing auth token", code: "UNAUTHORIZED" }, 401);
    }
    // TODO: Verify JWT token and extract organizationId, userId
    // For now, proceed but mark authorization as needed
    return null;
}

// Rate limit check helper - returns RateLimitResult or null if rate limited
function checkRateLimit(c: Context): RateLimitResult | null {
    const ip = c.req.header("x-forwarded-for") || "unknown";
    const result = rateLimiter.check(ip);
    return result.allowed ? result : null;
}

/**
 * GET /api/inbox - List inbox emails with analysis
 */
app.get("/", async (c: Context) => {
    try {
        // Check authentication
        const authResult = requireAuth(c);
        if (authResult) return authResult;

        // Check rate limit
        const rateResult = checkRateLimit(c);
        if (rateResult) {
            return c.json({ error: "Rate limit exceeded", retryAfterMs: rateResult.retryAfterMs }, 429);
        }

        const result = await db.select({
            id: emails.id,
            threadId: emails.threadId,
            accountId: emails.accountId,
            sender: emails.sender,
            subject: emails.subject,
            body: emails.body,
            receivedAt: emails.receivedAt,
            labels: emails.labels,
            category: emails.category,
            priority: emails.priority
        }).from(emails).orderBy(desc(emails.receivedAt)).limit(50);

        return c.json(result);
    } catch (err) {
        return c.json({ error: "Failed to fetch inbox" }, 500);
    }
});
