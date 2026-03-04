import assert from "node:assert/strict";
import test from "node:test";

import { createFlashCookieValue, getFlashTarget } from "../lib/flash.ts";

test("getFlashTarget trennt Query, Hash und Basis sauber", () => {
  const target = getFlashTarget("/pferde/abc?message=alt#kalender");

  assert.equal(target.basePath, "/pferde/abc?message=alt");
  assert.equal(target.hashFragment, "kalender");
  assert.equal(target.pathname, "/pferde/abc");
});

test("createFlashCookieValue erzeugt ein lesbares Flash-Payload", () => {
  const encoded = createFlashCookieValue("/login", "Anmeldung erfolgreich.", "success");
  const parsed = JSON.parse(decodeURIComponent(encoded));

  assert.deepEqual(parsed, {
    pathname: "/login",
    text: "Anmeldung erfolgreich.",
    tone: "success"
  });
});
