import React from "react";
import { useListWatchlists } from "@workspace/api-client-react";

export default function Watchlists() {
  const { data: watchlists, isLoading } = useListWatchlists();

  if (isLoading) return <div className="p-8">Loading watchlists...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Watchlists</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {watchlists?.map((list) => (
          <div key={list.id} className="bg-card border border-border p-6 rounded-lg hover:border-primary/50 transition-colors cursor-pointer">
            <h3 className="font-bold text-lg mb-2">{list.name}</h3>
            <p className="text-muted-foreground text-sm mb-4 h-10 overflow-hidden">{list.description}</p>
            <div className="text-sm font-mono flex items-center justify-between border-t border-border pt-4">
              <span>{list.walletCount} wallets</span>
              <span className="text-primary hover:underline">View List →</span>
            </div>
          </div>
        ))}
        {!watchlists?.length && <div className="col-span-full p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">No watchlists created yet.</div>}
      </div>
    </div>
  );
}
