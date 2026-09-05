"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export interface ViewerDocument {
  id: string;
  fileName: string;
  url: string;
  isPdf: boolean;
  pages: Array<{ page: number; text: string }>;
}

/**
 * Inline document viewer: the PDF in an iframe on the requested page, next to the
 * extracted page text with the cited passage highlighted.
 */
export function PdfCitationViewer({ documents, initialDocId, initialPage, highlight }: { documents: ViewerDocument[]; initialDocId: string | null; initialPage: number; highlight: string | null }) {
  const [docId, setDocId] = useState(initialDocId ?? documents[0]?.id ?? "");
  const [page, setPage] = useState(initialPage || 1);
  const doc = documents.find((d) => d.id === docId) ?? documents[0];
  const pageText = doc?.pages.find((p) => p.page === page)?.text ?? "";
  const parts = useMemo(() => {
    if (!highlight || !pageText) return [{ text: pageText, hit: false }];
    const needle = highlight.trim().slice(0, 60).toLowerCase();
    const idx = pageText.toLowerCase().indexOf(needle);
    if (idx < 0) return [{ text: pageText, hit: false }];
    return [
      { text: pageText.slice(0, idx), hit: false },
      { text: pageText.slice(idx, idx + Math.max(needle.length, Math.min(highlight.length, 400))), hit: true },
      { text: pageText.slice(idx + Math.max(needle.length, Math.min(highlight.length, 400))), hit: false },
    ];
  }, [highlight, pageText]);
  if (!doc) return <p className="text-sm text-muted-foreground">Geen documenten.</p>;
  const pageCount = doc.pages.length || 1;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={docId} onChange={(e) => { setDocId(e.target.value); setPage(1); }} className="border-input h-8 rounded-md border bg-background px-2 text-sm">
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fileName}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          Vorige
        </Button>
        <span className="font-mono text-xs">
          p. {page} / {pageCount}
        </span>
        <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
          Volgende
        </Button>
        <Button size="sm" variant="ghost" render={<a href={doc.url} target="_blank" rel="noreferrer">Openen</a>} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {doc.isPdf ? (
          <iframe key={`${doc.id}-${page}`} src={`${doc.url}&inline=1#page=${page}`} title={doc.fileName} className="h-[70vh] w-full rounded-md border bg-white" />
        ) : (
          <div className="flex h-[70vh] items-center justify-center rounded-md border text-sm text-muted-foreground">Inline weergave alleen voor pdf; gebruik “Openen”.</div>
        )}
        <div className="h-[70vh] overflow-auto rounded-md border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {parts.map((p, i) => (
            <span key={i} className={p.hit ? "bg-yellow-200 font-medium" : undefined}>
              {p.text}
            </span>
          ))}
          {!pageText ? <span className="text-muted-foreground">Geen tekst op deze pagina.</span> : null}
        </div>
      </div>
    </div>
  );
}
