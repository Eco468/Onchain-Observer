import { db, intelligenceItemsTable, eventsTable, walletsTable } from "@workspace/db";
import { desc, gte, and, eq } from "drizzle-orm";
import { logger } from "./logger";
import { broadcast } from "./websocket";

const WINDOW_MINUTES = 10;
const LOOKBACK_MINUTES = 90;
const MIN_WALLETS = 3;
const DEDUP_HOURS = 2;
const INTERVAL_MS = 3 * 60 * 1000;

function bucketKey(date: Date): string {
  const bucket = Math.floor(date.getTime() / (WINDOW_MINUTES * 60 * 1000));
  return String(bucket);
}

export async function runCorrelationDetection(): Promise<void> {
  const lookbackCutoff = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);
  const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);

  const recentEvents = await db
    .select({
      id: eventsTable.id,
      walletId: eventsTable.walletId,
      eventType: eventsTable.eventType,
      chain: eventsTable.chain,
      amountUsd: eventsTable.amountUsd,
      significance: eventsTable.significance,
      detectedAt: eventsTable.detectedAt,
    })
    .from(eventsTable)
    .where(gte(eventsTable.detectedAt, lookbackCutoff))
    .orderBy(desc(eventsTable.detectedAt));

  if (recentEvents.length === 0) return;

  const walletIds = [...new Set(recentEvents.map((e) => e.walletId))];
  const walletRows = await db
    .select({ id: walletsTable.id, label: walletsTable.label, address: walletsTable.address })
    .from(walletsTable);
  const walletMap = new Map(walletRows.map((w) => [w.id, w]));

  type Cluster = {
    eventType: string;
    chain: string;
    bucket: string;
    walletIds: Set<number>;
    events: typeof recentEvents;
  };

  const clusters = new Map<string, Cluster>();

  for (const event of recentEvents) {
    const bucket = bucketKey(event.detectedAt);
    const key = `${event.eventType}::${event.chain}::${bucket}`;

    if (!clusters.has(key)) {
      clusters.set(key, {
        eventType: event.eventType,
        chain: event.chain,
        bucket,
        walletIds: new Set(),
        events: [],
      });
    }
    const c = clusters.get(key)!;
    c.walletIds.add(event.walletId);
    c.events.push(event);
  }

  const recentCorrelations = await db
    .select({ headline: intelligenceItemsTable.headline, createdAt: intelligenceItemsTable.createdAt })
    .from(intelligenceItemsTable)
    .where(
      and(
        eq(intelligenceItemsTable.category, "correlation"),
        gte(intelligenceItemsTable.createdAt, dedupCutoff)
      )
    );

  const recentHeadlines = new Set(recentCorrelations.map((r) => r.headline));

  for (const [, cluster] of clusters) {
    if (cluster.walletIds.size < MIN_WALLETS) continue;

    const walletLabels = [...cluster.walletIds]
      .map((id) => walletMap.get(id)?.label ?? `Wallet #${id}`)
      .sort();

    const eventLabel = cluster.eventType.replace(/_/g, " ").toLowerCase();
    const headline = `Coordinated ${eventLabel} detected across ${cluster.walletIds.size} wallets on ${cluster.chain}`;

    if (recentHeadlines.has(headline)) continue;

    const totalUsd = cluster.events.reduce(
      (sum, e) => sum + (e.amountUsd ? Number(e.amountUsd) : 0),
      0
    );

    const sig =
      cluster.walletIds.size >= 5 || totalUsd > 5_000_000
        ? "critical"
        : cluster.walletIds.size >= 4 || totalUsd > 1_000_000
        ? "high"
        : "medium";

    const formattedTotal =
      totalUsd >= 1_000_000
        ? `$${(totalUsd / 1_000_000).toFixed(2)}M`
        : totalUsd >= 1_000
        ? `$${(totalUsd / 1_000).toFixed(0)}K`
        : `$${totalUsd.toFixed(0)}`;

    const body = `${cluster.walletIds.size} distinct wallets performed ${eventLabel} within a ${WINDOW_MINUTES}-minute window on ${cluster.chain}. Combined volume: ${formattedTotal}. Wallets involved: ${walletLabels.join(", ")}. This synchronized behavior is a high-signal indicator of coordinated positioning — historically preceding significant price moves or protocol events within 24–72 hours.`;

    const [inserted] = await db
      .insert(intelligenceItemsTable)
      .values({
        headline,
        body,
        category: "correlation",
        significance: sig,
        relatedWallets: walletLabels,
      })
      .returning();

    logger.info(
      { headline, wallets: cluster.walletIds.size, sig },
      "Correlation signal detected and saved"
    );

    broadcast({
      type: "correlation_signal",
      payload: {
        id: inserted.id,
        headline,
        body,
        significance: sig,
        eventType: cluster.eventType,
        chain: cluster.chain,
        walletCount: cluster.walletIds.size,
        walletLabels,
        totalUsd,
        detectedAt: inserted.createdAt.toISOString(),
      },
    });
  }
}

export function startCorrelationDetector(): void {
  logger.info("Correlation detector starting");

  runCorrelationDetection().catch((err) =>
    logger.error({ err }, "Initial correlation detection failed")
  );

  setInterval(() => {
    runCorrelationDetection().catch((err) =>
      logger.error({ err }, "Correlation detection cycle failed")
    );
  }, INTERVAL_MS);
}
