import { describe, expect, it } from "vitest";
import { can, isTenderScopedRole, ROLES, roleFromClerk } from "@/lib/permissions";

describe("permissions", () => {
  it("maps Clerk roles to app roles", () => {
    expect(roleFromClerk("org:admin")).toBe("admin");
    expect(roleFromClerk("org:projectleider")).toBe("projectleider");
    expect(roleFromClerk("org:member")).toBe("lezer");
    expect(roleFromClerk(null)).toBe("lezer");
    expect(roleFromClerk("org:onbekend")).toBe("lezer");
  });

  it("only admin and projectleider may decide approvals", () => {
    for (const role of ROLES) {
      expect(can(role, "approval:decide")).toBe(role === "admin" || role === "projectleider");
    }
  });

  it("readers cannot write", () => {
    expect(can("lezer", "project:write")).toBe(false);
    expect(can("lezer", "project:read")).toBe(true);
    expect(can("extern", "project:read")).toBe(false);
    expect(can("extern", "assessment:score")).toBe(true);
  });

  it("only admin may delete an organization or manage knowledge", () => {
    expect(can("admin", "org:delete")).toBe(true);
    expect(can("projectleider", "org:delete")).toBe(false);
    expect(can("projectleider", "knowledge:manage")).toBe(false);
  });

  it("scopes assessors and externals to assigned tenders", () => {
    expect(isTenderScopedRole("beoordelaar")).toBe(true);
    expect(isTenderScopedRole("extern")).toBe(true);
    expect(isTenderScopedRole("projectleider")).toBe(false);
  });
});
