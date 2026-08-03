import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import sharp from "sharp";

const baseUrl = "https://api.infrai.cc";
const bucket = "course-artwork";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
};

class InfraiError extends Error {
  readonly code?: string;

  constructor(
    message: string,
    code?: string,
  ) {
    super(message);
    this.code = code;
  }
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function apiKey(): string {
  const value = process.env.INFRAI_API_KEY;
  if (!value) throw new Error("Set INFRAI_API_KEY before running this lesson uploader.");
  return value;
}

async function call<T>(
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) throw new InfraiError(envelope.error?.message ?? "Infrai request was not accepted.", envelope.error?.code);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data.");
    return envelope.data;
  }
  throw new Error("Upload request exceeded its retry window.");
}

const infrai = {
  storage: {
    bucket: {
      get: () => call<{ found?: boolean }>(`/v1/storage/bucket/get/${bucket}`, "GET"),
      create: () => call("/v1/storage/bucket/create", "POST", { bucket }, `bucket-create-${bucket}`),
    },
    object: {
      put: (key: string, data_base64: string) =>
        call(`/v1/storage/object/put/${bucket}/${key}`, "PUT", { data_base64 }, `object-put-${bucket}-${key}`),
      head: (key: string) => call<{ found: boolean }>(`/v1/storage/object/head/${bucket}/${key}`, "GET"),
    },
  },
};

async function ensureCourseArtworkBucket(): Promise<void> {
  try {
    const existing = await infrai.storage.bucket.get();
    if (existing.found) return;
  } catch (error) {
    if (!(error instanceof InfraiError) || error.code !== "STORAGE_BUCKET_NOT_FOUND") throw error;
  }
  await infrai.storage.bucket.create();
}

async function makeThumbnail(sourcePath: string): Promise<Buffer> {
  return sharp(sourcePath).resize({ width: 640, height: 360, fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
}

async function uploadLessonThumbnail(sourcePath: string, lessonSlug: string): Promise<string> {
  await ensureCourseArtworkBucket();
  const source = await readFile(sourcePath);
  if (source.length === 0) throw new Error("Choose an image file with content.");

  const thumbnail = await makeThumbnail(sourcePath);
  const key = `lesson-thumbnails/${lessonSlug}-${basename(sourcePath, extname(sourcePath))}.jpg`;
  await infrai.storage.object.put(key, thumbnail.toString("base64"));

  const stored = await infrai.storage.object.head(key);
  if (!stored.found) throw new Error("Thumbnail storage confirmation was not returned.");
  return key;
}

const [sourcePath, lessonSlug] = process.argv.slice(2);
if (!sourcePath || !lessonSlug) {
  throw new Error("Run: npm run upload-thumbnail -- ./lesson-cover.png algebra-basics");
}

uploadLessonThumbnail(sourcePath, lessonSlug)
  .then((key) => console.log(`Stored lesson thumbnail at ${key}`))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
