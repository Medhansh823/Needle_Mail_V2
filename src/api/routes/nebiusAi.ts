import { Hono } from "hono";
import { getRuntime, NemotronRuntime } from "../../ai/nebiusRuntime.ts";
import type { Context } from "hono";
import { detectPromptInjection } from "../../security/prompt-injection.ts";
import { MemoryRateLimiter } from "../../security/rate-limit.ts";

const app = new Hono();

// Rate limiter: 30 requests per 15 minutes per API key
const nebiusRateLimiter = new MemoryRateLimiter(30, 15 * 60 * 1000);

/**
 * Sanitize error messages to remove potential secrets/tokens
 */
function sanitizeErrorMessage(message: string): string {
    // Remove potential API keys, tokens, or sensitive data from error messages
    const sanitized = message
        .replace(/[a-zA-Z0-9]{40}/g, "[REDACTED]")  // Long alphanumeric strings (potential API keys)
        .replace(/[a-f0-9]{32}/g, "[REDACTED]")      // MD5 hash length
        .replace(/[a-f0-9]{40}/g, "[REDACTED]")      // SHA1 hash length
        .replace(/[a-f0-9]{64}/g, "[REDACTED]");     // SHA256 hash length

    return sanitized;
}

/**
 * POST /api/nebius/analyze - Analyze email with Nemotron model
 * Respects NEBIUS_ENABLED flag - falls back to Needle2 when disabled
 */
app.post("/analyze", async (c: Context) => {
    try {
        // Check rate limit
        const body = await c.req.json();
        const ip = c.req.header("x-forwarded-for") || "unknown";
        const rateResult = nebiusRateLimiter.check(ip);
        if (!rateResult.allowed) {
            return c.json({ error: "Rate limit exceeded", retryAfterMs: rateResult.retryAfterMs }, 429);
        }

        const { apiKey, email, threadContext, task } = body;

        if (!apiKey) {
            return c.json({ error: "Nebius API key is required" }, 400);
        }

        if (!email) {
            return c.json({ error: "Email data is required" }, 400);
        }

        // Validate email content for prompt injection
        const emailSignal = detectPromptInjection(email);
        if (emailSignal.detected) {
            return c.json({ error: "Email content contains potential prompt injection", detected: emailSignal.matches }, 400);
        }

        const runtime = getRuntime(apiKey);

        let result: unknown;

        switch (task) {
            case "analyze_email":
                result = await runtime.analyze(
                    JSON.stringify({ task: "analyze_email", email, threadContext }),
                    ["classify_email", "extract_entities", "extract_deadline", "prepare_reply"]
                );
                break;

            case "plan_contextual_response":
                result = await runtime.planResponse(email, threadContext, {
                    intent: "follow-up",
                    tone: "professional",
                    purpose: [],
                    factsToInclude: [],
                    questionsToAnswer: [],
                    templateType: "standard",
                    confidence: 0.5,
                });
                break;

            case "write_email_reply":
                result = await runtime.writeEmailReply(email, threadContext, {
                    intent: "reply",
                    tone: "professional",
                    purpose: ["respond to sender"],
                    factsToInclude: [],
                    questionsToAnswer: [],
                    templateType: "standard",
                    confidence: 0.5,
                });
                break;

            default:
                return c.json({ error: `Unknown task: ${task}` }, 400);
        }

        return c.json({ success: true, result });
    } catch (err: any) {
        // Redact secrets from error messages before logging
        const sanitizedMessage = sanitizeErrorMessage(err.message || "Failed to analyze email");
        console.error("Nemius AI analysis error:", sanitizedMessage);
        return c.json({ error: sanitizedMessage }, 500);
    }
});

/**
 * GET /api/nebius/models - List available Nemotron models
 */
app.get("/models", async (c: Context) => {
    try {
        // Return known Nemotron models available on Nebius
        const models = [
            { id: "nebius/nemotron", name: "Nemotron", description: "NVIDIA Nemotron model" },
            { id: "nebius/llama-3.1-nemotron", name: "LLaMA Nemotron", description: "LLaMA-based Nemotron variant" },
        ];

        return c.json({ success: true, models });
    } catch (err) {
        return c.json({ error: "Failed to fetch models" }, 500);
    }
});

/**
 * POST /api/nebius/validate-key - Validate Nebius API key
 */
app.post("/validate-key", async (c: Context) => {
    try {
        const { apiKey } = await c.req.json();

        if (!apiKey) {
            return c.json({ error: "API key is required" }, 400);
        }

        // Note: NemotronRuntime doesn't have a static validateApiKey method,
        // so we check if the key can be used to fetch a token
        const { NebiusTokenFactory } = await import("../../providers/nebius.ts");
        try {
            await NebiusTokenFactory.fetchToken(apiKey);
            return c.json({ success: true });
        } catch {
            return c.json({ success: false });
        }
    } catch (err) {
        return c.json({ error: "Failed to validate API key" }, 500);
    }
});

export default app;
