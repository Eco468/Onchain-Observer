import { db, walletsTable, eventsTable, alertsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { broadcast } from "./websocket";
import { dispatchTelegramAlerts, formatEventAlert } from "./telegram";
import { getNormalTxs, getTokenTxs, getEthPrice, classifyTx } from "./etherscan";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 60_000; // poll every 60s
const SIGNIFICANCE_ORDER = ["low", "medium", "high", "critical"];

function meetsThreshold(eventSig: string, minSig: string): boolean {
  return SIGNIFICANCE_ORDER.indexOf(eventSig) >= SIGNIFICANCE_ORDER.indexOf(minSig);
}

// Track the last-seen block per wallet to avoid re-processing
const lastSeenBlock: Map<number, string> = new Map();

let watcherTimer: ReturnType<typeof setTimeout> | null = null;

export async function startBlockchainWatcher(): Promise<void> {
  if (!process.env["ETHERSCAN_API_KEY"]) {
    logger.info("ETHERSCAN_API_KEY not set — blockchain watcher disabled");
    return;
  }
  logger.info("Blockchain watcher started (Etherscan)");
  // Run once immediately, then on interval
  await pollWallets();
  scheduleNext();
}

function scheduleNext(): void {
  watcherTimer = setTimeout(async () => {
    try {
      await pollWallets();
    } catch (err) {
      logger.error({ err }, "Blockchain watcher poll error");
    }
    scheduleNext();
  }, POLL_INTERVAL_MS);
}

async function pollWallets(): Promise<void> {
  // Only watch Ethereum wallets
  const wallets = await db
    .select()
    .from(walletsTable)
    .where(eq(walletsTable.chain, "ethereum"));

  if (wallets.length === 0) return;

  const ethPrice = await getEthPrice();
  logger.info({ ethPrice, walletCount: wallets.length }, "Polling Ethereum wallets");

  // Stagger requests to respect Etherscan rate limits (5/sec free tier)
  for (const wallet of wallets) {
    await processWallet(wallet, ethPrice);
    await sleep(250); // ~4 requests/sec to stay safe
  }
}

async function processWallet(
  wallet: { id: number; address: string; label: string; chain: string },
  ethPrice: number
): Promise<void> {
  const startBlock = lastSeenBlock.get(wallet.id) ?? "0";
  let maxBlock = startBlock;

  // Fetch normal ETH transactions
  const normalTxs = await getNormalTxs(wallet.address, startBlock);
  for (const tx of normalTxs) {
    if (tx.isError !== "0") continue;
    if (tx.blockNumber <= startBlock) continue;
    if (tx.blockNumber > maxBlock) maxBlock = tx.blockNumber;

    const ethValue = Number(tx.value) / 1e18;
    const amountUsd = ethValue * ethPrice;

    const classified = classifyTx(tx, wallet.address, amountUsd);
    if (!classified) continue;

    await insertAndBroadcast(wallet, "ethereum", "ETH", amountUsd, tx.hash, classified);
    await sleep(100);
  }

  // Fetch ERC-20 token transfers
  const tokenTxs = await getTokenTxs(wallet.address, startBlock);
  for (const tx of tokenTxs) {
    if (tx.blockNumber <= startBlock) continue;
    if (tx.blockNumber > maxBlock) maxBlock = tx.blockNumber;

    const decimals = parseInt(tx.tokenDecimal) || 18;
    const tokenAmount = Number(tx.value) / Math.pow(10, decimals);

    // Only price stables and ETH-like tokens for now
    const stables = ["USDC", "USDT", "DAI", "BUSD", "FRAX"];
    const isStable = stables.includes(tx.tokenSymbol?.toUpperCase());
    const amountUsd = isStable ? tokenAmount : tokenAmount * 0; // skip non-stable token pricing for now

    if (amountUsd < 10_000 && !isStable) continue;
    const effectiveUsd = isStable ? tokenAmount : 0;
    if (effectiveUsd < 10_000) continue;

    const classified = classifyTx(tx, wallet.address, effectiveUsd);
    if (!classified) continue;

    await insertAndBroadcast(wallet, "ethereum", tx.tokenSymbol, effectiveUsd, tx.hash, classified);
    await sleep(100);
  }

  if (maxBlock !== startBlock) {
    lastSeenBlock.set(wallet.id, maxBlock);
  }
}

async function insertAndBroadcast(
  wallet: { id: number; address: string; label: string },
  chain: string,
  tokenSymbol: string,
  amountUsd: number,
  txHash: string,
  classified: { eventType: string; significance: string; summary: string }
): Promise<void> {
  try {
    const [inserted] = await db
      .insert(eventsTable)
      .values({
        walletId: wallet.id,
        eventType: classified.eventType,
        chain,
        tokenSymbol,
        amountUsd: String(Math.round(amountUsd)),
        txHash,
        significance: classified.significance,
        summary: classified.summary,
        detectedAt: new Date(),
      })
      .returning();

    logger.info(
      { walletLabel: wallet.label, eventType: classified.eventType, amountUsd },
      "Real onchain event detected"
    );

    const payload = {
      id: inserted.id,
      walletId: wallet.id,
      walletAddress: wallet.address,
      walletLabel: wallet.label,
      eventType: classified.eventType,
      chain,
      tokenSymbol,
      amountUsd: Math.round(amountUsd),
      txHash,
      significance: classified.significance,
      summary: classified.summary,
      detectedAt: inserted.detectedAt.toISOString(),
    };

    broadcast({ type: "event", payload });

    // Telegram alerts
    const activeAlerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true));

    const chatIds = activeAlerts
      .filter(
        (a) =>
          a.channel === "telegram" &&
          a.chatId &&
          meetsThreshold(classified.significance, a.minSignificance)
      )
      .map((a) => a.chatId!);

    if (chatIds.length > 0) {
      await dispatchTelegramAlerts(chatIds, formatEventAlert(payload));
    }
  } catch (err) {
    logger.error({ err }, "Failed to insert/broadcast onchain event");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function stopBlockchainWatcher(): void {
  if (watcherTimer) {
    clearTimeout(watcherTimer);
    watcherTimer = null;
  }
}
