import type { EmailProvider } from "./email.ts";

import { MemoryRateLimiter } from "../security/rate-limit.ts";

/**
 * Nebius Token Factory - Handles authentication with Nebius API
 * Generates and manages access tokens for Nemotron model calls
 *
 * Authentication flow:
 * - API Key-based authentication
 * - Token refresh mechanism
 * - Secure encrypted storage pattern (consistent with ProductionEmailProvider)
 */

export interface NebiusTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
}

/**
 * Configuration options for Nebius token fetch with timeout and retry
 */
export interface NebiusTokenFetchOptions {
    /** Request timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Retry delay in milliseconds (default: 1000) */
    retryDelayMs?: number;
    /** Rate limiter instance for API key protection */
    rateLimiter?: MemoryRateLimiter;
    /** Rate limit key (typically API key or IP) */
    rateLimitKey?: string;
}

/**
 * Factory class for obtaining Nebius API tokens
 *
 * @param apiKey - Nebius API key (from environment variables)
 * @returns Parsed token response containing access token and metadata
 * @throws {Error} If token request fails or response is invalid
 */
export class NebiusTokenFactory {
    private static readonly TOKEN_ENDPOINT = "https://api.nebius.ai/v1/auth/token";

    /**
     * Fetches an access token from the Nebius Token Factory API
     * with timeout, retry, and optional rate-limit handling
     *
     * @param apiKey - The Nebius API key for authentication
     * @param options - Optional fetch configuration
     * @returns Promise resolving to the token response
     * @throws {Error} If the token request fails
     */
    static async fetchToken(
        apiKey: string,
        options: NebiusTokenFetchOptions = {}
    ): Promise<NebiusTokenResponse> {
        const {
            timeoutMs = 30000,
            maxRetries = 3,
            retryDelayMs = 1000,
            rateLimiter,
            rateLimitKey,
        } = options;

        // Rate limit check if rate limiter provided
        if (rateLimiter && rateLimitKey) {
            const rateResult = rateLimiter.check(rateLimitKey);
            if (!rateResult.allowed) {
                throw new Error(
                    `Rate limit exceeded: ${rateResult.retryAfterMs}ms retry required`
                );
            }
        }

        let attempt = 0;
        const lastError: Error | null = null;

        while (attempt < maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                const response = await fetch(this.TOKEN_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `Nebius Token Factory failed: ${response.status} ${errorText}`
                    );
                }

                return response.json() as Promise<NebiusTokenResponse>;
            } catch (error) {
                attempt++;
                const err = error as Error;

                // If not last attempt, wait before retry
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                } else {
                    throw err;
                }
            }
        }

        throw new Error(
            `Nebius Token Factory failed after ${maxRetries} attempts`
        );
    }

    /**
     * Gets a fresh access token from Nebius Token Factory
     *
     * @param apiKey - The Nebius API key
     * @returns The access token string
     * @throws {Error} If token cannot be fetched
     */
    static async getAccessToken(apiKey: string): Promise<string> {
        const tokenData = await this.fetchToken(apiKey);

        if (!tokenData.access_token) {
            throw new Error("Nebius token response missing access_token");
        }

        return tokenData.access_token;
    }

    /**
     * Validates that the provided API key can obtain a token
     *
     * @param apiKey - The Nebius API key to validate
     * @returns True if token can be fetched, false otherwise
     */
    static async validateApiKey(apiKey: string): Promise<boolean> {
        try {
            await this.fetchToken(apiKey);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Configuration interface for Nebius provider
 */
export interface NebiusProviderConfig {
    /** Nebius API key - required */
    apiKey: string;
    /** Nemotron model name - defaults to nebius/nemotron */
    model?: string;
    /** Optional temperature for generation (0-1) */
    temperature?: number;
    /** Optional max tokens for generation */
    maxTokens?: number;
}
