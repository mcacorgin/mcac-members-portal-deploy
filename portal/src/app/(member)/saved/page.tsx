import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { resolveLandingPath } from "@/lib/account/routing";
import { listSaved } from "@/lib/posts/queries";
import { Button, EmptyState, ErrorState, PageHeader, ScreenId } from "@/components/ui";
import { FeedCard } from "../posts/feed-card";

// HOME-05: everything the viewer has bookmarked, newest first. Its own
// top-level destination (desktop rail, plus the link row near the top of
// /me on mobile) - split out of /me because it was buried at the bottom of
// that page and members could not find it (client feedback).

export const metadata = { title: "Saved · MCAC Members Portal" };

export default async function SavedPage() {
  const viewer = await requireViewer();
  const denied = memberAccessError(viewer);
  if (denied) redirect(await resolveLandingPath(viewer));

  const result = await listSaved(viewer);

  if (!result.ok) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ScreenId id="HOME-05" className="mb-2" />
        <PageHeader title="Saved" />
        <ErrorState
          title="Saved could not load"
          body="Try again in a moment."
          action={
            <Button href="/saved" variant="secondary">
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const items = result.data;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <ScreenId id="HOME-05" className="mb-2" />
      <PageHeader
        title="Saved"
        description="Posts you've bookmarked from Home, in one place."
      />

      {items.length === 0 ? (
        <EmptyState
          glyph="☆"
          title="Nothing saved yet"
          body="Bookmark a post from Home and it appears here."
          action={<Button href="/home">Go to Home</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
