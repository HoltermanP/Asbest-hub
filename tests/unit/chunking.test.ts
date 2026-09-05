import { describe, expect, it } from "vitest";
import { chunkText, estimateTokens, normalize } from "@/lib/chunking";
import { reciprocalRankFusion } from "@/lib/search-utils";

describe("chunking", () => {
  it("keeps short texts as one chunk with page info", () => {
    const chunks = chunkText([{ text: "Korte tekst.", page: 3 }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.page).toBe(3);
  });
  it("splits long texts with overlap", () => {
    const sentence = "Dit is een zin over asbestsanering en risicoklassen. ";
    const text = sentence.repeat(200);
    const chunks = chunkText([{ text }], { targetTokens: 200, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.tokenCount).toBeLessThanOrEqual(220);
    // overlap: the start of chunk 2 appears at the end of chunk 1
    const tail = chunks[0]!.content.slice(-30);
    expect(chunks[1]!.content.includes(tail.slice(0, 15)) || chunks[1]!.content.startsWith("Dit is")).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });
  it("normalizes whitespace and estimates tokens", () => {
    expect(normalize("a  \n\n\n\nb\r\nc")).toBe("a\n\nb\nc");
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});

describe("reciprocal rank fusion", () => {
  it("boosts items present in both lists", () => {
    const fused = reciprocalRankFusion([
      [
        { id: "a", rank: 1 },
        { id: "b", rank: 2 },
      ],
      [
        { id: "b", rank: 1 },
        { id: "c", rank: 2 },
      ],
    ]);
    expect(fused.get("b")!).toBeGreaterThan(fused.get("a")!);
    expect(fused.get("c")!).toBeLessThan(fused.get("a")!);
  });
});
