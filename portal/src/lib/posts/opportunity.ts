import { z } from "zod";

// The mandate model is deliberately a small private-network subset of the
// MergerDomo reference reviewed with Sandeep. It records useful matching data
// without introducing public-marketplace, EOI, or document-unlock workflows.

export const OPPORTUNITY_MANDATE_TYPES = ["sell_side", "buy_side"] as const;
export type OpportunityMandateType = (typeof OPPORTUNITY_MANDATE_TYPES)[number];

export const OPPORTUNITY_ROLE_VALUES = [
  "mandate_holder",
  "knows_mandate_holder",
  "no_data_available",
] as const;
export type OpportunityRole = (typeof OPPORTUNITY_ROLE_VALUES)[number];

export const OPPORTUNITY_ROLE_LABELS: Record<OpportunityRole, string> = {
  mandate_holder: "I have the mandate",
  knows_mandate_holder: "I know the party who has the mandate",
  no_data_available: "No data available",
};

export const OPPORTUNITY_ROLE_OPTIONS = OPPORTUNITY_ROLE_VALUES.map((value) => ({
  value,
  label: OPPORTUNITY_ROLE_LABELS[value],
}));

export const MANDATE_TYPE_LABELS: Record<OpportunityMandateType, string> = {
  sell_side: "Sell-side mandate",
  buy_side: "Buy-side mandate",
};

export const MANDATE_BASIS_VALUES = [
  "exclusive",
  "non_exclusive",
  "co_mandate",
  "introducer_only",
] as const;
export const MANDATE_BASIS_LABELS: Record<
  (typeof MANDATE_BASIS_VALUES)[number],
  string
> = {
  exclusive: "Exclusive",
  non_exclusive: "Non-exclusive",
  co_mandate: "Co-mandate",
  introducer_only: "Introducer only",
};

export const TRANSACTION_STRUCTURE_VALUES = [
  "full_sale",
  "majority",
  "minority",
  "asset_sale",
] as const;
export const TRANSACTION_STRUCTURE_LABELS: Record<
  (typeof TRANSACTION_STRUCTURE_VALUES)[number],
  string
> = {
  full_sale: "Full sale",
  majority: "Majority stake",
  minority: "Minority stake",
  asset_sale: "Asset sale",
};

export const MATERIAL_VALUES = ["teaser", "information_memorandum", "financials"] as const;
export const MATERIAL_LABELS: Record<(typeof MATERIAL_VALUES)[number], string> = {
  teaser: "Teaser",
  information_memorandum: "Information memorandum",
  financials: "Financials",
};

export const CURRENCY_VALUES = ["INR", "USD", "EUR", "GBP", "Other"] as const;

const amountSchema = z
  .number()
  .nonnegative("Enter a non-negative amount.")
  .finite("Enter a valid amount.");

const commonMandateMetadataSchema = z.object({
  roleInOpportunity: z.enum(OPPORTUNITY_ROLE_VALUES),
  industry: z.string().min(1, "Enter the primary industry."),
  specialization: z.string().max(160).optional(),
  geography: z.string().min(1, "Enter a geography."),
  mandateBasis: z.enum(MANDATE_BASIS_VALUES),
  mandateStartDate: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a mandate start month."),
  materialsAvailable: z.array(z.enum(MATERIAL_VALUES)).max(MATERIAL_VALUES.length),
  clientAuthorization: z.literal(true, {
    error: "Confirm that you are authorised to share this mandate.",
  }),
  requestedAction: z
    .string()
    .min(1, "Say what you need from the network."),
  currency: z.enum(CURRENCY_VALUES),
  amountMin: amountSchema,
  amountMax: amountSchema,
});

const sellSideOpportunityMetadataSchema = commonMandateMetadataSchema
  .extend({
    mandateType: z.literal("sell_side"),
    transactionStructures: z
      .array(z.enum(TRANSACTION_STRUCTURE_VALUES))
      .min(1, "Choose at least one transaction structure."),
    businessLocation: z.string().min(1, "Enter the business location."),
    stakePercent: z.number().min(0).max(100).finite().optional(),
    revenue: amountSchema.optional(),
    ebitda: amountSchema.optional(),
  })
  .refine((metadata) => metadata.amountMax > metadata.amountMin, {
    message: "Maximum asking range must be greater than the minimum.",
    path: ["amountMax"],
  });

