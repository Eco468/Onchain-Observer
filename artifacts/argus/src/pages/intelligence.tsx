import React from "react";
import { useGetIntelligenceFeed, useGetMarketSummary } from "@workspace/api-client-react";
import { formatDistanceToNow } from "date-fns";

export default function Intelligence() {
  const { data: summary, isLoading: summaryLoading } = useGetMarketSummary();
  const { data: feed, isLoading: feedLoading } = useGetIntelligenceFeed({ limit: 20 });

  if (summaryLoading || feedLoading) return <div className="p-8">Loading intelligence...</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
        <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
        Live Intelligence
      </h1>

      {summary && (
        <div className="bg-card border-l-4 border-primary p-6 space-y-4">
          <h2 className="text-xl font-bold">{summary.headline}</h2>
          <p className="text-muted-foreground leading-relaxed">{summary.body}</p>
          <div className="flex gap-4 text-sm font-mono text-primary pt-2">
            <span>Trending: {summary.trendingNarratives.join(", ")}</span>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {feed?.map((item) => (
          <div key={item.id} className="bg-card border border-border p-6 rounded-lg space-y-3">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold">{item.headline}</h3>
              <span className={`px-2 py-1 rounded text-xs font-mono font-medium ${item.significance === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-accent text-accent-foreground'}`}>
                {item.significance.toUpperCase()}
              </span>
            </div>
            <p className="text-foreground text-sm leading-relaxed">{item.body}</p>
            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono pt-2">
              <span className="uppercase">{item.category}</span>
              <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
