// ─── delete-account: a person deletes their own account, for good ─
//
// Both stores require this inside the app. Nothing is kept afterwards and
// there is no grace period: what goes, goes now.
//
//   { action: 'preview' }                  what deleting would do, per family
//   { action: 'delete', confirm: 'DELETE' } do it
//   { action: 'business_preview', family_id }                 Delete this business (051):
//   { action: 'delete_business', family_id, confirm_name }    what goes, then do it
//   { action: 'family_preview', family_id }                   Delete a family vault (057),
//   { action: 'delete_family', family_id, confirm_name }      from Settings › Your vaults
//
// A family is deleted only by its owner: its creator while an admin of it,
// else its longest-standing admin (057's family_owner). Another admin's
// preview says who the owner is. Never a personal vault, which goes only
// with its account.
//
// A business never goes with an account (051). While someone is a
// business's last admin, deleting their account is refused (409
// business_admin) before anything is touched: they make someone else an
// admin, or delete the business itself, by typing its name.
//
// The caller is ALWAYS the person in the session; the body names nobody.
// The database side is migration 029 (service role only):
//   account_deletion_plan()   which families go with the account: those
//                             nobody would be left to manage
//   family_storage_objects()  the files in one family's folder
//   delete_account_data()     every row, in one transaction
//
// The order makes a failure safe to retry. Files first: if removing them
// fails, nothing else has happened yet. Then the rows, all or nothing. Then
// the sign-in; if that fails, calling again finds no data and finishes it.
//
// Answers:
//   200 preview: { families: [...] }   (each with kind and blocked, 051)
//   200 delete:  { deleted: true, families_deleted, families_left, files_deleted }
//   200 business_preview: { business: { family_id, name, other_members, document_count } }
//   200 delete_business:  { deleted: true, files_deleted }
//   200 family_preview: { family: { family_id, name, can_delete, owner_name, other_members, document_count } }
//   200 delete_family:  { deleted: true, files_deleted }
//   400 no confirmation, or the wrong name     401 not signed in
//   403 not an admin of that business, or not that family's owner
//   409 { status: 'personal_vault' | 'business' }  not a family vault to delete this way
//   409 { status: 'business_admin', businesses }  the last admin of a business
//   503 { status: 'needs_migration' }  029 (for a business 051, for a family 057) is not applied
// ────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { openRefreshToken, revokeToken } from "../_shared/gmail.ts";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface PlanRow {
  family_id: string;
  family_name: string;
  storage_namespace: string;
  role: string;
  other_members: number;
  other_admins: number;
  document_count: number;
  your_documents: number;
  delete_family: boolean;
  /** 051: 'business' or 'family'; absent before it. */
  kind?: string;
  /** 051: a business whose last admin this person is. */
  blocked?: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUSINESS_NEEDS_MIGRATION = {
  status: "needs_migration",
  error: "Deleting a business is not switched on yet.",
};

const FAMILY_NEEDS_MIGRATION = {
  status: "needs_migration",
  error: "Deleting a family vault is not switched on yet.",
};

const needsMigration = (error: { code?: string; message?: string }) =>
  error.code === "PGRST202" || /could not find the function/i.test(error.message ?? "");

const NEEDS_MIGRATION = {
  status: "needs_migration",
  error: "Deleting your account from the app is not switched on yet.",
};

// Storage's remove() takes a list; keep each call small.
const REMOVE_BATCH = 100;
// A page of names per call (PostgREST caps rows), so ask again until none are
// left. The guard only stops a loop that makes no progress.
const MAX_ROUNDS = 500;

/** Remove every file under these family folders. Returns how many went. */
async function removeFamilyFiles(supabase: SupabaseClient, namespaces: string[]): Promise<number> {
  let removed = 0;
  for (const ns of namespaces) {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const { data, error } = await supabase.rpc("family_storage_objects", { p_storage_namespace: ns });
      if (error) throw new Error(`Could not list the files of ${ns}: ${error.message}`);
      const names = (data ?? []) as string[];
      if (!names.length) break;
      for (let i = 0; i < names.length; i += REMOVE_BATCH) {
        const batch = names.slice(i, i + REMOVE_BATCH);
        const { error: removeErr } = await supabase.storage.from("documents").remove(batch);
        if (removeErr) throw new Error(`Could not delete the files of ${ns}: ${removeErr.message}`);
        removed += batch.length;
      }
    }
  }
  return removed;
}

