"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** Button that invokes a server action without a form (e.g. "Genereer met AI"). */
export function ActionButton({
  action,
  children,
  successMessage = "Gestart",
  variant = "default",
  size = "sm",
  confirm,
  className,
  disabled,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  successMessage?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  confirm?: string;
  className?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res.ok) {
            toast.success(successMessage);
            router.refresh();
          } else toast.error(res.error);
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </Button>
  );
}
