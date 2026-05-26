import React, { useEffect, useRef, useState } from "react";
import { 
  useGetDashboardStats, 
  useGetDashboardActivity, 
  useHealthCheck 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet, ShieldAlert, List, TrendingUp, Bell, Server, Zap } from "lucide-react";
import { formatUsd } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveFeedContext, type LiveEventPayload } from "@/contexts/live-feed-context";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: health } = useHealthCheck();
  const { recentEvents, status } = useLiveFeedContext();
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());
  const prevCountRef = useRef(0);

  // Flash new live events as they arrive
  useEffect(() => {
    if (recentEvents.length > prevCountRef.current) {
      const newest = recentEvents[0];
      if (newest) {
        setFlashingIds((prev) => new Set([...prev, newest.id]));
        setTimeout(() => {
          setFlashingIds((prev) => {
            const next = new Set(prev);
            next.delete(newest.id);
            return next;
          });
        }, 3000);
      }
    }
    prevCountRef.current = recentEvents.length;
  }, [recentEvents]);

  // Merge live events on top of API-fetched activity
  const liveItems: Array<LiveEventPayload & { isLive?: true }> = recentEvents
    .slice(0, 5)
    .map((e) => ({ ...e, isLive: true as const }));

  const apiItems = (activity ?? []).filter(
    (a) => !liveItems.some((l) => l.id === a.id)
  );

  const feedItems = [...liveItems, ...apiItems].slice(0, 10);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase font-mono tracking-widest">Mission Control</h1>
          <p className="text-muted-foreground mt-1">Live overview of tracked wallets and onchain intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          {status === "connected" && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md text-sm font-mono text-primary">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              STREAMING
            </div>
          )}
          <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-md text-sm font-mono" data-testid="status-server">
            <Server className="w-4 h-4 text-primary" />
            <span className={health?.status === 'ok' ? 'text-primary' : 'text-destructive'}>
              API: {health?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : (
          <>
            <StatCard title="Tracked Wallets" value={stats?.trackedWallets ?? 0} icon={Wallet} href="/wallets" testId="stat-tracked-wallets" />
            <StatCard title="Total Volume (30d)" value={formatUsd(stats?.totalVolumeTracked)} icon={TrendingUp} testId="stat-volume" />
            <StatCard title="Events Today" value={stats?.eventsToday ?? 0} icon={Activity} href="/events" testId="stat-events" />
            <StatCard title="Critical Events" value={stats?.criticalEvents ?? 0} icon={ShieldAlert} className="border-destructive/30 bg-destructive/5" testId="stat-critical" />
            <StatCard title="Active Watchlists" value={stats?.activeWatchlists ?? 0} icon={List} href="/watchlists" testId="stat-watchlists" />
            <StatCard title="Active Alerts" value={stats?.activeAlerts ?? 0} icon={Bell} href="/alerts" testId="stat-alerts" />
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold uppercase font-mono tracking-wider">Live Activity Feed</h2>
            {status === "connected" && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                LIVE
              </span>
            )}
          </div>
          <Link href="/events" className="text-sm text-primary hover:underline font-mono">View All Events →</Link>
        </div>
        
        <Card className="bg-card shadow-lg border-primary/20">
          <div className="divide-y divide-border">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex justify-between"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-1/4" /></div>
              ))
            ) : feedItems.map((item, index) => {
              const isLive = 'isLive' in item && item.isLive;
              const isFlashing = flashingIds.has(item.id);
              const sig = item.significance;
              const title = isLive ? (item as LiveEventPayload).eventType.replace(/_/g, " ") : (item as any).title;
              const desc = isLive ? (item as LiveEventPayload).summary ?? "" : (item as any).description ?? "";
              const ts = isLive ? (item as LiveEventPayload).detectedAt : (item as any).timestamp;
              const amount = item.amountUsd;
              return (
                <div
                  key={item.id}
                  className={`p-4 flex items-center justify-between transition-all group ${
                    isFlashing ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-primary/5"
                  }`}
                  data-testid={`row-activity-${index}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                        sig === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : sig === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                        : 'bg-primary/10 text-primary border-primary/20'
                      }`} data-testid={`text-significance-${index}`}>
                        {sig.toUpperCase()}
                      </span>
                      <span className="font-semibold text-foreground capitalize" data-testid={`text-title-${index}`}>{title}</span>
                      {isFlashing && (
                        <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded animate-in fade-in duration-300">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-sm text-muted-foreground font-mono" data-testid={`text-time-${index}`}>
                      {formatDistanceToNow(new Date(ts), { addSuffix: true })}
                    </div>
                    {amount != null && (
                      <div className="font-mono text-primary font-medium mt-1" data-testid={`text-amount-${index}`}>
                        {formatUsd(amount)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!activityLoading && feedItems.length === 0 && (
              <div className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground space-y-4">
                <Activity className="w-12 h-12 text-muted" />
                <div>
                  <p className="font-mono text-lg text-foreground">No recent activity</p>
                  <p className="text-sm">The network is currently quiet. Waiting for events...</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, href, className, testId }: { title: string, value: string | number, icon: any, href?: string, className?: string, testId?: string }) {
  const content = (
    <Card className={`bg-card border-border hover:border-primary/50 transition-colors shadow-sm ${className}`} data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground font-mono uppercase tracking-wider">{title}</CardTitle>
        <Icon className="w-4 h-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono tracking-tight text-foreground">{value}</div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
