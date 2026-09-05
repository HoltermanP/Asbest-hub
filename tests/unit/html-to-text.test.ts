import { describe, expect, it } from "vitest";
import { decodeEntities, htmlToText, keepSectionsMentioning, parseSeedMarkdown, sliceBetween } from "@/lib/html-to-text";

describe("html to text", () => {
  it("keeps headings and lists, drops scripts and nav", () => {
    const html = `<html><head><script>x()</script><style>a{}</style></head><body><nav>menu</nav><h1>Titel &amp; meer</h1><p>Alinea &eacute;&eacute;n.</p><ul><li>punt a</li><li>punt b</li></ul></body></html>`;
    const t = htmlToText(html);
    expect(t).toContain("# Titel & meer");
    expect(t).toContain("Alinea één.");
    expect(t).toContain("- punt a");
    expect(t).not.toContain("menu");
    expect(t).not.toContain("x()");
  });
  it("prefers main content when large", () => {
    const filler = "<p>" + "tekst ".repeat(600) + "</p>";
    const html = `<body><div>buiten</div><main>${filler}<h2>Binnen</h2></main></body>`;
    expect(htmlToText(html)).toContain("## Binnen");
    expect(htmlToText(html)).not.toContain("buiten");
  });
  it("slices between markers and keeps matching sections", () => {
    const text = "# A\nniets\n# Afdeling 5. Asbest\nasbest regels\n# Afdeling 6. Overig\nander";
    expect(sliceBetween(text, "Afdeling 5", "Afdeling 6")).toBe("Afdeling 5. Asbest\nasbest regels");
    expect(keepSectionsMentioning(text, "asbest")).not.toContain("ander");
    expect(sliceBetween(text, "onbekend", null)).toBe(text);
  });
  it("parses seed front matter", () => {
    const md = `---\ntitle: Test\ncategory: arbo\npublisher: X\nsources:\n  - https://a\n  - https://b (toelichting)\n---\n\n# Kop\nInhoud`;
    const p = parseSeedMarkdown(md);
    expect(p.title).toBe("Test");
    expect(p.category).toBe("arbo");
    expect(p.sources).toHaveLength(2);
    expect(p.body.startsWith("# Kop")).toBe(true);
    expect(decodeEntities("&#8217;&euro;")).toBe("’€");
  });
});
