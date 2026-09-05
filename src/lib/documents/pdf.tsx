import "server-only";
import React from "react";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocBlock, DocSection, StructuredDocument } from "./types";
import { provenanceLine } from "../approvals/types";

Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 56, fontSize: 10, fontFamily: "Helvetica", color: "#0D1428", lineHeight: 1.45 },
  header: { position: "absolute", top: 24, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#5B6478" },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, fontSize: 8, color: "#5B6478", textAlign: "center" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 12, color: "#5B6478", marginBottom: 12 },
  meta: { fontSize: 9, color: "#5B6478", marginBottom: 18 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6, color: "#0D1428" },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 4 },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  paragraph: { marginBottom: 6, textAlign: "justify" },
  bullet: { flexDirection: "row", marginBottom: 2, paddingLeft: 8 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  note: { backgroundColor: "#EAF1FD", borderLeftWidth: 3, borderLeftColor: "#2D6FE8", padding: 6, marginBottom: 8, fontSize: 9 },
  table: { marginBottom: 8, borderWidth: 0.5, borderColor: "#DDE3EE" },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#DDE3EE" },
  tableHeader: { backgroundColor: "#F3F5F9", fontFamily: "Helvetica-Bold" },
  tableCell: { flex: 1, padding: 4, fontSize: 8.5 },
  provenance: { marginTop: 24, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: "#DDE3EE", fontSize: 8.5, color: "#5B6478" },
  disclaimer: { marginTop: 6, fontSize: 8.5, color: "#FF4D1C" },
  summary: { marginBottom: 12, padding: 8, backgroundColor: "#F3F5F9" },
});

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "paragraph":
      return <Text style={styles.paragraph}>{block.text ?? ""}</Text>;
    case "note":
      return (
        <View style={styles.note}>
          <Text>{block.text ?? ""}</Text>
        </View>
      );
    case "bullets":
    case "numbered":
      return (
        <View style={{ marginBottom: 6 }}>
          {(block.items ?? []).map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletMark}>{block.type === "numbered" ? `${i + 1}.` : "•"}</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case "table": {
      const t = block.table;
      if (!t) return null;
      return (
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            {t.headers.map((h, i) => (
              <Text key={i} style={styles.tableCell}>
                {h}
              </Text>
            ))}
          </View>
          {t.rows.map((r, ri) => (
            <View key={ri} style={styles.tableRow} wrap={false}>
              {r.cells.map((c, ci) => (
                <Text key={ci} style={styles.tableCell}>
                  {c}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
  }
}

function Section({ section }: { section: DocSection }) {
  const style = section.level === 1 ? styles.h1 : section.level === 2 ? styles.h2 : styles.h3;
  return (
    <View>
      <Text style={style}>{section.heading}</Text>
      {section.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      {section.sources && section.sources.length > 0 ? (
        <Text style={{ fontSize: 8, color: "#5B6478", marginBottom: 6 }}>Bronnen: {section.sources.join("; ")}</Text>
      ) : null}
    </View>
  );
}

export function PdfDocument({ doc }: { doc: StructuredDocument }) {
  const prov = provenanceLine({
    generatedBy: doc.provenance.generatedBy,
    generatedAt: doc.provenance.generatedAt,
    approvedByName: doc.provenance.approvedByName,
    approvedAt: doc.provenance.approvedAt,
  });
  return (
    <Document title={doc.title} author={doc.provenance.organizationName} language="nl">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Text>{doc.provenance.organizationName}</Text>
          <Text>{doc.reference ?? doc.title}</Text>
        </View>
        <Text style={styles.title}>{doc.title}</Text>
        {doc.subtitle ? <Text style={styles.subtitle}>{doc.subtitle}</Text> : null}
        <Text style={styles.meta}>
          {[doc.reference ? `Kenmerk ${doc.reference}` : null, `Datum ${doc.date}`, `Versie ${doc.provenance.version}`].filter(Boolean).join("  |  ")}
        </Text>
        {doc.summary ? (
          <View style={styles.summary}>
            <Text>{doc.summary}</Text>
          </View>
        ) : null}
        {doc.sections.map((s, i) => (
          <Section key={i} section={s} />
        ))}
        <View style={styles.provenance}>
          <Text>{prov}</Text>
          {doc.disclaimer ? <Text style={styles.disclaimer}>{doc.disclaimer}</Text> : null}
        </View>
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${doc.title} - pagina ${pageNumber} van ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderPdf(doc: StructuredDocument): Promise<Buffer> {
  const buffer = await renderToBuffer(<PdfDocument doc={doc} />);
  return Buffer.from(buffer);
}
