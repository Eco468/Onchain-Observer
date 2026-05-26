import { useState, useEffect, useRef, useCallback } from "react";

export interface LiveEventPayload {
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

export type WsStatus = "connecting" | "connected" | "disconnected" | "error";

export interface LiveFeedState {
  status: WsStatus;
  latestEvent: LiveEventPayload | null;
  eventCount: number;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useLiveFeed(onEvent?: (event: LiveEventPayload) => void): LiveFeedState {
  const [status, setStatus] = useState<WsStatus>("connecting");
  const [latestEvent, setLatestEvent] = useState<LiveEventPayload | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("connected");
      attemptsRef.current = 0;
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        if (data.type === "event" && data.payload) {
          const payload = data.payload as LiveEventPayload;
          setLatestEvent(payload);
          setEventCount((c) => c + 1);
          onEventRef.current?.(payload);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current++;
        setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        setStatus("error");
      }
    };

    ws.onerror = () => {
      setStatus("error");
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, latestEvent, eventCount };
}
