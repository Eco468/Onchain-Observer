import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useLiveFeed, type LiveEventPayload, type WsStatus } from "@/hooks/use-live-feed";
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
  eventCount: number;
  clearRecent: () => void;
}

const LiveFeedContext = createContext<LiveFeedContextValue>({
  status: "connecting",
  recentEvents: [],
  eventCount: 0,
  clearRecent: () => {},
});

const MAX_RECENT = 50;

export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const [recentEvents, setRecentEvents] = useState<LiveEventPayload[]>([]);
  const queryClient = useQueryClient();

  const handleEvent = useCallback(
    (event: LiveEventPayload) => {
      setRecentEvents((prev) => [event, ...prev].slice(0, MAX_RECENT));

      // Invalidate queries that depend on live event data
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardActivityQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetEventStatsQueryKey() });
    },
    [queryClient]
  );

  const { status, eventCount } = useLiveFeed(handleEvent);

  const clearRecent = useCallback(() => setRecentEvents([]), []);

  return (
    <LiveFeedContext.Provider value={{ status, recentEvents, eventCount, clearRecent }}>
      {children}
    </LiveFeedContext.Provider>
  );
}

export function useLiveFeedContext() {
  return useContext(LiveFeedContext);
}
