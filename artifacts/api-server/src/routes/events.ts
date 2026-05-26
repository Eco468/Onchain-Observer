import { Router, type IRouter } from "express";
import { db, eventsTable, walletsTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import {
  ListEventsQueryParams,
  GetEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events", async (req, res) => {
  try {
    const query = ListEventsQueryParams.parse(req.query);
    const limit = query.limit ?? 50;

    let events = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.detectedAt))
      .limit(limit);

    if (query.walletId) {
      events = events.filter((e) => e.walletId === query.walletId);
    }
    if (query.eventType) {
      events = events.filter((e) => e.eventType === query.eventType);
    }
    if (query.chain) {
      events = events.filter((e) => e.chain === query.chain);
    }
    if (query.significance) {
      events = events.filter((e) => e.significance === query.significance);
    }

    // Get wallet labels
    const wallets = await db.select().from(walletsTable);
    const walletMap = new Map(wallets.map((w) => [w.id, w]));

    const result = events.map((e) => {
      const wallet = walletMap.get(e.walletId);
      return {
        id: e.id,
        walletId: e.walletId,
        walletAddress: wallet?.address ?? "unknown",
        walletLabel: wallet?.label ?? "Unknown Wallet",
        eventType: e.eventType,
        chain: e.chain,
        tokenSymbol: e.tokenSymbol ?? null,
        amountUsd: e.amountUsd ? parseFloat(e.amountUsd) : null,
        txHash: e.txHash ?? null,
        significance: e.significance,
        summary: e.summary ?? null,
        detectedAt: e.detectedAt.toISOString(),
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list events" });
  }
});

router.get("/events/stats", async (req, res) => {
  try {
    const [total] = await db.select({ count: count() }).from(eventsTable);

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allEvents = await db.select().from(eventsTable);

    const last24h = allEvents.filter((e) => e.detectedAt >= yesterday).length;
    const last7d = allEvents.filter((e) => e.detectedAt >= lastWeek).length;

    // By type
    const typeMap = new Map<string, number>();
    const chainMap = new Map<string, number>();
    const sigMap = new Map<string, number>();

    for (const e of allEvents) {
      typeMap.set(e.eventType, (typeMap.get(e.eventType) ?? 0) + 1);
      chainMap.set(e.chain, (chainMap.get(e.chain) ?? 0) + 1);
      sigMap.set(e.significance, (sigMap.get(e.significance) ?? 0) + 1);
    }

    res.json({
      totalEvents: total?.count ?? 0,
      last24h,
      last7d,
      byType: Array.from(typeMap.entries()).map(([label, count]) => ({ label, count })),
      byChain: Array.from(chainMap.entries()).map(([label, count]) => ({ label, count })),
      bySignificance: Array.from(sigMap.entries()).map(([label, count]) => ({ label, count })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get event stats" });
  }
});

router.get("/events/:id", async (req, res) => {
  try {
    const { id } = GetEventParams.parse({ id: parseInt(req.params.id) });
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));

    if (!event) return res.status(404).json({ error: "Event not found" });

    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, event.walletId));

    res.json({
      id: event.id,
      walletId: event.walletId,
      walletAddress: wallet?.address ?? "unknown",
      walletLabel: wallet?.label ?? "Unknown Wallet",
      eventType: event.eventType,
      chain: event.chain,
      tokenSymbol: event.tokenSymbol ?? null,
      amountUsd: event.amountUsd ? parseFloat(event.amountUsd) : null,
      txHash: event.txHash ?? null,
      significance: event.significance,
      summary: event.summary ?? null,
      aiAnalysis: event.aiAnalysis ?? null,
      inferredIntent: event.inferredIntent ?? null,
      historicalContext: event.historicalContext ?? null,
      detectedAt: event.detectedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get event" });
  }
});

export default router;