const buySideOpportunityMetadataSchema = commonMandateMetadataSchema
  .extend({
    mandateType: z.literal("buy_side"),
    transactionStructures: z
      .array(z.enum(TRANSACTION_STRUCTURE_VALUES))
      .min(1, "Choose at least one acceptable structure."),
    targetCriteria: z.string().min(1, "Describe the target requirement."),
    distressedAllowed: z.boolean().optional(),
  })
  .refine((metadata) => metadata.amountMax > metadata.amountMin, {
    message: "Maximum budget must be greater than the minimum.",
    path: ["amountMax"],
  });

export const mandateOpportunityMetadataSchema = z.discriminatedUnion(
  "mandateType",
  [sellSideOpportunityMetadataSchema, buySideOpportunityMetadataSchema],
);

// Posts created before the Friday mandate form stay readable and editable,
// including any metadata fields from earlier portal drafts. New opportunities
// cannot use this branch because createPostInputSchema explicitly requires the
// mandate schema for every new opportunity.
export const legacyOpportunityMetadataSchema = z
  .object({
    industry: z.string().min(1),
    requestedAction: z.string().min(1),
  })
  .passthrough();

export const opportunityMetadataSchema = z.union([
  mandateOpportunityMetadataSchema,
  legacyOpportunityMetadataSchema,
]);

export function isMandateOpportunityMetadata(
  metadata: Record<string, unknown>,
): boolean {
  return mandateOpportunityMetadataSchema.safeParse(metadata).success;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(formData: FormData, name: string): number | undefined {
  const value = text(formData, name);
  if (!value) return undefined;
  return Number(value);
}

function requiredNumber(formData: FormData, name: string): number {
  const value = text(formData, name);
  return value ? Number(value) : Number.NaN;
}

export function mandateOpportunityMetadataFromForm(
  formData: FormData,
): Record<string, unknown> {
  const shared = {
    mandateType: text(formData, "mandateType"),
    roleInOpportunity: text(formData, "roleInOpportunity"),
    industry: text(formData, "industry"),
    specialization: text(formData, "specialization") || undefined,
    geography: text(formData, "geography"),
    mandateBasis: text(formData, "mandateBasis"),
    mandateStartDate: text(formData, "mandateStartDate"),
    materialsAvailable: formData
      .getAll("materialsAvailable")
      .filter((value): value is string => typeof value === "string"),
    clientAuthorization: formData.get("clientAuthorization") === "on",
    requestedAction: text(formData, "requestedAction"),
    currency: text(formData, "currency"),
    amountMin: requiredNumber(formData, "amountMin"),
    amountMax: requiredNumber(formData, "amountMax"),
    transactionStructures: formData
      .getAll("transactionStructures")
      .filter((value): value is string => typeof value === "string"),
  };

  if (shared.mandateType === "sell_side") {
    return {
      ...shared,
      businessLocation: text(formData, "businessLocation"),
      stakePercent: optionalNumber(formData, "stakePercent"),
      revenue: optionalNumber(formData, "revenue"),
      ebitda: optionalNumber(formData, "ebitda"),
    };
  }

  return {
    ...shared,
    targetCriteria: text(formData, "targetCriteria"),
    distressedAllowed: formData.get("distressedAllowed") === "on" || undefined,
  };
}

export function legacyOpportunityMetadataFromForm(
  formData: FormData,
  previousMetadata: Record<string, unknown> = {},
): Record<string, unknown> {
  const roleInOpportunity = text(formData, "roleInOpportunity");
  return {
    ...previousMetadata,
    industry: text(formData, "industry"),
    requestedAction: text(formData, "requestedAction"),
    ...(roleInOpportunity ? { roleInOpportunity } : {}),
  };
}
