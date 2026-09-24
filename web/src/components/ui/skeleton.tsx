export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-panel-2 ${className}`} aria-hidden="true" />;
}

export function CalendarSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="A carregar">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
