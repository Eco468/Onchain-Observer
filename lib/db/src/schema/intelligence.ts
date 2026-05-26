import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const intelligenceItemsTable = pgTable("intelligence_items", {
  id: serial("id").primaryKey(),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull(),
  significance: text("significance").notNull().default("medium"),
  relatedWallets: text("related_wallets").array(),
  relatedEventId: integer("related_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntelligenceItemSchema = createInsertSchema(intelligenceItemsTable).omit({ id: true, createdAt: true });
export type InsertIntelligenceItem = z.infer<typeof insertIntelligenceItemSchema>;
export type IntelligenceItem = typeof intelligenceItemsTable.$inferSelect;
