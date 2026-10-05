import { createHash, createHmac } from "node:crypto";

// Cloudflare R2 — S3-үйлесімді API. Жаңа npm тәуелділігін қоспау үшін
// presigned URL қолтаңбасы (AWS SigV4) Node.js-тің кіріктірілген crypto
// модулімен қолмен жасалады.

const REGION = "auto";
const SERVICE = "s3";

function hmac(key: Buffer | string, data: string) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function sha256Hex(data: string) {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function amzDate(d: Date) {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function dateStamp(d: Date) {
  return amzDate(d).slice(0, 8);
}

/** AWS-тің RFC3986 қатаң URI-кодтауы (encodeURIComponent-тен қатаңырақ). */
function encodeRfc3986(str: string) {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

function encodePath(key: string) {
  return key
    .split("/")
    .map((segment) => encodeRfc3986(segment))
    .join("/");
}

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function getConfig(): R2Config {
  const accountId = process.env["R2_ACCOUNT_ID"];
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"];
  const bucket = process.env["R2_BUCKET_NAME"];
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    const missing = [
      !accountId && "R2_ACCOUNT_ID",
      !accessKeyId && "R2_ACCESS_KEY_ID",
      !secretAccessKey && "R2_SECRET_ACCESS_KEY",
      !bucket && "R2_BUCKET_NAME",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(`Missing R2 environment variable(s): ${missing}`);
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function presign({
  method,
  key,
  expiresIn,
  extraQuery = {},
}: {
  method: "GET" | "PUT" | "DELETE";
  key: string;
  expiresIn: number;
  extraQuery?: Record<string, string>;
}): string {
  const cfg = getConfig();
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDateStr = amzDate(now);
  const dateStr = dateStamp(now);
  const credentialScope = `${dateStr}/${REGION}/${SERVICE}/aws4_request`;
  const credential = `${cfg.accessKeyId}/${credentialScope}`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDateStr,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
    ...extraQuery,
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k]!)}`)
    .join("&");

  const canonicalUri = `/${cfg.bucket}/${encodePath(key)}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDateStr,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStr);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/** Браузерден R2-ге тікелей жүктеу үшін уақытша PUT сілтемесі. */
export function r2PresignedPutUrl(key: string, expiresInSeconds = 300) {
  return presign({ method: "PUT", key, expiresIn: expiresInSeconds });
}

/** Файлды ашу/жүктеп алу үшін уақытша GET сілтемесі. */
export function r2PresignedGetUrl(key: string, expiresInSeconds = 60, downloadFilename?: string) {
  const extraQuery: Record<string, string> = {};
  if (downloadFilename) {
    const safe = downloadFilename.replace(/["\r\n]/g, "");
    extraQuery["response-content-disposition"] = `attachment; filename="${safe}"`;
  }
  return presign({ method: "GET", key, expiresIn: expiresInSeconds, extraQuery });
}

export async function r2DeleteObject(key: string) {
  const url = presign({ method: "DELETE", key, expiresIn: 60 });
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed: ${res.status} ${await res.text()}`);
  }
}
