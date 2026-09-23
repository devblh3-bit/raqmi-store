import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/lib/auth/session", () => ({
  createSession: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { prisma } from "../src/lib/db";
import { trackOrderAction } from "../src/app/actions/track";
import { generateOrderCode } from "../src/lib/order-code";

describe("trackOrderAction", () => {
  const TEST_EMAIL = "track-action-test@example.com";
  let orderCode: string;

  beforeAll(async () => {
    orderCode = generateOrderCode();
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL },
    });
    await prisma.order.create({
      data: {
        code: orderCode,
        userId: user.id,
        guestEmail: TEST_EMAIL,
        totalMinor: 1000n,
      },
    });
  });

  afterAll(async () => {
    if (orderCode) {
      await prisma.order.deleteMany({ where: { code: orderCode } });
    }
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await prisma.$disconnect();
  });

  it("returns INVALID_INPUT when fields are missing", async () => {
    const fd = new FormData();
    const res = await trackOrderAction({}, fd);
    expect(res.error).toBe("INVALID_INPUT");
  });

  it("returns NOT_FOUND when order code does not match email", async () => {
    const fd = new FormData();
    fd.append("code", orderCode);
    fd.append("email", "wrong@example.com");
    fd.append("locale", "en");
    const res = await trackOrderAction({}, fd);
    expect(res.error).toBe("NOT_FOUND");
  });

  it("authenticates and redirects to order page when code and email match", async () => {
    const fd = new FormData();
    fd.append("code", orderCode);
    fd.append("email", TEST_EMAIL);
    fd.append("locale", "en");

    await expect(trackOrderAction({}, fd)).rejects.toThrow(`REDIRECT:/en/orders/${orderCode}`);
  });
});
