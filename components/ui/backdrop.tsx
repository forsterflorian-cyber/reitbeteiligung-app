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
        <div className="absolute inset-0 opacity-[0.22]" style={baseImageStyle} />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/55" />
        <div className="absolute inset-y-0 right-0 w-2/3 bg-[radial-gradient(circle_at_top_right,rgba(120,113,108,0.14),transparent_60%)]" />
      </div>
    );
  }

  if (variant === "section") {
    return (
      <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 hidden overflow-hidden lg:block", className)} {...props}>
        <div className="absolute inset-0 opacity-[0.1]" style={baseImageStyle} />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-stone-50/70 to-stone-50" />
      </div>
    );
  }

  return (
    <div aria-hidden="true" className={cx("pointer-events-none absolute inset-0 hidden overflow-hidden md:block", className)} {...props}>
      <div className="absolute inset-0 opacity-[0.14]" style={baseImageStyle} />
      <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/65 to-white/95" />
    </div>
  );
}
