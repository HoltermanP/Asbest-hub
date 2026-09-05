import type { StructuredDocument } from "@/lib/documents/types";
import { provenanceLine } from "@/lib/approvals/types";

/** Renders a structured document inline (HTML), matching the DOCX/PDF layout. */
export function DocumentView({ doc }: { doc: StructuredDocument }) {
  return (
    <article className="prose prose-sm max-w-none rounded-lg border bg-background p-6">
      <h1 className="font-heading text-xl font-semibold">{doc.title}</h1>
      {doc.subtitle ? <p className="text-muted-foreground">{doc.subtitle}</p> : null}
      <p className="font-mono text-xs text-muted-foreground">
        {[doc.reference ? `Kenmerk ${doc.reference}` : null, `Datum ${doc.date}`, `Versie ${doc.provenance.version}`].filter(Boolean).join("  |  ")}
      </p>
      {doc.summary ? <p className="rounded-md bg-muted p-3 text-sm">{doc.summary}</p> : null}
      {doc.sections.map((s, i) => {
        const Tag = s.level === 1 ? "h2" : s.level === 2 ? "h3" : "h4";
        return (
          <section key={i} className="mt-4">
            <Tag className="font-heading font-semibold">{s.heading}</Tag>
            {s.blocks.map((b, j) => {
              if (b.type === "paragraph") return <p key={j}>{b.text}</p>;
              if (b.type === "note")
                return (
                  <p key={j} className="border-l-4 border-ai-blue bg-accent p-2 text-sm">
                    {b.text}
                  </p>
                );
              if (b.type === "bullets")
                return (
                  <ul key={j} className="list-disc pl-5">
                    {(b.items ?? []).map((it, k) => (
                      <li key={k}>{it}</li>
                    ))}
                  </ul>
                );
              if (b.type === "numbered")
                return (
                  <ol key={j} className="list-decimal pl-5">
                    {(b.items ?? []).map((it, k) => (
                      <li key={k}>{it}</li>
                    ))}
                  </ol>
                );
              if (b.type === "table" && b.table)
                return (
                  <div key={j} className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          {b.table.headers.map((h, k) => (
                            <th key={k} className="border-b bg-muted px-2 py-1 text-left font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {b.table.rows.map((r, k) => (
                          <tr key={k}>
                            {r.cells.map((c, m) => (
                              <td key={m} className="border-b px-2 py-1 align-top">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              return null;
            })}
            {s.sources && s.sources.length > 0 ? <p className="text-xs text-muted-foreground">Bronnen: {s.sources.join("; ")}</p> : null}
          </section>
        );
      })}
      <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground">
        <p>
          {provenanceLine({
            generatedBy: doc.provenance.generatedBy,
            generatedAt: doc.provenance.generatedAt,
            approvedByName: doc.provenance.approvedByName,
            approvedAt: doc.provenance.approvedAt,
          })}
        </p>
        {doc.disclaimer ? <p className="text-velocity">{doc.disclaimer}</p> : null}
      </footer>
    </article>
  );
}
