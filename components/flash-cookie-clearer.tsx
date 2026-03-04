"use client";

import { useEffect } from "react";

const FLASH_COOKIE_NAME = "rb_flash";

export function FlashCookieClearer() {
  useEffect(() => {
    document.cookie = FLASH_COOKIE_NAME + "=; Max-Age=0; path=/; SameSite=Lax";
  }, []);

  return null;
}
