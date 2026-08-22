"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth";
import { adminSetConfig } from "@/lib/admin/mutations";
import type { ConfigKey, ConfigValue } from "@/lib/config";
import { err, type ActionResult } from "@/lib/contracts/result";
import { scheduleOutboxDelivery } from "@/lib/notifications/delivery";

// ADMIN-03 config writes. adminSetConfig authorizes and validates against
// the config registry; this wrapper adds the tighter UI bound for expiry.

export async function saveConfigAction<K extends ConfigKey>(
  key: K,
  value: ConfigValue<K>,
): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (key === "posts.opportunityExpiryDays") {
    const days = Number(value);
    if (!Number.isInteger(days) || days < 30 || days > 365)
      return err("validation", "Expiry must be between 30 and 365 days.", {
        value: ["Enter a whole number of days between 30 and 365."],
      });
  }
  const result = await adminSetConfig(
    viewer,
    key,
    value,
    scheduleOutboxDelivery,
  );
  if (result.ok) revalidatePath("/admin/policy");
  return result;
}
