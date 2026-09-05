import { describe, expect, it } from "vitest";
import { addWorkingDays, dutchHolidays, investigationValidity, isWorkingDay, latestSubmissionDate, remindersDue, requiredPermits } from "@/lib/deadlines";

describe("working days", () => {
  it("knows Dutch holidays", () => {
    const h = dutchHolidays(2026);
    expect(h.has("2026-04-27")).toBe(true);
    expect(h.has("2026-04-05")).toBe(true); // Easter Sunday 2026
    expect(h.has("2026-04-06")).toBe(true); // Easter Monday
    expect(h.has("2026-05-14")).toBe(true); // Ascension
    expect(h.has("2026-05-25")).toBe(true); // Whit Monday
  });
  it("skips weekends and holidays", () => {
    expect(isWorkingDay(new Date(2026, 3, 27))).toBe(false);
    expect(isWorkingDay(new Date(2026, 3, 28))).toBe(true);
    // Friday 24 April 2026 minus 2 working days -> Wednesday 22 April
    expect(addWorkingDays(new Date(2026, 3, 24), -2).getDate()).toBe(22);
    // Tuesday 28 April 2026 minus 2 working days: skips Mon 27 (Koningsdag) and the weekend -> Thu 23 April
    expect(addWorkingDays(new Date(2026, 3, 28), -2).getDate()).toBe(23);
  });
});

describe("permit terms", () => {
  it("sloopmelding is 4 calendar weeks before start", () => {
    const d = latestSubmissionDate("sloopmelding", new Date(2026, 5, 1));
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(4);
  });
  it("LAVS is 2 working days before start", () => {
    // Monday 8 June 2026 -> Thursday 4 June
    const d = latestSubmissionDate("asbestmelding_lavs", new Date(2026, 5, 8));
    expect(d.getDate()).toBe(4);
  });
  it("proposes permits by object type and risk class", () => {
    const woning2 = requiredPermits({ objectType: "woning", riskClass: "2" });
    expect(woning2.find((p) => p.type === "sloopmelding")!.required).toBe(true);
    expect(woning2.find((p) => p.type === "asbestmelding_lavs")!.required).toBe(true);
    const bodem1 = requiredPermits({ objectType: "bodem", riskClass: "1" });
    expect(bodem1.find((p) => p.type === "sloopmelding")!.required).toBe(false);
    expect(bodem1.find((p) => p.type === "asbestmelding_lavs")!.required).toBe(false);
    expect(requiredPermits({ objectType: "gebouw", riskClass: "2A", isMonument: true }).find((p) => p.type === "omgevingsvergunning")!.required).toBe(true);
  });
});

describe("investigation validity", () => {
  it("warns and expires after three years", () => {
    const now = new Date(2026, 0, 1);
    expect(investigationValidity(new Date(2025, 0, 1), now).expired).toBe(false);
    expect(investigationValidity(new Date(2025, 0, 1), now).warning).toBe(false);
    expect(investigationValidity(new Date(2022, 6, 1), now).expired).toBe(true);
    expect(investigationValidity(new Date(2023, 3, 1), now).warning).toBe(true);
  });
});

describe("reminders", () => {
  it("fires reminders that are due and not yet sent", () => {
    const deadline = new Date(2026, 4, 20);
    const today = new Date(2026, 4, 13);
    const due = remindersDue(deadline, [14, 7, 1], ["14"], today);
    expect(due.map((d) => d.daysBefore)).toEqual([7]);
    expect(remindersDue(deadline, [14, 7, 1], [], new Date(2026, 4, 25))).toEqual([]);
  });
});
