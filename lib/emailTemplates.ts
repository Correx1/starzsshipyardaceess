/**
 * Generates highly professional HTML email templates for Starzs Marine and Engineering Ltd (SMEL) Access Control.
 * Fully optimized for B2B Client requests containing requesting staff details and resource checklists.
 */

interface ResourceItem {
  category: "staff" | "machinery" | "materials" | "other";
  quantity: number;
  type: string;
  details: string;
}

interface ApprovedEmailData {
  ticketNumber: string;
  pinCode: string;
  clientOrgName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  expectedDate: string;
  resources: ResourceItem[];
  domainUrl: string;
  requestingStaffName?: string;
  requestingStaffEmail?: string;
  adminSignatureName?: string;
  adminSignaturePhone?: string;
  adminSignatureCompany?: string;
}

interface DeniedEmailData {
  ticketNumber: string;
  clientOrgName: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  expectedDate: string;
  denialReason: string;
  domainUrl: string;
  resources: ResourceItem[];
  requestingStaffName?: string;
  requestingStaffEmail?: string;
  adminSignatureName?: string;
  adminSignaturePhone?: string;
  adminSignatureCompany?: string;
}

interface RescheduledEmailData {
  ticketNumber: string;
  clientOrgName: string;
  visitorName: string;
  visitorPhone: string;
  oldDate: string;
  newDate: string;
  domainUrl: string;
  requestingStaffName?: string;
  requestingStaffEmail?: string;
  adminSignatureName?: string;
  adminSignaturePhone?: string;
  adminSignatureCompany?: string;
}

/**
 * Returns the HTML email template for an APPROVED B2B access request
 */
