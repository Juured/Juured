import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt - võrdlus",
  description: "Võta ühendust võrdlus kinnisvaravõrdluse tiimiga.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-paper text-body">
      <header className="border-b border-rule bg-paper/90">
        <div className="max-w-compare mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
          <a href="/" className="font-display text-[24px] leading-none tracking-tight text-ink">
            võrdlus
          </a>
          <a href="/" className="text-[13px] text-ink hover:text-accent transition-colors">
            Tagasi võrdlusesse
          </a>
        </div>
      </header>

      <section className="max-w-compare mx-auto px-5 sm:px-8 py-12 sm:py-16">
        <div className="max-w-2xl">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Kontakt</p>
          <h1 className="display mt-3 text-ink text-balance">Võta ühendust</h1>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            Küsimuste, tagasiside, andmeallikate või koostöösoovide korral kirjuta meile.
          </p>
          <a
            href="mailto:juuredkv@gmail.com"
            className="mt-8 inline-flex items-center border border-ink bg-ink px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-paper hover:bg-ink/85 transition-colors"
          >
            juuredkv@gmail.com
          </a>
        </div>
      </section>
    </main>
  );
}
