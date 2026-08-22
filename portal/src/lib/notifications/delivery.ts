import { after } from "next/server";
import { processOutboxEvent } from "@/lib/notifications/worker";
import type { OutboxDeliveryScheduler } from "@/lib/outbox";

// Ordinary actions create one or a handful of events. A global policy change
// can create hundreds; do not hold one request open trying to drain that bulk
// fan-out. The unchanged cron worker will deliver the remainder.
const MAX_IMMEDIATE_EVENTS = 5;

/**
 * Start delivery after the response so sending mail never delays or rolls back
 * the user's action. The persisted outbox row remains available to cron if
 * this best-effort attempt cannot run or the provider rejects it.
 */
export const scheduleOutboxDelivery: OutboxDeliveryScheduler = (eventIds) => {
  if (eventIds.length === 0) return;
  const ids = eventIds.slice(0, MAX_IMMEDIATE_EVENTS);
  after(async () => {
    for (const eventId of ids) {
      try {
        await processOutboxEvent(eventId);
      } catch (error) {
        console.error(`[outbox] immediate delivery failed for event ${eventId}`, error);
      }
    }
  });
};
