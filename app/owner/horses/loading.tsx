function LoadingCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="h-44 rounded-3xl bg-stone-200" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-24 rounded-full bg-stone-200" />
        <div className="h-7 w-2/3 rounded-2xl bg-stone-200" />
        <div className="h-4 w-32 rounded-full bg-stone-200" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="h-4 rounded-full bg-stone-100" />
          <div className="h-4 rounded-full bg-stone-100" />
          <div className="h-4 rounded-full bg-stone-100" />
          <div className="h-4 rounded-full bg-stone-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-28 rounded-2xl bg-stone-200" />
          <div className="h-11 w-28 rounded-2xl bg-stone-200" />
        </div>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200" />
        <div className="h-10 w-56 animate-pulse rounded-3xl bg-stone-200" />
        <div className="h-5 w-full animate-pulse rounded-2xl bg-stone-100" />
      </div>
      <div className="animate-pulse rounded-3xl border border-stone-200 bg-white p-5 shadow-soft sm:p-6">
        <div className="h-7 w-48 rounded-2xl bg-stone-200" />
        <div className="mt-4 space-y-3">
          <div className="h-11 rounded-2xl bg-stone-100" />
          <div className="h-11 rounded-2xl bg-stone-100" />
          <div className="h-11 rounded-2xl bg-stone-100" />
          <div className="h-32 rounded-3xl bg-stone-100" />
        </div>
      </div>
      <LoadingCard />
      <LoadingCard />
    </div>
  );
}