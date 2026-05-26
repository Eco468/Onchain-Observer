import React, { useState } from "react";
import { useListWallets, useCreateWallet, getListWalletsQueryKey } from "@workspace/api-client-react";
import { formatUsd, formatAddress } from "@/lib/format";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Filter } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  address: z.string().min(10, { message: "Address must be at least 10 characters." }),
  chain: z.string().min(1, { message: "Chain is required." }),
  category: z.string().min(1, { message: "Category is required." }),
  label: z.string().min(1, { message: "Label is required." }),
  notes: z.string().optional(),
});

export default function Wallets() {
  const [category, setCategory] = useState<string>("all");
  const [chain, setChain] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wallets, isLoading } = useListWallets({
    ...(category !== "all" ? { category } : {}),
    ...(chain !== "all" ? { chain } : {})
  });

  const createWallet = useCreateWallet();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      address: "",
      chain: "ethereum",
      category: "whale",
      label: "",
      notes: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createWallet.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "Wallet tracked", description: "Successfully added to monitoring." });
        queryClient.invalidateQueries({ queryKey: getListWalletsQueryKey() });
        setIsOpen(false);
        form.reset();
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error.message || "Failed to add wallet.", variant: "destructive" });
      }
    });
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
              <SelectItem value="whale">Whale</SelectItem>
              <SelectItem value="exchange">Exchange</SelectItem>
              <SelectItem value="dao">DAO</SelectItem>
              <SelectItem value="vc">VC</SelectItem>
              <SelectItem value="bridge">Bridge</SelectItem>
              <SelectItem value="smart-money">Smart Money</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={chain} onValueChange={setChain}>
            <SelectTrigger className="w-[140px] font-mono bg-card">
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

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono uppercase tracking-wider gap-2 ml-4">
                <Plus className="w-4 h-4" /> Add Wallet
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] border-primary/20">
              <DialogHeader>
                <DialogTitle className="font-mono uppercase text-xl text-primary">Track New Wallet</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">Address</FormLabel>
                        <FormControl>
                          <Input placeholder="0x..." {...field} className="font-mono" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-xs uppercase">Label</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Alameda Research" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="chain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase">Chain</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="font-mono capitalize">
                                <SelectValue placeholder="Select chain" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ethereum">Ethereum</SelectItem>
                              <SelectItem value="solana">Solana</SelectItem>
                              <SelectItem value="arbitrum">Arbitrum</SelectItem>
                              <SelectItem value="base">Base</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-mono text-xs uppercase">Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="font-mono capitalize">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="whale">Whale</SelectItem>
                              <SelectItem value="exchange">Exchange</SelectItem>
                              <SelectItem value="dao">DAO</SelectItem>
                              <SelectItem value="vc">VC</SelectItem>
                              <SelectItem value="bridge">Bridge</SelectItem>
                              <SelectItem value="smart-money">Smart Money</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full font-mono uppercase tracking-widest mt-4" disabled={createWallet.isPending}>
                    {createWallet.isPending ? "Adding..." : "Start Tracking"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
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
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4"><Skeleton className="h-8 w-full" /></td>
                  </tr>
                ))
              ) : wallets?.map((wallet, index) => (
                <tr key={wallet.id} className="hover:bg-primary/5 transition-colors" data-testid={`row-wallet-${index}`}>
                  <td className="px-6 py-4 font-semibold">
                    <Link href={`/wallets/${wallet.id}`} className="hover:underline text-foreground hover:text-primary transition-colors flex items-center gap-2">
                      {wallet.label}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground text-xs">{formatAddress(wallet.address)}</td>
                  <td className="px-6 py-4 font-mono text-xs uppercase tracking-wider">{wallet.category}</td>
                  <td className="px-6 py-4 font-mono text-xs uppercase">{wallet.chain}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary">{formatUsd(wallet.totalVolume30d)}</td>
                  <td className="px-6 py-4 text-center font-mono font-bold">{wallet.eventCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`w-2 h-2 rounded-full inline-block ${wallet.isActive ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary))]' : 'bg-muted-foreground'}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !wallets?.length && (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="font-mono text-lg text-muted-foreground mb-2">No tracked wallets match criteria.</div>
          </div>
        )}
      </Card>
    </div>
  );
}
