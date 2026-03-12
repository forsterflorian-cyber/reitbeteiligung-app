import assert from "node:assert/strict";
import test from "node:test";

import { buildConversationSummaryMaps, buildLatestHorseGroupMessageMap } from "../lib/message-summaries.ts";

test("Conversation-Summaries bauen Kontakt- und Latest-Message-Maps auch fuer leere und unvollstaendige Daten", () => {
  const { conversationInfo, latestMessages } = buildConversationSummaryMaps([
    {
      conversation_id: "conversation-1",
      latest_message_content: "Hallo",
      latest_message_created_at: "2026-03-20T10:15:00.000Z",
      latest_message_id: "message-1",
      latest_message_sender_id: "user-2",
      partner_email: "owner@example.com",
      partner_name: "Pferdehalterin",
      partner_phone: null
    },
    {
      conversation_id: "conversation-2",
      latest_message_content: null,
      latest_message_created_at: null,
      latest_message_id: null,
      latest_message_sender_id: null,
      partner_email: null,
      partner_name: "Reiter",
      partner_phone: null
    }
  ]);

  assert.deepEqual(conversationInfo.get("conversation-1"), {
    partner_email: "owner@example.com",
    partner_name: "Pferdehalterin",
    partner_phone: null
  });
  assert.deepEqual(conversationInfo.get("conversation-2"), {
    partner_email: null,
    partner_name: "Reiter",
    partner_phone: null
  });
  assert.deepEqual(latestMessages.get("conversation-1"), {
    content: "Hallo",
    conversation_id: "conversation-1",
    created_at: "2026-03-20T10:15:00.000Z",
    id: "message-1",
    sender_id: "user-2"
  });
  assert.equal(latestMessages.has("conversation-2"), false);
});

test("Horse-Group-Summaries behalten pro Pferd nur den ersten Datensatz", () => {
  const latestGroupMessages = buildLatestHorseGroupMessageMap([
    {
      content: "Neueste Nachricht",
      created_at: "2026-03-20T12:00:00.000Z",
      horse_id: "horse-1",
      id: "group-1",
      sender_id: "owner-1"
    },
    {
      content: "Aeltere Nachricht",
      created_at: "2026-03-20T10:00:00.000Z",
      horse_id: "horse-1",
      id: "group-older",
      sender_id: "owner-1"
    },
    {
      content: "Anderes Pferd",
      created_at: "2026-03-21T09:00:00.000Z",
      horse_id: "horse-2",
      id: "group-2",
      sender_id: "rider-2"
    }
  ]);

  assert.deepEqual(latestGroupMessages.get("horse-1"), {
    content: "Neueste Nachricht",
    created_at: "2026-03-20T12:00:00.000Z",
    horse_id: "horse-1",
    id: "group-1",
    sender_id: "owner-1"
  });
  assert.deepEqual(latestGroupMessages.get("horse-2"), {
    content: "Anderes Pferd",
    created_at: "2026-03-21T09:00:00.000Z",
    horse_id: "horse-2",
    id: "group-2",
    sender_id: "rider-2"
  });
});
