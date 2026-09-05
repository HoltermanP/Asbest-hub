import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { provenanceLine } from "../approvals/types";
import type { DocBlock, DocSection, StructuredDocument } from "./types";

const FONT = "Calibri";

function heading(text: string, level: 1 | 2 | 3): Paragraph {
  const map = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
  return new Paragraph({ text, heading: map[level], spacing: { before: level === 1 ? 320 : 200, after: 120 } });
}

function blockToParagraphs(block: DocBlock): Array<Paragraph | Table> {
  switch (block.type) {
    case "paragraph":
      return [new Paragraph({ children: [new TextRun({ text: block.text ?? "", font: FONT, size: 21 })], spacing: { after: 120 } })];
    case "note":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text ?? "", font: FONT, size: 20, italics: true })],
          shading: { type: ShadingType.CLEAR, fill: "EAF1FD" },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2D6FE8" } },
          spacing: { after: 160 },
        }),
      ];
    case "bullets":
      return (block.items ?? []).map(
        (item) => new Paragraph({ children: [new TextRun({ text: item, font: FONT, size: 21 })], bullet: { level: 0 }, spacing: { after: 60 } }),
      );
    case "numbered":
      return (block.items ?? []).map(
        (item) =>
          new Paragraph({
            children: [new TextRun({ text: item, font: FONT, size: 21 })],
            numbering: { reference: "numbered", level: 0 },
            spacing: { after: 60 },
          }),
      );
    case "table": {
      const t = block.table;
      if (!t) return [];
      const header = new TableRow({
        tableHeader: true,
        children: t.headers.map(
          (h) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: "F3F5F9" },
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, font: FONT, size: 19 })] })],
            }),
        ),
      });
      const rows = t.rows.map(
        (r) =>
          new TableRow({
            children: r.cells.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, font: FONT, size: 19 })] })] })),
          }),
      );
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] }), new Paragraph({ spacing: { after: 120 } })];
    }
  }
}

function sectionToChildren(section: DocSection): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [heading(section.heading, section.level)];
  for (const b of section.blocks) out.push(...blockToParagraphs(b));
  if (section.sources && section.sources.length > 0) {
    out.push(
      new Paragraph({
        children: [new TextRun({ text: `Bronnen: ${section.sources.join("; ")}`, font: FONT, size: 17, color: "5B6478" })],
        spacing: { after: 120 },
      }),
    );
  }
  return out;
}

export async function renderDocx(doc: StructuredDocument): Promise<Buffer> {
  const prov = provenanceLine({
    generatedBy: doc.provenance.generatedBy,
    generatedAt: doc.provenance.generatedAt,
    approvedByName: doc.provenance.approvedByName,
    approvedAt: doc.provenance.approvedAt,
  });
  const children: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: doc.title, font: FONT, size: 44, bold: true, color: "0D1428" })], spacing: { after: 80 } }),
  ];
  if (doc.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: doc.subtitle, font: FONT, size: 26, color: "5B6478" })], spacing: { after: 120 } }));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: [doc.reference ? `Kenmerk ${doc.reference}` : null, `Datum ${doc.date}`, `Versie ${doc.provenance.version}`].filter(Boolean).join("  |  "),
          font: FONT,
          size: 18,
          color: "5B6478",
        }),
      ],
      spacing: { after: 240 },
    }),
  );
  if (doc.summary) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: doc.summary, font: FONT, size: 21 })],
        shading: { type: ShadingType.CLEAR, fill: "F3F5F9" },
        spacing: { after: 240 },
      }),
    );
  }
  for (const s of doc.sections) children.push(...sectionToChildren(s));
  children.push(
    new Paragraph({
      children: [new TextRun({ text: prov, font: FONT, size: 17, color: "5B6478" })],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: "DDE3EE" } },
      spacing: { before: 360, after: 60 },
    }),
  );
  if (doc.disclaimer) children.push(new Paragraph({ children: [new TextRun({ text: doc.disclaimer, font: FONT, size: 17, color: "FF4D1C" })] }));

  const document = new Document({
    creator: doc.provenance.organizationName,
    title: doc.title,
    numbering: {
      config: [{ reference: "numbered", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }],
    },
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: "0D1428", font: FONT } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, color: "0D1428", font: FONT } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: "2D6FE8", font: FONT } },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${doc.provenance.organizationName}  |  ${doc.reference ?? doc.title}`, font: FONT, size: 16, color: "5B6478" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${doc.title} - pagina `, font: FONT, size: 16, color: "5B6478" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: "5B6478" }),
                  new TextRun({ text: " van ", font: FONT, size: 16, color: "5B6478" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: "5B6478" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}
