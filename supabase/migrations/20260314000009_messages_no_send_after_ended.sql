-- Server-side send block for ended conversations.
--
-- The previous "Teilnehmer schreiben Nachrichten" policy allowed any conversation
-- participant to insert messages as long as they were part of the conversation.
-- This means a client bypassing the UI could still send messages into a conversation
-- whose relationship was ended.
--
-- New policy additionally requires:
--   1. The conversation is still visible (is_relationship_conversation_visible = true)
--   2. The approval is NOT in 'ended' status
--
-- Result:
--   approved    → visible + not ended  → INSERT allowed ✓
--   ended       → visible + ended      → INSERT blocked ✓  (read-only)
--   revoked     → not visible          → INSERT blocked ✓
--   rejected    → not visible          → INSERT blocked ✓
--   trial phase → visible + no approval row → INSERT allowed ✓

drop policy if exists "Teilnehmer schreiben Nachrichten" on public.messages;

create policy "Teilnehmer schreiben Nachrichten"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (c.rider_id = auth.uid() or c.owner_id = auth.uid())
        and public.is_relationship_conversation_visible(c.horse_id, c.rider_id)
        and not exists (
          select 1
          from public.approvals a
          where a.horse_id = c.horse_id
            and a.rider_id = c.rider_id
            and a.status = 'ended'
        )
    )
  );
