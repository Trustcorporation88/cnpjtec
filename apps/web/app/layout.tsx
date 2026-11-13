import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MEiSHOP: imposto de quem trabalha por conta própria",
  description:
    "Responda poucas perguntas e descubra o que muda para você em 2027: CNPJ técnico, MEI, nota fiscal e inscrição estadual.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffd400",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <p className="aviso-teste" role="note">
          Versão de testes. As regras ainda estão sendo conferidas por um contador.
        </p>
        <header className="topo">
          <Link className="marca" href="/">
            MEiSHOP
          </Link>
          <nav aria-label="Principal">
            <Link href="/">Minha situação</Link>
            <Link href="/limite">Meu limite</Link>
            <Link href="/das">Guia do MEI</Link>
            <Link href="/cnpj-tecnico">CNPJ técnico</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="rodape">
          <p>
            O resultado é uma orientação geral, feita só com as respostas que você deu. Ele não
            substitui a análise de um contador.
          </p>
          <p>Não pedimos senha do gov.br e não guardamos as suas respostas.</p>
        </footer>
      </body>
    </html>
  );
}
