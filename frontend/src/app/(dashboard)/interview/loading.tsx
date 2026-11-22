export default function InterviewLoading() {
  return (
    <div
      className="max-w-[1180px] mx-auto pb-10 animate-pulse"
      aria-busy="true"
      aria-label="Loading Practice Room"
    >
      {/* Collapsible Setup Card Header Skeleton */}
      <div className="rounded-[8px] border border-[#e8eaec] bg-[#f9fbfc] px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-[6px] bg-[#eef4f6] border border-[#b8d4dc]" />
          <div className="h-4 w-48 rounded-[4px] bg-[#ebedee]" />
          <div className="hidden sm:block h-5 w-28 rounded-[4px] bg-[#ebedee]" />
          <div className="hidden md:block h-5 w-24 rounded-[4px] bg-[#ebedee]" />
        </div>
        <div className="h-[28px] w-24 rounded-[6px] border border-[#cdced1] bg-white" />
      </div>

      {/* Toolbar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-[28px] w-11 rounded-[6px] bg-[#eef4f6] border border-[#b8d4dc]" />
          <div className="h-[28px] w-11 rounded-[6px] bg-white border border-[#e8eaec]" />
          <div className="h-[28px] w-11 rounded-[6px] bg-white border border-[#e8eaec]" />
          <div className="h-4 w-32 rounded-[4px] bg-[#ebedee] ml-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-[30px] w-16 rounded-[6px] border border-[#e8eaec] bg-white" />
          <div className="h-[30px] w-36 rounded-[6px] bg-[#ebedee]" />
        </div>
      </div>

      {/* Main 12-Col Practice Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Question, STAR Checklist, Coaching Tip */}
        <section className="lg:col-span-5 flex flex-col gap-3">
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-[4px] bg-[#ebedee]" />
              <div className="h-5 w-16 rounded-[4px] bg-[#ebedee]" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-full rounded-[4px] bg-[#ebedee]" />
              <div className="h-5 w-4/5 rounded-[4px] bg-[#ebedee]" />
            </div>
            <div className="h-3.5 w-3/4 rounded-[4px] bg-[#f0f1f2]" />
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 rounded-[4px] bg-[#ebedee]" />
              <div className="h-3.5 w-32 rounded-[4px] bg-[#f0f1f2]" />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[52px] rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc]"
                />
              ))}
            </div>
          </div>

          <div className="h-[40px] rounded-[8px] border border-[#e8eaec] bg-white px-4 flex items-center justify-between">
            <div className="h-4 w-28 rounded-[4px] bg-[#ebedee]" />
            <div className="h-4 w-4 rounded-[4px] bg-[#ebedee]" />
          </div>
        </section>

        {/* Right Column: 16:9 Studio Video Feed + Telemetry Chips */}
        <section className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full aspect-video rounded-[8px] overflow-hidden bg-[#0f1419] border border-[#e8eaec] flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/15 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3]" />
            </div>
            <p className="text-[12.5px] font-medium text-white/80">
              Preparing Practice Room…
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[26px] w-20 rounded-[4px] bg-[#ebedee]"
              />
            ))}
          </div>
        </section>
      </div>

      {/* Bottom Control Dock Skeleton */}
      <div className="mt-5 rounded-[8px] border border-[#e8eaec] bg-white px-3 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-[36px] h-[36px] rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec]" />
          <div className="w-[36px] h-[36px] rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec]" />
          <div className="w-[36px] h-[36px] rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec]" />
        </div>
        <div className="h-[36px] w-36 rounded-[6px] bg-[#1b6c80]/70" />
        <div className="h-[36px] w-20 rounded-[6px] bg-[#f4f6f8] border border-[#e8eaec]" />
      </div>
    </div>
  );
}
