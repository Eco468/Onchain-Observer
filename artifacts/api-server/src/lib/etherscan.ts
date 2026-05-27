import { logger } from "./logger";

const BASE = "https://api.etherscan.io/v2/api";

export interface EthTx {
  hash: string;
  from: string;
  to: string;
  value: string; // in wei
  tokenSymbol?: string;
  tokenDecimal?: string;
  contractAddress?: string;
  timeStamp: string;
  blockNumber: string;
  isError: string;
  functionName?: string;
  input?: string;
}

export interface TokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
  timeStamp: string;
  blockNumber: string;
  isError?: string;
}

function apiKey(): string {
  return process.env["ETHERSCAN_API_KEY"] ?? "";
}

async function get<T>(params: Record<string, string>): Promise<T | null> {
  const key = apiKey();
  const url = new URL(BASE);
  url.searchParams.set("chainid", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (key) url.searchParams.set("apikey", key);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as { status: string; message: string; result: T };
    if (data.status !== "1") {
      if (data.message !== "No transactions found") {
        logger.warn({ message: data.message }, "Etherscan non-success response");
      }
      return null;
    }
    return data.result;
  } catch (err) {
    logger.error({ err }, "Etherscan fetch error");
    return null;
  }
}

export async function getNormalTxs(address: string, startBlock = "0", limit = 10): Promise<EthTx[]> {
  const result = await get<EthTx[]>({
    module: "account",
    action: "txlist",
    address,
    startblock: startBlock,
    endblock: "99999999",
    sort: "desc",
    offset: String(limit),
    page: "1",
  });
  return result ?? [];
}

export async function getTokenTxs(address: string, startBlock = "0", limit = 20): Promise<TokenTx[]> {
  const result = await get<TokenTx[]>({
    module: "account",
    action: "tokentx",
    address,
    startblock: startBlock,
    sort: "desc",
    offset: String(limit),
    page: "1",
  });
  return result ?? [];
}

export async function getEthBalance(address: string): Promise<number | null> {
  const result = await get<string>({
    module: "account",
    action: "balance",
    address,
    tag: "latest",
  });
  if (!result) return null;
  return Number(result) / 1e18;
}

export async function getEthPrice(): Promise<number> {
  const result = await get<{ ethusd: string }>({
    module: "stats",
    action: "ethprice",
  });
  return result ? parseFloat(result.ethusd) : 3000;
}

// Classify a transaction into an event type + significance
export function classifyTx(
  tx: EthTx | TokenTx,
  walletAddress: string,
  amountUsd: number
): { eventType: string; significance: string; summary: string } | null {
  const isToken = "tokenSymbol" in tx && tx.tokenSymbol;
  const symbol = isToken ? (tx as TokenTx).tokenSymbol : "ETH";
  const isIncoming = (tx.to ?? "").toLowerCase() === walletAddress.toLowerCase();
  const isOutgoing = (tx.from ?? "").toLowerCase() === walletAddress.toLowerCase();

  // Stablecoins
  const stables = ["USDC", "USDT", "DAI", "BUSD", "FRAX", "LUSD"];
  if (isToken && stables.includes(symbol.toUpperCase())) {
    if (amountUsd < 10_000) return null;
    const sig = amountUsd >= 1_000_000 ? "critical" : amountUsd >= 100_000 ? "high" : "medium";
    return {
      eventType: "stablecoin_inflow",
      significance: sig,
      summary: `${isIncoming ? "Inflow" : "Outflow"} of ${symbol} detected. $${(amountUsd / 1_000_000).toFixed(2)}M stablecoin movement — potential capital deployment signal.`,
    };
  }

  // Large ETH transfers
  if (!isToken) {
    if (amountUsd < 50_000) return null;
    const sig = amountUsd >= 5_000_000 ? "critical" : amountUsd >= 500_000 ? "high" : "medium";
    return {
      eventType: isIncoming ? "accumulation" : "treasury_movement",
      significance: sig,
      summary: `Large ETH ${isIncoming ? "inflow" : "outflow"} of $${(amountUsd / 1_000_000).toFixed(2)}M detected. ${isIncoming ? "Accumulation pattern." : "Capital movement detected."}`,
    };
  }

  // Known governance / DeFi tokens
  const govTokens = ["UNI", "AAVE", "COMP", "MKR", "CRV", "LDO", "ARB", "OP"];
  if (govTokens.includes(symbol.toUpperCase())) {
    if (amountUsd < 10_000) return null;
    const sig = amountUsd >= 500_000 ? "high" : "medium";
    return {
      eventType: "governance",
      significance: sig,
      summary: `${symbol} governance token movement. $${(amountUsd / 1_000_000).toFixed(2)}M — possible voting position being built.`,
    };
  }

  // Large token transfers in general
  if (amountUsd >= 100_000) {
    const sig = amountUsd >= 2_000_000 ? "high" : "medium";
    return {
      eventType: isIncoming ? "accumulation" : "liquidity_migration",
      significance: sig,
      summary: `${symbol} ${isIncoming ? "accumulation" : "outflow"} of $${(amountUsd / 1_000_000).toFixed(2)}M on Ethereum.`,
    };
  }

  return null;
}
