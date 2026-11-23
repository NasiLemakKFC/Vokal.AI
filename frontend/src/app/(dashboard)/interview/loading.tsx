export default function InterviewLoading() {
  return (
    <div
      className="max-w-[1200px] mx-auto pb-10"
      aria-busy="true"
      aria-label="Loading Practice Studio"
    >
      {/* Collapsible Setup Card Header Skeleton */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-4 w-48 rounded-[4px] bg-[var(--active)]" />
          <div className="hidden sm:block h-4 w-32 rounded-[4px] bg-[var(--active)]" />
        </div>
        <div className="h-8 w-24 rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)]" />
      </div>

      {/* Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-8 w-12 rounded-[var(--radius-control)] bg-[var(--accent-soft)] border border-[var(--border-accent)]" />
          <div className="h-8 w-12 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)]" />
          <div className="h-8 w-12 rounded-[var(--radius-control)] bg-[var(--surface)] border border-[var(--border)]" />
          <div className="h-4 w-32 rounded-[4px] bg-[var(--active)] ml-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]" />
          <div className="h-8 w-36 rounded-[var(--radius-control)] bg-[var(--active)]" />
        </div>
      </div>

      {/* Main 12-Col Practice Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-[4px] bg-[var(--active)]" />
              <div className="h-5 w-16 rounded-[var(--radius-pill)] bg-[var(--active)]" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-full rounded-[4px] bg-[var(--active)]" />
              <div className="h-5 w-4/5 rounded-[4px] bg-[var(--active)]" />
            </div>
            <div className="h-3.5 w-3/4 rounded-[4px] bg-[var(--raised)]" />
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded-[4px] bg-[var(--active)]" />
              <div className="h-3.5 w-24 rounded-[4px] bg-[var(--raised)]" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)]"
                />
              ))}
            </div>
          </div>

          <div className="h-12 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 flex items-center justify-between">
            <div className="h-4 w-28 rounded-[4px] bg-[var(--active)]" />
            <div className="h-4 w-4 rounded-[4px] bg-[var(--active)]" />
          </div>
        </section>

        {/* Right Column */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full aspect-video rounded-[var(--radius-card)] overflow-hidden bg-zinc-950 border border-[var(--border)] flex flex-col items-center justify-center gap-2">
            <p className="text-[13px] font-medium text-white/80">
              Preparing Practice Studio…
            </p>
          </div>

          <div className="h-9 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]" />
        </section>
      </div>

      {/* Bottom Control Dock Skeleton */}
      <div className="mt-5 control-dock px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]" />
          <div className="w-10 h-10 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]" />
          <div className="w-10 h-10 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]" />
        </div>
        <div className="h-10 w-40 rounded-[var(--radius-control)] bg-[var(--accent)]/60" />
        <div className="h-10 w-24 rounded-[var(--radius-control)] bg-[var(--raised)] border border-[var(--border)]" />
      </div>
    </div>
  );
}
