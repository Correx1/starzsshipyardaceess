/**
 * Twilio WhatsApp Notification Utility
 * Uses lightweight HTTP fetch requests to interact with the Twilio REST API,
 * ensuring high performance, zero dependencies, and full serverless/edge compatibility.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || ""; // E.g., "+14155238886"

/**
 * Dispatches a WhatsApp message via Twilio API
 * @param to The recipient phone number (must include country code, e.g., "+2348012345678")
 * @param body The text message body
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error("Twilio credentials or sender number are not configured in environment variables.");
    return { success: false, error: "Twilio integration is not configured." };
  }

  // Format recipient and sender numbers for Twilio WhatsApp format
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const formattedFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") 
    ? TWILIO_WHATSAPP_FROM 
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  
  // Prepare basic authorization token
  const authString = `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`;
  let base64Auth = "";
  try {
    // Edge-compatible and Node-compatible base64 encoding
    base64Auth = typeof btoa === "function" 
      ? btoa(authString) 
      : Buffer.from(authString).toString("base64");
  } catch (err) {
    console.error("Failed to encode Twilio authorization string:", err);
    return { success: false, error: "Failed to encode authorization credentials." };
  }

  // Prepare URL-encoded form body parameters
  const params = new URLSearchParams();
  params.append("From", formattedFrom);
  params.append("To", formattedTo);
  params.append("Body", body);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${base64Auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio WhatsApp sending failed:", data);
      return { success: false, error: data.message || "Failed to send WhatsApp message via Twilio." };
    }

    return { success: true, messageId: data.sid };
  } catch (err: any) {
    console.error("Twilio API request connection error:", err);
    return { success: false, error: err.message || "Connection error to Twilio API." };
  }
}
