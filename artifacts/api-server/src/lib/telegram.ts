import { logger } from "./logger";

const BASE = "https://api.telegram.org";

function token(): string {
  const t = process.env["TELEGRAM_BOT_TOKEN"];
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return t;
}

async function apiCall<T>(method: string, body?: object): Promise<T> {
  const res = await fetch(`${BASE}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) throw new Error(`Telegram API error: ${data.description}`);
  return data.result;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string; first_name?: string; username?: string };
    text?: string;
  };
}

export async function getUpdates(): Promise<TelegramUpdate[]> {
  return apiCall<TelegramUpdate[]>("getUpdates", { limit: 10, timeout: 0 });
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  await apiCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
}

export function formatEventAlert(payload: {
  walletLabel: string;
  walletAddress: string;
  eventType: string;
  chain: string;
  tokenSymbol: string | null;
  amountUsd: number | null;
  significance: string;
  summary: string | null;
  detectedAt: string;
}): string {
  const sigEmoji =
    payload.significance === "critical"
      ? "🚨"
      : payload.significance === "high"
      ? "⚠️"
      : payload.significance === "medium"
      ? "🔔"
      : "ℹ️";

  const amount =
    payload.amountUsd != null
      ? `$${(payload.amountUsd / 1_000_000).toFixed(2)}M`
      : "—";

  const addr = payload.walletAddress.slice(0, 6) + "…" + payload.walletAddress.slice(-4);

  return [
    `${sigEmoji} <b>ARGUS ALERT</b> — ${payload.significance.toUpperCase()}`,
    ``,
    `<b>${payload.eventType.replace(/_/g, " ").toUpperCase()}</b>`,
    payload.summary ?? "",
    ``,
    `👛 <b>Wallet:</b> ${payload.walletLabel} (<code>${addr}</code>)`,
    `⛓ <b>Chain:</b> ${payload.chain.toUpperCase()}`,
    payload.tokenSymbol ? `🪙 <b>Token:</b> ${payload.tokenSymbol}` : null,
    `💵 <b>Amount:</b> ${amount}`,
    `🕐 <b>Detected:</b> ${new Date(payload.detectedAt).toUTCString()}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function formatCorrelationAlert(payload: {
  headline: string;
  body: string;
  significance: string;
  eventType: string;
  chain: string;
  walletCount: number;
  walletLabels: string[];
  totalUsd: number;
  detectedAt: string;
}): string {
  const sigEmoji =
    payload.significance === "critical"
      ? "🚨"
      : payload.significance === "high"
      ? "⚠️"
      : "🔔";

  const total =
    payload.totalUsd >= 1_000_000
      ? `$${(payload.totalUsd / 1_000_000).toFixed(2)}M`
      : payload.totalUsd >= 1_000
      ? `$${(payload.totalUsd / 1_000).toFixed(0)}K`
      : `$${payload.totalUsd.toFixed(0)}`;

  const walletList = payload.walletLabels
    .map((l) => `  • ${l}`)
    .join("\n");

  return [
    `${sigEmoji} <b>ARGUS CORRELATION</b> — ${payload.significance.toUpperCase()}`,
    ``,
    `<b>${payload.headline}</b>`,
    ``,
    `📊 <b>Event type:</b> ${payload.eventType.replace(/_/g, " ").toUpperCase()}`,
    `⛓ <b>Chain:</b> ${payload.chain.toUpperCase()}`,
    `👛 <b>Wallets (${payload.walletCount}):</b>`,
    walletList,
    `💵 <b>Combined volume:</b> ${total}`,
    `🕐 <b>Detected:</b> ${new Date(payload.detectedAt).toUTCString()}`,
    ``,
    `<i>Synchronized moves across ${payload.walletCount}+ wallets in a 10-min window signal coordinated positioning.</i>`,
  ].join("\n");
}

export async function dispatchTelegramAlerts(
  chatIds: string[],
  message: string
): Promise<void> {
  await Promise.allSettled(
    chatIds.map(async (chatId) => {
      try {
        await sendMessage(chatId, message);
        logger.info({ chatId }, "Telegram alert sent");
      } catch (err) {
        logger.error({ err, chatId }, "Failed to send Telegram alert");
      }
    })
  );
}
