import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-stone-50/80">
      <div className="space-y-3 p-5 text-center sm:p-6">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-sm font-semibold text-stone-600">RB</div>
        <div className="space-y-1">
          <p className="font-semibold text-stone-900">{title}</p>
          <p className="text-sm text-stone-600">{description}</p>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </Card>
  );
}
