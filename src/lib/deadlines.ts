import { toIsoDate } from "./format";

/** Dutch national holidays (fixed + Easter-based) used for working-day arithmetic. */
export function dutchHolidays(year: number): Set<string> {
  const set = new Set<string>();
  const add = (d: Date) => set.add(toIsoDate(d));
  add(new Date(year, 0, 1));
  add(new Date(year, 3, 27));
  add(new Date(year, 4, 5));
  add(new Date(year, 11, 25));
  add(new Date(year, 11, 26));
  const easter = easterSunday(year);
  add(easter);
  add(addDays(easter, 1));
  add(addDays(easter, 49));
  add(addDays(easter, -2));
  add(addDays(easter, 39));
  add(addDays(easter, 50));
  return set;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

export function isWorkingDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !dutchHolidays(date.getFullYear()).has(toIsoDate(date));
}

/** Adds (or subtracts, when negative) working days, skipping weekends and Dutch holidays. */
export function addWorkingDays(date: Date, days: number): Date {
  let d = new Date(date.getTime());
  const step = days < 0 ? -1 : 1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    d = addDays(d, step);
    if (isWorkingDay(d)) remaining--;
  }
  return d;
}

export type PermitType = "sloopmelding" | "asbestmelding_lavs" | "startmelding_szw" | "omgevingsvergunning" | "overige";

export interface PermitTerm {
  type: PermitType;
  label: string;
  authority: string;
  /** Statutory lead time before the start of work. */
  days: number;
  workingDays: boolean;
  basis: string;
}

/**
 * Statutory lead times before the planned start of remediation.
 * - Sloopmelding: minimaal 4 weken voor aanvang (Besluit bouwwerken leefomgeving art. 7.10; voorheen Bouwbesluit 2012 art. 1.26). Bij particuliere woningen met < 35 m2 hechtgebonden materiaal geldt in bepaalde gevallen 5 werkdagen.
 * - Asbestmelding LAVS / startmelding Arbeidsinspectie: uiterlijk 2 werkdagen voor aanvang bij risicoklasse 2/2A (Arbobesluit art. 4.47c).
 */
export const PERMIT_TERMS: Record<PermitType, PermitTerm> = {
  sloopmelding: {
    type: "sloopmelding",
    label: "Sloopmelding (Omgevingsloket / DSO)",
    authority: "Gemeente (bevoegd gezag Omgevingswet)",
    days: 28,
    workingDays: false,
    basis: "Bbl art. 7.10: melding ten minste vier weken voor aanvang van de sloopwerkzaamheden.",
  },
  asbestmelding_lavs: {
    type: "asbestmelding_lavs",
    label: "Asbestmelding via LAVS",
    authority: "Nederlandse Arbeidsinspectie / gemeente / certificerende instelling via LAVS",
    days: 2,
    workingDays: true,
    basis: "Arbobesluit art. 4.47c: melding uiterlijk twee werkdagen voor aanvang bij risicoklasse 2 en 2A, door de gecertificeerde saneerder.",
  },
  startmelding_szw: {
    type: "startmelding_szw",
    label: "Startmelding Nederlandse Arbeidsinspectie",
    authority: "Nederlandse Arbeidsinspectie",
    days: 2,
    workingDays: true,
    basis: "Arbobesluit art. 4.47c; de melding via LAVS bereikt de Arbeidsinspectie automatisch.",
  },
  omgevingsvergunning: {
    type: "omgevingsvergunning",
    label: "Omgevingsvergunning",
    authority: "Gemeente (bevoegd gezag Omgevingswet)",
    days: 56,
    workingDays: false,
    basis: "Omgevingswet: reguliere procedure acht weken (verlengbaar met zes weken).",
  },
  overige: {
    type: "overige",
    label: "Overige melding",
    authority: "Nader te bepalen",
    days: 14,
    workingDays: false,
    basis: "Organisatiespecifieke termijn.",
  },
};

/** Latest submission date for a permit given the planned start date. */
export function latestSubmissionDate(type: PermitType, plannedStart: Date, overrideDays?: number): Date {
  const term = PERMIT_TERMS[type];
  const days = overrideDays ?? term.days;
  return term.workingDays ? addWorkingDays(plannedStart, -days) : addDays(plannedStart, -days);
}

export interface RequiredPermit {
  type: PermitType;
  required: boolean;
  reason: string;
}

/** Rule-based baseline of required notifications; the permit-advisor agent refines this. */
export function requiredPermits(input: {
  objectType: "woning" | "gebouw" | "bodem" | "installatie" | "infra";
  riskClass: "1" | "2" | "2A" | null;
  isMonument?: boolean;
}): RequiredPermit[] {
  const out: RequiredPermit[] = [];
  const structural = input.objectType !== "bodem";
  out.push({
    type: "sloopmelding",
    required: structural,
    reason: structural
      ? "Verwijderen van asbest uit een bouwwerk is sloopwerk waarvoor een sloopmelding verplicht is (Bbl art. 7.10)."
      : "Bij bodemsanering is geen sloopmelding vereist; toets op Wet bodembescherming/Omgevingswet bodem.",
  });
  const hoog = input.riskClass === "2" || input.riskClass === "2A";
  out.push({
    type: "asbestmelding_lavs",
    required: hoog,
    reason: hoog
      ? "Risicoklasse 2/2A: melding door gecertificeerde saneerder via LAVS, uiterlijk twee werkdagen voor aanvang (Arbobesluit art. 4.47c)."
      : "Risicoklasse 1: geen LAVS-startmelding verplicht, wel registratie van het werk aanbevolen.",
  });
  out.push({
    type: "startmelding_szw",
    required: hoog,
    reason: hoog ? "Startmelding Nederlandse Arbeidsinspectie volgt uit de LAVS-melding." : "Niet vereist bij risicoklasse 1.",
  });
  out.push({
    type: "omgevingsvergunning",
    required: Boolean(input.isMonument),
    reason: input.isMonument
      ? "Rijksmonument of gemeentelijk monument: omgevingsvergunning voor sloopactiviteit vereist."
      : "Alleen vereist bij monumenten, beschermd stadsgezicht of aanvullende activiteiten.",
  });
  return out;
}

/** Asbestos inventory reports older than three years require a check/update. */
export const INVESTIGATION_VALIDITY_YEARS = 3;

export function investigationValidity(reportDate: Date, now = new Date()): { validUntil: Date; expired: boolean; warning: boolean; daysLeft: number } {
  const validUntil = new Date(reportDate.getTime());
  validUntil.setFullYear(validUntil.getFullYear() + INVESTIGATION_VALIDITY_YEARS);
  const daysLeft = Math.floor((validUntil.getTime() - now.getTime()) / 86_400_000);
  return { validUntil, expired: daysLeft < 0, warning: daysLeft < 180, daysLeft };
}

export interface ReminderDue {
  daysBefore: number;
  dueOn: Date;
}

/** Which reminders should fire today for a deadline given configured lead days and already-sent markers. */
export function remindersDue(deadline: Date, reminderDaysBefore: number[], alreadySent: string[], today = new Date()): ReminderDue[] {
  const out: ReminderDue[] = [];
  const todayIso = toIsoDate(today);
  for (const days of reminderDaysBefore) {
    const dueOn = addDays(deadline, -days);
    const key = `${days}`;
    if (alreadySent.includes(key)) continue;
    if (toIsoDate(dueOn) <= todayIso && todayIso <= toIsoDate(deadline)) out.push({ daysBefore: days, dueOn });
  }
  return out;
}
