import crypto from "crypto";
import bcrypt from "bcryptjs";

interface HashedPassword {
  hash: string;
  salt: string;
}

/**
 * Generates a cryptographically secure random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Hashes a password using bcrypt (adaptive, highly secure hashing)
 * @param password The plain text password
 * @param salt Optional. Kept for signature compatibility.
 */
export function hashPassword(password: string, salt?: string): HashedPassword {
  const activeSalt = salt || bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, activeSalt);

  return {
    hash,
    salt: activeSalt,
  };
}

/**
 * Verifies a plain text password against a stored hash and salt.
 * Supports modern bcrypt hashes as well as legacy HMAC-SHA256 hashes.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  // Check if hash is a modern bcrypt hash
  if (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    try {
      return bcrypt.compareSync(password, hash);
    } catch {
      return false;
    }
  }

  // Legacy HMAC-SHA256 fallback
  try {
    const legacyHash = crypto
      .createHmac("sha256", salt)
      .update(password)
      .digest("hex");
    return legacyHash === hash;
  } catch {
    return false;
  }
}

