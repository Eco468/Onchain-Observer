import React from "react";
import { useListAlerts } from "@workspace/api-client-react";

export default function Alerts() {
  const { data: alerts, isLoading } = useListAlerts();

  if (isLoading) return <div className="p-8">Loading alerts...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Alert Configurations</h1>
      </div>
      
      <div className="space-y-4">
        {alerts?.map((alert) => (
          <div key={alert.id} className="bg-card border border-border p-6 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">{alert.name}</h3>
              <p className="text-sm text-muted-foreground uppercase font-mono mt-1">
                {alert.channel} • Min Significance: {alert.minSignificance}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-mono ${alert.isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {alert.isActive ? 'ACTIVE' : 'DISABLED'}
              </span>
            </div>
          </div>
        ))}
        {!alerts?.length && <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-lg">No alerts configured.</div>}
      </div>
    </div>
  );
}
