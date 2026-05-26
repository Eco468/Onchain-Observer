import React, { useState } from "react";
import { useListAlerts, useCreateAlert, useUpdateAlert, useDeleteAlert } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAlertsQueryKey } from "@workspace/api-client-react";
import { Bell, BellOff, Trash2, Plus, Send, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SIG_LEVELS = ["low", "medium", "high", "critical"] as const;

interface DetectedChat {
  chatId: string;
  name: string;
  username: string | null;
}

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlerts();
  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [minSig, setMinSig] = useState<string>("high");

  // Telegram setup state
  const [detectedChats, setDetectedChats] = useState<DetectedChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string>("");

  async function fetchChats() {
    setLoadingChats(true);
    try {
      const res = await fetch("/api/telegram/setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDetectedChats(data.chats ?? []);
      if ((data.chats ?? []).length === 0) {
        toast({ title: "No chats found", description: "Send any message to your bot in Telegram, then try again.", variant: "destructive" });
      } else {
        setSelectedChatId(data.chats[0].chatId);
        toast({ title: `Found ${data.chats.length} chat(s)`, description: "Select one below and save the alert." });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingChats(false);
    }
  }

  async function sendTest(chatId: string) {
    setTestingId(chatId);
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Test sent!", description: "Check your Telegram." });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  }

  async function handleCreate() {
    if (!name.trim() || !selectedChatId) return;
    try {
      await createAlert.mutateAsync({
        data: { name: name.trim(), channel: "telegram", chatId: selectedChatId, minSignificance: minSig },
      });
      queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      setShowForm(false);
      setName("");
      setSelectedChatId("");
      setDetectedChats([]);
      toast({ title: "Alert created", description: "You'll receive Telegram messages for matching events." });
    } catch {
      toast({ title: "Failed to create alert", variant: "destructive" });
    }
  }

  async function toggleActive(id: number, current: boolean) {
    await updateAlert.mutateAsync({ id, data: { isActive: !current } });
    queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
  }

  async function handleDelete(id: number) {
    await deleteAlert.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
    toast({ title: "Alert deleted" });
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight uppercase font-mono">Alert Config</h1>
          <p className="text-muted-foreground">Get notified on Telegram when whale events are detected</p>
        </div>
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 font-mono"
          variant={showForm ? "outline" : "default"}
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cancel" : "New Alert"}
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="p-6 border-primary/30 bg-card space-y-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <h2 className="font-mono font-semibold uppercase tracking-wider text-sm text-muted-foreground">New Telegram Alert</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Alert Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Whale Watcher"
                className="font-mono bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase">Min Significance</label>
              <Select value={minSig} onValueChange={setMinSig}>
                <SelectTrigger className="font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIG_LEVELS.map((s) => (
                    <SelectItem key={s} value={s} className="font-mono">{s.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Telegram chat detection */}
          <div className="space-y-3 border border-border rounded-lg p-4 bg-background/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-mono font-medium">Connect Telegram Chat</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send any message to your bot in Telegram, then click Detect.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchChats}
                disabled={loadingChats}
                className="font-mono flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? "animate-spin" : ""}`} />
                {loadingChats ? "Detecting…" : "Detect Chats"}
              </Button>
            </div>

            {detectedChats.length > 0 && (
              <div className="space-y-2">
                {detectedChats.map((chat) => (
                  <div
                    key={chat.chatId}
                    onClick={() => setSelectedChatId(chat.chatId)}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedChatId === chat.chatId
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">{chat.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {chat.username ? `@${chat.username} · ` : ""}ID: {chat.chatId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedChatId === chat.chatId && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); sendTest(chat.chatId); }}
                        disabled={testingId === chat.chatId}
                        className="font-mono text-xs"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        {testingId === chat.chatId ? "Sending…" : "Test"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowForm(false)} className="font-mono">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !selectedChatId || createAlert.isPending}
              className="font-mono"
            >
              {createAlert.isPending ? "Saving…" : "Save Alert"}
            </Button>
          </div>
        </Card>
      )}

      {/* Alert List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-muted-foreground font-mono text-sm">Loading…</div>
        ) : alerts?.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-lg">
            <Bell className="w-10 h-10 mx-auto mb-3 text-muted" />
            <p className="font-mono">No alerts configured yet.</p>
            <p className="text-sm mt-1">Create one to start receiving Telegram notifications.</p>
          </div>
        ) : (
          alerts?.map((alert) => (
            <Card key={alert.id} className={`p-5 border flex items-center justify-between transition-colors ${alert.isActive ? "border-primary/20 bg-card" : "border-border bg-card/50 opacity-60"}`}>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold font-mono text-lg">{alert.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    alert.isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {alert.isActive ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  TELEGRAM · Min: {alert.minSignificance?.toUpperCase()}
                  {alert.chatId && ` · Chat ${alert.chatId}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => alert.chatId && sendTest(alert.chatId)}
                  disabled={!alert.chatId || testingId === alert.chatId}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  title="Send test message"
                >
                  <Send className="w-3.5 h-3.5 mr-1" />
                  {testingId === alert.chatId ? "…" : "Test"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toggleActive(alert.id, alert.isActive ?? false)}
                  className="font-mono text-xs text-muted-foreground hover:text-foreground"
                  title={alert.isActive ? "Pause alert" : "Enable alert"}
                >
                  {alert.isActive ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(alert.id)}
                  className="text-destructive/60 hover:text-destructive font-mono text-xs"
                  title="Delete alert"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