export function getApprovedEmailTemplate(data: ApprovedEmailData): string {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
    `${data.domainUrl}/verify/${data.ticketNumber}`
  )}`;

  const resourcesHtml = data.resources
    .map((item) => {
      let badgeBg = "#f1f5f9";
      let badgeText = "#475569";
      let label: string = item.category;

      if (item.category === "staff") {
        badgeBg = "#d1fae5";
        badgeText = "#065f46";
        label = "staff / labor";
      } else if (item.category === "machinery") {
        badgeBg = "#dbeafe";
        badgeText = "#1e40af";
        label = "machinery";
      } else if (item.category === "materials") {
        badgeBg = "#fef3c7";
        badgeText = "#92400e";
        label = "materials / cargo";
      }

      return `
        <li style="margin: 6px 0; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; list-style-type: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b;">
          <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; margin-right: 8px; letter-spacing: 0.05em;">${label}</span>
          <strong>${item.quantity}x</strong> ${item.type}
          ${item.details ? `<span style="display: block; font-size: 11px; color: #64748b; margin-top: 2px; margin-left: 8px;">• ${item.details}</span>` : ""}
        </li>
      `;
    })
    .join("");

  const signatureHtml = data.adminSignatureName ? `
    <div style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #475569; line-height: 1.5; text-align: left;">
      <p style="margin: 0 0 4px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 700; color: #001d3f;">${data.adminSignatureName}</p>
      ${data.adminSignatureCompany ? `<p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748b;">${data.adminSignatureCompany}</p>` : ""}
      ${data.adminSignaturePhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; font-family: monospace; color: #64748b;">Phone: ${data.adminSignaturePhone}</p>` : ""}
    </div>
  ` : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Access Approved - SMEL Access Control</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #001d3f; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">Starzs Marine and Engineering Ltd (SMEL) Access Control</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">OFFICIAL ENTRY AUTHORIZATION</p>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="background-color: #ecfdf5; border-bottom: 1px solid #a7f3d0; padding: 20px; text-align: center;">
              <span style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.05em;">Access Approved</span>
              <p style="margin: 12px 0 0 0; color: #065f46; font-size: 13px; font-weight: 500; line-height: 1.5;">Your facility access request has been approved by the administrator.</p>
            </td>
          </tr>
          
          <!-- Ticket Details -->
          <tr>
            <td style="padding: 30px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                
                <!-- Ticket ID & Backup PIN -->
                <tr>
                  <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="50%" align="center" style="border-right: 1px solid #e2e8f0; padding-right: 10px;">
                          <span style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Ticket Number</span>
                          <span style="font-family: monospace; font-size: 15px; font-weight: 800; color: #001d3f; letter-spacing: 0.02em; padding: 4px 8px; background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 2px; display: inline-block; max-width: 100%; word-break: break-all;">${data.ticketNumber}</span>
                        </td>
                        <td width="50%" align="center" style="padding-left: 10px;">
                          <span style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Backup PIN Code</span>
                          <span style="font-family: monospace; font-size: 18px; font-weight: 900; color: #04356a; letter-spacing: 0.1em; padding: 4px 12px; background-color: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 2px; display: inline-block;">${data.pinCode}</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 10px 0 0 0; color: #64748b; font-size: 11px; font-weight: 500; line-height: 1.4;">
                      If your phone goes offline or has no internet, you can present the <strong>6-digit Backup PIN</strong> to the gate guards for manual verification.
                    </p>
                  </td>
                </tr>
                
                <!-- Visitor details -->
                <tr>
                  <td style="padding-top: 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="35%" style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Origin Client:</td>
                        <td width="65%" style="font-size: 13px; color: #1e293b; font-weight: 700; padding-bottom: 12px;">${data.clientOrgName}</td>
                      </tr>
                      ${data.requestingStaffName ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Staff:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffName}</td>
                      </tr>
                      ` : ""}
                      ${data.requestingStaffEmail ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Email:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffEmail}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Driver Name:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.visitorName}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">WhatsApp Phone:</td>
                        <td style="font-size: 13px; color: #1e293b; font-family: monospace; padding-bottom: 12px;">${data.visitorPhone}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Authorized Date:</td>
                        <td style="font-size: 13px; color: #04356a; font-weight: 700; padding-bottom: 12px;">${data.expectedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Resources Checklist -->
                <tr>
                  <td style="padding-top: 16px; padding-bottom: 24px;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">Authorized Resource Checklist:</span>
                    <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px 16px;">
                      <ul style="margin: 0; padding: 0; list-style-type: none;">
                        ${resourcesHtml}
                      </ul>
                    </div>
                  </td>
                </tr>
                
                <!-- QR Code Verification & Printing -->
                <tr>
                  <td align="center" style="padding-top: 16px; border-top: 1px solid #f1f5f9;">
                    <p style="margin: 0 0 16px 0; color: #64748b; font-size: 12px; font-weight: 500; line-height: 1.4;">
                      Scan this QR code at the security gate for automated check-in/out logging:
                    </p>
                    <img src="${qrCodeUrl}" alt="Access Ticket QR Code" width="160" height="160" style="display: block; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; background-color: #ffffff; margin-bottom: 16px;" />
                    
                    <div style="margin-top: 12px;">
                      <a href="${data.domainUrl}/ticket/${data.ticketNumber}" target="_blank" style="display: inline-block; background-color: #04356a; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 10px 20px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Print Gate Pass (PDF)</a>
                    </div>
                  </td>
                </tr>

                <!-- Signature Block -->
                <tr>
                  <td>
                    ${signatureHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5; font-weight: 500;">
                Please present this email or the Ticket ID at the gate for access. <br/>
                This ticket is valid for one complete entry and exit cycle on the scheduled date.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Returns the HTML email template for a DENIED B2B access request
 */
export function getDeniedEmailTemplate(data: DeniedEmailData): string {
  const resourcesHtml = data.resources
    .map((item) => {
      let badgeBg = "#f1f5f9";
      let badgeText = "#475569";
      let label: string = item.category;

      if (item.category === "staff") {
        badgeBg = "#d1fae5";
        badgeText = "#065f46";
        label = "staff / labor";
      } else if (item.category === "machinery") {
        badgeBg = "#dbeafe";
        badgeText = "#1e40af";
        label = "machinery";
      } else if (item.category === "materials") {
        badgeBg = "#fef3c7";
        badgeText = "#92400e";
        label = "materials / cargo";
      }

      return `
        <li style="margin: 6px 0; padding-bottom: 6px; border-bottom: 1px solid #f1f5f9; list-style-type: none; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #1e293b;">
          <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 2px; margin-right: 8px; letter-spacing: 0.05em;">${label}</span>
          <strong>${item.quantity}x</strong> ${item.type}
          ${item.details ? `<span style="display: block; font-size: 11px; color: #64748b; margin-top: 2px; margin-left: 8px;">• ${item.details}</span>` : ""}
        </li>
      `;
    })
    .join("");

  const signatureHtml = data.adminSignatureName ? `
    <div style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #475569; line-height: 1.5; text-align: left;">
      <p style="margin: 0 0 4px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 700; color: #001d3f;">${data.adminSignatureName}</p>
      ${data.adminSignatureCompany ? `<p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748b;">${data.adminSignatureCompany}</p>` : ""}
      ${data.adminSignaturePhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; font-family: monospace; color: #64748b;">Phone: ${data.adminSignaturePhone}</p>` : ""}
    </div>
  ` : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Access Registration Update - SMEL Access Control</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #001d3f; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">Starzs Marine and Engineering Ltd (SMEL) Access Control</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">OFFICIAL ENTRY REGISTRATION</p>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="background-color: #fef2f2; border-bottom: 1px solid #fecaca; padding: 20px; text-align: center;">
              <span style="display: inline-block; background-color: #ref4444; color: #ffffff; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.05em; background-color: #ef4444;">Access Declined</span>
              <p style="margin: 12px 0 0 0; color: #991b1b; font-size: 13px; font-weight: 500; line-height: 1.5;">Your request to enter the compound has been declined by the facility owner.</p>
            </td>
          </tr>
          
          <!-- Details -->
          <tr>
            <td style="padding: 30px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <!-- Reference ID -->
                <tr>
                  <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Reference Ticket Number</span>
                    <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #475569; padding: 4px 12px; background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 2px; display: inline-block;">${data.ticketNumber}</span>
                  </td>
                </tr>
                
                <!-- Denial Reason -->
                <tr>
                  <td style="padding-top: 24px; padding-bottom: 24px;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">Reason for Denial:</span>
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 16px; font-size: 13px; color: #991b1b; font-weight: 600; line-height: 1.5; font-family: sans-serif;">
                      ${data.denialReason || "No specific reason was provided by the administrator."}
                    </div>
                  </td>
                </tr>
                
                <!-- Visitor details -->
                <tr>
                  <td style="padding-top: 12px; border-top: 1px solid #f1f5f9;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="35%" style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Origin Client:</td>
                        <td width="65%" style="font-size: 13px; color: #1e293b; font-weight: 700; padding-bottom: 12px;">${data.clientOrgName}</td>
                      </tr>
                      ${data.requestingStaffName ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Staff:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffName}</td>
                      </tr>
                      ` : ""}
                      ${data.requestingStaffEmail ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Email:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffEmail}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Visitor Name:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.visitorName}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">WhatsApp Phone:</td>
                        <td style="font-size: 13px; color: #1e293b; font-family: monospace; padding-bottom: 12px;">${data.visitorPhone}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requested Date:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.expectedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Resources Checklist -->
                <tr>
                  <td style="padding-top: 16px; padding-bottom: 24px;">
                    <span style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 8px;">Requested Resource Checklist:</span>
                    <div style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px 16px;">
                      <ul style="margin: 0; padding: 0; list-style-type: none;">
                        ${resourcesHtml}
                      </ul>
                    </div>
                  </td>
                </tr>

                <!-- Signature Block -->
                <tr>
                  <td>
                    ${signatureHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5; font-weight: 500;">
                If you believe this is an error or wish to reschedule, please contact your B2B representative.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

/**
 * Returns the HTML email template for a RESCHEDULED access request
 */
export function getRescheduledEmailTemplate(data: RescheduledEmailData): string {
  const signatureHtml = data.adminSignatureName ? `
    <div style="margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #475569; line-height: 1.5; text-align: left;">
      <p style="margin: 0 0 4px 0;">Best regards,</p>
      <p style="margin: 0; font-weight: 700; color: #001d3f;">${data.adminSignatureName}</p>
      ${data.adminSignatureCompany ? `<p style="margin: 0; font-size: 11px; font-weight: 600; color: #64748b;">${data.adminSignatureCompany}</p>` : ""}
      ${data.adminSignaturePhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; font-family: monospace; color: #64748b;">Phone: ${data.adminSignaturePhone}</p>` : ""}
    </div>
  ` : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Access Pass Rescheduled - SMEL Access Control</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: #001d3f; padding: 24px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">Starzs Marine and Engineering Ltd (SMEL) Access Control</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">ACCESS RESCHEDULED NOTIFICATION</p>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="background-color: #f0f7ff; border-bottom: 1px solid #bfdbfe; padding: 20px; text-align: center;">
              <span style="display: inline-block; background-color: #0284c7; color: #ffffff; font-size: 12px; font-weight: 700; padding: 6px 16px; border-radius: 2px; text-transform: uppercase; letter-spacing: 0.05em;">Ticket Rescheduled</span>
              <p style="margin: 12px 0 0 0; color: #0369a1; font-size: 13px; font-weight: 500; line-height: 1.5;">B2B Partner <strong>${data.clientOrgName}</strong> has rescheduled an authorized entry pass.</p>
            </td>
          </tr>
          
          <!-- Details -->
          <tr>
            <td style="padding: 30px 24px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px; border-bottom: 1px solid #f1f5f9;">
                    <span style="font-size: 10px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Ticket Number</span>
                    <span style="font-family: monospace; font-size: 15px; font-weight: 700; color: #475569; padding: 4px 12px; background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 2px; display: inline-block;">${data.ticketNumber}</span>
                  </td>
                </tr>
                
                <!-- Reschedule Info -->
                <tr>
                  <td style="padding-top: 24px; padding-bottom: 24px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; padding: 16px;">
                      <tr>
                        <td width="50%" style="text-align: center; border-right: 1px solid #e2e8f0; padding-right: 10px;">
                          <span style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">Previous Date</span>
                          <span style="font-size: 13px; color: #991b1b; font-weight: 700; text-decoration: line-through;">${data.oldDate}</span>
                        </td>
                        <td width="50%" style="text-align: center; padding-left: 10px;">
                          <span style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 4px;">New Authorized Date</span>
                          <span style="font-size: 14px; color: #15803d; font-weight: 800;">${data.newDate}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Visitor details -->
                <tr>
                  <td style="padding-top: 12px; border-top: 1px solid #f1f5f9;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td width="35%" style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Origin Client:</td>
                        <td width="65%" style="font-size: 13px; color: #1e293b; font-weight: 700; padding-bottom: 12px;">${data.clientOrgName}</td>
                      </tr>
                      ${data.requestingStaffName ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Staff:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffName}</td>
                      </tr>
                      ` : ""}
                      ${data.requestingStaffEmail ? `
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Requesting Email:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.requestingStaffEmail}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Visitor Name:</td>
                        <td style="font-size: 13px; color: #1e293b; font-weight: 600; padding-bottom: 12px;">${data.visitorName}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; padding-bottom: 12px;">Visitor Phone:</td>
                        <td style="font-size: 13px; color: #1e293b; font-family: monospace; padding-bottom: 12px;">${data.visitorPhone}</td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Signature Block -->
                <tr>
                  <td>
                    ${signatureHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 11px; line-height: 1.5; font-weight: 500;">
                This is an automated notification. The ticket status remains <strong>APPROVED</strong>, but the authorized entry date has been updated to the new date above.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
