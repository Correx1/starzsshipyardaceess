import * as XLSX from "xlsx";

export interface ExportableRequest {
  id: string;
  ticket_number: string;
  pin_code: string;
  clientOrgName?: string;
  requesting_staff_name?: string;
  requesting_staff_email?: string;
  visitor_name: string;
  visitor_phone: string;
  expected_date: string;
  status: string;
  resources?: Array<{
    category: string;
    quantity: number;
    type: string;
    details?: string;
  }>;
  denial_reason?: string | null;
  entered_at?: string | null;
  entered_by?: string | null;
  exited_at?: string | null;
  exited_by?: string | null;
  created_at: string;
}

function formatResourceManifest(resources?: ExportableRequest["resources"]): string {
  if (!resources || !Array.isArray(resources) || resources.length === 0) return "None";
  return resources
    .map((r) => `${r.quantity}x ${r.type} (${r.category.toUpperCase()}${r.details ? ` - ${r.details}` : ""})`)
    .join("; ");
}

function getDerivedStatus(req: ExportableRequest): string {
  if (req.status === "approved") {
    if (req.entered_at && req.exited_at) return "CHECKED OUT (EXPIRED)";
    if (req.entered_at && !req.exited_at) return "INSIDE FACILITY";
    return "APPROVED (AWAITING ARRIVAL)";
  }
  return req.status.toUpperCase();
}

function formatAuditRow(req: ExportableRequest) {
  return {
    "Ticket Number": req.ticket_number,
    "Gate PIN": req.pin_code,
    "Partner / Client": req.clientOrgName || "N/A",
    "Requesting Staff": req.requesting_staff_name || "N/A",
    "Staff Email": req.requesting_staff_email || "N/A",
    "Driver / Visitor": req.visitor_name,
    "Driver Phone": req.visitor_phone,
    "Expected Date": req.expected_date,
    "Operational Status": getDerivedStatus(req),
    "Resource Manifest": formatResourceManifest(req.resources),
    "Check-In Time": req.entered_at ? new Date(req.entered_at).toLocaleString() : "N/A",
    "Check-In Guard": req.entered_by || "N/A",
    "Check-Out Time": req.exited_at ? new Date(req.exited_at).toLocaleString() : "N/A",
    "Check-Out Guard": req.exited_by || "N/A",
    "Denial Reason": req.denial_reason || "N/A",
    "Submitted Date": new Date(req.created_at).toLocaleString(),
  };
}

/**
 * Generates and triggers download of an Excel (.xlsx) file
 */
export function exportToExcel(data: ExportableRequest[], filenamePrefix = "STARZS_Gate_Audit_Log") {
  const rows = data.map(formatAuditRow);
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((row) => String(row[key as keyof typeof row] || "").length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 12), 45) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Gate Access Audit");

  const todayStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `${filenamePrefix}_${todayStr}.xlsx`);
}

/**
 * Generates and triggers download of a CSV file
 */
export function exportToCSV(data: ExportableRequest[], filenamePrefix = "STARZS_Gate_Audit_Log") {
  const rows = data.map(formatAuditRow);
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [];
  
  csvLines.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  for (const row of rows) {
    const line = headers
      .map((header) => {
        const val = String(row[header as keyof typeof row] || "");
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",");
    csvLines.push(line);
  }

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csvLines.join("\n"));
  const link = document.createElement("a");
  const todayStr = new Date().toISOString().split("T")[0];
  link.setAttribute("href", csvContent);
  link.setAttribute("download", `${filenamePrefix}_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
