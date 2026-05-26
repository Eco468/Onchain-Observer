import { Router, type IRouter } from "express";
import { db, alertsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateAlertBody,
  UpdateAlertParams,
  UpdateAlertBody,
  DeleteAlertParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/alerts", async (req, res) => {
  try {
    const alerts = await db.select().from(alertsTable).orderBy(desc(alertsTable.createdAt));

    res.json(
      alerts.map((a) => ({
        id: a.id,
        name: a.name,
        channel: a.channel,
        webhookUrl: a.webhookUrl ?? null,
        chatId: a.chatId ?? null,
        minSignificance: a.minSignificance,
        isActive: a.isActive,
        createdAt: a.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list alerts" });
  }
});

router.post("/alerts", async (req, res) => {
  try {
    const body = CreateAlertBody.parse(req.body);
    const [alert] = await db
      .insert(alertsTable)
      .values({
        name: body.name,
        channel: body.channel,
        webhookUrl: body.webhookUrl ?? null,
        chatId: body.chatId ?? null,
        minSignificance: body.minSignificance ?? "medium",
      })
      .returning();

    res.status(201).json({
      id: alert.id,
      name: alert.name,
      channel: alert.channel,
      webhookUrl: alert.webhookUrl ?? null,
      chatId: alert.chatId ?? null,
      minSignificance: alert.minSignificance,
      isActive: alert.isActive,
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid alert data" });
  }
});

router.patch("/alerts/:id", async (req, res) => {
  try {
    const { id } = UpdateAlertParams.parse({ id: parseInt(req.params.id) });
    const body = UpdateAlertBody.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;
    if (body.chatId !== undefined) updates.chatId = body.chatId;
    if (body.minSignificance !== undefined) updates.minSignificance = body.minSignificance;
    if (body.isActive !== undefined) updates.isActive = body.isActive;

    const [alert] = await db
      .update(alertsTable)
      .set(updates)
      .where(eq(alertsTable.id, id))
      .returning();

    if (!alert) return res.status(404).json({ error: "Alert not found" });

    res.json({
      id: alert.id,
      name: alert.name,
      channel: alert.channel,
      webhookUrl: alert.webhookUrl ?? null,
      chatId: alert.chatId ?? null,
      minSignificance: alert.minSignificance,
      isActive: alert.isActive,
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(400).json({ error: "Invalid update data" });
  }
});

router.delete("/alerts/:id", async (req, res) => {
  try {
    const { id } = DeleteAlertParams.parse({ id: parseInt(req.params.id) });
    await db.delete(alertsTable).where(eq(alertsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

export default router;
