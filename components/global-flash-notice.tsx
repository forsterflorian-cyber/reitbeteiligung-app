import { cookies } from "next/headers";

import { FlashCookieClearer } from "@/components/flash-cookie-clearer";
import { FLASH_COOKIE_NAME, type FlashPayload } from "@/lib/flash";

const toastTones = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800"
};

function readFlashCookie() {
  const rawValue = cookies().get(FLASH_COOKIE_NAME)?.value;

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<FlashPayload>;

    if (
      typeof parsed.pathname !== "string" ||
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
  const payload = readFlashCookie();

  if (!payload) {
    return null;
  }

  return (
    <>
      <FlashCookieClearer />
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:justify-end sm:px-6">
        <div className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-lg ${toastTones[payload.tone]}`}>
          {payload.text}
        </div>
      </div>
    </>
  );
}
