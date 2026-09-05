import "server-only";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { extractText, getDocumentProxy } from "unpdf";

export interface ExtractedPage {
  page: number;
  text: string;
}
export interface ExtractedDocument {
  pages: ExtractedPage[];
  text: string;
  pageCount: number;
  kind: "pdf" | "docx" | "xlsx" | "txt";
}

export function detectKind(fileName: string, mimeType?: string | null): ExtractedDocument["kind"] | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "xlsx" || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (ext === "txt" || ext === "md" || ext === "csv" || mimeType?.startsWith("text/")) return "txt";
  return null;
}

/** Extracts text per page (PDF) or as a single page (DOCX, XLSX, TXT). */
export async function extractDocumentText(data: Buffer, fileName: string, mimeType?: string | null): Promise<ExtractedDocument> {
  const kind = detectKind(fileName, mimeType);
  if (!kind) throw new Error(`Bestandstype van ${fileName} wordt niet ondersteund (pdf, docx, xlsx, txt)`);
  switch (kind) {
    case "pdf": {
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const result = await extractText(pdf, { mergePages: false });
      const pages = result.text.map((t, i) => ({ page: i + 1, text: t.trim() }));
      return { pages, text: pages.map((p) => p.text).join("\n\n"), pageCount: result.totalPages, kind };
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer: data });
      const text = result.value.trim();
      return { pages: [{ page: 1, text }], text, pageCount: 1, kind };
    }
    case "xlsx": {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(data as unknown as ArrayBuffer);
      const parts: string[] = [];
      wb.eachSheet((sheet) => {
        parts.push(`Werkblad: ${sheet.name}`);
        sheet.eachRow((row) => {
          const cells = (row.values as unknown[]).slice(1).map((v) => cellToString(v));
          if (cells.some((c) => c !== "")) parts.push(cells.join(" | "));
        });
      });
      const text = parts.join("\n");
      return { pages: [{ page: 1, text }], text, pageCount: 1, kind };
    }
    case "txt": {
      const text = data.toString("utf8").trim();
      return { pages: [{ page: 1, text }], text, pageCount: 1, kind };
    }
  }
}

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.result !== undefined) return String(o.result);
    if (o.text !== undefined) return String(o.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return "";
  }
  return String(v);
}

/** Reads a price sheet (xlsx) with columns omschrijving | hoeveelheid | eenheidsprijs | totaal. */
export async function readPriceSheet(data: Buffer): Promise<Array<{ omschrijving: string; hoeveelheid: number; eenheidsprijs: number; totaal: number }>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const rows: Array<{ omschrijving: string; hoeveelheid: number; eenheidsprijs: number; totaal: number }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1);
    const omschrijving = cellToString(values[0]);
    const hoeveelheid = Number(cellToString(values[1]).replace(",", "."));
    const eenheidsprijs = Number(cellToString(values[2]).replace(",", "."));
    const totaal = Number(cellToString(values[3]).replace(",", "."));
    if (!omschrijving || !Number.isFinite(hoeveelheid)) return;
    rows.push({ omschrijving, hoeveelheid, eenheidsprijs: Number.isFinite(eenheidsprijs) ? eenheidsprijs : 0, totaal: Number.isFinite(totaal) ? totaal : hoeveelheid * eenheidsprijs });
  });
  return rows;
}
