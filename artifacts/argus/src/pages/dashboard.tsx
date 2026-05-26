import React from "react";
import { 
  useGetDashboardStats, 
  useGetDashboardActivity, 
  useHealthCheck 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Wallet, ShieldAlert, List, TrendingUp, Bell, Server } from "lucide-react";
import { formatUsd } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetDashboardActivity({ limit: 10 });
  const { data: health } = useHealthCheck();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase font-mono tracking-widest">Mission Control</h1>
          <p className="text-muted-foreground mt-1">Live overview of tracked wallets and onchain intelligence</p>
        </div>
        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-md text-sm font-mono" data-testid="status-server">
          <Server className="w-4 h-4 text-primary" />
          <span className={health?.status === 'ok' ? 'text-primary' : 'text-destructive'}>
            API: {health?.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
          </span>
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
          <h2 className="text-xl font-semibold uppercase font-mono tracking-wider">Live Activity Feed</h2>
          <Link href="/events" className="text-sm text-primary hover:underline font-mono">View All Events →</Link>
        </div>
        
        <Card className="bg-card shadow-lg border-primary/20">
          <div className="divide-y divide-border">
            {activityLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 flex justify-between"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-10 w-1/4" /></div>
              ))
            ) : activity?.map((item, index) => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-primary/5 transition-colors group" data-testid={`row-activity-${index}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${item.significance === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'}`} data-testid={`text-significance-${index}`}>
                      {item.significance.toUpperCase()}
                    </span>
                    <span className="font-semibold text-foreground" data-testid={`text-title-${index}`}>{item.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground font-mono" data-testid={`text-time-${index}`}>
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </div>
                  {item.amountUsd && (
                    <div className="font-mono text-primary font-medium mt-1" data-testid={`text-amount-${index}`}>
                      {formatUsd(item.amountUsd)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!activityLoading && !activity?.length && (
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
