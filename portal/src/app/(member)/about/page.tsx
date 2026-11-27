import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { Card, PageHeader } from "@/components/ui";
import { aboutParagraphs, founders, council, policySections } from "@/lib/about-content";

export const metadata = { title: "About · MCAC Members Portal" };

export default async function AboutPage() {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader title="About" />
      <Card className="grid gap-3 p-5">
        <h2 className="text-lg font-semibold text-ink">About MCAC</h2>
        {aboutParagraphs.map(text => <p key={text}>{text}</p>)}
      </Card>
      <Card className="grid gap-3 p-5">
        <h2 className="text-lg font-semibold text-ink">Leadership Team</h2>
        <h3 className="font-semibold">Founders</h3>
        <ul>{founders.map(name => <li key={name}>{name}</li>)}</ul>
        <h3 className="font-semibold">Executive Council Members</h3>
        <ul>{council.map(name => <li key={name}>{name}</li>)}</ul>
      </Card>
      <Card className="grid gap-3 p-5">
        <h2 className="text-lg font-semibold text-ink">MCAC Membership Guidelines</h2>
        {policySections.map(section => <div className="grid gap-3" key={section.title}>
          <h3 className="font-semibold">{section.title}</h3>
          {section.groups.map((group, i) => <div className="grid gap-3" key={i}>
            {group.title && <h4 className="font-semibold">{group.title}</h4>}
            {group.clauses.map(clause => <p key={clause}>{clause}</p>)}
          </div>)}
        </div>)}
      </Card>
    </div>
  );
}
