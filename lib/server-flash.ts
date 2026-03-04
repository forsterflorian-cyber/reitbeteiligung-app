import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createFlashCookieValue, getFlashTarget, type FlashTone } from "@/lib/flash";

export function redirectWithFlash(path: string, tone: FlashTone, text: string): never {
  const { basePath, hashFragment, pathname } = getFlashTarget(path);

  cookies().set("rb_flash", createFlashCookieValue(pathname, text, tone), {
    httpOnly: false,
    maxAge: 60,
    path: "/",
    sameSite: "lax"
  });

  redirect(hashFragment ? `${basePath}#${hashFragment}` : basePath);
}
