"use client";

import { useState } from "react";
import {
  CURRENCY_VALUES,
  MANDATE_BASIS_LABELS,
  MANDATE_BASIS_VALUES,
  MANDATE_TYPE_LABELS,
  OPPORTUNITY_MANDATE_TYPES,
  MATERIAL_LABELS,
  MATERIAL_VALUES,
  TRANSACTION_STRUCTURE_LABELS,
  TRANSACTION_STRUCTURE_VALUES,
  type OpportunityMandateType,
} from "@/lib/posts/opportunity";
import {
  Checkbox,
  FieldError,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";

type OpportunityFieldsProps = {
  disabled: boolean;
  fieldErrors: Record<string, string[]>;
  metadata?: Record<string, unknown>;
  prefix: string;
};

function str(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function number(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function values(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function OpportunityFields({
  disabled,
  fieldErrors,
  metadata = {},
  prefix,
}: OpportunityFieldsProps) {
  const initialType = OPPORTUNITY_MANDATE_TYPES.includes(
    metadata.mandateType as OpportunityMandateType,
  )
    ? (metadata.mandateType as OpportunityMandateType)
    : "";
  const [mandateType, setMandateType] = useState<OpportunityMandateType | "">(
    initialType,
  );
  const errFor = (key: string) => fieldErrors[`metadata.${key}`]?.[0];
  const selectedMaterials = new Set(values(metadata, "materialsAvailable"));
  const selectedStructures = new Set(values(metadata, "transactionStructures"));

  return (
    <>
      <FormField
        label="Opportunity type (required)"
        htmlFor={`${prefix}-mandate-type`}
        error={errFor("mandateType")}
      >
        <Select
          id={`${prefix}-mandate-type`}
          name="mandateType"
          value={mandateType}
          disabled={disabled}
          onChange={(event) =>
            setMandateType(event.target.value as OpportunityMandateType | "")
          }
          aria-invalid={errFor("mandateType") ? "true" : undefined}
        >
          <option value="">Choose a mandate type</option>
          {OPPORTUNITY_MANDATE_TYPES.map((type) => (
            <option key={type} value={type}>
              {MANDATE_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </FormField>

      {mandateType ? (
        <>
          <FormField
            label="Primary industry (required)"
            htmlFor={`${prefix}-industry`}
            hint="Use the clearest industry for members to match against."
            error={errFor("industry")}
          >
            <Input
              id={`${prefix}-industry`}
              name="industry"
              defaultValue={str(metadata, "industry")}
              disabled={disabled}
              aria-invalid={errFor("industry") ? "true" : undefined}
            />
          </FormField>

          <FormField
            label="Specialisation (optional)"
            htmlFor={`${prefix}-specialization`}
            error={errFor("specialization")}
          >
            <Input
              id={`${prefix}-specialization`}
              name="specialization"
              maxLength={160}
              defaultValue={str(metadata, "specialization")}
              disabled={disabled}
              aria-invalid={errFor("specialization") ? "true" : undefined}
            />
          </FormField>

          <FormField
            label={mandateType === "sell_side" ? "Business geography (required)" : "Target geography (required)"}
            htmlFor={`${prefix}-geography`}
            error={errFor("geography")}
          >
            <Input
              id={`${prefix}-geography`}
              name="geography"
              defaultValue={str(metadata, "geography")}
              disabled={disabled}
              aria-invalid={errFor("geography") ? "true" : undefined}
            />
          </FormField>

          <FormField
            label="Mandate basis (required)"
            htmlFor={`${prefix}-mandate-basis`}
            error={errFor("mandateBasis")}
          >
            <Select
              id={`${prefix}-mandate-basis`}
              name="mandateBasis"
              defaultValue={str(metadata, "mandateBasis")}
              disabled={disabled}
              aria-invalid={errFor("mandateBasis") ? "true" : undefined}
            >
              <option value="">Choose mandate basis</option>
              {MANDATE_BASIS_VALUES.map((basis) => (
                <option key={basis} value={basis}>
                  {MANDATE_BASIS_LABELS[basis]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Mandate start month (required)"
            htmlFor={`${prefix}-mandate-start-date`}
            error={errFor("mandateStartDate")}
          >
            <Input
              id={`${prefix}-mandate-start-date`}
              name="mandateStartDate"
              type="month"
              defaultValue={str(metadata, "mandateStartDate")}
              disabled={disabled}
              aria-invalid={errFor("mandateStartDate") ? "true" : undefined}
            />
          </FormField>

          <fieldset className="grid gap-1.5">
            <legend className="text-[13px] font-medium text-ink">
              Materials available (optional)
            </legend>
            <div className="divide-y divide-border rounded-container border border-border px-3">
              {MATERIAL_VALUES.map((material) => (
                <Checkbox
                  key={material}
                  name="materialsAvailable"
                  value={material}
                  defaultChecked={selectedMaterials.has(material)}
                  disabled={disabled}
                  label={MATERIAL_LABELS[material]}
                />
              ))}
            </div>
            <FieldError>{errFor("materialsAvailable")}</FieldError>
          </fieldset>

          <fieldset className="grid gap-1.5">
            <legend className="text-[13px] font-medium text-ink">
              {mandateType === "sell_side"
                ? "Transaction structure (required)"
                : "Acceptable structures (required)"}
            </legend>
            <div className="divide-y divide-border rounded-container border border-border px-3">
              {TRANSACTION_STRUCTURE_VALUES.map((structure) => (
                <Checkbox
                  key={structure}
                  name="transactionStructures"
                  value={structure}
                  defaultChecked={selectedStructures.has(structure)}
                  disabled={disabled}
                  label={TRANSACTION_STRUCTURE_LABELS[structure]}
                />
              ))}
            </div>
            <FieldError>{errFor("transactionStructures")}</FieldError>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label={mandateType === "sell_side" ? "Asking range from (required)" : "Budget from (required)"}
              htmlFor={`${prefix}-amount-min`}
              error={errFor("amountMin")}
            >
              <Input
                id={`${prefix}-amount-min`}
                name="amountMin"
                type="number"
                min="0"
                step="0.01"
                defaultValue={number(metadata, "amountMin")}
                disabled={disabled}
                aria-invalid={errFor("amountMin") ? "true" : undefined}
              />
            </FormField>
            <FormField
              label={mandateType === "sell_side" ? "Asking range to (required)" : "Budget to (required)"}
              htmlFor={`${prefix}-amount-max`}
              error={errFor("amountMax")}
            >
              <Input
                id={`${prefix}-amount-max`}
                name="amountMax"
                type="number"
                min="0"
                step="0.01"
                defaultValue={number(metadata, "amountMax")}
                disabled={disabled}
                aria-invalid={errFor("amountMax") ? "true" : undefined}
              />
            </FormField>
            <FormField
              label="Currency (required)"
              htmlFor={`${prefix}-currency`}
              error={errFor("currency")}
            >
              <Select
                id={`${prefix}-currency`}
                name="currency"
                defaultValue={str(metadata, "currency") || "INR"}
                disabled={disabled}
                aria-invalid={errFor("currency") ? "true" : undefined}
              >
                {CURRENCY_VALUES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {mandateType === "sell_side" ? (
            <>
              <FormField
                label="Business location (required)"
                htmlFor={`${prefix}-business-location`}
                error={errFor("businessLocation")}
              >
                <Input
                  id={`${prefix}-business-location`}
                  name="businessLocation"
                  defaultValue={str(metadata, "businessLocation")}
                  disabled={disabled}
                  aria-invalid={errFor("businessLocation") ? "true" : undefined}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Stake available % (optional)" htmlFor={`${prefix}-stake-percent`} error={errFor("stakePercent")}>
                  <Input id={`${prefix}-stake-percent`} name="stakePercent" type="number" min="0" max="100" step="0.01" defaultValue={number(metadata, "stakePercent")} disabled={disabled} />
                </FormField>
                <FormField label="Revenue (optional)" htmlFor={`${prefix}-revenue`} error={errFor("revenue")}>
                  <Input id={`${prefix}-revenue`} name="revenue" type="number" min="0" step="0.01" defaultValue={number(metadata, "revenue")} disabled={disabled} />
                </FormField>
                <FormField label="EBITDA (optional)" htmlFor={`${prefix}-ebitda`} error={errFor("ebitda")}>
                  <Input id={`${prefix}-ebitda`} name="ebitda" type="number" min="0" step="0.01" defaultValue={number(metadata, "ebitda")} disabled={disabled} />
                </FormField>
              </div>
            </>
          ) : (
            <>
              <FormField
                label="Target requirement (required)"
                htmlFor={`${prefix}-target-criteria`}
                hint="Describe the business, capability, or profile you want to acquire."
                error={errFor("targetCriteria")}
              >
                <Textarea
                  id={`${prefix}-target-criteria`}
                  name="targetCriteria"
                  rows={3}
                  defaultValue={str(metadata, "targetCriteria")}
                  disabled={disabled}
                  aria-invalid={errFor("targetCriteria") ? "true" : undefined}
                />
              </FormField>
              <Checkbox
                name="distressedAllowed"
                defaultChecked={metadata.distressedAllowed === true}
                disabled={disabled}
                label="Open to distressed opportunities"
              />
            </>
          )}

          <FormField
            label="What do you need from members? (required)"
            htmlFor={`${prefix}-requested-action`}
            error={errFor("requestedAction")}
          >
            <Textarea
              id={`${prefix}-requested-action`}
              name="requestedAction"
              rows={3}
              defaultValue={str(metadata, "requestedAction")}
              disabled={disabled}
              aria-invalid={errFor("requestedAction") ? "true" : undefined}
            />
          </FormField>

          <div>
            <Checkbox
              id={`${prefix}-client-authorization`}
              name="clientAuthorization"
              defaultChecked={metadata.clientAuthorization === true}
              disabled={disabled}
              label="I confirm I am authorised to share this mandate with MCAC members and have excluded confidential client information."
            />
            <FieldError>{errFor("clientAuthorization")}</FieldError>
          </div>
        </>
      ) : null}
    </>
  );
}
