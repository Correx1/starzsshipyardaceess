import { customAlphabet } from "nanoid";

const genPart = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

/**
 * Generates official Starzs Ticket ID format: STYD.XXXXXXXX-XXXXXXXX
 * Example: "STYD.USFDCWBV-OLZN2OIY"
 */
export function generateSecureTicketNumber(): string {
  return `STYD.${genPart()}-${genPart()}`;
}
