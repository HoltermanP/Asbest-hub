/** Rough token estimate: ~4 characters per token for Dutch prose. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ChunkInput {
  text: string;
  page?: number | null;
  heading?: string | null;
}
export interface Chunk {
  index: number;
  content: string;
  tokenCount: number;
  page: number | null;
  heading: string | null;
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

/**
 * Splits text into chunks of ~targetTokens (default 800) with ~overlapTokens
 * (default 100) overlap, preferring paragraph and sentence boundaries. Pages
 * are chunked independently so every chunk keeps its page number.
 */
export function chunkText(inputs: ChunkInput[], opts: ChunkOptions = {}): Chunk[] {
  const target = (opts.targetTokens ?? 800) * 4;
  const overlap = (opts.overlapTokens ?? 100) * 4;
  const chunks: Chunk[] = [];
  let index = 0;
  for (const input of inputs) {
    const text = normalize(input.text);
    if (!text) continue;
    const pieces = splitWithOverlap(text, target, overlap);
    for (const piece of pieces) {
      chunks.push({
        index: index++,
        content: piece,
        tokenCount: estimateTokens(piece),
        page: input.page ?? null,
        heading: input.heading ?? null,
      });
    }
  }
  return chunks;
}

export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitWithOverlap(text: string, target: number, overlap: number): string[] {
  if (text.length <= target) return [text];
  const out: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (cut > target * 0.5) end = start + cut + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}
