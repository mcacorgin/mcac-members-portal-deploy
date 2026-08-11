"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  Checkbox,
  FieldError,
  FormField,
  Input,
  Label,
  Select,
} from "@/components/ui";
import type { ConfigKey, ConfigValue } from "@/lib/config";
import { saveConfigAction } from "./actions";

// Each control saves independently and reports its own pending/success/error
// state, so a failing key never blocks the rest of the policy screen.

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

function useConfigSave() {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  function save<K extends ConfigKey>(
    key: K,
    value: ConfigValue<K>,
    onError?: () => void,
  ) {
    setState({ kind: "saving" });
    startTransition(async () => {
      const result = await saveConfigAction(key, value);
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        onError?.();
        return;
      }
      setState({ kind: "saved" });
    });
  }

  return { save, state, pending };
}

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span aria-live="polite" className="text-xs">
      {state.kind === "saving" ? (
        <span className="text-ink-muted">Saving...</span>
      ) : state.kind === "saved" ? (
        <span className="font-medium text-success">Saved</span>
      ) : state.kind === "error" ? (
        <FieldError>{state.message}</FieldError>
      ) : null}
    </span>
  );
}

// --- Brand ------------------------------------------------------------------

export function BrandControl({
  initial,
}: {
  initial: "restrained" | "stronger";
}) {
  const { save, state, pending } = useConfigSave();
  const [value, setValue] = useState(initial);

  function choose(next: "restrained" | "stronger") {
    const previous = value;
    setValue(next);
    save("brand.goldPresence", next, () => setValue(previous));
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">Brand</h3>
        <SaveIndicator state={state} />
      </div>
      <p className="mb-2 text-sm text-ink-secondary">
        Choose how prominently MCAC gold appears across the portal.
      </p>
      <div role="radiogroup" aria-label="Gold presence">
        {(
          [
            {
              value: "restrained",
              label: "Restrained",
              description: "Gold appears only in the brand mark.",
            },
            {
              value: "stronger",
              label: "Stronger",
              description: "Gold may appear in selected accents as well.",
            },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            className="grid min-h-tap cursor-pointer grid-cols-[22px_1fr] items-start gap-x-2.5 py-2.5"
          >
            <input
              type="radio"
              name="goldPresence"
              value={option.value}
              checked={value === option.value}
              disabled={pending}
              onChange={() => choose(option.value)}
              className="mt-0.5 size-5 accent-navy"
            />
            <span className="font-medium text-ink">
              {option.label}
              <small className="mt-0.5 block text-sm font-normal text-ink-secondary">
                {option.description}
              </small>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

// --- Sign-in ------------------------------------------------------------------

export function SignInControl({ initial }: { initial: boolean }) {
  const { save, state, pending } = useConfigSave();
  const [value, setValue] = useState(initial);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-ink">Sign-in</h3>
        <SaveIndicator state={state} />
      </div>
      <Checkbox
        label="Email and password sign-in enabled"
        description="Warning: disabling this hides email sign-in for everyone. Members without a linked LinkedIn account cannot sign in until it is re-enabled."
        checked={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.checked;
          const previous = value;
          setValue(next);
          save("auth.emailFallbackEnabled", next, () => setValue(previous));
        }}
      />
    </Card>
  );
}

// --- Contact defaults ---------------------------------------------------------

const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible to members" },
  { value: "hidden", label: "Hidden from everyone" },
  { value: "admin_only", label: "Administrators only" },
] as const;

type Visibility = (typeof VISIBILITY_OPTIONS)[number]["value"];

function ContactDefaultRow({
  configKey,
  label,
  initial,
}: {
  configKey: Extract<
    ConfigKey,
    "contact.defaults.phone" | "contact.defaults.email" | "contact.defaults.linkedin"
  >;
  label: string;
  initial: Visibility;
}) {
  const { save, state, pending } = useConfigSave();
  const [value, setValue] = useState<Visibility>(initial);
  const id = `contact-default-${configKey.split(".").pop()}`;

  return (
    <div className="grid items-center gap-x-3 gap-y-1 border-b border-border py-2.5 last:border-b-0 sm:grid-cols-[120px_1fr_90px]">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <Select
        id={id}
        value={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value as Visibility;
          const previous = value;
          setValue(next);
          save(configKey, next, () => setValue(previous));
        }}
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      <SaveIndicator state={state} />
    </div>
  );
}

export function ContactDefaultsControl({
  phone,
  email,
  linkedin,
}: {
  phone: Visibility;
  email: Visibility;
  linkedin: Visibility;
}) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-ink">Contact defaults</h3>
      <p className="mb-2 text-sm text-ink-secondary">
        Default visibility for contact fields. Applies to NEW registrations
        only; existing members keep their own choices.
      </p>
      <ContactDefaultRow
        configKey="contact.defaults.phone"
        label="Phone"
        initial={phone}
      />
      <ContactDefaultRow
        configKey="contact.defaults.email"
        label="Email"
        initial={email}
      />
      <ContactDefaultRow
        configKey="contact.defaults.linkedin"
        label="LinkedIn"
        initial={linkedin}
      />
    </Card>
  );
}

