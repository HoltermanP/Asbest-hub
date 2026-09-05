"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /toegang|Geen recht|niet toegewezen|Forbidden/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg rounded-lg border bg-background p-6 text-center">
      <h1 className="font-heading text-xl font-semibold">{forbidden ? "Geen toegang" : "Er is iets misgegaan"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "Onbekende fout"}</p>
      {error.digest ? <p className="mt-1 font-mono text-xs text-muted-foreground">ref {error.digest}</p> : null}
      <Button className="mt-4" variant="outline" onClick={() => reset()}>
        Opnieuw proberen
      </Button>
    </div>
  );
}
