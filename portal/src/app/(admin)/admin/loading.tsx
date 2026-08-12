import { Card, Skeleton } from "@/components/ui";

export default function AdminLoading() {
  return (
    <div aria-label="Loading administration" role="status">
      <Skeleton className="mb-2 h-7 w-40" />
      <Skeleton className="mb-6 h-4 w-full max-w-md" />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="grid gap-2">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-4 w-24" />
          </Card>
        ))}
      </div>
      <div className="grid gap-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="grid gap-3">
            <div className="flex justify-between gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-11 w-full rounded-control" />
          </Card>
        ))}
      </div>
    </div>
  );
}
