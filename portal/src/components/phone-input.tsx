import { Input, Select } from "@/components/ui";
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from "@/lib/phone";

// Country-code dropdown + national-number input (issue #82). The form
// submits both parts; the server normalizes them to E.164 before storage.
// defaultNational/defaultCountryCode come pre-split from the stored value
// (see splitE164) or from the failed-submit retention values.
export function PhoneInput({
  phoneId = "phone",
  phoneName = "phone",
  countryCodeId = "countryCode",
  countryCodeName = "countryCode",
  defaultNational = "",
  defaultCountryCode = DEFAULT_COUNTRY_CODE,
  required = false,
  autoComplete = "tel",
  phoneInvalid = false,
  phoneDescribedBy,
}: {
  phoneId?: string;
  phoneName?: string;
  countryCodeId?: string;
  countryCodeName?: string;
  defaultNational?: string;
  defaultCountryCode?: string;
  required?: boolean;
  autoComplete?: string;
  phoneInvalid?: boolean;
  phoneDescribedBy?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Fixed-width wrapper: the shared Select hardcodes w-full and cx() is
          a plain join (no tailwind-merge), so w-auto here would lose to it in
          stylesheet order and crush the number input. */}
      <div className="w-40 max-w-full flex-none">
        <Select
          id={countryCodeId}
          name={countryCodeName}
          defaultValue={defaultCountryCode}
          aria-label="Country code"
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <Input
        id={phoneId}
        name={phoneName}
        type="tel"
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultNational}
        aria-invalid={phoneInvalid || undefined}
        aria-describedby={phoneDescribedBy}
        // Readers with a large font setting get a wider dropdown. Below
        // 4.5rem the number drops onto its own line instead of shrinking to
        // a sliver. At the default size the row never gets that narrow.
        className="min-w-[4.5rem] flex-1"
      />
    </div>
  );
}
