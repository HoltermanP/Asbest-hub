import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthState, getContext } from "@/lib/auth";
import { openApprovalsForUser } from "@/lib/approvals";
import { ROLE_LABELS } from "@/lib/permissions";
import { ensureOrganizationSettings } from "@/lib/organization";

export const dynamic = "force-dynamic";
/** Server actions in this segment start AI jobs that keep running after the response (after()). */
export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (!state.userId) redirect("/sign-in");
  if (!state.orgId) redirect("/organisatie");
  const ctx = await getContext();
  await ensureOrganizationSettings(ctx);
  const open = await openApprovalsForUser(ctx);
  return (
    <AppShell openApprovals={open.length} roleLabel={ROLE_LABELS[ctx.role]}>
      {children}
    </AppShell>
  );
}
