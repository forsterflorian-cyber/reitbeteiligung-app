import { FAQ_SECTIONS } from "@/lib/faq-content";
import { AppPageShell } from "@/components/ui/app-page-shell";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";

export default function FaqPage() {
  return (
    <AppPageShell>
      <PageHeader
        backdropVariant="hero"
        subtitle="Hier findest du die wichtigsten Antworten zum aktuellen Ablauf auf reitbeteiligung.app."
        surface
        title="Hilfe & FAQ"
      />
      <div className="space-y-6">
        {FAQ_SECTIONS.map((section) => (
          <SectionCard key={section.title} subtitle={section.intro} title={section.title}>
            <div className="space-y-4">
              {section.items.map((item) => (
                <Card className="p-5" key={item.question}>
                  <div className="space-y-2">
                    <h2 className="text-base font-semibold text-stone-900">{item.question}</h2>
                    <p className="text-sm leading-7 text-stone-600">{item.answer}</p>
                  </div>
                </Card>
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </AppPageShell>
  );
}
