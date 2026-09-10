/**
 * Utilities to encode and decode ticket numbers to and from random-looking URL slugs.
 * Ensures the explicit ticket format (e.g. STYD.TZWLJNVO-7GR9VB0I) is hidden in URLs.
 */

export function encodeTicketSlug(ticketNumber: string): string {
  if (!ticketNumber) return "";
  try {
    return Buffer.from(ticketNumber.trim()).toString("hex").toLowerCase();
  } catch {
    return ticketNumber;
  }
}

export function decodeTicketSlug(slug: string): string {
  if (!slug) return "";
  const clean = slug.trim();
  try {
    // If it's a valid hex string with even length
    if (/^[0-9a-f]+$/i.test(clean) && clean.length % 2 === 0) {
      const decoded = Buffer.from(clean, "hex").toString("utf-8");
      if (decoded.startsWith("STYD.") || decoded.includes("-")) {
        return decoded;
      }
    }
  } catch {
    // fallback
  }
  return clean;
}
