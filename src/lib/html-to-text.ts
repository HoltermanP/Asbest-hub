/**
 * Minimal HTML -> text conversion tuned for wetten.overheid.nl, iplo.nl, pianoo.nl
 * and similar government sites. Keeps heading structure as markdown-style lines.
 */
export function htmlToText(html: string): string {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<(nav|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<(header|footer)[^>]*>[\s\S]*?<\/\1>/gi, (m) => (m.length < 20000 ? " " : m));
  // Prefer the main content when present.
  const main = /<main[\s\S]*?<\/main>/i.exec(s) ?? /<article[\s\S]*?<\/article>/i.exec(s);
  if (main && main[0].length > 2000) s = main[0];
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, lvl: string, inner: string) => `\n\n${"#".repeat(Number(lvl))} ${strip(inner)}\n\n`);
  s = s.replace(/<(li)[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t: string, inner: string) => `\n- ${strip(inner)}`);
  s = s.replace(/<(p|div|section|tr|table|ul|ol|dl|dt|dd|blockquote|pre)[^>]*>/gi, "\n").replace(/<\/(p|div|section|tr|table|ul|ol|dl|dt|dd|blockquote|pre)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(td|th)>/gi, " | ");
  s = strip(s);
  for (const phrase of BOILERPLATE) s = s.split(phrase).join(" ");
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => !/^-\s*(\.\.\.)?$/.test(l))
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Repeated UI phrases on wetten.overheid.nl that carry no legal content. */
const BOILERPLATE = [
  "Toon relaties in LiDO",
  "Maak een permanente link",
  "Toon wetstechnische informatie",
  "Vergelijk met een eerdere versie",
  "Geen andere versie om mee te vergelijken",
  "Druk het regelingonderdeel af",
  "Sla het regelingonderdeel op",
  "Direct naar content",
];

function strip(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", euml: "ë", egrave: "è", ouml: "ö", uuml: "ü", iuml: "ï", auml: "ä", ndash: "-", mdash: "-", hellip: "...", sect: "§", deg: "°", euro: "€", rsquo: "'", lsquo: "'", ldquo: "\"", rdquo: "\"" };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Cuts text between two markers (case-insensitive, first occurrence). Returns the full text when markers are not found. */
export function sliceBetween(text: string, from: string | null, to: string | null): string {
  let start = 0;
  let end = text.length;
  if (from) {
    // Use the last occurrence: tables of contents repeat headings before the body.
    const i = text.toLowerCase().lastIndexOf(from.toLowerCase());
    if (i >= 0) start = i;
  }
  if (to) {
    const j = text.toLowerCase().indexOf(to.toLowerCase(), start + (from?.length ?? 0) + 1);
    if (j > start) end = j;
  }
  return text.slice(start, end).replace(/[\s#]+$/, "").trim();
}

/** Keeps only sections (heading + body) that mention the keyword; useful for large acts with a small relevant part. */
export function keepSectionsMentioning(text: string, keyword: string): string {
  const parts = text.split(/\n(?=#{1,6} )/);
  const kw = keyword.toLowerCase();
  const kept = parts.filter((p) => p.toLowerCase().includes(kw));
  return (kept.length ? kept : parts).join("\n").trim();
}

/** Parses a markdown seed file with YAML-ish front matter (title, category, publisher, sources list). */
export function parseSeedMarkdown(md: string): { title: string; category: string; publisher: string | null; sources: string[]; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(md);
  if (!m) return { title: md.split("\n")[0]?.replace(/^#\s*/, "") ?? "Onbekend", category: "overig", publisher: null, sources: [], body: md };
  const front = m[1]!;
  const body = m[2]!.trim();
  const get = (key: string) => new RegExp(`^${key}:\\s*(.*)$`, "m").exec(front)?.[1]?.trim() ?? null;
  const sources = [...front.matchAll(/^\s*-\s+(\S.*)$/gm)].map((x) => x[1]!.trim());
  return { title: get("title") ?? "Onbekend", category: get("category") ?? "overig", publisher: get("publisher"), sources, body };
}
