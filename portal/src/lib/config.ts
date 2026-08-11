import { db, tables, type DbOrTx } from "@/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

// Late-binding config registry (BUILD-PLAN.md). Every pending client decision
// is a key here; changing a decision is a config update, never a code change.

const registry = {
  "brand.goldPresence": z.enum(["restrained", "stronger"]).default("restrained"),
  "auth.emailFallbackEnabled": z.boolean().default(true),
  "contact.defaults.phone": z
    .enum(["visible", "hidden", "admin_only"])
    .default("hidden"),
  "contact.defaults.email": z
    .enum(["visible", "hidden", "admin_only"])
    .default("admin_only"),
  "contact.defaults.linkedin": z
    .enum(["visible", "hidden", "admin_only"])
    .default("visible"),
  "posts.opportunityExpiryDays": z.number().int().min(1).default(90),
  "posts.expiryAdminOverridable": z.boolean().default(true),
  // Global section toggles (CONT-04); per-member overrides live in
  // member_section_overrides.
  "sections.opportunity": z.boolean().default(true),
  "sections.job": z.boolean().default(true),
  "sections.knowledge": z.boolean().default(true),
  "sections.event": z.boolean().default(true),
} as const;

export type ConfigKey = keyof typeof registry;
export type ConfigValue<K extends ConfigKey> = z.infer<(typeof registry)[K]>;

export async function getConfig<K extends ConfigKey>(
  key: K,
  dbOrTx: DbOrTx = db,
): Promise<ConfigValue<K>> {
  const schema = registry[key];
  const [row] = await dbOrTx
    .select()
    .from(tables.appConfig)
    .where(eq(tables.appConfig.key, key))
    .limit(1);
  if (!row) return schema.parse(undefined) as ConfigValue<K>;
  const parsed = schema.safeParse(row.value);
  return (
    parsed.success ? parsed.data : schema.parse(undefined)
  ) as ConfigValue<K>;
}

export async function setConfig<K extends ConfigKey>(
  key: K,
  value: ConfigValue<K>,
  updatedBy?: string,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  registry[key].parse(value);
  await dbOrTx
    .insert(tables.appConfig)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: tables.appConfig.key,
      set: { value, updatedAt: new Date(), updatedBy },
    });
}
