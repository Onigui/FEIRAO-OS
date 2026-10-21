import Link from "next/link";
import { SHOWCASE_CITY } from "@/features/showcase/constants";

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/vitrine" className="font-display text-xl text-primary">
            Vitrine {SHOWCASE_CITY}
          </Link>
          <Link href="/vitrine" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Ver todos os carros
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
      <footer className="border-t bg-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-4 py-5 text-xs text-muted-foreground">
          <span>Carros das lojas de {SHOWCASE_CITY}. Preços e disponibilidade informados pelas lojas.</span>
          <Link href="/privacidade" className="underline">
            Privacidade
          </Link>
          <Link href="/termos" className="underline">
            Termo das lojas
          </Link>
        </div>
      </footer>
    </div>
  );
}
