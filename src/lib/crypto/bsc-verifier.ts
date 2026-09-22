import "server-only";

export const BSC_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955".toLowerCase();
export const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef".toLowerCase();

const DEFAULT_NODE_REAL_RPC = "https://bsc-mainnet.nodereal.io/v1/6d081ec623574537aa93a13145b37961";

export interface BscVerifyResult {
  confirmed: boolean;
  reason?: string;
  amountMinor?: bigint;
  fromAddress?: string;
  toAddress?: string;
  blockNumber?: number;
  txHash?: string;
}

export function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/^0x/, "");
}

interface RawRpcLog {
  address: string;
  topics: string[];
  data: string;
}

interface RawRpcReceipt {
  status: string; // "0x1" for success, "0x0" for failure
  blockNumber: string;
  transactionHash: string;
  logs: RawRpcLog[];
}

/**
 * Verify a USDT (BEP-20) transaction on BNB Smart Chain using NodeReal RPC.
 *
 * Verifies:
 * 1. Transaction exists and has status 0x1 (succeeded).
 * 2. Emitted Transfer event from the official BSC-USD contract (0x55d398...).
 * 3. Event recipient matches the store's configured BEP20 address.
 * 4. Token transfer amount (18 decimals) is >= expectedAmountMinor.
 */
export async function verifyBscUsdtTransaction(input: {
  txHash: string;
  storeAddress: string;
  expectedAmountMinor?: bigint | number;
  rpcUrl?: string;
}): Promise<BscVerifyResult> {
  const hash = input.txHash.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    return { confirmed: false, reason: "INVALID_TX_HASH_FORMAT" };
  }

  const targetStoreNorm = normalizeAddress(input.storeAddress);
  if (!targetStoreNorm) {
    return { confirmed: false, reason: "STORE_ADDRESS_NOT_CONFIGURED" };
  }

  const rpcUrl = input.rpcUrl || process.env.BSC_RPC_URL || DEFAULT_NODE_REAL_RPC;

  let receipt: RawRpcReceipt | null = null;
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [hash],
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return { confirmed: false, reason: `RPC_HTTP_ERROR_${res.status}` };
    }

    const json = await res.json();
    if (json.error) {
      return { confirmed: false, reason: `RPC_ERROR: ${json.error.message || json.error}` };
    }

    receipt = json.result;
  } catch (err) {
    console.error("[bsc-verifier] RPC fetch failed:", err);
    return { confirmed: false, reason: "RPC_CONNECTION_FAILED" };
  }

  if (!receipt) {
    // Transaction not yet mined / still in mempool
    return { confirmed: false, reason: "TX_NOT_FOUND_OR_PENDING" };
  }

  if (receipt.status !== "0x1") {
    return { confirmed: false, reason: "TX_REVERTED_OR_FAILED" };
  }

  // Scan logs for USDT Transfer to storeAddress
  for (const log of receipt.logs || []) {
    if (log.address.toLowerCase() !== BSC_USDT_CONTRACT) {
      continue;
    }

    if (!log.topics || log.topics.length < 3) {
      continue;
    }

    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) {
      continue;
    }

    // topics[2] is recipient, padded to 32 bytes (64 hex chars + 0x)
    const logToNorm = normalizeAddress(log.topics[2].slice(26));
    if (logToNorm !== targetStoreNorm) {
      continue;
    }

    // Amount is in data as uint256 hex (18 decimals on BSC)
    try {
      const rawUnits = BigInt(log.data);
      // Convert from 18 decimals to 2 decimals (USD minor cents)
      // 10^18 / 10^2 = 10^16
      const amountMinor = rawUnits / (10n ** 16n);

      if (input.expectedAmountMinor !== undefined) {
        const expected = BigInt(input.expectedAmountMinor);
        if (amountMinor < expected) {
          return {
            confirmed: false,
            reason: `INSUFFICIENT_AMOUNT_RECEIVED: received ${Number(amountMinor) / 100} USD, expected ${Number(expected) / 100} USD`,
            amountMinor,
          };
        }
      }

      const fromAddress = "0x" + normalizeAddress(log.topics[1]?.slice(26) || "");
      const blockNumber = parseInt(receipt.blockNumber, 16);

      return {
        confirmed: true,
        amountMinor,
        fromAddress,
        toAddress: "0x" + targetStoreNorm,
        blockNumber: Number.isFinite(blockNumber) ? blockNumber : undefined,
        txHash: hash,
      };
    } catch (e) {
      console.error("[bsc-verifier] failed to parse transfer amount:", e);
      return { confirmed: false, reason: "AMOUNT_PARSE_ERROR" };
    }
  }

  return { confirmed: false, reason: "NO_USDT_TRANSFER_TO_STORE_ADDRESS" };
}

