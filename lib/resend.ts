/**
 * Resend Email Notification Utility
 * Uses lightweight HTTP fetch requests to interact with the Resend REST API,
 * ensuring high performance, zero dependencies, and full serverless/edge compatibility.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "STARZS MARINE AND ENGINEERING LTD Access <onboarding@resend.dev>";

/**
 * Dispatches a professional HTML email via Resend API
 * @param to Recipient email address
 * @param subject Email subject line
 * @param html HTML string for email content
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("Resend API Key is missing from environment variables.");
    return { success: false, error: "Resend integration is not configured." };
  }

  const url = "https://api.resend.com/emails";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend Email sending failed:", data);
      return { success: false, error: data.message || "Failed to send email via Resend." };
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error("Resend API request connection error:", err);
    return { success: false, error: err.message || "Connection error to Resend API." };
  }
}
