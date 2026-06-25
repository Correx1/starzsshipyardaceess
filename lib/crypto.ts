import crypto from "crypto";

interface HashedPassword {
  hash: string;
  salt: string;
}

/**
 * Generates a cryptographically secure random salt (16 bytes, hex encoded)
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Hashes a password using SHA-256 and a cryptographic salt
 * @param password The plain text password
 * @param salt Optional. The salt. If not provided, a new one will be generated.
 */
export function hashPassword(password: string, salt?: string): HashedPassword {
  const activeSalt = salt || generateSalt();
  
  // Hash using SHA-256 HMAC
  const hash = crypto
    .createHmac("sha256", activeSalt)
    .update(password)
    .digest("hex");

  return {
    hash,
    salt: activeSalt,
  };
}

/**
 * Verifies a plain text password against a stored hash and salt
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const result = hashPassword(password, salt);
  return result.hash === hash;
}
