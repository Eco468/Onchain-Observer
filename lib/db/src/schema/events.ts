import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  eventType: text("event_type").notNull(),
  chain: text("chain").notNull(),
  tokenSymbol: text("token_symbol"),
  amountUsd: numeric("amount_usd"),
  txHash: text("tx_hash"),
  significance: text("significance").notNull().default("medium"),
  summary: text("summary"),
  aiAnalysis: text("ai_analysis"),
  inferredIntent: text("inferred_intent"),
  historicalContext: text("historical_context"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
