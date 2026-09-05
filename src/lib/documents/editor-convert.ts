/**
 * Conversion between StructuredDocument sections and the ProseMirror (Tiptap)
 * document JSON used by the Word-like editor. Pure functions, no DOM.
 */
import type { DocBlock, DocSection } from "./types";
import { parseInline } from "./inline";

export interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

function textNodes(text: string): PmNode[] {
  return parseInline(text)
    .filter((r) => r.text.length > 0)
    .map((r) => {
      const marks: PmNode["marks"] = [];
      if (r.bold) marks.push({ type: "bold" });
      if (r.italic) marks.push({ type: "italic" });
      return marks.length ? { type: "text", text: r.text, marks } : { type: "text", text: r.text };
    });
}

function paragraph(text: string): PmNode {
  const content = textNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
}

/** StructuredDocument sections -> ProseMirror doc. Section headings become h1/h2/h3. */
export function sectionsToPm(sections: DocSection[]): PmNode {
  const content: PmNode[] = [];
  for (const s of sections) {
    content.push({ type: "heading", attrs: { level: s.level }, content: textNodes(s.heading) });
    for (const b of s.blocks) {
      switch (b.type) {
        case "paragraph":
          content.push(paragraph(b.text ?? ""));
          break;
        case "note":
          content.push({ type: "blockquote", content: [paragraph(b.text ?? "")] });
          break;
        case "bullets":
        case "numbered":
          content.push({ type: b.type === "bullets" ? "bulletList" : "orderedList", content: (b.items ?? []).map((it) => ({ type: "listItem", content: [paragraph(it)] })) });
          break;
        case "table": {
          const t = b.table;
          if (!t) break;
          const rows: PmNode[] = [
            { type: "tableRow", content: t.headers.map((h) => ({ type: "tableHeader", content: [paragraph(h)] })) },
            ...t.rows.map((r) => ({ type: "tableRow", content: r.cells.map((c) => ({ type: "tableCell", content: [paragraph(c)] })) })),
          ];
          content.push({ type: "table", content: rows });
          break;
        }
      }
    }
  }
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

function nodeText(node: PmNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") {
    const bold = node.marks?.some((m) => m.type === "bold");
    const italic = node.marks?.some((m) => m.type === "italic");
    const t = node.text ?? "";
    if (bold) return `**${t}**`;
    if (italic) return `_${t}_`;
    return t;
  }
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(nodeText).join(node.type === "paragraph" ? "" : "\n");
}

function cellText(cell: PmNode): string {
  return (cell.content ?? []).map(nodeText).join(" ").trim();
}

/** ProseMirror doc -> StructuredDocument sections. Text before the first heading goes into an "Inleiding" section. */
export function pmToSections(doc: PmNode): DocSection[] {
  const sections: DocSection[] = [];
  let current: DocSection | null = null;
  const ensure = () => {
    if (!current) {
      current = { heading: "Inleiding", level: 1, blocks: [] };
      sections.push(current);
    }
    return current;
  };
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case "heading": {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1))) as 1 | 2 | 3;
        current = { heading: nodeText(node).trim() || "Kop", level, blocks: [] };
        sections.push(current);
        break;
      }
      case "paragraph": {
        const text = nodeText(node).trim();
        if (text) ensure().blocks.push({ type: "paragraph", text });
        break;
      }
      case "blockquote": {
        const text = (node.content ?? []).map(nodeText).join("\n").trim();
        if (text) ensure().blocks.push({ type: "note", text });
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? []).map((li) => (li.content ?? []).map(nodeText).join(" ").trim()).filter(Boolean);
        if (items.length) ensure().blocks.push({ type: node.type === "bulletList" ? "bullets" : "numbered", items });
        break;
      }
      case "table": {
        const rows = node.content ?? [];
        if (rows.length === 0) break;
        const first = rows[0]!;
        const headers = (first.content ?? []).map(cellText);
        const body = rows.slice(1).map((r) => ({ cells: (r.content ?? []).map(cellText) }));
        const block: DocBlock = { type: "table", table: { headers, rows: body } };
        ensure().blocks.push(block);
        break;
      }
      default:
        break;
    }
  }
  return sections.filter((s) => s.blocks.length > 0 || s.heading);
}
