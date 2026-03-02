export function LandingFooter() {
  return (
    <footer className="border-t border-stone-200 py-8">
      <div className="space-y-3 text-sm text-stone-600">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a className="font-medium text-stone-700 hover:text-stone-900" href="#rechtliches">
            Impressum
          </a>
          <a className="font-medium text-stone-700 hover:text-stone-900" href="#rechtliches">
            Datenschutz
          </a>
          <a className="font-medium text-stone-700 hover:text-stone-900" href="mailto:kontakt@reitbeteiligung.app">
            Kontakt
          </a>
        </div>
        <p id="rechtliches">Impressum und Datenschutzhinweise werden im naechsten Schritt ergaenzt.</p>
      </div>
    </footer>
  );
}
