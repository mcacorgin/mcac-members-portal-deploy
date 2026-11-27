import Link from "next/link";
import { Card } from "@/components/ui";

export function NewMembers({ members }: { members: { id: string; name: string }[] }) {
  if (!members.length) return null;
  return <Card className="mb-4 grid gap-2 p-4">
    <h2 className="font-semibold text-ink">New Members</h2>
    <ul className="grid gap-1">
      {members.map(member => <li key={member.id}>
        <Link className="inline-flex min-h-tap items-center text-navy-text underline" href={`/people/${member.id}`}>{member.name}</Link>
      </li>)}
    </ul>
  </Card>;
}
