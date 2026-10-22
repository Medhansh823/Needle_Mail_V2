import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const ALGO = "aes-256-gcm";

// Key versions track which key was used to encrypt each secret
// Format: { [keyId: string]: { key: Buffer, createdAt: number } }
const keyVersions: Map<string, { key: Buffer; createdAt: number }> = new Map();

// Don't initialize at module level - validate key when provided
function validateAndGetKey(base64Key: string): Buffer {
    const b = Buffer.from(base64Key, "base64");
    if (b.length !== 32) throw Error("NEEDLE_ENCRYPTION_KEY must decode to 32 bytes");
    return b;
}

export function encryptSecret(value: string, base64Key: string, keyId: string = "v1"): string {
    const key = validateAndGetKey(base64Key);
    keyVersions.set(keyId, { key, createdAt: Date.now() });
    const versionedKey = keyVersions.get(keyId)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, versionedKey.key, iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([Buffer.from(keyId, "utf8"), iv, cipher.getAuthTag(), data]).toString("base64url")
}

export function decryptSecret(payload: string, base64Key: string): string {
    const key = validateAndGetKey(base64Key);
    const raw = Buffer.from(payload, "base64url");
    if (raw.length < 30) throw Error("Invalid encrypted secret");

    // Extract: [2-byte keyId][12-byte IV][16-byte tag][ciphertext]
    const keyId = raw.subarray(0, 2).toString("utf8");
    const iv = raw.subarray(2, 14); // 12-byte IV starting at offset 2
    const tag = raw.subarray(14, 30); // 16-byte auth tag
    const ciphertext = raw.subarray(30);

    keyVersions.set(keyId, { key, createdAt: Date.now() });
    const versionedKey = keyVersions.get(keyId)!;

    const decipher = createDecipheriv(ALGO, versionedKey.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}

// Rotate to a new key version
export function rotateKey(newBase64Key: string, fromKeyId: string = "v1"): string {
    const newKey = validateAndGetKey(newBase64Key);
    keyVersions.set("v2", { key: newKey, createdAt: Date.now() });
    return "v2";
}

// Clean up old key versions (keep only the last N)
export function pruneOldKeys(keepCount: number = 2) {
    const keys = Array.from(keyVersions.keys()).sort();
    if (keys.length <= keepCount) return;
    for (let i = 0; i < keys.length - keepCount; i++) {
        keyVersions.delete(keys[i]);
    }
}
