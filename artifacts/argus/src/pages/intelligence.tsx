import React, { useState, useEffect } from "react";
import { useGetIntelligenceFeed, useGetMarketSummary } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";
import { useLiveFeedContext, type CorrelationSignalPayload } from "@/contexts/live-feed-context";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { GitCompare, Zap, RadioTower, TrendingUp } from "lucide-react";

interface CorrelationItem {
  id: number;
  headline: string;
  body: string;
  significance: string;
  relatedWallets: string[];
  createdAt: string;
}

function sigBadge(sig: string) {
  if (sig === "critical")
    return "bg-destructive/15 text-destructive border border-destructive/30";
  if (sig === "high")
    return "bg-orange-500/15 text-orange-400 border border-orange-500/30";
  return "bg-primary/10 text-primary border border-primary/20";
}

export default function Intelligence() {
  const { data: summary, isLoading: summaryLoading } = useGetMarketSummary();
  const { data: feed, isLoading: feedLoading } = useGetIntelligenceFeed({ limit: 20 });
  const { recentCorrelations, status } = useLiveFeedContext();
  const [liveFlashIds, setLiveFlashIds] = useState<Set<number>>(new Set());

  const { data: correlations, isLoading: corrLoading, refetch: refetchCorr } = useQuery<CorrelationItem[]>({
    queryKey: ["intelligence", "correlations"],
    queryFn: () => fetch("/api/intelligence/correlations?limit=10").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  // Trigger a manual detection run on mount so there's immediate data
  useEffect(() => {
    fetch("/api/intelligence/correlations/run", { method: "POST" })
      .then(() => refetchCorr())
      .catch(() => {});
  }, [refetchCorr]);

  // Flash newly arriving live correlations
  useEffect(() => {
    const newest = recentCorrelations[0];
    if (!newest) return;
    setLiveFlashIds((prev) => new Set([...prev, newest.id]));
    const t = setTimeout(() => {
      setLiveFlashIds((prev) => { const n = new Set(prev); n.delete(newest.id); return n; });
    }, 4000);
    return () => clearTimeout(t);
  }, [recentCorrelations]);

  // Merge live correlations on top of API-fetched ones
  const liveCorrelationItems: CorrelationItem[] = recentCorrelations.map((s) => ({
    id: s.id,
    headline: s.headline,
    body: s.body,
    significance: s.significance,
    relatedWallets: s.walletLabels,
    createdAt: s.detectedAt,
  }));

  const mergedCorrelations = [
    ...liveCorrelationItems,
    ...(correlations ?? []).filter((c) => !liveCorrelationItems.some((l) => l.id === c.id)),
  ].slice(0, 10);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-widest text-primary uppercase font-mono flex items-center gap-3">
            <RadioTower className="w-7 h-7" />
            Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">Cross-wallet correlation analysis and onchain signals</p>
        </div>
        {status === "connected" && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md text-sm font-mono text-primary">
            <Zap className="w-3.5 h-3.5 animate-pulse" />
            STREAMING
          </div>
        )}
      </div>

      {/* Market summary */}
      {summaryLoading ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : summary && (
        <div className="bg-card border-l-4 border-primary p-6 space-y-3 rounded-r-lg">
          <div className="flex items-center gap-2 text-xs font-mono text-primary uppercase tracking-widest">
            <TrendingUp className="w-3.5 h-3.5" />
            Market Narrative
          </div>
          <h2 className="text-xl font-bold">{summary.headline}</h2>
          <p className="text-muted-foreground leading-relaxed text-sm">{summary.body}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {summary.trendingNarratives.map((n: string, i: number) => (
              <span key={i} className="text-xs font-mono bg-primary/5 border border-primary/15 px-2 py-1 rounded text-primary/80">
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Correlation Signals ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold uppercase font-mono tracking-wider flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-primary" />
              Correlation Signals
            </h2>
            {status === "connected" && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-mono">3+ wallets · same move · 10-min window</span>
        </div>

        {corrLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : mergedCorrelations.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-10 flex flex-col items-center text-center space-y-3">
            <GitCompare className="w-10 h-10 text-muted-foreground" />
            <p className="font-mono text-foreground">No correlation signals yet</p>
            <p className="text-sm text-muted-foreground">Argus scans every 3 minutes for synchronized wallet moves. Check back shortly.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mergedCorrelations.map((item) => {
              const isLive = liveCorrelationItems.some((l) => l.id === item.id);
              const isFlashing = liveFlashIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-5 space-y-3 transition-all duration-500 ${
                    isFlashing
                      ? "bg-primary/10 border-primary/50 shadow-[0_0_20px_rgba(0,255,127,0.08)]"
                      : "bg-card border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {isFlashing && (
                        <span className="shrink-0 mt-0.5 text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded animate-in fade-in duration-300">
                          NEW
                        </span>
                      )}
                      <h3 className="font-bold text-foreground leading-snug">{item.headline}</h3>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${sigBadge(item.significance)}`}>
                      {item.significance.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>

                  {item.relatedWallets.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.relatedWallets.map((label) => (
                        <span
                          key={label}
                          className="text-xs font-mono bg-primary/5 border border-primary/15 px-2 py-0.5 rounded text-primary/70"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground font-mono pt-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Intelligence Feed ── */}
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-xl font-semibold uppercase font-mono tracking-wider">Intelligence Feed</h2>
        </div>
        {feedLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {feed?.filter((item) => item.category !== "correlation").map((item) => (
              <div key={item.id} className="bg-card border border-border p-6 rounded-lg space-y-3 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <h3 className="text-lg font-bold leading-snug">{item.headline}</h3>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-mono font-medium ${sigBadge(item.significance)}`}>
                    {item.significance.toUpperCase()}
                  </span>
                </div>
                <p className="text-foreground text-sm leading-relaxed">{item.body}</p>
                <div className="flex justify-between items-center text-xs text-muted-foreground font-mono pt-1">
                  <span className="uppercase tracking-wider">{item.category}</span>
                  <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
