import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
}: {
  title: string;
  description?: string | null;
  breadcrumbs?: Array<{ href?: string; label: string }>;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground" aria-label="Kruimelpad">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {b.href ? (
                  <Link href={b.href} className="hover:text-foreground">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 ? <ChevronRight className="size-3" /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="truncate font-heading text-2xl font-semibold">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-background p-10 text-center">
      <p className="font-heading text-base font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-background">
      <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
        <div>
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KeyValue({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</dt>
          <dd className="mt-0.5 text-sm">{it.value ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
