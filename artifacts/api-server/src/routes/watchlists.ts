import { Router, type IRouter } from "express";
import { db, watchlistsTable, watchlistWalletsTable, walletsTable, eventsTable } from "@workspace/db";
import { eq, count, and, desc } from "drizzle-orm";
import {
  CreateWatchlistBody,
  GetWatchlistParams,
  UpdateWatchlistParams,
  UpdateWatchlistBody,
  DeleteWatchlistParams,
  AddWalletToWatchlistParams,
  AddWalletToWatchlistBody,
  RemoveWalletFromWatchlistParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/watchlists", async (req, res) => {
  try {
    const watchlists = await db.select().from(watchlistsTable).orderBy(desc(watchlistsTable.createdAt));

    const walletCounts = await db
      .select({ watchlistId: watchlistWalletsTable.watchlistId, count: count() })
      .from(watchlistWalletsTable)
      .groupBy(watchlistWalletsTable.watchlistId);

    const countMap = new Map(walletCounts.map((w) => [w.watchlistId, w.count]));

    const result = watchlists.map((wl) => ({
      id: wl.id,
      name: wl.name,
      description: wl.description ?? null,
      walletCount: countMap.get(wl.id) ?? 0,
      createdAt: wl.createdAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list watchlists" });
  }
});

router.post("/watchlists", async (req, res) => {
  try {
    const body = CreateWatchlistBody.parse(req.body);
    const [watchlist] = await db
      .insert(watchlistsTable)
      .values({ name: body.name, description: body.description ?? null })
      .returning();

    res.status(201).json({
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description ?? null,
      walletCount: 0,
      createdAt: watchlist.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid watchlist data" });
  }
});

router.get("/watchlists/:id", async (req, res) => {
  try {
    const { id } = GetWatchlistParams.parse({ id: parseInt(req.params.id) });
    const [watchlist] = await db.select().from(watchlistsTable).where(eq(watchlistsTable.id, id));

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    const watchlistWallets = await db
      .select({ walletId: watchlistWalletsTable.walletId })
      .from(watchlistWalletsTable)
      .where(eq(watchlistWalletsTable.watchlistId, id));

    const walletIds = watchlistWallets.map((w) => w.walletId);

    const wallets = walletIds.length > 0
      ? await db.select().from(walletsTable).where(
          eq(walletsTable.id, walletIds[0])
        )
      : [];

    // Get all wallets if multiple
    const allWallets = walletIds.length > 0
      ? await Promise.all(
          walletIds.map((wid) =>
            db.select().from(walletsTable).where(eq(walletsTable.id, wid)).then((r) => r[0])
          )
        )
      : [];

    const eventCounts = await db
      .select({ walletId: eventsTable.walletId, count: count() })
      .from(eventsTable)
      .groupBy(eventsTable.walletId);
    const ecMap = new Map(eventCounts.map((e) => [e.walletId, e.count]));

    const walletResult = allWallets.filter(Boolean).map((w) => ({
      id: w.id,
      address: w.address,
      chain: w.chain,
      category: w.category,
      label: w.label,
      notes: w.notes ?? null,
      isActive: w.isActive,
      lastActivity: w.lastActivity?.toISOString() ?? null,
      totalVolume30d: w.totalVolume30d ? parseFloat(w.totalVolume30d) : null,
      eventCount: ecMap.get(w.id) ?? 0,
      createdAt: w.createdAt.toISOString(),
    }));

    res.json({
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description ?? null,
      wallets: walletResult,
      createdAt: watchlist.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

router.patch("/watchlists/:id", async (req, res) => {
  try {
    const { id } = UpdateWatchlistParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateWatchlistBody.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;

    const [watchlist] = await db
      .update(watchlistsTable)
      .set(updates)
      .where(eq(watchlistsTable.id, id))
      .returning();

    if (!watchlist) return res.status(404).json({ error: "Watchlist not found" });

    const [wc] = await db
      .select({ count: count() })
      .from(watchlistWalletsTable)
      .where(eq(watchlistWalletsTable.watchlistId, id));

    res.json({
      id: watchlist.id,
      name: watchlist.name,
      description: watchlist.description ?? null,
      walletCount: wc?.count ?? 0,
      createdAt: watchlist.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid update data" });
  }
});

router.delete("/watchlists/:id", async (req, res) => {
  try {
    const { id } = DeleteWatchlistParams.parse({ id: parseInt(req.params.id) });
    await db.delete(watchlistsTable).where(eq(watchlistsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete watchlist" });
  }
});

router.post("/watchlists/:id/wallets", async (req, res) => {
  try {
    const { id } = AddWalletToWatchlistParams.parse({ id: parseInt(req.params.id) });
    const body = AddWalletToWatchlistBody.parse(req.body);

    await db.insert(watchlistWalletsTable).values({
      watchlistId: id,
      walletId: body.walletId,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Failed to add wallet to watchlist" });
  }
});

router.delete("/watchlists/:id/wallets/:walletId", async (req, res) => {
  try {
    const { id } = RemoveWalletFromWatchlistParams.parse({ id: parseInt(req.params.id) });
    const walletId = parseInt(req.params.walletId);

    await db
      .delete(watchlistWalletsTable)
      .where(
        and(
          eq(watchlistWalletsTable.watchlistId, id),
          eq(watchlistWalletsTable.walletId, walletId)
        )
      );

    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to remove wallet from watchlist" });
  }
});

export default router;
