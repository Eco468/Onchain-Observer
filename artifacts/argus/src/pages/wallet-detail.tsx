import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetWallet, useListEvents } from "@workspace/api-client-react";
import { formatUsd, formatAddress } from "@/lib/format";
import { formatDistanceToNow, format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  ChevronLeft,
  Activity,
  Wallet,
  Coins,
  History,
} from "lucide-react";

interface Tx {
  hash: string;
  blockNumber: string;
  timestamp: number;
  from: string;
  to: string;
  direction: "in" | "out";
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  amountUsd: number;
  method: string;
  type: "eth" | "token";
}

interface TxResponse {
  transactions: Tx[];
  supported: boolean;
  chain: string;
  ethBalance?: number;
  ethPrice?: number;
}

type Tab = "events" | "transactions";

export default function WalletDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [tab, setTab] = useState<Tab>("events");

  const { data: wallet, isLoading: walletLoading } = useGetWallet(id);

  const { data: events, isLoading: eventsLoading } = useListEvents(
    { walletId: id, limit: 50 }
  );

  const { data: txData, isLoading: txLoading } = useQuery<TxResponse>({
    queryKey: ["wallet-transactions", id],
    queryFn: async () => {
      const res = await fetch(`/api/wallets/${id}/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    enabled: !!id && tab === "transactions",
    staleTime: 60_000,
  });

  if (walletLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4">
        <Wallet className="w-12 h-12 text-muted" />
        <p className="font-mono text-muted-foreground">Wallet not found.</p>
        <Link href="/wallets" className="text-primary text-sm font-mono hover:underline">← Back to Wallets</Link>
      </div>
    );
  }

  const isEthereum = wallet.chain === "ethereum";
  const ethBalance = txData?.ethBalance;
  const ethPrice = txData?.ethPrice ?? 2100;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <Link href="/wallets" className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono hover:text-foreground transition-colors mb-4">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Wallets
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono tracking-tight text-foreground">{wallet.label}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-mono text-muted-foreground text-sm">{wallet.address}</span>
              {isEthereum && (
                <a
                  href={`https://etherscan.io/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline font-mono"
                >
                  <ExternalLink className="w-3 h-3" /> Etherscan
                </a>
              )}
            </div>
          </div>
          <span className={`text-xs font-mono px-3 py-1 rounded border capitalize ${
            wallet.category === "whale" ? "bg-primary/10 text-primary border-primary/20"
            : wallet.category === "exchange" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
            : "bg-muted text-muted-foreground border-border"
          }`}>
            {wallet.category}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Chain" value={wallet.chain.toUpperCase()} />
        <StatBox label="30d Volume" value={formatUsd(wallet.totalVolume30d)} highlight />
        <StatBox label="Detected Events" value={String(wallet.eventCount)} />
        {ethBalance != null ? (
          <StatBox
            label="ETH Balance"
            value={`${ethBalance.toFixed(2)} ETH`}
            sub={formatUsd(ethBalance * ethPrice)}
            highlight
          />
        ) : (
          <StatBox label="Status" value={wallet.isActive ? "ACTIVE" : "PAUSED"} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === "events"} onClick={() => setTab("events")} icon={<Activity className="w-3.5 h-3.5" />}>
          Detected Events {events?.length ? `(${events.length})` : ""}
        </TabButton>
        {isEthereum && (
          <TabButton active={tab === "transactions"} onClick={() => setTab("transactions")} icon={<History className="w-3.5 h-3.5" />}>
            Transaction History
          </TabButton>
        )}
      </div>

      {/* Events tab */}
      {tab === "events" && (
        <Card className="border-primary/20 overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-background uppercase border-b border-border font-mono tracking-wider">
              <tr>
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-5 py-3 text-left">Type</th>
                <th className="px-5 py-3 text-left">Chain</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {eventsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : events?.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground font-mono text-sm">No detected events yet.</td></tr>
              ) : events?.map((e) => (
                <tr key={e.id} className="hover:bg-primary/5 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(e.detectedAt), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs uppercase">{e.eventType.replace(/_/g, " ")}</td>
                  <td className="px-5 py-3 font-mono text-xs uppercase">{e.chain}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-primary text-sm">
                    {formatUsd(e.amountUsd)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <SigBadge sig={e.significance} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Transactions tab */}
      {tab === "transactions" && (
        <Card className="border-primary/20 overflow-hidden bg-card">
          {txLoading ? (
            <div className="divide-y divide-border/50">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex justify-between">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : !txData?.supported ? (
            <div className="p-12 text-center">
              <Coins className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="font-mono text-muted-foreground">Transaction history is only available for Ethereum wallets.</p>
            </div>
          ) : txData.transactions.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-mono text-sm">No transactions found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground bg-background uppercase border-b border-border font-mono tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-left">Time</th>
                    <th className="px-5 py-3 text-left">Tx Hash</th>
                    <th className="px-5 py-3 text-left">Method</th>
                    <th className="px-5 py-3 text-left">Counterparty</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-right">USD Value</th>
                    <th className="px-5 py-3 text-center">Dir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {txData.transactions.map((tx) => {
                    const counterparty = tx.direction === "in" ? tx.from : tx.to;
                    const isIn = tx.direction === "in";
                    return (
                      <tr key={`${tx.hash}-${tx.tokenSymbol}`} className="hover:bg-primary/5 transition-colors group">
                        <td className="px-5 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          <div>{formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}</div>
                          <div className="text-[10px] opacity-60">{format(new Date(tx.timestamp), "MMM d, HH:mm")}</div>
                        </td>
                        <td className="px-5 py-3">
                          <a
                            href={`https://etherscan.io/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {tx.hash.slice(0, 8)}…{tx.hash.slice(-6)}
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </td>
                        <td className="px-5 py-3 font-mono text-xs uppercase text-muted-foreground">
                          {tx.method || "transfer"}
                        </td>
                        <td className="px-5 py-3">
                          <a
                            href={`https://etherscan.io/address/${counterparty}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            {formatAddress(counterparty)}
                          </a>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-sm font-semibold">
                          <span className={isIn ? "text-primary" : "text-foreground"}>
                            {tx.amount < 0.0001
                              ? tx.amount.toExponential(2)
                              : tx.amount >= 1_000_000
                              ? `${(tx.amount / 1_000_000).toFixed(2)}M`
                              : tx.amount >= 1000
                              ? `${(tx.amount / 1000).toFixed(2)}K`
                              : tx.amount.toFixed(4)}
                            {" "}{tx.tokenSymbol}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-muted-foreground">
                          {tx.amountUsd > 0 ? formatUsd(tx.amountUsd) : "—"}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            isIn
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            {isIn
                              ? <ArrowDownLeft className="w-2.5 h-2.5" />
                              : <ArrowUpRight className="w-2.5 h-2.5" />}
                            {isIn ? "IN" : "OUT"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Notes */}
      {wallet.notes && (
        <Card className="p-5 border-border bg-card">
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-foreground leading-relaxed">{wallet.notes}</p>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="bg-card border border-border p-4 rounded-lg">
      <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-mono font-bold text-lg ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground font-mono mt-0.5">{sub}</div>}
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: { active: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-mono border-b-2 transition-colors -mb-px ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SigBadge({ sig }: { sig: string }) {
  const cls =
    sig === "critical" ? "bg-destructive/10 text-destructive border-destructive/20"
    : sig === "high" ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
    : "bg-primary/10 text-primary border-primary/20";
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border tracking-widest ${cls}`}>
      {sig.toUpperCase()}
    </span>
  );
}
