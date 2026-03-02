export function LandingFooter() {
  return (
    <footer className="border-t border-stone-200 py-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-600">
        <a className="hover:text-stone-900" href="#rechtliches">
          Impressum
        </a>
        <span className="text-stone-300">|</span>
        <a className="hover:text-stone-900" href="#rechtliches">
          Datenschutz
        </a>
        <span className="text-stone-300">|</span>
        <a className="hover:text-stone-900" href="mailto:kontakt@reitbeteiligung.app">
          Kontakt
        </a>
      </div>
      <p className="mt-3 text-sm text-stone-500" id="rechtliches">
        Impressum und Datenschutzhinweise werden im naechsten Schritt hinterlegt.
      </p>
    </footer>
  );
}

