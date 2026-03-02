import type { ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Backdrop, type BackdropVariant } from "@/components/ui/backdrop";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
  surface?: boolean;
  backdropVariant?: Exclude<BackdropVariant, "pattern">;
  contentClassName?: string;
};

export function PageHeader({
  actions,
  backdropVariant,
  className,
  contentClassName,
  eyebrow,
  subtitle,
  surface,
  title
}: PageHeaderProps) {
  const content = (
    <>
      <div className="space-y-2">
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
        {subtitle ? <p className="max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div> : null}
    </>
  );

  if (surface) {
    return (
      <div className={cx("relative overflow-hidden rounded-2xl surface-panel", className)}>
        {backdropVariant ? <Backdrop variant={backdropVariant} /> : null}
        <div className={cx("relative z-10 space-y-4 px-5 py-6 sm:px-6", contentClassName)}>{content}</div>
      </div>
    );
  }

  return <div className={cx("space-y-4", className)}>{content}</div>;
}
