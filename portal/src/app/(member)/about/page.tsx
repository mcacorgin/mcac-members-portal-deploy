import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, PageHeader } from "@/components/ui";

// TODO(client): Sandeep sends the MCAC intro and vision (two paragraphs), the
// charter, and the founders and executive council list as a Word file. Do not
// invent content here. Replace each ComingSoon below when the text arrives.
// The policy PDF lives in public/about/.

export const metadata = { title: "About · MCAC Members Portal" };

function ComingSoon() {
  return (
    <p
      data-testid="content-placeholder"
      className="rounded-control border border-dashed border-border-strong bg-surface-subtle px-3 py-2.5 text-[0.9375rem] text-ink-secondary"
    >
      Content coming soon.
    </p>
  );
}

export default async function AboutPage() {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader title="About MCAC" />
      <Card className="grid gap-2 p-5">
        <h2 className="text-lg font-semibold text-ink">What MCAC is</h2>
        <ComingSoon />
      </Card>
      <Card className="grid gap-2 p-5">
        <h2 className="text-lg font-semibold text-ink">Charter</h2>
        <ComingSoon />
      </Card>
      <Card className="grid gap-2 p-5">
        <h2 className="text-lg font-semibold text-ink">Leadership team</h2>
        <p className="text-sm text-ink-secondary">
          Founders and the executive council.
        </p>
        <ComingSoon />
      </Card>
      <Card className="grid gap-2 p-5">
        <h2 className="text-lg font-semibold text-ink">Membership policy</h2>
        <p className="text-sm text-ink-secondary">
          Member rights, referrals and collaboration, and the rules on
          non-solicitation.
        </p>
        <a
          data-testid="policy-pdf-link"
          href="/about/mcac-membership-policy.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap items-center font-medium text-navy-text underline decoration-navy/30 underline-offset-2"
        >
          Download the membership policy (PDF)
        </a>
      </Card>
    </div>
  );
}
