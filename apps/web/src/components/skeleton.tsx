type SkeletonProps = { className?: string };

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-xl bg-slate-200/70 motion-reduce:animate-none ${className}`}
    />
  );
}

export function SkeletonText({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="panel" aria-hidden="true">
      <SkeletonText className="w-2/3" />
      <Skeleton className="mt-3 h-10 w-1/3" />
    </div>
  );
}

export function SkeletonTable({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <div className="panel mt-6 overflow-x-auto" aria-hidden="true">
      <div className="min-w-[42rem]">
        <div
          className="grid gap-5 border-b border-slate-200/70 p-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <SkeletonText
              key={index}
              className={index === 0 ? "w-3/4" : "w-1/2"}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="grid gap-5 border-b border-slate-200/70 p-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <SkeletonText
                key={column}
                className={column === 0 ? "w-full" : "w-2/3"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonActivityCard() {
  return (
    <div className="soft-card min-h-48" aria-hidden="true">
      <SkeletonText className="w-2/3" />
      <SkeletonText className="mt-3 w-1/3" />
      <div className="mt-12 flex gap-2">
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonResults() {
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>
      <div className="panel mt-7">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    </div>
  );
}
