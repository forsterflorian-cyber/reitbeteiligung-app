import { cookies } from "next/headers";

import { FlashCookieClearer } from "@/components/flash-cookie-clearer";
import { Notice } from "@/components/notice";

type FlashTone = "error" | "success";

type FlashPayload = {
  pathname: string;
  text: string;
  tone: FlashTone;
};

const FLASH_COOKIE_NAME = "rb_flash";

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
      <Notice text={payload.text} tone={payload.tone} />
    </>
  );
}
