export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-28 animate-pulse rounded-full bg-stone-200" />
        <div className="h-10 w-56 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-5 w-full animate-pulse rounded-xl bg-stone-100" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="h-7 w-48 rounded-xl bg-stone-200" />
          <div className="mt-5 space-y-3">
            <div className="h-11 rounded-xl bg-stone-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-11 rounded-xl bg-stone-100" />
              <div className="h-11 rounded-xl bg-stone-100" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-11 rounded-xl bg-stone-100" />
              <div className="h-11 rounded-xl bg-stone-100" />
            </div>
            <div className="h-32 rounded-xl bg-stone-100" />
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="h-6 w-40 rounded-xl bg-stone-200" />
          <div className="mt-4 h-4 rounded-full bg-stone-100" />
          <div className="mt-2 h-4 rounded-full bg-stone-100" />
          <div className="mt-5 h-11 rounded-xl bg-stone-100" />
        </div>
      </div>
    </div>
  );
}