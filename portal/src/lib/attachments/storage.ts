import { mkdir, rmdir, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

// Storage drivers behind the attachments contract (docs/build/attachments.md).
// Selected by STORAGE_DRIVER: "local" (dev, files under portal/.uploads/) or
// "supabase" (production, private bucket via the Storage REST API).

export interface StorageDriver {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  delete(key: string): Promise<void>;
  // A driver provides exactly one delivery mode: local streams the file,
  // supabase issues a short-lived signed URL (<= 60s).
  getStream?(key: string): Promise<ReadableStream<Uint8Array>>;
  getSignedUrl?(key: string): Promise<string>;
}

// Keys are always server-generated posts/{postId}/{uuid}; anything else is a
// programming error and must never reach the filesystem or bucket.
const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const KEY_PATTERN = new RegExp(`^posts/${UUID}/${UUID}$`);

export function assertValidObjectKey(key: string): void {
  if (!KEY_PATTERN.test(key)) {
    throw new Error(`Invalid attachment object key: ${key}`);
  }
}

export function makeObjectKey(postId: string): string {
  const key = `posts/${postId}/${crypto.randomUUID()}`;
  assertValidObjectKey(key);
  return key;
}

export function resolveStorageDriverName(
  value: string | undefined,
  nodeEnv: string | undefined,
): "local" | "supabase" {
  if (value === "local" || value === "supabase") return value;
  if (nodeEnv === "production") {
    throw new Error(
      'Storage driver not configured: set STORAGE_DRIVER to "supabase" or "local"',
    );
  }
  return "local";
}

function localDriver(): StorageDriver {
  const root = path.resolve(process.cwd(), ".uploads");
  const resolveKey = (key: string) => {
    assertValidObjectKey(key);
    return path.join(root, key);
  };
  return {
    async put(key, bytes) {
      const file = resolveKey(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
    },
    async delete(key) {
      const file = resolveKey(key);
      await unlink(file).catch(() => undefined);
      // Drop the per-post directory when it is empty.
      await rmdir(path.dirname(file)).catch(() => undefined);
    },
    async getStream(key) {
      return Readable.toWeb(
        createReadStream(resolveKey(key)),
      ) as ReadableStream<Uint8Array>;
    },
  };
}

const SIGNED_URL_EXPIRY_SECONDS = 60;

function supabaseDriver(): StorageDriver {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase storage driver not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  const bucket = process.env.SUPABASE_BUCKET ?? "attachments";
  const base = `${url.replace(/\/+$/, "")}/storage/v1`;
  const auth = { Authorization: `Bearer ${serviceKey}` };

  return {
    async put(key, bytes, mime) {
      assertValidObjectKey(key);
      const res = await fetch(`${base}/object/${bucket}/${key}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": mime },
        body: new Blob([bytes as BlobPart]),
      });
      if (!res.ok) {
        throw new Error(`Supabase upload failed (${res.status}): ${await res.text()}`);
      }
    },
    async delete(key) {
      assertValidObjectKey(key);
      const res = await fetch(`${base}/object/${bucket}/${key}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Supabase delete failed (${res.status}): ${await res.text()}`);
      }
    },
    async getSignedUrl(key) {
      assertValidObjectKey(key);
      const res = await fetch(`${base}/object/sign/${bucket}/${key}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: SIGNED_URL_EXPIRY_SECONDS }),
      });
      if (!res.ok) {
        throw new Error(`Supabase sign failed (${res.status}): ${await res.text()}`);
      }
      const data = (await res.json()) as { signedURL: string };
      return `${base}${data.signedURL}`;
    },
  };
}

let driver: StorageDriver | undefined;

export function getStorageDriver(): StorageDriver {
  if (!driver) {
    const driverName = resolveStorageDriverName(
      process.env.STORAGE_DRIVER,
      process.env.NODE_ENV,
    );
    driver =
      driverName === "supabase" ? supabaseDriver() : localDriver();
  }
  return driver;
}
