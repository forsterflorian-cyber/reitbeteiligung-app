import type { Route } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RoleCardProps = {
  title: string;
  points: readonly string[];
  href: Route;
  ctaLabel: string;
};

export function RoleCard({ ctaLabel, href, points, title }: RoleCardProps) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-stone-900">{title}</h3>
        </div>
        <ul className="space-y-3 text-sm leading-6 text-stone-600">
          {points.map((point) => (
            <li className="flex gap-3" key={point}>
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-clay" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <Link className={buttonVariants("ghost", "justify-start px-0 py-0 text-forest hover:bg-transparent hover:text-clay")} href={href}>
          {ctaLabel}
        </Link>
      </div>
    </Card>
  );
}
