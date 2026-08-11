import { PageHeader, ScreenId, Skeleton } from "@/components/ui";

/** PEOPLE-01 loading state: toolbar + row skeletons while the list loads. */
export default function PeopleLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl" aria-busy="true">
      <ScreenId id="PEOPLE-01" className="mb-2" />
      <PageHeader title="People" description="Loading the approved member directory." />
      <Skeleton className="mb-3 h-11 w-full rounded-control" />
      <Skeleton className="mb-4 h-11 w-3/5 rounded-full" />
      <div className="grid gap-px overflow-hidden rounded-container border border-border bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3.5 py-3">
            <Skeleton className="size-[38px] flex-none rounded-avatar" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
