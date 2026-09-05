/** Role model. Pure functions so they can be unit-tested without Clerk. */
export const ROLES = ["admin", "projectleider", "beoordelaar", "lezer", "extern"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Beheerder",
  projectleider: "Projectleider",
  beoordelaar: "Beoordelaar",
  lezer: "Lezer",
  extern: "Externe beoordelaar",
};

export type Permission =
  | "project:read"
  | "project:write"
  | "tender:read"
  | "tender:write"
  | "approval:decide"
  | "assessment:score"
  | "session:manage"
  | "knowledge:read"
  | "knowledge:manage"
  | "settings:read"
  | "settings:write"
  | "org:delete"
  | "ai:run";

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "project:read",
    "project:write",
    "tender:read",
    "tender:write",
    "approval:decide",
    "assessment:score",
    "session:manage",
    "knowledge:read",
    "knowledge:manage",
    "settings:read",
    "settings:write",
    "org:delete",
    "ai:run",
  ]),
  projectleider: new Set<Permission>([
    "project:read",
    "project:write",
    "tender:read",
    "tender:write",
    "approval:decide",
    "assessment:score",
    "session:manage",
    "knowledge:read",
    "settings:read",
    "ai:run",
  ]),
  beoordelaar: new Set<Permission>(["project:read", "tender:read", "assessment:score", "knowledge:read"]),
  lezer: new Set<Permission>(["project:read", "tender:read", "knowledge:read", "settings:read"]),
  extern: new Set<Permission>(["tender:read", "assessment:score", "knowledge:read"]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Maps a Clerk organization role string (e.g. "org:projectleider") to an app role. */
export function roleFromClerk(orgRole: string | null | undefined): Role {
  if (!orgRole) return "lezer";
  const raw = orgRole.replace(/^org:/, "").toLowerCase();
  if ((ROLES as readonly string[]).includes(raw)) return raw as Role;
  if (raw === "member") return "lezer";
  return "lezer";
}

/** Roles that only see tenders they are explicitly assigned to. */
export function isTenderScopedRole(role: Role): boolean {
  return role === "beoordelaar" || role === "extern";
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Geen toegang tot deze actie") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Niet ingelogd") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Niet gevonden") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
