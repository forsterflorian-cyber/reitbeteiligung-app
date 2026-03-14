"use client";

import { useEffect, useState } from "react";

import { FLASH_COOKIE_NAME, type FlashPayload } from "@/lib/flash";

const toastTones = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

function readAndClearFlash(): FlashPayload | null {
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(FLASH_COOKIE_NAME + "="))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!raw) {
    return null;
  }

  // Clear immediately so no subsequent server render picks it up stale
  document.cookie = `${FLASH_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax`;

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<FlashPayload>;

    if (
      typeof parsed.text !== "string" ||
      (parsed.tone !== "error" && parsed.tone !== "success")
    ) {
      return null;
    }

    return parsed as FlashPayload;
  } catch {
    return null;
  }
}

export function GlobalFlashNotice() {
  const [payload, setPayload] = useState<FlashPayload | null>(null);

  useEffect(() => {
    setPayload(readAndClearFlash());
  }, []);

  if (!payload) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
      <div className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-lg ${toastTones[payload.tone]}`}>
        {payload.text}
      </div>
    </div>
  );
}
