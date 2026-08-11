import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** HOME-04 loading state: identity card, link rows, and contact skeletons. */
export default function MeLoading() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4" aria-busy="true">
      <div>
        <ScreenId id="HOME-04" className="mb-2" />
        <PageHeader title="Me" description="Loading your profile." />
      </div>
      <Skeleton className="h-[128px] w-full rounded-container" />
      <Skeleton className="h-[64px] w-full rounded-container" />
      <div className="grid gap-3 rounded-container border border-border bg-surface p-4">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="w-full" />
        <Skeleton className="w-3/5" />
      </div>
    </div>
  );
}
