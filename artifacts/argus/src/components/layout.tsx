import React from "react";
import { Link, useLocation } from "wouter";
import { Activity, Eye, Wallet, List, BrainCircuit, Bell, Globe, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLiveFeedContext } from "@/contexts/live-feed-context";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/events", label: "Events Feed", icon: Globe },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/watchlists", label: "Watchlists", icon: List },
  { href: "/intelligence", label: "Intelligence", icon: BrainCircuit },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { status, eventCount } = useLiveFeedContext();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border flex items-center gap-3">
          <Eye className="w-8 h-8 text-primary" />
          <span className="font-bold text-xl tracking-tight uppercase">Argus</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              {status === "connected" ? (
                <>
                  <Radio className="w-3 h-3 text-primary animate-pulse" />
                  <span className="text-primary">LIVE FEED</span>
                </>
              ) : status === "connecting" ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="text-yellow-500">CONNECTING</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-destructive" />
                  <span className="text-destructive">OFFLINE</span>
                </>
              )}
            </div>
            {eventCount > 0 && (
              <span className="text-muted-foreground">{eventCount} streamed</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            System Operational
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
