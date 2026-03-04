import assert from "node:assert/strict";
import test from "node:test";

import {
  canAcceptTrialRequest,
  canApproveTrialRequest,
  canCancelTrialRequest,
  canCompleteTrialRequest,
  isActiveRelationship
} from "../lib/trial-lifecycle.ts";

test("trial lifecycle helper deckt die Owner- und Rider-Schritte sauber ab", () => {
  assert.equal(canCancelTrialRequest("requested"), true);
  assert.equal(canCancelTrialRequest("accepted"), true);
  assert.equal(canCancelTrialRequest("declined"), false);
  assert.equal(canAcceptTrialRequest("requested"), true);
  assert.equal(canAcceptTrialRequest("accepted"), false);
  assert.equal(canCompleteTrialRequest("accepted"), true);
  assert.equal(canCompleteTrialRequest("completed"), false);
  assert.equal(canApproveTrialRequest("completed"), true);
  assert.equal(canApproveTrialRequest("requested"), false);
});

test("isActiveRelationship erkennt nur freigeschaltete Beziehungen", () => {
  assert.equal(isActiveRelationship("approved"), true);
  assert.equal(isActiveRelationship("revoked"), false);
  assert.equal(isActiveRelationship(null), false);
});
