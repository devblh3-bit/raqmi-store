import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "NO_FILE_PROVIDED" }, { status: 400 });
    }

    const blob = file as File;

    if (blob.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 400 });
    }

    const mime = blob.type.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
    }

    const ext = EXTENSION_MAP[mime] ?? "jpg";
    const filename = `receipt_${randomUUID()}.${ext}`;

    const uploadDir = join(process.cwd(), "public", "uploads", "receipts");
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, filename);
    const arrayBuffer = await blob.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/receipts/${filename}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      size: blob.size,
      name: blob.name,
    });
  } catch (err) {
    console.error("[upload] receipt upload error:", err);
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 500 });
  }
}
