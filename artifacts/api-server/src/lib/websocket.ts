import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "./logger";

export interface WalletEventPayload {
  id: number;
  walletId: number;
  walletAddress: string;
  walletLabel: string;
  eventType: string;
  chain: string;
  tokenSymbol: string | null;
  amountUsd: number | null;
  txHash: string | null;
  significance: string;
  summary: string | null;
  detectedAt: string;
}

export interface CorrelationSignalPayload {
  id: number;
  headline: string;
  body: string;
  significance: string;
  eventType: string;
  chain: string;
  walletCount: number;
  walletLabels: string[];
  totalUsd: number;
  detectedAt: string;
}

export type LiveEvent =
  | { type: "ping" }
  | { type: "event"; payload: WalletEventPayload }
  | { type: "correlation_signal"; payload: CorrelationSignalPayload };

let wss: WebSocketServer | null = null;

export function createWss(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    logger.info("WebSocket client connected");

    ws.on("close", () => {
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err }, "WebSocket client error");
    });

    // Send a welcome ping
    ws.send(JSON.stringify({ type: "ping" }));
  });

  wss.on("error", (err) => {
    logger.error({ err }, "WebSocket server error");
  });

  logger.info("WebSocket server attached at /ws");
  return wss;
}

export function broadcast(event: LiveEvent): void {
  if (!wss) return;
  const message = JSON.stringify(event);
  let sent = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sent++;
    }
  });
  if (sent > 0) {
    logger.info({ sent, eventType: event.payload?.eventType }, "Broadcasted live event");
  }
}
