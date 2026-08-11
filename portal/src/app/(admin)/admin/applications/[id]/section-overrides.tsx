"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, FieldError, Label, Select } from "@/components/ui";
import type { Section } from "@/lib/authz";
import { setSectionOverrideAction } from "./actions";

const SECTIONS: { section: Section; label: string }[] = [
  { section: "opportunity", label: "Opportunities" },
  { section: "job", label: "Jobs" },
  { section: "knowledge", label: "Knowledge" },
  { section: "event", label: "Events" },
];

type OverrideValue = "inherit" | "enabled" | "disabled";

function toValue(enabled: boolean | null | undefined): OverrideValue {
  if (enabled === true) return "enabled";
  if (enabled === false) return "disabled";
  return "inherit";
}

function OverrideRow({
  userId,
  section,
  label,
  initial,
  globalEnabled,
}: {
  userId: string;
  section: Section;
  label: string;
  initial: OverrideValue;
  globalEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState<OverrideValue>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleChange(next: OverrideValue) {
    const previous = value;
    setValue(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setSectionOverrideAction(
        userId,
        section,
        next === "inherit" ? null : next === "enabled",
      );
      if (!result.ok) {
        setValue(previous);
        setError(result.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const id = `override-${section}`;
  const effective =
    globalEnabled && (value === "inherit" || value === "enabled");

  return (
    <div className="grid min-h-tap grid-cols-1 items-center gap-x-3 gap-y-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[1fr_220px_110px]">
      <Label htmlFor={id} className="text-sm">
        {label}
        <span className="mt-0.5 block text-xs font-normal text-ink-muted">
          Global setting: {globalEnabled ? "enabled" : "disabled"}
        </span>
      </Label>
      <Select
        id={id}
        value={value}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value as OverrideValue)}
      >
        <option value="inherit">Inherit global</option>
        <option value="enabled">Enabled</option>
        <option value="disabled">Disabled</option>
      </Select>
      <span aria-live="polite" className="text-xs">
        {pending ? (
          <span className="text-ink-muted">Saving...</span>
        ) : error ? (
          <FieldError>{error}</FieldError>
        ) : saved ? (
          <span className="font-medium text-success">Saved</span>
        ) : (
          <span className="text-ink-muted">
            Effective: {effective ? "on" : "off"}
          </span>
        )}
      </span>
    </div>
  );
}

export function SectionOverrides({
  userId,
  overrides,
  globals,
}: {
  userId: string;
  overrides: Partial<Record<Section, boolean>>;
  globals: Record<Section, boolean>;
}) {
  return (
    <Card>
      <h3 className="mb-1 text-base font-semibold text-ink">
        Section access for this member
      </h3>
      <p className="mb-2 text-sm text-ink-secondary">
        Overrides apply within globally enabled sections. Disabling a section
        removes both navigation and data access for this member.
      </p>
      <div>
        {SECTIONS.map(({ section, label }) => (
          <OverrideRow
            key={section}
            userId={userId}
            section={section}
            label={label}
            initial={toValue(overrides[section])}
            globalEnabled={globals[section]}
          />
        ))}
      </div>
    </Card>
  );
}
