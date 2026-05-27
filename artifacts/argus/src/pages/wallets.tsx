import React, { useState, useRef, useEffect } from "react";
import { useListWallets, useCreateWallet, getListWalletsQueryKey } from "@workspace/api-client-react";
import { formatUsd, formatAddress } from "@/lib/format";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Filter, Search, Loader2, CheckCircle2, AlertTriangle, ExternalLink, Zap } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

interface LookupResult {
  alreadyTracked: boolean;
  walletId: number | null;
  walletLabel: string | null;
  address: string;
  ethBalance: number | null;
  ethPrice: number | null;
  suggestedLabel: string;
  suggestedCategory: string;
}

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CATEGORIES = ["whale", "exchange", "dao", "vc", "bridge", "smart-money"] as const;
const CHAINS = ["ethereum", "solana", "arbitrum", "base"] as const;

function isEthAddress(addr: string) {
  return ETH_ADDRESS_RE.test(addr.trim());
}

export default function Wallets() {
  const [category, setCategory] = useState("all");
  const [chain, setChain] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Add-wallet dialog state
  const [rawAddress, setRawAddress] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [label, setLabel] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("whale");
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [notes, setNotes] = useState("");
  const addressInputRef = useRef<HTMLInputElement>(null);

  const { data: wallets, isLoading } = useListWallets({
    ...(category !== "all" ? { category } : {}),
    ...(chain !== "all" ? { chain } : {}),
  });
  const createWallet = useCreateWallet();

  // Reset dialog state when opened
  useEffect(() => {
    if (isOpen) {
      setRawAddress("");
      setLookupState("idle");
      setLookupResult(null);
      setLookupError("");
      setLabel("");
      setSelectedCategory("whale");
      setSelectedChain("ethereum");
      setNotes("");
      setTimeout(() => addressInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  async function handleLookup() {
    const addr = rawAddress.trim();
    if (!addr) return;

    if (isEthAddress(addr)) {
      setSelectedChain("ethereum");
    }

    setLookupState("loading");
    setLookupError("");
    setLookupResult(null);

    try {
      const res = await fetch(`/api/wallets/lookup?address=${encodeURIComponent(addr)}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error ?? "Lookup failed.");
        setLookupState("error");
        return;
      }
      const result = data as LookupResult;
      setLookupResult(result);
      setLabel(result.suggestedLabel);
      setSelectedCategory(result.suggestedCategory || "whale");
      setLookupState("done");
    } catch {
      setLookupError("Network error — could not reach the server.");
      setLookupState("error");
    }
  }

  function handleAddressKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleLookup();
  }

  function handleSubmit() {
    if (!lookupResult || lookupResult.alreadyTracked) return;
    if (!label.trim()) {
      toast({ title: "Label required", description: "Please give this wallet a name.", variant: "destructive" });
      return;
    }

    createWallet.mutate(
      {
        data: {
          address: lookupResult.address,
          chain: selectedChain,
          category: selectedCategory,
          label: label.trim(),
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: (wallet) => {
          toast({ title: "Tracking started", description: `${label} added to Argus.` });
          queryClient.invalidateQueries({ queryKey: getListWalletsQueryKey() });
          setIsOpen(false);
          navigate(`/wallets/${wallet.id}`);
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to add wallet.", variant: "destructive" });
        },
      }
    );
  }

  const addrValid = isEthAddress(rawAddress.trim()) || rawAddress.trim().length >= 10;
  const ethUsdValue =
    lookupResult?.ethBalance != null && lookupResult?.ethPrice != null
      ? lookupResult.ethBalance * lookupResult.ethPrice
      : null;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-mono">Tracked Wallets</h1>
          <p className="text-muted-foreground">Monitor smart money and significant entities</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2 font-mono">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px] font-mono bg-card">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger className="w-[140px] font-mono bg-card">
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Chains</SelectItem>
              {CHAINS.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider gap-2 ml-4">
                <Plus className="w-4 h-4" /> Add Wallet
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[500px] border-primary/20 p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="font-mono uppercase text-xl text-primary flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Track New Wallet
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Paste any address — Argus fetches live data and auto-fills the details.
                </p>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {/* Step 1: Address search */}
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                    Wallet Address
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      ref={addressInputRef}
                      placeholder="0x... or Solana address"
                      value={rawAddress}
                      onChange={(e) => {
                        setRawAddress(e.target.value);
                        if (lookupState !== "idle") {
                          setLookupState("idle");
                          setLookupResult(null);
                          setLookupError("");
                        }
                      }}
                      onKeyDown={handleAddressKeyDown}
                      className="font-mono text-sm flex-1"
                      disabled={lookupState === "loading"}
                    />
                    <Button
                      onClick={handleLookup}
                      disabled={!rawAddress.trim() || lookupState === "loading"}
                      variant="outline"
                      className="shrink-0 border-primary/30 text-primary hover:bg-primary/10 font-mono"
                    >
                      {lookupState === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  {lookupState === "error" && (
                    <p className="text-xs text-destructive font-mono flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {lookupError}
                    </p>
                  )}
                  {lookupState === "idle" && rawAddress && !addrValid && (
                    <p className="text-xs text-muted-foreground font-mono">
                      Enter a complete address to look up
                    </p>
                  )}
                </div>

                {/* Step 2: Preview card */}
                {lookupState === "done" && lookupResult && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Already tracked banner */}
                    {lookupResult.alreadyTracked ? (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">Already tracked</p>
                          <p className="text-sm text-muted-foreground">
                            <span className="text-primary font-mono">{lookupResult.walletLabel}</span> is already being monitored by Argus.
                          </p>
                          <Link
                            href={`/wallets/${lookupResult.walletId}`}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline mt-1"
                          >
                            View wallet <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* ETH balance preview */}
                        {lookupResult.ethBalance !== null && (
                          <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">ETH Balance</p>
                              <p className="text-xl font-bold font-mono text-primary">
                                {lookupResult.ethBalance.toFixed(4)} ETH
                              </p>
                            </div>
                            {ethUsdValue !== null && (
                              <div>
                                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">USD Value</p>
                                <p className="text-xl font-bold font-mono text-foreground">
                                  {formatUsd(ethUsdValue)}
                                </p>
                              </div>
                            )}
                            <div className="col-span-2">
                              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Address</p>
                              <p className="text-xs font-mono text-foreground break-all">{lookupResult.address}</p>
                            </div>
                          </div>
                        )}

                        {/* Label */}
                        <div className="space-y-1.5">
                          <Label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                            Label <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            placeholder="e.g. Jump Trading, Paradigm Fund…"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="font-mono"
                            autoFocus={!lookupResult.suggestedLabel}
                          />
                        </div>

                        {/* Chain & Category */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Chain</Label>
                            <Select value={selectedChain} onValueChange={setSelectedChain}>
                              <SelectTrigger className="font-mono capitalize">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CHAINS.map((c) => (
                                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Category</Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                              <SelectTrigger className="font-mono capitalize">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                          <Label className="font-mono text-xs uppercase text-muted-foreground tracking-wider">
                            Notes <span className="text-muted-foreground/50">(optional)</span>
                          </Label>
                          <Input
                            placeholder="Any context about this wallet…"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        </div>

                        {/* Submit */}
                        <Button
                          onClick={handleSubmit}
                          disabled={createWallet.isPending || !label.trim()}
                          className="w-full font-mono uppercase tracking-widest gap-2"
                        >
                          {createWallet.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4" />
                          )}
                          {createWallet.isPending ? "Adding…" : "Start Tracking"}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {/* Idle hint */}
                {lookupState === "idle" && (
                  <p className="text-xs text-center text-muted-foreground font-mono pb-1">
                    Ethereum (0x…) addresses are auto-detected and queried live from Etherscan
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Wallet table */}
      <Card className="border border-primary/20 overflow-hidden shadow-lg bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-background uppercase border-b border-border font-mono tracking-wider">
              <tr>
                <th className="px-6 py-4">Label</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Chain</th>
                <th className="px-6 py-4 text-right">Vol (30d)</th>
                <th className="px-6 py-4 text-center">Events</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-6 py-4">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : wallets?.map((wallet, index) => (
                    <tr
                      key={wallet.id}
                      className="hover:bg-primary/5 transition-colors"
                      data-testid={`row-wallet-${index}`}
                    >
                      <td className="px-6 py-4 font-semibold">
                        <Link
                          href={`/wallets/${wallet.id}`}
                          className="hover:underline text-foreground hover:text-primary transition-colors flex items-center gap-2"
                        >
                          {wallet.label}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono text-muted-foreground text-xs">
                        {formatAddress(wallet.address)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">{wallet.category}</td>
                      <td className="px-6 py-4 font-mono text-xs uppercase">{wallet.chain}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-primary">
                        {formatUsd(wallet.totalVolume30d)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold">{wallet.eventCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`w-2 h-2 rounded-full inline-block ${
                            wallet.isActive
                              ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                              : "bg-muted-foreground"
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !wallets?.length && (
          <div className="p-16 text-center flex flex-col items-center">
            <p className="font-mono text-lg text-muted-foreground">No tracked wallets match criteria.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
