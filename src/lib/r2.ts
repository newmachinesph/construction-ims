import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 is S3-compatible. Uploads are proxied through our API (the
 * server receives the file, then streams it here) rather than presigned
 * direct-to-browser — so we never configure bucket CORS, and every write is
 * authorized server-side first. Reads are streamed back through an auth-gated
 * route too, keeping material and delivery photos private to logged-in users.
 *
 * The secret access key lives only in server env; this module is `server-only`
 * so a client import fails the build.
 */

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

let client: S3Client | null = null;
function r2(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: "auto",
    endpoint: requireEnv("R2_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return client;
}

/** True when R2 is configured; lets upload features degrade instead of crashing. */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({
      Bucket: requireEnv("R2_BUCKET"),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(
  key: string,
): Promise<{ body: Uint8Array; contentType: string } | null> {
  try {
    const res = await r2().send(
      new GetObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return { body: bytes, contentType: res.ContentType ?? "application/octet-stream" };
  } catch (err) {
    if (err instanceof Error && err.name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: requireEnv("R2_BUCKET"), Key: key }));
}
