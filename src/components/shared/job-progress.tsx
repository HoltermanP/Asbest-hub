"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface JobState {
  status: "wachtrij" | "bezig" | "gereed" | "mislukt";
  progress: number;
  progressMessage: string | null;
  error: string | null;
}

/** Polls /api/jobs/[id] every 2.5 s and refreshes the page when the job finishes. */
export function JobProgress({ jobId, label }: { jobId: string; label?: string }) {
  const [state, setState] = useState<JobState | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function poll() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Status niet opgehaald");
        const data = (await res.json()) as JobState;
        if (!active) return;
        setState(data);
        if (data.status === "gereed" || data.status === "mislukt") {
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
      timer = setTimeout(poll, 2500);
    }
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, router]);

  if (!state) return <div className="text-xs text-muted-foreground">Status ophalen...</div>;
  if (state.status === "mislukt")
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-medium">AI-taak mislukt</p>
        <p className="font-mono text-xs">{state.error}</p>
      </div>
    );
  if (state.status === "gereed") return <div className="text-xs text-emerald-700">Gereed. Pagina wordt ververst...</div>;
  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin text-ai-blue" />
        <span>{label ?? "AI-taak"}</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground">{state.progress}%</span>
      </div>
      <Progress value={state.progress} />
      {state.progressMessage ? <p className="text-xs text-muted-foreground">{state.progressMessage}</p> : null}
    </div>
  );
}
