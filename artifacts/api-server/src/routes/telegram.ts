import { Router, type IRouter } from "express";
import { getUpdates, sendMessage } from "../lib/telegram";
import { db, alertsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/telegram/setup — fetch latest chat IDs from getUpdates
router.get("/telegram/setup", async (req, res) => {
  try {
    const updates = await getUpdates();

    const chats = updates
      .filter((u) => u.message?.chat)
      .map((u) => ({
        chatId: String(u.message!.chat.id),
        name:
          u.message!.chat.first_name ??
          u.message!.chat.username ??
          `Chat ${u.message!.chat.id}`,
        username: u.message!.chat.username ?? null,
      }));

    // Deduplicate by chatId
    const seen = new Set<string>();
    const unique = chats.filter((c) => {
      if (seen.has(c.chatId)) return false;
      seen.add(c.chatId);
      return true;
    });

    res.json({ chats: unique });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch Telegram updates. Make sure the bot token is correct and you have messaged the bot." });
  }
});

// POST /api/telegram/test — send a test message to a chat
router.post("/telegram/test", async (req, res) => {
  const { chatId } = req.body as { chatId?: string };
  if (!chatId) return res.status(400).json({ error: "chatId is required" });

  try {
    await sendMessage(
      chatId,
      "🟢 <b>ARGUS</b> — Test alert successful!\n\nYour Telegram notifications are working correctly."
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send test message" });
  }
});

export default router;
