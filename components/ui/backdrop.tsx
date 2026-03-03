import type { CSSProperties, HTMLAttributes } from "react";

import { cx } from "@/lib/cx";

export type BackdropVariant = "pattern" | "hero" | "section" | "cardTexture";

type BackdropProps = HTMLAttributes<HTMLDivElement> & {
  variant: BackdropVariant;
};

function backgroundImageForVariant(variant: Exclude<BackdropVariant, "pattern">) {
  if (variant === "hero") {
    return "url('/images/brand/bg_hero_2400x1200.jpg')";
  }

  if (variant === "section") {
    return "url('/images/brand/bg_section_2400x1600.jpg')";
  }

  return "url('/images/brand/bg_card_1400x1400.jpg')";
}

export function Backdrop({ className, variant, ...props }: BackdropProps) {
  if (variant === "pattern") {
    return (
      <div aria-hidden="true" className={cx("pointer-events-none inset-0 overflow-hidden", className)} {...props}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/brand/pattern_tile_512.png')",
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
            opacity: 0.12
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(214,211,209,0.3),transparent_30%),radial-gradient(circle_at_88%_0%,rgba(6,78,59,0.08),transparent_28%),linear-gradient(180deg,rgba(250,250,249,0.82),rgba(250,250,249,0.9))]" />
      </div>
    );
  }

  const baseImageStyle = {
    backgroundImage: backgroundImageForVariant(variant),
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover"
  } satisfies CSSProperties;

  if (variant === "hero") {
    return (
      <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 hidden overflow-hidden md:block", className)} {...props}>
        <div className="absolute inset-0 opacity-[0.28]" style={baseImageStyle} />
        <div className="absolute inset-0 bg-gradient-to-r from-white/96 via-white/86 to-white/58" />
        <div className="absolute inset-y-0 right-0 w-3/4 bg-[radial-gradient(circle_at_top_right,rgba(6,78,59,0.12),transparent_46%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-stone-50/70" />
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 overflow-hidden", className)} {...props}>
        <div className="absolute inset-0 opacity-[0.18] sm:opacity-[0.16] lg:opacity-[0.14]" style={baseImageStyle} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.08),transparent_34%),radial-gradient(circle_at_82%_10%,rgba(6,78,59,0.1),transparent_32%),linear-gradient(180deg,rgba(250,250,249,0.24),rgba(250,250,249,0.84)_40%,rgba(250,250,249,0.96))]" />
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-stone-50/72 via-stone-50/36 to-transparent" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 hidden overflow-hidden md:block", className)} {...props}>
      <div className="absolute inset-0 opacity-[0.14]" style={baseImageStyle} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/92 via-white/74 to-white/96" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(6,78,59,0.08),transparent_24%)]" />
    </div>
  );
}
