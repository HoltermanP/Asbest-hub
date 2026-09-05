import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

/** Loads a versioned system prompt from src/ai/prompts/<name>.v<version>.md. */
export function loadPrompt(name: string, version = 1): string {
  const key = `${name}.v${version}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const file = path.join(process.cwd(), "src", "ai", "prompts", `${key}.md`);
  const text = readFileSync(file, "utf8").trim();
  cache.set(key, text);
  return text;
}

export const GLOBAL_RULES = `
Algemene regels voor alle AsbestHub-agents:
- Je schrijft in het Nederlands, zakelijk en feitelijk.
- Al je output is een VOORSTEL. Een mens controleert en accordeert. Je sluit nooit een inschrijver uit, maakt nooit een score definitief, publiceert niets en verstuurt geen meldingen.
- Gebruik de meegeleverde kennisbankfragmenten (gelabeld [K1], [K2], ...) als primaire bron voor wet- en regelgeving. Verwijs naar de labels in het veld sources.
- Verzin geen wetsartikelen, normen, termijnen of certificaten. Als iets niet uit de context blijkt, zeg dat en verlaag de confidence.
- Neem geen persoonsgegevens op die niet functioneel nodig zijn.
- Sluit af met de zin "Controleer altijd de actuele wettekst." waar dat relevant is.
`.trim();
