import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** HOME-06 loading state: form skeletons while the profile loads. */
export default function MeEditLoading() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-24 rounded-control" />
        <ScreenId id="HOME-06" />
      </div>
      <PageHeader title="Edit profile" description="Loading your profile." />
      <div className="grid gap-3 rounded-container border border-border bg-surface p-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full rounded-control" />
        <Skeleton className="h-11 w-full rounded-control" />
      </div>
      <div className="grid gap-3 rounded-container border border-border bg-surface p-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-11 w-full rounded-control" />
      </div>
    </div>
  );
}
