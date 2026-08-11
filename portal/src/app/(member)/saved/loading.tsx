import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** HOME-05 loading state: feed-card skeletons while Saved loads. */
export default function SavedLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl" aria-busy="true">
      <ScreenId id="HOME-05" className="mb-2" />
      <PageHeader title="Saved" description="Loading your saved posts." />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2.5 rounded-container border border-border bg-surface p-4">
            <Skeleton className="h-28 w-full rounded-control" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="w-full" />
            <Skeleton className="w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
