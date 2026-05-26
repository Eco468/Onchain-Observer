import React from "react";
import { useParams } from "wouter";
import { useGetWallet, useAnalyzeWallet } from "@workspace/api-client-react";
import { formatUsd } from "@/lib/format";

export default function WalletDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { data: wallet, isLoading } = useGetWallet(id, { query: { enabled: !!id } });

  if (isLoading) return <div className="p-8">Loading wallet...</div>;
  if (!wallet) return <div className="p-8">Wallet not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{wallet.label}</h1>
        <div className="font-mono text-muted-foreground text-lg">{wallet.address}</div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Category</div>
          <div className="font-semibold capitalize">{wallet.category}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Chain</div>
          <div className="font-semibold capitalize">{wallet.chain}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">30d Volume</div>
          <div className="font-semibold font-mono text-primary">{formatUsd(wallet.totalVolume30d)}</div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg">
          <div className="text-sm text-muted-foreground mb-1">Events</div>
          <div className="font-semibold font-mono">{wallet.eventCount}</div>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-lg space-y-4">
        <h2 className="text-xl font-bold border-b border-border pb-2">Notes & Analysis</h2>
        {wallet.notes ? (
          <p className="text-foreground leading-relaxed">{wallet.notes}</p>
        ) : (
          <p className="text-muted-foreground italic">No manual notes for this wallet.</p>
        )}
      </div>
    </div>
  );
}
