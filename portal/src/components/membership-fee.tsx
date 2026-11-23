import { MEMBERSHIP_FEE_LABEL, PAYMENT_DETAILS } from "@/lib/membership-fee";

const STEPS = [
  "Fill in the application form.",
  "An MCAC admin reviews it and approves it.",
  "You see how to pay in the portal.",
  "You pay. MCAC confirms your payment and admits you as a member.",
];

// Shown before sign-in and on the register page. Nobody pays at registration.
export function FeeSteps() {
  return (
    <section
      data-testid="fee-steps"
      aria-labelledby="fee-steps-heading"
      className="rounded-container border border-border bg-surface-subtle p-4"
    >
      <h2 id="fee-steps-heading" className="text-sm font-semibold text-ink">
        Membership fee: {MEMBERSHIP_FEE_LABEL}
      </h2>
      <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm text-ink-secondary">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-2 text-sm text-ink-secondary">
        You do not pay when you apply.
      </p>
    </section>
  );
}

const BANK_ROWS: [string, keyof typeof PAYMENT_DETAILS][] = [
  ["Account name", "accountName"],
  ["Bank", "bankName"],
  ["Account number", "accountNumber"],
  ["IFSC", "ifsc"],
  ["UPI ID", "upiId"],
];

// Shown on the payment screen to an applicant or member whose fee is due.
export function PaymentDetails() {
  const rows = BANK_ROWS.filter(([, key]) => PAYMENT_DETAILS[key]);
  const hasDetails = rows.length > 0 || PAYMENT_DETAILS.qrImagePath;
  return (
    <section
      data-testid="payment-details"
      aria-labelledby="payment-details-heading"
      className="rounded-container border border-border bg-navy-tint p-4"
    >
      <h2
        id="payment-details-heading"
        className="text-sm font-semibold text-navy-text"
      >
        Pay the membership fee: {MEMBERSHIP_FEE_LABEL}
      </h2>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Use the UPI QR code or a bank transfer. Your membership starts when MCAC
        confirms your payment.
      </p>
      {hasDetails ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
          {PAYMENT_DETAILS.qrImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={PAYMENT_DETAILS.qrImagePath}
              alt="MCAC UPI QR code. Scan it in any UPI app."
              width={160}
              height={160}
              className="rounded-control border border-border bg-white"
            />
          ) : null}
          <dl className="grid gap-1 text-sm">
            {rows.map(([label, key]) => (
              <div key={key} className="flex flex-wrap gap-x-2">
                <dt className="text-ink-muted">{label}</dt>
                <dd className="font-medium text-ink">
                  {PAYMENT_DETAILS[key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-secondary">
          MCAC sends the UPI QR code and bank details on WhatsApp.
        </p>
      )}
    </section>
  );
}
