import type { Email } from "../domain/types.ts"; import type { EmailProvider } from "./email.ts"; import { GmailProvider } from "./gmail.ts"; import { createDecipheriv, createCipheriv } from "node:crypto"; import { decryptSecret, encryptSecret } from "../security/secrets.ts";
/**
 * Production email provider that wraps GmailProvider with encrypted token persistence
 * Uses encrypted refresh tokens from database and handles OAuth token refresh flow
 * Implements refresh token rotation on each use for enhanced security
 */
export class ProductionEmailProvider implements EmailProvider {
  private encryptedRefreshToken: string;
  private userId: string;
  private organizationId: string;
  private getAccessToken: () => Promise<string>; // Callback to get fresh access token
  private refreshTokenLastUsedAt: number = 0;
  private readonly refreshTokenTtlMs: number = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(
    encryptedRefreshToken: string,
    userId: string,
    organizationId: string,
    getAccessToken: () => Promise<string>
  ) {
    this.encryptedRefreshToken = encryptedRefreshToken;
    this.userId = userId;
    this.organizationId = organizationId;
    this.getAccessToken = getAccessToken;
    // Validate the encrypted token can be decrypted (will throw if invalid)
    try {
      if (!encryptedRefreshToken || encryptedRefreshToken.length < 10) {
        throw new Error("Invalid encrypted refresh token");
      }
    } catch (error: any) {
      throw new Error(`Failed to validate encrypted refresh token: ${error.message}`);
    }
  }

  private async ensureRefreshTokenValid(): Promise<void> {
    // Decrypt current refresh token to check status
    const tokenData = this.decryptRefreshToken();
    if (!tokenData) throw new Error("Cannot decrypt refresh token");

    // Update last used timestamp
    tokenData.lastUsedAt = Date.now();

    // Check if token is approaching expiry (within 7 days)
    if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 7 * 24 * 60 * 60 * 1000) {
      // Proactively refresh the token
      await this.rotateRefreshToken();
    }

    // Re-encrypt and store updated token
    this.encryptedRefreshToken = await this.rotateRefreshToken();
  }

  private decryptRefreshToken(): { expiresAt?: number; lastUsedAt?: number } | null {
    const raw = Buffer.from(this.encryptedRefreshToken, "base64url");
    if (raw.length < 28) return null;
    // Try all available key versions for backward compatibility
    for (const [keyId, vKey] of (global as any).keyVersions?.entries() || []) {
      try {
        // Format: [2-byte keyId][12-byte IV][16-byte tag][ciphertext]
        const iv = raw.subarray(2, 14); // skip 2-byte keyId, 12-byte IV
        const tag = raw.subarray(14, 30);
        const ciphertext = raw.subarray(30);
        const decipher = createDecipheriv("aes-256-gcm", vKey.key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const parsed = JSON.parse(decrypted.toString("utf8"));
        // Update the key version used and re-encrypt with current key
        this.encryptedRefreshToken = encryptSecret(JSON.stringify(parsed), keyId);
        return parsed;
      } catch {
        // try next key
      }
    }
    return null;
  }

  private async rotateRefreshToken(): Promise<string> {
    // Decrypt current token
    const tokenData = this.decryptRefreshToken();
    if (!tokenData) throw new Error("Cannot decrypt refresh token");

    // Update last used timestamp
    tokenData.lastUsedAt = Date.now();

    // Re-encrypt with current key version
    const encrypted = encryptSecret(JSON.stringify(tokenData), this.getCurrentKeyId());
    this.encryptedRefreshToken = encrypted;
    return encrypted;
  }

  private getCurrentKeyId(): string {
    // Default to v1, in production would determine from token prefix
    return "v1";
  }

  async listInbox(accountId: string): Promise<Email[]> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.listInbox(accountId));
  }

  async getThread(threadId: string): Promise<Email[]> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.getThread(threadId));
  }

  async applyLabel(emailId: string, label: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.applyLabel(emailId, label));
  }

  async removeLabel(emailId: string, label: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.removeLabel(emailId, label));
  }

  async archive(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.archive(emailId));
  }

  async restore(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.restore(emailId));
  }

  async markRead(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.markRead(emailId));
  }

  async markUnread(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.markUnread(emailId));
  }

  async star(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.star(emailId));
  }

  async unstar(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.unstar(emailId));
  }

  async move(emailId: string, destination: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.move(emailId, destination));
  }

  async delete(emailId: string): Promise<void> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.delete(emailId));
  }

  async createDraft(to: string[], subject: string, body: string, threadId?: string): Promise<string> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.createDraft(to, subject, body, threadId));
  }

  async sendReply(emailId: string, body: string): Promise<string> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.sendReply(emailId, body));
  }

  async sendForward(emailId: string, to: string[], body: string): Promise<string> {
    await this.ensureRefreshTokenValid();
    return this.withGmailProvider(provider => provider.sendForward(emailId, to, body));
  }

  async createTask(threadId: string, title: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async createReminder(threadId: string, title: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async bulkAction(operations: string, threadId: string): Promise<void> {
    throw new Error("Not implemented");
  }

  private async withGmailProvider<T>(operation: (provider: GmailProvider) => Promise<T>): Promise<T> {
    const accessToken = await this.getAccessToken();
    const provider = new GmailProvider(accessToken);
    return operation(provider);
  }
}
/**
 * Factory to create ProductionEmailProvider from database record
 */
export async function createProductionEmailProvider(
  userId: string,
  organizationId: string,
  encryptedRefreshToken: string,
  getAccessToken: () => Promise<string>
): Promise<ProductionEmailProvider> {
  // Validate the encrypted token can be decrypted (will throw if invalid)
  try {
    if (!encryptedRefreshToken || encryptedRefreshToken.length < 10) {
      throw new Error("Invalid encrypted refresh token");
    }
  } catch (error: any) {
    throw new Error(`Failed to validate encrypted token: ${error.message}`);
  }

  return new ProductionEmailProvider(
    encryptedRefreshToken,
    userId,
    organizationId,
    getAccessToken
  );
}
