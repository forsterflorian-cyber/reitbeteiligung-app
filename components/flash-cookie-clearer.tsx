"use client";

import { useEffect } from "react";

import { FLASH_COOKIE_NAME } from "@/lib/flash";

export function FlashCookieClearer() {
  useEffect(() => {
    document.cookie = FLASH_COOKIE_NAME + "=; Max-Age=0; path=/; SameSite=Lax";
  }, []);

  return null;
}
