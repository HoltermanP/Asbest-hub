import "server-only";
import { del, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isProduction } from "./env";

export interface StoredFile {
  /** Opaque reference persisted in the database. Either an https blob URL or local://<relative path>. */
  url: string;
  pathname: string;
  size: number;
  contentType: string;
}

const LOCAL_PREFIX = "local://";

function localRoot(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? ".local-storage");
}

function usesBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeKey(key: string): string {
  const cleaned = key.replace(/\\/g, "/").replace(/\.\.+/g, ".").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("\0")) throw new Error("Ongeldige bestandsnaam");
  return cleaned;
}

/** Stores a file under an org-scoped key, e.g. `orgs/<orgId>/investigations/<id>/rapport.pdf`. */
export async function putFile(key: string, data: Buffer | Uint8Array, contentType: string): Promise<StoredFile> {
  const cleanKey = safeKey(key);
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (usesBlob()) {
    const blob = await put(cleanKey, buffer, { access: "public", contentType, addRandomSuffix: true });
    return { url: blob.url, pathname: blob.pathname, size: buffer.length, contentType };
  }
  if (isProduction()) throw new Error("BLOB_READ_WRITE_TOKEN ontbreekt in productie");
  const target = path.join(localRoot(), cleanKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buffer);
  return { url: `${LOCAL_PREFIX}${cleanKey}`, pathname: cleanKey, size: buffer.length, contentType };
}

export async function getFile(url: string): Promise<Buffer> {
  if (url.startsWith(LOCAL_PREFIX)) {
    const rel = safeKey(url.slice(LOCAL_PREFIX.length));
    return fs.readFile(path.join(localRoot(), rel));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bestand niet opgehaald (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFile(url: string): Promise<void> {
  if (url.startsWith(LOCAL_PREFIX)) {
    const rel = safeKey(url.slice(LOCAL_PREFIX.length));
    await fs.rm(path.join(localRoot(), rel), { force: true });
    return;
  }
  await del(url);
}

/** Returns true when the stored file belongs to the organization (org id is part of the key). */
export function fileBelongsToOrg(url: string, orgId: string): boolean {
  const pathname = url.startsWith(LOCAL_PREFIX) ? url.slice(LOCAL_PREFIX.length) : safePathnameFromUrl(url);
  return pathname.startsWith(`orgs/${orgId}/`) || pathname.startsWith(`shared/`);
}

function safePathnameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+/, "");
  } catch {
    return "";
  }
}

/** App route that streams a stored file with an authorization check. */
export function fileDownloadPath(url: string, fileName?: string): string {
  const params = new URLSearchParams({ u: url });
  if (fileName) params.set("name", fileName);
  return `/api/files?${params.toString()}`;
}

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function assertUploadSize(size: number): void {
  if (size > MAX_UPLOAD_BYTES) throw new Error("Bestand is groter dan 50 MB");
}

/**
 * Virus scan hook. Interface is fixed; the default implementation is a no-op
 * that reports "niet gescand" so callers can show this in the UI. Replace with
 * a real scanner (e.g. ClamAV service) by implementing VirusScanner.
 */
export interface VirusScanResult {
  scanned: boolean;
  clean: boolean;
  engine: string;
  details: string | null;
}
export interface VirusScanner {
  scan(data: Buffer, fileName: string): Promise<VirusScanResult>;
}
export const noopVirusScanner: VirusScanner = {
  async scan() {
    return { scanned: false, clean: true, engine: "none", details: "Geen virusscanner geconfigureerd" };
  },
};
export const virusScanner: VirusScanner = noopVirusScanner;
