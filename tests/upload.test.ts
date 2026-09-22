import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

let mockUser: { userId: string; role: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(async () => mockUser),
}));

import { POST } from "../src/app/api/upload/route";

describe("POST /api/upload", () => {
  beforeEach(() => {
    mockUser = null;
  });

  it("rejects unauthenticated upload requests with 401", async () => {
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects requests without a file with 400", async () => {
    mockUser = { userId: "user-123", role: "CUSTOMER" };
    const fd = new FormData();
    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("NO_FILE_PROVIDED");
  });

  it("rejects non-image files with 400", async () => {
    mockUser = { userId: "user-123", role: "CUSTOMER" };
    const fd = new FormData();
    const blob = new Blob(["malicious-script"], { type: "application/javascript" });
    fd.append("file", blob, "script.js");

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("INVALID_FILE_TYPE");
  });

  it("successfully accepts and writes image file returning receipt url", async () => {
    mockUser = { userId: "user-123", role: "CUSTOMER" };
    const fd = new FormData();
    const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
    const blob = new Blob([imageBytes], { type: "image/png" });
    fd.append("file", blob, "my_baridimob_receipt.png");

    const req = new Request("http://localhost/api/upload", {
      method: "POST",
      body: fd,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.url).toMatch(/^\/uploads\/receipts\/receipt_[a-f0-9-]+\.png$/);
  });
});
