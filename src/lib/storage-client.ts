import { useServerFn } from "@tanstack/react-start";
import { deleteStorageFile, getDownloadUrl, getUploadUrl } from "@/lib/storage.functions";

/**
 * Cloudflare R2 хранилищесімен жұмыс істеуге арналған клиенттік хук.
 * Файл браузерден R2-ге тікелей жүктеледі (сервер арқылы өтпейді),
 * ал рұқсатты сервер тексереді (presigned URL беру алдында).
 */
export function useStorageActions() {
  const fetchUploadUrl = useServerFn(getUploadUrl);
  const fetchDownloadUrl = useServerFn(getDownloadUrl);
  const fetchDelete = useServerFn(deleteStorageFile);

  async function uploadFile(file: File): Promise<{ key: string }> {
    const { key, uploadUrl } = await fetchUploadUrl({ data: { fileName: file.name } });
    const put = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!put.ok) throw new Error("Файлды жүктеу сәтсіз аяқталды");
    return { key };
  }

  async function openStoredFile(table: string, key: string, fileName?: string | null) {
    const { url } = await fetchDownloadUrl({
      data: fileName ? { table, key, fileName } : { table, key },
    });
    window.open(url, "_blank");
  }

  async function removeStoredFile(table: string, key: string) {
    await fetchDelete({ data: { table, key } });
  }

  return { uploadFile, openStoredFile, removeStoredFile };
}
