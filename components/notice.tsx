type NoticeProps = {
  tone?: "error" | "success" | "neutral";
  text?: string | null;
};

const tones = {
  error: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-stone-200 bg-white text-stone-600",
  success: "border-stone-200 bg-sand text-forest"
};

export function Notice({ tone = "neutral", text }: NoticeProps) {
  if (!text) {
    return null;
  }

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{text}</div>;
}
