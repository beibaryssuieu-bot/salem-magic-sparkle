import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type RlsClient = SupabaseClient<Database>;

/**
 * Файл қай кестеге тіркелгеніне қарай рұқсат тексеріледі:
 * - reports / event_plans / event_report_attachments: тек иесі немесе әкімші
 *   (Supabase Storage-тегі бұрынғы саясатпен бірдей)
 * - eduqor_docs: кез келген кірген пайдаланушыға ашық (ортақ кітапхана)
 */
const ALLOWED_TABLES = [
  "reports",
  "event_plans",
  "event_report_attachments",
  "eduqor_docs",
] as const;
type AllowedTable = (typeof ALLOWED_TABLES)[number];

function isAllowedTable(value: string): value is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(value);
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.-]/g, "_");
}

async function isAdminUser(supabase: RlsClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

async function checkFileAccess(
  supabase: RlsClient,
  userId: string,
  table: AllowedTable,
  key: string,
): Promise<boolean> {
  if (table === "eduqor_docs") {
    const { data } = await supabase.from(table).select("id").eq("file_path", key).maybeSingle();
    return !!data;
  }

  const admin = await isAdminUser(supabase, userId);

  if (table === "event_report_attachments") {
    const { data } = await supabase
      .from("event_report_attachments")
      .select("report_id, event_reports(user_id)")
      .eq("file_path", key)
      .maybeSingle();
    if (!data) return false;
    const ownerId = data.event_reports?.user_id;
    return admin || ownerId === userId;
  }

  const { data } = await supabase.from(table).select("user_id").eq("file_path", key).maybeSingle();
  if (!data) return false;
  return admin || data.user_id === userId;
}

/** Жаңа файл жүктеу үшін браузерге тікелей R2-ге арналған уақытша сілтеме. */
export const getUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string }) => {
    if (!input.fileName || typeof input.fileName !== "string") {
      throw new Error("Invalid file name");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const key = `${context.userId}/${crypto.randomUUID()}-${sanitizeFileName(data.fileName)}`;
    const { r2PresignedPutUrl } = await import("@/lib/r2.server");
    const uploadUrl = r2PresignedPutUrl(key);
    return { key, uploadUrl };
  });

/** Бар файлды ашу/жүктеп алу үшін уақытша сілтеме — алдымен рұқсат тексеріледі. */
export const getDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: string; key: string; fileName?: string }) => {
    if (!isAllowedTable(input.table)) throw new Error("Invalid table");
    if (!input.key) throw new Error("Invalid key");
    return input as { table: AllowedTable; key: string; fileName?: string };
  })
  .handler(async ({ data, context }) => {
    const allowed = await checkFileAccess(context.supabase, context.userId, data.table, data.key);
    if (!allowed) throw new Error("Access denied");
    const { r2PresignedGetUrl } = await import("@/lib/r2.server");
    const url = r2PresignedGetUrl(data.key, 60, data.fileName);
    return { url };
  });

/** R2-ден файлды өшіру — алдымен рұқсат тексеріледі. */
export const deleteStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: string; key: string }) => {
    if (!isAllowedTable(input.table)) throw new Error("Invalid table");
    if (!input.key) throw new Error("Invalid key");
    return input as { table: AllowedTable; key: string };
  })
  .handler(async ({ data, context }) => {
    const allowed = await checkFileAccess(context.supabase, context.userId, data.table, data.key);
    if (!allowed) throw new Error("Access denied");
    const { r2DeleteObject } = await import("@/lib/r2.server");
    await r2DeleteObject(data.key);
    return { ok: true };
  });
