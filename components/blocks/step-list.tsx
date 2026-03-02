import { Card } from "@/components/ui/card";

export type StepItem = {
  number: string;
  title: string;
  description: string;
};

type StepListProps = {
  items: readonly StepItem[];
};

export function StepList({ items }: StepListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card className="p-5 sm:p-6" key={item.number}>
          <div className="space-y-3">
            <span className="inline-flex min-h-[28px] items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-stone-600">
              {item.number}
            </span>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-stone-900">{item.title}</h3>
              <p className="text-sm leading-6 text-stone-600">{item.description}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
