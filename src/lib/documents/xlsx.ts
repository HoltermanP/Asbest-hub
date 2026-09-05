import "server-only";
import ExcelJS from "exceljs";

export interface PriceSheetLine {
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
}

/** Generates the tender price sheet (prijsblad) as xlsx with formulas for totals. */
export async function buildPriceSheetXlsx(opts: { title: string; reference: string; lines: PriceSheetLine[]; organizationName: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = opts.organizationName;
  const ws = wb.addWorksheet("Prijsblad");
  ws.columns = [
    { header: "Omschrijving", key: "omschrijving", width: 60 },
    { header: "Hoeveelheid", key: "hoeveelheid", width: 14 },
    { header: "Eenheidsprijs (EUR)", key: "eenheidsprijs", width: 20 },
    { header: "Totaal (EUR)", key: "totaal", width: 18 },
  ];
  ws.insertRow(1, [opts.title]);
  ws.insertRow(2, [`Kenmerk ${opts.reference} - ${opts.organizationName}`]);
  ws.insertRow(3, ["Vul uitsluitend de gele cellen (eenheidsprijs) in. Prijzen exclusief btw. Totaal wordt automatisch berekend."]);
  ws.insertRow(4, []);
  ws.getRow(1).font = { bold: true, size: 14 };
  const headerRow = ws.getRow(5);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F9" } };
  const firstData = 6;
  opts.lines.forEach((l, i) => {
    const r = firstData + i;
    ws.getRow(r).values = [`${l.omschrijving} (${l.eenheid})`, l.hoeveelheid, null, { formula: `B${r}*C${r}` }];
    ws.getCell(`C${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3B0" } };
    ws.getCell(`C${r}`).numFmt = "#,##0.00";
    ws.getCell(`D${r}`).numFmt = "#,##0.00";
  });
  const lastData = firstData + opts.lines.length - 1;
  const totalRow = lastData + 2;
  ws.getCell(`A${totalRow}`).value = "Totale inschrijfsom exclusief btw";
  ws.getCell(`A${totalRow}`).font = { bold: true };
  ws.getCell(`D${totalRow}`).value = { formula: `SUM(D${firstData}:D${lastData})` };
  ws.getCell(`D${totalRow}`).numFmt = "#,##0.00";
  ws.getCell(`D${totalRow}`).font = { bold: true };
  ws.getCell(`A${totalRow + 2}`).value = "Naam inschrijver:";
  ws.getCell(`A${totalRow + 3}`).value = "Datum en handtekening:";
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Parses questions imported from xlsx/csv: columns vraag | vraagsteller | documentverwijzing. */
export async function parseQuestionsFile(data: Buffer, fileName: string): Promise<Array<{ question: string; askedBy: string | null; documentReference: string | null }>> {
  if (fileName.toLowerCase().endsWith(".csv")) {
    const text = data.toString("utf8");
    const sep = text.includes(";") ? ";" : ",";
    return text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(1)
      .map((l) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim()))
      .filter((c) => c[0])
      .map((c) => ({ question: c[0]!, askedBy: c[1] || null, documentReference: c[2] || null }));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const out: Array<{ question: string; askedBy: string | null; documentReference: string | null }> = [];
  ws?.eachRow((row, n) => {
    if (n === 1) return;
    const v = (row.values as unknown[]).slice(1).map((c) => (c === null || c === undefined ? "" : typeof c === "object" && "text" in (c as object) ? String((c as { text: string }).text) : String(c)).trim());
    if (v[0]) out.push({ question: v[0], askedBy: v[1] || null, documentReference: v[2] || null });
  });
  return out;
}
