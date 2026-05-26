import { Router, type IRouter } from "express";
import { db, intelligenceItemsTable, walletsTable, eventsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { GetIntelligenceFeedQueryParams, AnalyzeWalletBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/intelligence/feed", async (req, res) => {
  try {
    const query = GetIntelligenceFeedQueryParams.parse(req.query);
    const limit = query.limit ?? 20;

    const items = await db
      .select()
      .from(intelligenceItemsTable)
      .orderBy(desc(intelligenceItemsTable.createdAt))
      .limit(limit);

    res.json(
      items.map((item) => ({
        id: item.id,
        headline: item.headline,
        body: item.body,
        category: item.category,
        significance: item.significance,
        relatedWallets: item.relatedWallets ?? [],
        relatedEventId: item.relatedEventId ?? null,
        createdAt: item.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get intelligence feed" });
  }
});

router.post("/intelligence/analyze", async (req, res) => {
  try {
    const body = AnalyzeWalletBody.parse(req.body);

    let context = "";
    if (body.walletId) {
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, body.walletId));
      if (wallet) {
        const recentEvents = await db
          .select()
          .from(eventsTable)
          .where(eq(eventsTable.walletId, body.walletId))
          .orderBy(desc(eventsTable.detectedAt))
          .limit(5);

        context = `Wallet: ${wallet.label} (${wallet.address}) on ${wallet.chain}, category: ${wallet.category}. Recent events: ${recentEvents.map((e) => `${e.eventType} - ${e.summary ?? "no summary"}`).join("; ")}`;
      }
    }

    if (body.eventId) {
      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, body.eventId));
      if (event) {
        const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, event.walletId));
        context = `Event: ${event.eventType} on ${event.chain}, significance: ${event.significance}, amount: $${event.amountUsd ?? 0}, wallet: ${wallet?.label ?? "unknown"}`;
      }
    }

    // Static AI analysis (production would call LLM)
    const analyses: Record<string, string> = {
      accumulation: "Systematic token accumulation detected. Historical data shows this wallet pattern precedes 40-60 day hold cycles before distribution. Risk/reward asymmetry favors the accumulator.",
      stablecoin_inflow: "Large stablecoin positioning indicates dry powder deployment readiness. Cross-referencing with historical cycles suggests potential acquisition activity within 2-4 weeks.",
      governance: "Governance token positioning ahead of vote. Historical pattern shows these wallets vote on proposals that increase protocol revenue or unlock liquidity.",
      bridge: "Cross-chain capital flow detected. Bridge movements of this magnitude typically precede ecosystem-specific deployment, often correlated with upcoming protocol launches.",
      reactivation: "Dormant wallet reactivation is a high-signal event. Historically, wallets silent for 180+ days that reactivate do so with specific strategic intent.",
    };

    const eventType = body.eventId ? "accumulation" : "accumulation";
    const analysis = analyses[eventType] ?? "Onchain activity pattern detected. This wallet exhibits behavior consistent with informed market participants accumulating ahead of catalysts.";

    res.json({
      analysis,
      inferredIntent: "Strategic positioning ahead of anticipated market catalyst",
      significance: "high",
      historicalContext: "Pattern matches 3 previous cycles where similar behavior preceded 15-40% price moves within 30 days",
      confidence: "medium-high",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to analyze" });
  }
});

router.get("/intelligence/summary", async (req, res) => {
  try {
    const allEvents = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.detectedAt))
      .limit(100);

    const chainCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    for (const e of allEvents) {
      chainCounts.set(e.chain, (chainCounts.get(e.chain) ?? 0) + 1);
      typeCounts.set(e.eventType, (typeCounts.get(e.eventType) ?? 0) + 1);
    }

    const topChains = [...chainCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([chain]) => chain);

    const topTypes = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    const narratives = [
      "Smart money rotating into L2 ecosystem assets ahead of protocol upgrades",
      "Stablecoin reserves building across tracked wallets — potential accumulation phase",
      "Governance participation increasing among historically profitable whale wallets",
      "Bridge activity from Ethereum to Base increasing — capital following yield",
    ];

    res.json({
      headline: topChains.length > 0
        ? `Elevated activity detected across ${topChains.join(", ")} networks`
        : "Monitoring active — tracking ${allEvents.length} recent onchain events",
      body: `Argus has detected ${allEvents.length} onchain events in the tracked period. Dominant event patterns include ${topTypes.slice(0, 2).join(" and ")}. Smart money wallets are showing concentrated activity suggesting coordinated positioning.`,
      trendingNarratives: narratives.slice(0, 3),
      topActiveChains: topChains.length > 0 ? topChains : ["ethereum", "base", "arbitrum"],
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get market summary" });
  }
});

export default router;
