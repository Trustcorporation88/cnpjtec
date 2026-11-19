import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Medicao } from "@/components/Medicao";

export const metadata: Metadata = {
  title: "ProContador: imposto de quem trabalha por conta própria",
  description:
    "Responda poucas perguntas e descubra o que muda para você em 2027: CNPJ técnico, MEI, nota fiscal e inscrição estadual.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#02322e",
};

const GA4 = /^G-[A-Z0-9]{4,15}$/.test(process.env.GA4_ID ?? "") ? process.env.GA4_ID! : null;

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <p className="aviso-teste" role="note">
          Versão de testes. As regras ainda estão sendo conferidas por um contador.
        </p>
        <header className="topo">
          <Link className="marca" href="/" aria-label="ProContador, página inicial">
            <Image src="/marca/escudo.png" alt="" width={37} height={48} priority />
            <span>ProContador</span>
          </Link>
          <nav aria-label="Principal">
            <Link href="/">Minha situação</Link>
            <Link href="/simulador">Comparar</Link>
            <Link href="/caderno">Caderno</Link>
            <Link href="/limite">Meu limite</Link>
            <Link href="/sair-do-mei">Sair do MEI</Link>
            <Link href="/das">Guia do MEI</Link>
            <Link href="/cnpj-tecnico">CNPJ técnico</Link>
            <Link href="/cadesp">Inscrição estadual</Link>
            <Link href="/nota-de-servico">Códigos da nota</Link>
            <Link href="/cofre">Cofre de notas</Link>
            <Link href="/abrir-mei">Abrir MEI</Link>
            <Link href="/assistente">Perguntar</Link>
            <Link href="/ajuda">Contador</Link>
            <Link href="/conta">Minha conta</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="rodape">
          <p>
            O resultado é uma orientação geral, feita só com as respostas que você deu. Ele não
            substitui a análise de um contador.
          </p>
          <p>
            Não pedimos senha do gov.br. Sem conta, não guardamos as suas respostas. Com conta, você baixa ou apaga
            tudo quando quiser.
          </p>
        </footer>
        {GA4 && <Medicao id={GA4} />}
      </body>
    </html>
  );
}
