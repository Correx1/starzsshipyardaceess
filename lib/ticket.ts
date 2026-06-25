import { customAlphabet } from "nanoid";

// Generates 8 random uppercase alphabetic characters
const genAlpha = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

// Generates 8 random uppercase alphanumeric characters (letters + numbers)
const genAlphaNum = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 8);

/**
 * Generates a cryptographically secure, unguessable access ticket number.
 * Pattern: STYD.[8 chars alphabetic]-[8 chars alphanumeric] (e.g., STYD.MQRGNTLB-910B2539)
 */
export function generateSecureTicketNumber(): string {
  return `STYD.${genAlpha()}-${genAlphaNum()}`;
}
