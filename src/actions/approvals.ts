"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/lib/action-result";
import { decideApproval } from "@/lib/approvals";
import { getContext } from "@/lib/auth";

const decideSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["goedgekeurd", "afgewezen"]),
  comment: z.string().max(4000).optional().default(""),
});

/** Human decision on an approval request. Server-side enforces role and human actor. */
export async function decideApprovalAction(input: { approvalId: string; decision: "goedgekeurd" | "afgewezen"; comment: string }) {
  return runAction(async () => {
    const ctx = await getContext();
    const parsed = decideSchema.parse(input);
    const row = await decideApproval({ ctx, approvalId: parsed.approvalId, decision: parsed.decision, comment: parsed.comment });
    revalidatePath("/accorderingen");
    revalidatePath("/projecten");
    revalidatePath("/aanbestedingen");
    return { id: row.id, status: row.status };
  });
}
