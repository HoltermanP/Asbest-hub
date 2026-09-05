import { diffLines } from "diff";
import type { StructuredDocument } from "./types";

/** Flattens a structured document to plain text lines for diffing. */
export function documentToText(doc: StructuredDocument): string {
  const lines: string[] = [doc.title];
  if (doc.subtitle) lines.push(doc.subtitle);
  if (doc.summary) lines.push(doc.summary);
  for (const s of doc.sections) {
    lines.push(`${"#".repeat(s.level)} ${s.heading}`);
    for (const b of s.blocks) {
      if (b.type === "paragraph" || b.type === "note") lines.push(b.text ?? "");
      if (b.type === "bullets" || b.type === "numbered") for (const i of b.items ?? []) lines.push(`- ${i}`);
      if (b.type === "table" && b.table) {
        lines.push(b.table.headers.join(" | "));
        for (const r of b.table.rows) lines.push(r.cells.join(" | "));
      }
    }
  }
  return lines.join("\n");
}

export interface DiffPart {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export function diffDocuments(a: StructuredDocument, b: StructuredDocument): DiffPart[] {
  return diffLines(documentToText(a), documentToText(b)).map((p) => ({
    type: p.added ? "added" : p.removed ? "removed" : "unchanged",
    text: p.value,
  }));
}

/** Short human-readable summary of what changed between two versions. */
export function diffSummary(a: StructuredDocument, b: StructuredDocument): string {
  const parts = diffDocuments(a, b);
  const added = parts.filter((p) => p.type === "added").reduce((n, p) => n + p.text.split("\n").filter(Boolean).length, 0);
  const removed = parts.filter((p) => p.type === "removed").reduce((n, p) => n + p.text.split("\n").filter(Boolean).length, 0);
  const headingsA = new Set(a.sections.map((s) => s.heading));
  const headingsB = new Set(b.sections.map((s) => s.heading));
  const newSections = [...headingsB].filter((h) => !headingsA.has(h));
  const droppedSections = [...headingsA].filter((h) => !headingsB.has(h));
  const bits = [`${added} regels toegevoegd`, `${removed} regels verwijderd`];
  if (newSections.length) bits.push(`nieuwe secties: ${newSections.join(", ")}`);
  if (droppedSections.length) bits.push(`vervallen secties: ${droppedSections.join(", ")}`);
  return bits.join("; ");
}
