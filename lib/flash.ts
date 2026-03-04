export const FLASH_COOKIE_NAME = "rb_flash";

export type FlashTone = "error" | "success";

export type FlashPayload = {
  pathname: string;
  text: string;
  tone: FlashTone;
};

export function getFlashTarget(path: string) {
  const [basePath, hashFragment = ""] = path.split("#", 2);
  const pathname = basePath.split("?", 1)[0] || "/";

  return {
    basePath,
    hashFragment,
    pathname
  };
}

export function createFlashCookieValue(pathname: string, text: string, tone: FlashTone) {
  return encodeURIComponent(JSON.stringify({ pathname, text, tone } satisfies FlashPayload));
}
