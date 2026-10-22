import { Response } from "express";

/**
 * Escapes an individual CSV cell value:
 * 1. OWASP CSV Formula Injection Defense:
 *    If the text begins with dangerous formula triggers (=, +, -, @, \t, \r),
 *    prepends a single quote (') so spreadsheets interpret the cell strictly as literal text.
 * 2. RFC 4180 CSV Escaping:
 *    If the text contains quotes, commas, or newlines, wraps the cell in double quotes
 *    and escapes any embedded quotes with double quotes ("").
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // OWASP CSV Injection Defense: Prefix formula characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 Escaping: Wrap in double quotes if commas, quotes, or newlines exist
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of cell values into a single CSV row line
 */
export function formatCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",") + "\r\n";
}

/**
 * Streams CSV content to an Express response with appropriate headers
 */
export async function sendCsvResponse(
  res: Response,
  filename: string,
  headers: string[],
  rows: unknown[][]
): Promise<void> {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Pragma", "no-cache");

  // Write UTF-8 BOM for Microsoft Excel compatibility
  res.write("\uFEFF");

  // Write header row
  res.write(formatCsvRow(headers));

  // Write data rows
  for (const row of rows) {
    res.write(formatCsvRow(row));
  }

  res.end();
}
