import { Router, type IRouter } from "express";
import { db, walletsTable, eventsTable } from "@workspace/db";
import { eq, count, desc } from "drizzle-orm";
import {
  ListWalletsQueryParams,
  CreateWalletBody,
  GetWalletParams,
  UpdateWalletParams,
  UpdateWalletBody,
  DeleteWalletParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/wallets", async (req, res) => {
  try {
    const query = ListWalletsQueryParams.parse(req.query);
    let wallets = await db.select().from(walletsTable).orderBy(desc(walletsTable.createdAt));

    if (query.category) {
      wallets = wallets.filter((w) => w.category === query.category);
    }
    if (query.chain) {
      wallets = wallets.filter((w) => w.chain === query.chain);
    }

    const eventCounts = await db
      .select({ walletId: eventsTable.walletId, count: count() })
      .from(eventsTable)
      .groupBy(eventsTable.walletId);

    const countMap = new Map(eventCounts.map((e) => [e.walletId, e.count]));

    const result = wallets.map((w) => ({
      id: w.id,
      address: w.address,
      chain: w.chain,
      category: w.category,
      label: w.label,
      notes: w.notes ?? null,
      isActive: w.isActive,
      lastActivity: w.lastActivity?.toISOString() ?? null,
      totalVolume30d: w.totalVolume30d ? parseFloat(w.totalVolume30d) : null,
      eventCount: countMap.get(w.id) ?? 0,
      createdAt: w.createdAt.toISOString(),
    }));

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list wallets" });
  }
});

router.post("/wallets", async (req, res) => {
  try {
    const body = CreateWalletBody.parse(req.body);
    const [wallet] = await db
      .insert(walletsTable)
      .values({
        address: body.address,
        chain: body.chain,
        category: body.category,
        label: body.label,
        notes: body.notes ?? null,
      })
      .returning();

    res.status(201).json({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      category: wallet.category,
      label: wallet.label,
      notes: wallet.notes ?? null,
      isActive: wallet.isActive,
      lastActivity: null,
      totalVolume30d: null,
      eventCount: 0,
      createdAt: wallet.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid wallet data" });
  }
});

router.get("/wallets/:id", async (req, res) => {
  try {
    const { id } = GetWalletParams.parse({ id: parseInt(req.params.id) });
    const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.id, id));

    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const [eventCount] = await db
      .select({ count: count() })
      .from(eventsTable)
      .where(eq(eventsTable.walletId, id));

    res.json({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      category: wallet.category,
      label: wallet.label,
      notes: wallet.notes ?? null,
      isActive: wallet.isActive,
      lastActivity: wallet.lastActivity?.toISOString() ?? null,
      totalVolume30d: wallet.totalVolume30d ? parseFloat(wallet.totalVolume30d) : null,
      eventCount: eventCount?.count ?? 0,
      createdAt: wallet.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get wallet" });
  }
});

router.patch("/wallets/:id", async (req, res) => {
  try {
    const { id } = UpdateWalletParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateWalletBody.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.label !== undefined) updates.label = body.label;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.category !== undefined) updates.category = body.category;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const [wallet] = await db
      .update(walletsTable)
      .set(updates)
      .where(eq(walletsTable.id, id))
      .returning();

    if (!wallet) return res.status(404).json({ error: "Wallet not found" });

    const [eventCount] = await db
      .select({ count: count() })
      .from(eventsTable)
      .where(eq(eventsTable.walletId, id));

    res.json({
      id: wallet.id,
      address: wallet.address,
      chain: wallet.chain,
      category: wallet.category,
      label: wallet.label,
      notes: wallet.notes ?? null,
      isActive: wallet.isActive,
      lastActivity: wallet.lastActivity?.toISOString() ?? null,
      totalVolume30d: wallet.totalVolume30d ? parseFloat(wallet.totalVolume30d) : null,
      eventCount: eventCount?.count ?? 0,
      createdAt: wallet.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid update data" });
  }
});

router.delete("/wallets/:id", async (req, res) => {
  try {
    const { id } = DeleteWalletParams.parse({ id: parseInt(req.params.id) });
    await db.delete(walletsTable).where(eq(walletsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete wallet" });
  }
});

export default router;