// --- Opportunities ------------------------------------------------------------

export function OpportunitiesControl({
  expiryDays,
  adminOverridable,
}: {
  expiryDays: number;
  adminOverridable: boolean;
}) {
  const expirySave = useConfigSave();
  const overrideSave = useConfigSave();
  const [days, setDays] = useState(String(expiryDays));
  const [overridable, setOverridable] = useState(adminOverridable);
  const [localError, setLocalError] = useState<string | null>(null);

  function saveExpiry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(days);
    if (!Number.isInteger(parsed) || parsed < 30 || parsed > 365) {
      setLocalError("Enter a whole number of days between 30 and 365.");
      return;
    }
    setLocalError(null);
    expirySave.save("posts.opportunityExpiryDays", parsed);
  }

  return (
    <Card>
      <h3 className="text-base font-semibold text-ink">Opportunities</h3>
      <p className="mb-3 text-sm text-ink-secondary">
        Opportunity posts move to the Old view after this many days.
      </p>
      <form
        onSubmit={saveExpiry}
        className="flex flex-wrap items-end gap-2"
      >
        <FormField
          label="Expiry (days)"
          htmlFor="expiry-days"
          error={localError}
          className="w-36"
        >
          <Input
            id="expiry-days"
            type="number"
            min={30}
            max={365}
            step={1}
            inputMode="numeric"
            value={days}
            aria-invalid={localError ? "true" : undefined}
            aria-describedby={localError ? "expiry-days-error" : undefined}
            onChange={(event) => setDays(event.target.value)}
          />
        </FormField>
        <Button
          type="submit"
          variant="secondary"
          disabled={expirySave.pending}
          className="mb-6"
        >
          {expirySave.pending ? "Saving..." : "Save"}
        </Button>
        <span className="mb-8">
          <SaveIndicator state={expirySave.state} />
        </span>
      </form>
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-1">
        <Checkbox
          label="Administrators may override expiry per post"
          checked={overridable}
          disabled={overrideSave.pending}
          onChange={(event) => {
            const next = event.target.checked;
            const previous = overridable;
            setOverridable(next);
            overrideSave.save("posts.expiryAdminOverridable", next, () =>
              setOverridable(previous),
            );
          }}
          className="flex-1"
        />
        <SaveIndicator state={overrideSave.state} />
      </div>
    </Card>
  );
}

// --- Sections -------------------------------------------------------------------

function SectionToggleRow({
  configKey,
  label,
  initial,
}: {
  configKey: Extract<
    ConfigKey,
    "sections.opportunity" | "sections.job" | "sections.knowledge" | "sections.event"
  >;
  label: string;
  initial: boolean;
}) {
  const { save, state, pending } = useConfigSave();
  const [value, setValue] = useState(initial);

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border last:border-b-0">
      <Checkbox
        label={label}
        checked={value}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.checked;
          const previous = value;
          setValue(next);
          save(configKey, next, () => setValue(previous));
        }}
        className="flex-1"
      />
      <SaveIndicator state={state} />
    </div>
  );
}

export function SectionsControl({
  opportunity,
  job,
  knowledge,
  event,
}: {
  opportunity: boolean;
  job: boolean;
  knowledge: boolean;
  event: boolean;
}) {
  return (
    <Card>
      <h3 className="text-base font-semibold text-ink">Sections</h3>
      <p className="mb-1 text-sm text-ink-secondary">
        Global section toggles. Turning a section off removes navigation and
        data access for every member; per-member overrides are set on the
        member record.
      </p>
      <SectionToggleRow
        configKey="sections.opportunity"
        label="Opportunities"
        initial={opportunity}
      />
      <SectionToggleRow configKey="sections.job" label="Jobs" initial={job} />
      <SectionToggleRow
        configKey="sections.knowledge"
        label="Knowledge"
        initial={knowledge}
      />
      <SectionToggleRow
        configKey="sections.event"
        label="Events"
        initial={event}
      />
    </Card>
  );
}
