import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { PageHeader } from "@/components/ui";

// TODO(client): replace the placeholder below with the client's help text.
// Do not invent content here. Files for this page go in public/help/.

export const metadata = { title: "Help · MCAC Members Portal" };

export default async function HelpPage() {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Help" />
      <div
        data-testid="content-placeholder"
        className="rounded-container border border-dashed border-border-strong bg-surface-subtle p-6 text-ink-secondary"
      >
        <strong className="block font-semibold text-ink">Content coming</strong>
        <p className="mt-1 text-[0.9375rem]">
          This page will be filled in soon.
        </p>
      </div>
    </div>
  );
}
