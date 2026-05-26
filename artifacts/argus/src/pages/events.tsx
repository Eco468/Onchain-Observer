import React, { useState } from "react";
import { useListEvents, useGetEventStats } from "@workspace/api-client-react";
import { formatUsd, formatAddress } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Filter } from "lucide-react";

export default function Events() {
  const [chain, setChain] = useState<string>("all");
  const [significance, setSignificance] = useState<string>("all");

  const { data: events, isLoading } = useListEvents({ 
    limit: 100,
    ...(chain !== "all" ? { chain } : {}),
    ...(significance !== "all" ? { significance } : {})
  });
  const { data: stats } = useGetEventStats();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-mono">Events Feed</h1>
          <p className="text-muted-foreground">Chronological list of detected onchain events</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4 font-mono">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger className="w-[140px] font-mono bg-card" data-testid="select-chain">
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chains</SelectItem>
              <SelectItem value="ethereum">Ethereum</SelectItem>
              <SelectItem value="solana">Solana</SelectItem>
              <SelectItem value="arbitrum">Arbitrum</SelectItem>
              <SelectItem value="base">Base</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={significance} onValueChange={setSignificance}>
            <SelectTrigger className="w-[160px] font-mono bg-card" data-testid="select-significance">
              <SelectValue placeholder="Significance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Significance</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border p-4 rounded-lg flex flex-col justify-center">
          <div className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">24h Volume</div>
          <div className="font-mono text-xl font-bold">{stats?.last24h ?? 0} Events</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex flex-col justify-center">
          <div className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">7d Volume</div>
          <div className="font-mono text-xl font-bold">{stats?.last7d ?? 0} Events</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex flex-col justify-center col-span-2">
          <div className="text-xs text-muted-foreground font-mono mb-1 uppercase tracking-wider">Top Event Types</div>
          <div className="flex gap-4 font-mono text-sm">
            {stats?.byType.slice(0, 3).map(t => (
              <div key={t.label} className="flex gap-2"><span className="text-primary">{t.label}:</span> <span>{t.count}</span></div>
            ))}
          </div>
        </div>
      </div>
      
      <Card className="border border-primary/20 overflow-hidden shadow-lg bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-background uppercase border-b border-border font-mono tracking-wider">
              <tr>
                <th className="px-6 py-4">Time</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Wallet</th>
                <th className="px-6 py-4">Chain</th>
                <th className="px-6 py-4 text-right">Amount (USD)</th>
                <th className="px-6 py-4 text-center">Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : events?.map((event, index) => (
                <tr key={event.id} className="hover:bg-primary/5 transition-colors group" data-testid={`row-event-${index}`}>
                  <td className="px-6 py-4 font-mono whitespace-nowrap text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(event.detectedAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs uppercase text-foreground">{event.eventType.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4">
                    <Link href={`/wallets/${event.walletId}`} className="flex flex-col group-hover:text-primary transition-colors">
                      <span className="font-semibold text-sm">{event.walletLabel}</span>
                      <span className="text-xs text-muted-foreground font-mono">{formatAddress(event.walletAddress)}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs uppercase">{event.chain}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                    {formatUsd(event.amountUsd)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-widest border ${event.significance === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/20' : event.significance === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                      {event.significance.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !events?.length && (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="font-mono text-lg text-muted-foreground mb-2">No events found matching filters.</div>
          </div>
        )}
      </Card>
    </div>
  );
}
