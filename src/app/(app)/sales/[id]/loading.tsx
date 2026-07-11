import { Skeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="rounded-card border border-line bg-surface p-6">
        <div className="mb-6 flex justify-between border-b border-line pb-6">
          <Skeleton className="h-16 w-48" />
          <Skeleton className="h-16 w-32" />
        </div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    </div>
  );
}
