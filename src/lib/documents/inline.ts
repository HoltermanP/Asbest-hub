/**
 * Lightweight inline formatting inside StructuredDocument text: **bold** and
 * _italic_ (markdown-style). Kept as plain text in the database so every
 * renderer (HTML, DOCX, PDF) can split it into runs.
 */
export interface InlineRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = () => {
    if (buf) runs.push({ text: buf, bold, italic });
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("**", i)) {
      flush();
      bold = !bold;
      i++;
      continue;
    }
    const ch = text[i]!;
    if (ch === "_" && (i === 0 || /[\s(]/.test(text[i - 1]!) || italic) && (italic ? i === text.length - 1 || /[\s.,;:)!?]/.test(text[i + 1] ?? " ") : /\S/.test(text[i + 1] ?? " "))) {
      flush();
      italic = !italic;
      continue;
    }
    buf += ch;
  }
  flush();
  return runs.length ? runs : [{ text: "", bold: false, italic: false }];
}

export function toInline(runs: InlineRun[]): string {
  return runs.map((r) => (r.bold ? `**${r.text}**` : r.italic ? `_${r.text}_` : r.text)).join("");
}

export function stripInline(text: string): string {
  return parseInline(text)
    .map((r) => r.text)
    .join("");
}
