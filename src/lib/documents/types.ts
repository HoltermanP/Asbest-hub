/**
 * Structured document model. Every generated document (project documents,
 * tender documents, letters) is stored in this shape and rendered to DOCX/PDF.
 */
export interface DocTableRow {
  cells: string[];
}
export interface DocTable {
  headers: string[];
  rows: DocTableRow[];
}
export interface DocBlock {
  type: "paragraph" | "bullets" | "numbered" | "table" | "note";
  text?: string;
  items?: string[];
  table?: DocTable;
}
export interface DocSection {
  heading: string;
  level: 1 | 2 | 3;
  blocks: DocBlock[];
  sources?: string[];
}
export interface DocumentProvenance {
  generatedBy: "mens" | "ai";
  generatedAt: string;
  model: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  version: number;
  organizationName: string;
}
export interface StructuredDocument {
  title: string;
  subtitle: string | null;
  reference: string | null;
  date: string;
  summary: string | null;
  sections: DocSection[];
  provenance: DocumentProvenance;
  disclaimer: string | null;
}

export const AI_DISCLAIMER =
  "Dit document is een AI-concept en niet bindend totdat het door een bevoegde medewerker is geaccordeerd. Controleer altijd de actuele wettekst.";
