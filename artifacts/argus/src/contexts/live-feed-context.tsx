import { createContext, useContext, useState, useCallback } from "react";
import { useLiveFeed, type LiveEventPayload, type CorrelationSignalPayload, type WsStatus } from "@/hooks/use-live-feed";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardStatsQueryKey,
  getGetDashboardActivityQueryKey,
  getListEventsQueryKey,
  getGetEventStatsQueryKey,
} from "@workspace/api-client-react";

interface LiveFeedContextValue {
  status: WsStatus;
  recentEvents: LiveEventPayload[];
  recentCorrelations: CorrelationSignalPayload[];
  eventCount: number;
  clearRecent: () => void;
}

const LiveFeedContext = createContext<LiveFeedContextValue>({
  status: "connecting",
  recentEvents: [],
  recentCorrelations: [],
  eventCount: 0,
  clearRecent: () => {},
});

const MAX_RECENT = 50;
const MAX_CORRELATIONS = 20;

export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const [recentEvents, setRecentEvents] = useState<LiveEventPayload[]>([]);
  const [recentCorrelations, setRecentCorrelations] = useState<CorrelationSignalPayload[]>([]);
  const queryClient = useQueryClient();

  const handleEvent = useCallback(
    (event: LiveEventPayload) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, MAX_RECENT));
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey() });
    },
    [queryClient]
  );

  const handleCorrelation = useCallback(
    (signal: CorrelationSignalPayload) => {
      setRecentCorrelations((prev) => [signal, ...prev].slice(0, MAX_CORRELATIONS));
      // Invalidate intelligence feed so it picks up the new item
      queryClient.invalidateQueries({ queryKey: ["intelligence"] });
    },
    [queryClient]
  );

  const { status, eventCount } = useLiveFeed(handleEvent, handleCorrelation);

  const clearRecent = useCallback(() => {
    setRecentEvents([]);
    setRecentCorrelations([]);
  }, []);

  return (
    <LiveFeedContext.Provider value={{ status, recentEvents, recentCorrelations, eventCount, clearRecent }}>
      {children}
    </LiveFeedContext.Provider>
  );
}

export function useLiveFeedContext() {
  return useContext(LiveFeedContext);
}

export type { LiveEventPayload, CorrelationSignalPayload };
