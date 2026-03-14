"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/types/database";

const messageTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit"
});

type ChatThreadProps = {
  conversationId: string;
  currentUserId: string;
  initialMessages: Message[];
  isClosed?: boolean;
  partnerLabel: string;
};

async function fetchMessages(supabase: SupabaseClient, conversationId: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return {
    error,
    messages: (data as Message[] | null) ?? []
  };
}

async function markConversationRead(supabase: SupabaseClient, conversationId: string) {
  const { error } = await supabase.rpc("mark_conversation_read", {
    p_conversation_id: conversationId
  });

  return error;
}

export function ChatThread({ conversationId, currentUserId, initialMessages, isClosed = false, partnerLabel }: ChatThreadProps) {
  const supabase = createClient();
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadMessages = async () => {
      const result = await fetchMessages(supabase, conversationId);

      if (!isActive) {
        return;
      }

      if (result.error) {
        setError("Die Nachrichten konnten nicht geladen werden.");
        return;
      }

      setError(null);
      setMessages(result.messages);
      await markConversationRead(supabase, conversationId);
    };

    void loadMessages();

    const intervalId = window.setInterval(() => {
      void loadMessages();
    }, 4000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [conversationId, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = draft.trim();

    if (!content) {
      setError("Bitte gib eine Nachricht ein.");
      return;
    }

    setIsSending(true);

    const { error: insertError } = await supabase.from("messages").insert({
      content,
      conversation_id: conversationId,
      sender_id: currentUserId
    });

    if (insertError) {
      setError("Die Nachricht konnte nicht gesendet werden.");
      setIsSending(false);
      return;
    }

    const result = await fetchMessages(supabase, conversationId);

    if (result.error) {
      setError("Die Nachricht wurde gesendet, aber die Ansicht konnte nicht aktualisiert werden.");
    } else {
      setError(null);
      setMessages(result.messages);
      await markConversationRead(supabase, conversationId);
    }

    setDraft("");
    setIsSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="max-h-[56vh] space-y-3 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
        {messages.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-sm text-stone-600">Noch keine Nachrichten. Nutzt den Chat, um den Probetermin abzustimmen.</p>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUserId;

            return (
              <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`} key={message.id}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isOwnMessage ? "bg-forest text-white" : "bg-sand text-ink"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">{isOwnMessage ? "Du" : partnerLabel}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`mt-2 text-[11px] ${isOwnMessage ? "text-white/75" : "text-stone-500"}`}>
                    {messageTimeFormatter.format(new Date(message.created_at))}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {isClosed ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Diese Reitbeteiligung wurde beendet. Der Chatverlauf ist weiterhin lesbar, neue Nachrichten sind nicht mehr möglich.
        </div>
      ) : (
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="sr-only" htmlFor="chat-message">
              Nachricht
            </label>
            <input
              autoComplete="off"
              id="chat-message"
              maxLength={1000}
              name="message"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Schreibe eine Nachricht zum Probetermin"
              type="text"
              value={draft}
            />
          </div>
          <button
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-forest px-5 py-3 text-base font-semibold text-white hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSending}
            type="submit"
          >
            {isSending ? "Wird gesendet..." : "Nachricht senden"}
          </button>
        </form>
      )}
    </div>
  );
}