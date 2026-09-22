import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  verifyBscUsdtTransaction,
  normalizeAddress,
  BSC_USDT_CONTRACT,
  ERC20_TRANSFER_TOPIC,
} from "../src/lib/crypto/bsc-verifier";

describe("BSC BEP-20 USDT Verifier (NodeReal RPC)", () => {
  const storeAddress = "0xd207428abac1b01377ccd0d5a1e748a91f71213a";
  const validHash = "0x842833344466083542c08c3620d0cf54d78b27b95c90db8e1a97f5d764c8d346";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes addresses correctly", () => {
    expect(normalizeAddress("0xd207428ABAC1B01377CCD0D5A1E748A91F71213A")).toBe(
      "d207428abac1b01377ccd0d5a1e748a91f71213a",
    );
    expect(normalizeAddress("d207428abac1b01377ccd0d5a1e748a91f71213a")).toBe(
      "d207428abac1b01377ccd0d5a1e748a91f71213a",
    );
  });

  it("rejects invalid transaction hash formats", async () => {
    const res = await verifyBscUsdtTransaction({
      txHash: "invalid-hash",
      storeAddress,
    });
    expect(res.confirmed).toBe(false);
    expect(res.reason).toBe("INVALID_TX_HASH_FORMAT");
  });

  it("rejects when store address is missing", async () => {
    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress: "",
    });
    expect(res.confirmed).toBe(false);
    expect(res.reason).toBe("STORE_ADDRESS_NOT_CONFIGURED");
  });

  it("handles pending or unmined transactions", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: null }), { status: 200 }),
    );

    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress,
    });
    expect(res.confirmed).toBe(false);
    expect(res.reason).toBe("TX_NOT_FOUND_OR_PENDING");
  });

  it("rejects reverted/failed transactions", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { status: "0x0", logs: [] },
        }),
        { status: 200 },
      ),
    );

    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress,
    });
    expect(res.confirmed).toBe(false);
    expect(res.reason).toBe("TX_REVERTED_OR_FAILED");
  });

  it("successfully confirms a valid 21.98 USDT transfer to storeAddress", async () => {
    // 21.98 USDT with 18 decimals = 21980000000000000000 (0x1310fa1cb9f9d4ec0)
    // minor units (cents) = 2198n ($21.98)
    const mockReceipt = {
      status: "0x1",
      blockNumber: "0x75b571d",
      transactionHash: validHash,
      logs: [
        {
          address: BSC_USDT_CONTRACT,
          topics: [
            ERC20_TRANSFER_TOPIC,
            "0x00000000000000000000000046680fb3f7a2b301b5d3e091e8adb018fbce5596",
            "0x000000000000000000000000d207428abac1b01377ccd0d5a1e748a91f71213a", // storeAddress
          ],
          data: "0x000000000000000000000000000000000000000000000001310fa1cb9f9d4ec0",
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: mockReceipt }), { status: 200 }),
    );

    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress,
      expectedAmountMinor: 2000n, // expected $20.00, received $21.98 -> OK
    });

    expect(res.confirmed).toBe(true);
    expect(res.amountMinor).toBe(2198n);
    expect(res.fromAddress?.toLowerCase()).toBe("0x46680fb3f7a2b301b5d3e091e8adb018fbce5596");
    expect(res.toAddress?.toLowerCase()).toBe("0xd207428abac1b01377ccd0d5a1e748a91f71213a");
  });

  it("rejects when recipient address does not match storeAddress", async () => {
    const mockReceipt = {
      status: "0x1",
      blockNumber: "0x75b571d",
      transactionHash: validHash,
      logs: [
        {
          address: BSC_USDT_CONTRACT,
          topics: [
            ERC20_TRANSFER_TOPIC,
            "0x00000000000000000000000046680fb3f7a2b301b5d3e091e8adb018fbce5596",
            "0x0000000000000000000000009999999999999999999999999999999999999999", // Different recipient
          ],
          data: "0x000000000000000000000000000000000000000000000001310fa1cb9f9d4ec0",
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: mockReceipt }), { status: 200 }),
    );

    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress,
    });

    expect(res.confirmed).toBe(false);
    expect(res.reason).toBe("NO_USDT_TRANSFER_TO_STORE_ADDRESS");
  });

  it("rejects when received amount is less than expected amount", async () => {
    const mockReceipt = {
      status: "0x1",
      blockNumber: "0x75b571d",
      transactionHash: validHash,
      logs: [
        {
          address: BSC_USDT_CONTRACT,
          topics: [
            ERC20_TRANSFER_TOPIC,
            "0x00000000000000000000000046680fb3f7a2b301b5d3e091e8adb018fbce5596",
            "0x000000000000000000000000d207428abac1b01377ccd0d5a1e748a91f71213a",
          ],
          data: "0x0000000000000000000000000000000000000000000000008ac7230489e80000", // 10 USDT (1000 cents)
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: mockReceipt }), { status: 200 }),
    );

    const res = await verifyBscUsdtTransaction({
      txHash: validHash,
      storeAddress,
      expectedAmountMinor: 2500n, // expected $25.00, received $10.00 -> FAIL
    });

    expect(res.confirmed).toBe(false);
    expect(res.reason).toContain("INSUFFICIENT_AMOUNT_RECEIVED");
  });
});

