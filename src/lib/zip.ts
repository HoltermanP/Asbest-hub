import "server-only";
import JSZip from "jszip";

export interface ZipEntry {
  path: string;
  data: Buffer | string;
}

export async function buildZip(entries: ZipEntry[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const e of entries) zip.file(e.path, e.data);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** File name convention: 01_Aanbestedingsleidraad_v2.docx */
export function conventionalFileName(index: number, label: string, version: number, ext: string): string {
  const safe = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${String(index).padStart(2, "0")}_${safe}_v${version}.${ext}`;
}
