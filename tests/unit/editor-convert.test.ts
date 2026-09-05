import { describe, expect, it } from "vitest";
import { pmToSections, sectionsToPm } from "@/lib/documents/editor-convert";
import { parseInline, stripInline, toInline } from "@/lib/documents/inline";
import type { DocSection } from "@/lib/documents/types";

describe("inline formatting", () => {
  it("parses bold and italic markers into runs and back", () => {
    const runs = parseInline("Dit is **vet** en _cursief_ tekst.");
    expect(runs.map((r) => [r.text, r.bold, r.italic])).toEqual([["Dit is ", false, false], ["vet", true, false], [" en ", false, false], ["cursief", false, true], [" tekst.", false, false]]);
    expect(toInline(runs)).toBe("Dit is **vet** en _cursief_ tekst.");
    expect(stripInline("**a** _b_")).toBe("a b");
    expect(parseInline("snake_case_name")[0]!.text).toBe("snake_case_name");
  });
});

describe("editor conversion", () => {
  const sections: DocSection[] = [
    { heading: "Inleiding", level: 1, blocks: [{ type: "paragraph", text: "Alinea met **vet**." }, { type: "note", text: "Let op." }] },
    { heading: "Scope", level: 2, blocks: [{ type: "bullets", items: ["een", "twee"] }, { type: "numbered", items: ["stap"] }, { type: "table", table: { headers: ["Bron", "Aantal"], rows: [{ cells: ["B01", "12"] }] } }] },
  ];
  it("round-trips sections through ProseMirror JSON", () => {
    const pm = sectionsToPm(sections);
    expect(pm.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    expect(pm.content?.[1]?.content?.[1]).toMatchObject({ type: "text", text: "vet", marks: [{ type: "bold" }] });
    const back = pmToSections(pm);
    expect(back).toEqual(sections);
  });
  it("puts leading text into an introduction section and clamps heading levels", () => {
    const back = pmToSections({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Vooraf" }] }, { type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "Diep" }] }, { type: "paragraph" }] });
    expect(back[0]).toMatchObject({ heading: "Inleiding", blocks: [{ type: "paragraph", text: "Vooraf" }] });
    expect(back[1]).toMatchObject({ heading: "Diep", level: 3 });
  });
});
