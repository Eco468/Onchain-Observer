import { db, walletsTable, eventsTable, alertsTable } from "@workspace/db";
import { broadcast } from "./websocket";
import { logger } from "./logger";
import { eq } from "drizzle-orm";
import { dispatchTelegramAlerts, formatEventAlert } from "./telegram";

const EVENT_TYPES = [
  "accumulation",
  "stablecoin_inflow",
  "liquidity_migration",
  "treasury_movement",
  "governance",
  "staking",
  "bridge",
  "reactivation",
  "coordinated",
];

const CHAINS = ["ethereum", "base", "arbitrum", "optimism", "polygon"];
const TOKENS = ["ETH", "USDC", "USDT", "BTC", "ARB", "OP", "MATIC", "DAI", "WBTC"];

const SIGNIFICANCE_WEIGHTS = [
  { value: "critical", weight: 0.1 },
  { value: "high", weight: 0.25 },
  { value: "medium", weight: 0.4 },
  { value: "low", weight: 0.25 },
];

const SUMMARIES: Record<string, string[]> = {
  accumulation: [
    "Large token accumulation detected. Wallet systematically buying across multiple blocks.",
    "Smart money accumulation pattern detected. Historical correlation with pre-rally positioning.",
    "Coordinated accumulation across {token} observed. Volume 3.2x above 30-day average.",
  ],
  stablecoin_inflow: [
    "Stablecoin inflow detected. Dry powder positioning suggests near-term deployment.",
    "USDC inflow from multiple exchange withdrawals. Institutional buy signal pattern.",
    "Large stablecoin transfer to DeFi protocols. Yield farming rotation underway.",
  ],
  bridge: [
    "Cross-chain bridge transaction detected. Capital migrating to {chain} ecosystem.",
    "Large bridge inflow detected via Stargate. Liquidity following yield opportunities.",
    "Bridge outflow from Ethereum L1 to L2. Gas cost optimization pattern.",
  ],
  governance: [
    "Governance token accumulation before upcoming vote. Historically predictive signal.",
    "Wallet positioned in governance tokens ahead of high-impact proposal.",
    "DAO voting power concentration detected. Protocol governance shift underway.",
  ],
  reactivation: [
    "Dormant wallet reactivated after extended inactivity. First move is {token} accumulation.",
    "Long-dormant address showing activity. High-signal reactivation event.",
    "Wallet silent for 180+ days reactivated with immediate token positioning.",
  ],
  staking: [
    "Large ETH staking event detected via Lido protocol. Yield capture strategy.",
    "Validator staking deposit detected. Long-term confidence signal.",
    "Institutional ETH staking activity. Risk-off positioning.",
  ],
  treasury_movement: [
    "DAO treasury rebalancing detected. Moving to yield-generating protocols.",
    "Protocol treasury diversification. Converting governance tokens to stablecoins.",
    "Large treasury transaction. Capital allocation shift underway.",
  ],
  liquidity_migration: [
    "Liquidity position migrated to higher-yield pool. DeFi rotation strategy.",
    "Large LP position removed and redeployed. Chasing yield differentials.",
    "Concentrated liquidity migration detected on Uniswap V3.",
  ],
  coordinated: [
    "Multiple wallets moving in coordinated pattern. Institutional rebalancing.",
    "Temporal clustering of transactions across {count} wallets. High-signal event.",
    "Coordinated wallet activity detected. 4 addresses acting in tight 8-minute window.",
  ],
};

const SIGNIFICANCE_ORDER = ["low", "medium", "high", "critical"];

function meetsThreshold(eventSig: string, minSig: string): boolean {
  return SIGNIFICANCE_ORDER.indexOf(eventSig) >= SIGNIFICANCE_ORDER.indexOf(minSig);
}

function weighted<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatSummary(template: string, token: string, chain: string): string {
  return template
    .replace("{token}", token)
    .replace("{chain}", chain)
    .replace("{count}", String(Math.floor(Math.random() * 3) + 3));
}

let simulatorTimer: ReturnType<typeof setTimeout> | null = null;

export async function startEventSimulator(): Promise<void> {
  logger.info("Event simulator started");
  scheduleNext();
}

function scheduleNext(): void {
  const delay = (15 + Math.random() * 25) * 1000;
  simulatorTimer = setTimeout(async () => {
    try {
      await generateAndBroadcastEvent();
    } catch (err) {
      logger.error({ err }, "Event simulator error");
    }
    scheduleNext();
  }, delay);
}

async function generateAndBroadcastEvent(): Promise<void> {
  const wallets = await db.select().from(walletsTable).limit(20);
  if (wallets.length === 0) return;

  const wallet = randomFrom(wallets);
  const eventType = randomFrom(EVENT_TYPES);
  const chain = wallet.chain || randomFrom(CHAINS);
  const token = randomFrom(TOKENS);
  const significance = weighted(SIGNIFICANCE_WEIGHTS);

  const summaryTemplates = SUMMARIES[eventType] ?? ["Onchain activity detected."];
  const summary = formatSummary(randomFrom(summaryTemplates), token, chain);

  const amountUsd =
    significance === "critical"
      ? Math.floor(Math.random() * 50_000_000 + 10_000_000)
      : significance === "high"
      ? Math.floor(Math.random() * 10_000_000 + 1_000_000)
      : significance === "medium"
      ? Math.floor(Math.random() * 1_000_000 + 100_000)
      : Math.floor(Math.random() * 100_000 + 10_000);

  const txHash = "0x" + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join("");

  const [inserted] = await db
    .insert(eventsTable)
    .values({
      walletId: wallet.id,
      eventType,
      chain,
      tokenSymbol: token,
      amountUsd: String(amountUsd),
      txHash,
      significance,
      summary,
      detectedAt: new Date(),
    })
    .returning();

  logger.info(
    { walletLabel: wallet.label, eventType, significance, amountUsd },
    "Simulated onchain event generated"
  );

  const payload = {
    id: inserted.id,
    walletId: wallet.id,
    walletAddress: wallet.address,
    walletLabel: wallet.label,
    eventType,
    chain,
    tokenSymbol: token,
    amountUsd,
    txHash,
    significance,
    summary,
    detectedAt: inserted.detectedAt.toISOString(),
  };

  broadcast({ type: "event", payload });

  // Dispatch Telegram alerts for active alerts that meet significance threshold
  try {
    const activeAlerts = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true));

    const telegramChatIds = activeAlerts
      .filter(
        (a) =>
          a.channel === "telegram" &&
          a.chatId &&
          meetsThreshold(significance, a.minSignificance)
      )
      .map((a) => a.chatId!);

    if (telegramChatIds.length > 0) {
      const message = formatEventAlert(payload);
      await dispatchTelegramAlerts(telegramChatIds, message);
    }
  } catch (err) {
    logger.error({ err }, "Failed to dispatch alerts");
  }
}

export function stopEventSimulator(): void {
  if (simulatorTimer) {
    clearTimeout(simulatorTimer);
    simulatorTimer = null;
  }
}
