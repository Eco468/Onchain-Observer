import { Router, type IRouter } from "express";
import { db, walletsTable, watchlistsTable, eventsTable, alertsTable } from "@workspace/db";
import { eq, desc, count, sum, gte } from "drizzle-orm";
import { GetDashboardActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  try {
    const [walletCount] = await db.select({ count: count() }).from(walletsTable);
    const [watchlistCount] = await db.select({ count: count() }).from(watchlistsTable);
    const [alertCount] = await db
      .select({ count: count() })
      .from(alertsTable)
      .where(eq(alertsTable.isActive, true));

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const allEventsToday = await db
      .select()
      .from(eventsTable)
      .where(gte(eventsTable.detectedAt, yesterday));

    const eventsToday = allEventsToday.length;
    const criticalEvents = allEventsToday.filter(
      (e) => e.significance === "critical" || e.significance === "high"
    ).length;

    const allEvents = await db.select().from(eventsTable);
    const totalVolumeTracked = allEvents.reduce((sum, e) => {
      return sum + (e.amountUsd ? parseFloat(e.amountUsd) : 0);
    }, 0);

    res.json({
      trackedWallets: walletCount?.count ?? 0,
      activeWatchlists: watchlistCount?.count ?? 0,
      eventsToday,
      criticalEvents,
      totalVolumeTracked,
      activeAlerts: alertCount?.count ?? 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

router.get("/dashboard/activity", async (req, res) => {
  try {
    const query = GetDashboardActivityQueryParams.parse(req.query);
    const limit = query.limit ?? 10;

    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.detectedAt))
      .limit(limit);

    const wallets = await db.select().from(walletsTable);
    const walletMap = new Map(wallets.map((w) => [w.id, w]));

    const result = events.map((e) => {
      const wallet = walletMap.get(e.walletId);
      return {
        id: e.id,
        type: e.eventType,
        title: formatEventTitle(e.eventType),
        description: e.summary ?? `${e.eventType.replace(/_/g, " ")} detected on ${e.chain}`,
        significance: e.significance,
        chain: e.chain ?? null,
        walletLabel: wallet?.label ?? null,
        amountUsd: e.amountUsd ? parseFloat(e.amountUsd) : null,
        timestamp: e.detectedAt.toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get dashboard activity" });
  }
});

function formatEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    accumulation: "Token Accumulation Detected",
    stablecoin_inflow: "Stablecoin Inflow",
    liquidity_migration: "Liquidity Migration",
    treasury_movement: "Treasury Movement",
    governance: "Governance Activity",
    staking: "Staking Event",
    bridge: "Bridge Transaction",
    reactivation: "Wallet Reactivation",
    coordinated: "Coordinated Wallet Activity",
  };
  return titles[eventType] ?? eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default router;
