interface LoadingSkeletonProps {
  label?: string;
  rows?: number;
}

export function LoadingSkeleton({ label = 'Loading content', rows = 3 }: LoadingSkeletonProps) {
  return (
    <div className="loading-skeleton" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => <span className="skeleton-line" key={index} />)}
    </div>
  );
}
