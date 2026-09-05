"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import type { ChecklistItem } from "@/db/schema";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

export function ChecklistRow({ phaseId, item, toggle, readOnly }: { phaseId: string; item: ChecklistItem; toggle: (phaseId: string, itemId: string, done: boolean) => Promise<ActionResult<unknown>>; readOnly: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className={cn("flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60", pending && "opacity-60")}>
      <Checkbox
        checked={item.done}
        disabled={readOnly || pending}
        onCheckedChange={(v) =>
          start(async () => {
            const res = await toggle(phaseId, item.id, Boolean(v));
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          })
        }
      />
      <span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
    </label>
  );
}
