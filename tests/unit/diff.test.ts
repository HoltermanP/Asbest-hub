import { describe, expect, it } from "vitest";
import { diffDocuments, diffSummary, documentToText } from "@/lib/documents/diff";
import type { StructuredDocument } from "@/lib/documents/types";

function doc(sections: StructuredDocument["sections"]): StructuredDocument {
  return {
    title: "T",
    subtitle: null,
    reference: null,
    date: "2026-01-01",
    summary: null,
    sections,
    provenance: { generatedBy: "ai", generatedAt: "2026-01-01", model: "m", approvedByName: null, approvedAt: null, version: 1, organizationName: "O" },
    disclaimer: null,
  };
}

describe("document diff", () => {
  it("summarises added and removed lines and sections", () => {
    const a = doc([{ heading: "Inleiding", level: 1, blocks: [{ type: "paragraph", text: "Een." }] }]);
    const b = doc([
      { heading: "Inleiding", level: 1, blocks: [{ type: "paragraph", text: "Een." }, { type: "bullets", items: ["x", "y"] }] },
      { heading: "Scope", level: 1, blocks: [{ type: "table", table: { headers: ["a"], rows: [{ cells: ["1"] }] } }] },
    ]);
    const s = diffSummary(a, b);
    expect(s).toContain("toegevoegd");
    expect(s).toContain("nieuwe secties: Scope");
    expect(diffDocuments(a, b).some((p) => p.type === "added")).toBe(true);
    expect(documentToText(b)).toContain("- x");
  });
});
