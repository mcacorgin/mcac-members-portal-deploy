import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** PEOPLE-02 loading state: profile and contact panel skeletons. */
export default function MemberProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl" aria-busy="true">
      <ScreenId id="PEOPLE-02" className="mb-2" />
      <PageHeader
        title="Member profile"
        description="Loading the approved profile and permitted contact fields."
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <div className="grid gap-3 rounded-container border border-border bg-surface p-4">
          <Skeleton className="size-[54px] rounded-avatar" />
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="w-full" />
          <Skeleton className="w-4/5" />
        </div>
        <div className="grid gap-3 rounded-container border border-border bg-surface p-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-11 w-full rounded-control" />
          <Skeleton className="h-11 w-full rounded-control" />
        </div>
      </div>
    </div>
  );
}
