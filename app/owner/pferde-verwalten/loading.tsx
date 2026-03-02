export default function OwnerManageHorsesLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-4 w-28 rounded-full bg-stone-200" />
        <div className="h-10 w-64 rounded-xl bg-stone-200" />
        <div className="h-4 w-full rounded-full bg-stone-200" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-4 w-40 rounded-full bg-stone-200" />
        <div className="h-11 w-full rounded-xl bg-stone-200 sm:w-48" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((item) => (
          <div className="rounded-2xl border border-stone-200 bg-white p-5" key={item}>
            <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
              <div className="h-32 rounded-xl bg-stone-200" />
              <div className="space-y-3">
                <div className="h-6 w-48 rounded-full bg-stone-200" />
                <div className="h-4 w-28 rounded-full bg-stone-200" />
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[0, 1, 2, 3, 4, 5].map((detail) => (
                    <div className="h-4 rounded-full bg-stone-200" key={detail} />
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {[0, 1, 2, 3].map((action) => (
                    <div className="h-11 rounded-xl bg-stone-200" key={action} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}