/** Ask Google to forget this person's Gmail permission. Best effort: the row goes either way. */
async function revokeGmail(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from("gmail_connections")
      .select("refresh_token_enc")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.refresh_token_enc) await revokeToken(await openRefreshToken(data.refresh_token_enc));
  } catch (err) {
    console.warn("[delete-account] Gmail permission not revoked at Google:", (err as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, confirm, family_id: familyId, confirm_name: confirmName } = await req.json().catch(() => ({}));
    if (!["preview", "delete", "business_preview", "delete_business", "family_preview", "delete_family"].includes(action)) {
      return json(400, { error: "action must be preview, delete, business_preview, delete_business, family_preview or delete_family" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await requireUser(req, supabase);
    if (!auth.ok) return auth.response;
    const userId = auth.userId;

    // ── Delete this business (051) ─────────────────────────────────
    // Checked as the person in the session (the functions refuse anyone but
    // an admin of that business), then files first, then rows, as below.
    if (action === "business_preview" || action === "delete_business") {
      if (typeof familyId !== "string" || !UUID.test(familyId)) {
        return json(400, { error: "Say which business." });
      }
      const { data: bizData, error: bizErr } = await supabase.rpc("business_deletion_plan", {
        p_user_id: userId, p_family_id: familyId,
      });
      if (bizErr) {
        if (needsMigration(bizErr)) return json(503, BUSINESS_NEEDS_MIGRATION);
        if (bizErr.code === "42501") return json(403, { error: "Only an admin of this business can delete it." });
        console.error("[delete-account] business plan failed:", bizErr.code, bizErr.message);
        return json(500, { error: "Could not work out what to delete. Please try again." });
      }
      const biz = ((bizData ?? []) as Array<{
        family_id: string; family_name: string; storage_namespace: string; other_members: string[]; document_count: number;
      }>)[0];
      if (!biz) return json(403, { error: "Only an admin of this business can delete it." });

      if (action === "business_preview") {
        return json(200, {
          business: {
            family_id: biz.family_id,
            name: biz.family_name,
            other_members: biz.other_members ?? [],
            document_count: biz.document_count,
          },
        });
      }

      const typed = typeof confirmName === "string" ? confirmName.trim().toLowerCase() : "";
      if (!typed || typed !== biz.family_name.trim().toLowerCase()) {
        return json(400, { error: `Type the business's name, ${biz.family_name}, to delete it.` });
      }
      const files = await removeFamilyFiles(supabase, [biz.storage_namespace]);
      const { data: purged, error: purgeErr } = await supabase.rpc("purge_business", {
        p_user_id: userId, p_family_id: familyId, p_confirm_name: confirmName,
      });
      if (purgeErr) {
        if (purgeErr.code === "42501") return json(403, { error: "Only an admin of this business can delete it." });
        console.error("[delete-account] purge_business failed:", purgeErr.code, purgeErr.message);
        return json(500, { error: "The business couldn't be deleted. Please try again." });
      }
      let lateFiles = 0;
      try {
        lateFiles = await removeFamilyFiles(supabase, purged ? [purged as string] : []);
      } catch (err) {
        console.error("[delete-account] business files left behind:", (err as Error).message);
      }
      return json(200, { deleted: true, files_deleted: files + lateFiles });
    }

    // ── Delete a family vault (057) ────────────────────────────────
    // Its owner only, the name typed; files first, then rows, as above.
    if (action === "family_preview" || action === "delete_family") {
      if (typeof familyId !== "string" || !UUID.test(familyId)) {
        return json(400, { error: "Say which family." });
      }
      const { data: famData, error: famErr } = await supabase.rpc("family_deletion_plan", {
        p_user_id: userId, p_family_id: familyId,
      });
      if (famErr) {
        if (needsMigration(famErr)) return json(503, FAMILY_NEEDS_MIGRATION);
        if (famErr.code === "42501") return json(403, { error: "Only an admin of this family can do this." });
        if (famErr.hint === "personal_vault" || famErr.hint === "business") {
          return json(409, { status: famErr.hint, error: famErr.message });
        }
        console.error("[delete-account] family plan failed:", famErr.code, famErr.message);
        return json(500, { error: "Could not work out what to delete. Please try again." });
      }
      const fam = ((famData ?? []) as Array<{
        family_id: string; family_name: string; storage_namespace: string; is_owner: boolean;
        owner_name: string | null; other_members: string[]; document_count: number;
      }>)[0];
      if (!fam) return json(403, { error: "Only an admin of this family can do this." });

      if (action === "family_preview") {
        return json(200, {
          family: {
            family_id: fam.family_id,
            name: fam.family_name,
            can_delete: fam.is_owner,
            owner_name: fam.owner_name,
            other_members: fam.other_members ?? [],
            document_count: fam.document_count,
          },
        });
      }

      if (!fam.is_owner) {
        return json(403, { error: `Only ${fam.owner_name ?? "its owner"} can delete ${fam.family_name}.` });
      }
      const typed = typeof confirmName === "string" ? confirmName.trim().toLowerCase() : "";
      if (!typed || typed !== fam.family_name.trim().toLowerCase()) {
        return json(400, { error: `Type the family's name, ${fam.family_name}, to delete it.` });
      }
      const files = await removeFamilyFiles(supabase, [fam.storage_namespace]);
      const { data: purged, error: purgeErr } = await supabase.rpc("purge_family_vault", {
        p_user_id: userId, p_family_id: familyId, p_confirm_name: confirmName,
      });
      if (purgeErr) {
        if (purgeErr.code === "42501") return json(403, { error: purgeErr.message || "Only its owner can delete this family." });
        console.error("[delete-account] purge_family_vault failed:", purgeErr.code, purgeErr.message);
        return json(500, { error: "The family couldn't be deleted. Please try again." });
      }
      let lateFiles = 0;
      try {
        lateFiles = await removeFamilyFiles(supabase, purged ? [purged as string] : []);
      } catch (err) {
        console.error("[delete-account] family files left behind:", (err as Error).message);
      }
      return json(200, { deleted: true, files_deleted: files + lateFiles });
    }

    const { data: planData, error: planErr } = await supabase.rpc("account_deletion_plan", { p_user_id: userId });
    if (planErr) {
      if (needsMigration(planErr)) return json(503, NEEDS_MIGRATION);
      console.error("[delete-account] plan failed:", planErr.code, planErr.message);
      return json(500, { error: "Could not work out what to delete. Please try again." });
    }
    const plan = (planData ?? []) as PlanRow[];

    if (action === "preview") {
      return json(200, {
        families: plan.map((f) => ({
          family_id: f.family_id,
          name: f.family_name,
          role: f.role,
          other_members: f.other_members,
          document_count: f.document_count,
          your_documents: f.your_documents,
          deleted: f.delete_family,
          kind: f.kind ?? "family",
          blocked: f.blocked === true,
        })),
      });
    }

    if (confirm !== "DELETE") {
      return json(400, { error: "Type DELETE to confirm." });
    }

    // A business never goes with an account: its last admin hands it on, or
    // deletes it, first. Refused before anything is touched.
    const blocked = plan.filter((f) => f.blocked).map((f) => f.family_name);
    if (blocked.length) {
      return json(409, {
        status: "business_admin",
        businesses: blocked,
        error: `You're the last admin of ${blocked.join(", ")}. Make someone else an admin, or delete the business, first.`,
      });
    }

    // 1. The files of the families that go with the account.
    const files = await removeFamilyFiles(
      supabase,
      plan.filter((f) => f.delete_family).map((f) => f.storage_namespace),
    );

    // 2. Gmail: tell Google, while the sealed permission still exists.
    await revokeGmail(supabase, userId);

    // 3. Every row, in one transaction.
    const { data: result, error: dataErr } = await supabase.rpc("delete_account_data", { p_user_id: userId });
    if (dataErr) {
      if (needsMigration(dataErr)) return json(503, NEEDS_MIGRATION);
      if (dataErr.hint === "business_admin") return json(409, { status: "business_admin", error: dataErr.message });
      console.error("[delete-account] delete_account_data failed:", dataErr.code, dataErr.message);
      return json(500, { error: "Your account couldn't be deleted, and nothing more was removed. Please try again." });
    }
    const outcome = (result ?? {}) as { deleted_namespaces?: string[]; families_deleted?: number; families_left?: number };

    // 4. Anything added to those folders meanwhile, and the folders of families
    //    the person had created and nobody was left in (found in step 3).
    let lateFiles = 0;
    try {
      lateFiles = await removeFamilyFiles(supabase, outcome.deleted_namespaces ?? []);
    } catch (err) {
      console.error("[delete-account] files left behind:", (err as Error).message);
    }

    // 5. The sign-in itself. Its Gmail connection, feedback and saved chats
    //    go with it (ON DELETE CASCADE).
    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("[delete-account] deleteUser failed:", authErr.message);
      return json(500, {
        error: "Your documents and details are deleted, but your sign-in wasn't. Please try again.",
      });
    }

    return json(200, {
      deleted: true,
      families_deleted: outcome.families_deleted ?? 0,
      families_left: outcome.families_left ?? 0,
      files_deleted: files + lateFiles,
    });
  } catch (err) {
    console.error("[delete-account]", (err as Error).message);
    return json(500, { error: "Your account could not be deleted. Please try again." });
  }
});
