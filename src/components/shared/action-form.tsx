"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

/**
 * Form wrapper around a server action returning ActionResult. Shows toasts,
 * refreshes the route on success and optionally navigates.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage = "Opgeslagen",
  redirectTo,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  redirectTo?: (data: unknown) => string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className={className}
      data-pending={pending || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          const res = await action(fd);
          if (res.ok) {
            toast.success(successMessage);
            onSuccess?.();
            if (redirectTo) router.push(redirectTo(res.data));
            else router.refresh();
          } else {
            setError(res.error);
            toast.error(res.error);
          }
        });
      }}
    >
      {children}
      {error ? <p className="mt-2 text-sm text-velocity">{error}</p> : null}
    </form>
  );
}
