"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Notice } from "@/components/notice";

type FlashTone = "error" | "success";

type FlashPayload = {
  pathname: string;
  text: string;
  tone: FlashTone;
};

const FLASH_COOKIE_NAME = "rb_flash";

function clearFlashCookie() {
  document.cookie = `${FLASH_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax`;
}

function readFlashCookie() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${FLASH_COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  const rawValue = cookie.slice(`${FLASH_COOKIE_NAME}=`.length);

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<FlashPayload>;

    if (
      typeof parsed.pathname !== "string" ||
      typeof parsed.text !== "string" ||
      (parsed.tone !== "error" && parsed.tone !== "success")
    ) {
      clearFlashCookie();
      return null;
    }

    return parsed as FlashPayload;
  } catch {
    clearFlashCookie();
    return null;
  }
}

export function GlobalFlashNotice() {
  const pathname = usePathname();
  const [payload, setPayload] = useState<FlashPayload | null>(null);

  useEffect(() => {
    const flash = readFlashCookie();

    if (!flash) {
      setPayload(null);
      return;
    }

    if (flash.pathname !== pathname) {
      setPayload(null);
      return;
    }

    setPayload(flash);
    clearFlashCookie();
  }, [pathname]);

  const tone = useMemo(() => payload?.tone ?? "success", [payload]);

  if (!payload) {
    return null;
  }

  return <Notice text={payload.text} tone={tone} />;
}
