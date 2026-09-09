export function TransactionsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-[14px] bg-[var(--card-border)]/60" />
        ))}
      </div>
      <div className="h-40 rounded-[14px] bg-[var(--card-border)]/60" />
      <div className="grid gap-5 lg:grid-cols-[58fr_42fr]">
        <div className="h-[420px] rounded-[14px] bg-[var(--card-border)]/60" />
        <div className="hidden h-[420px] rounded-[14px] bg-[var(--card-border)]/60 lg:block" />
      </div>
    </div>
  );
}
