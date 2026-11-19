import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Medicao } from "@/components/Medicao";
import { MenuPrincipal } from "@/components/MenuPrincipal";
import { GRUPOS_DO_MENU } from "@/lib/menu";

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
        <a className="pular" href="#conteudo">Pular para o conteúdo</a>
        <header className="topo">
          <div className="topo-dentro">
            <Link className="marca" href="/" aria-label="ProContador, página inicial">
              <Image src="/marca/escudo.png" alt="" width={31} height={40} priority />
              <span>ProContador</span>
            </Link>
            <MenuPrincipal />
          </div>
        </header>
        <p className="aviso-teste" role="note">
          Versão de testes: as regras estão em revisão por um contador.
        </p>
        <main id="conteudo">{children}</main>
        <footer className="rodape">
          <div className="rodape-dentro">
            <div className="rodape-marca">
              <p className="rodape-nome">ProContador</p>
              <p>
                Imposto de quem trabalha por conta própria, explicado com a lei na mão. Para motorista,
                entregador, diarista, manicure, revendedora e MEI.
              </p>
            </div>
            {GRUPOS_DO_MENU.map((grupo) => (
              <nav key={grupo.titulo} aria-label={grupo.titulo}>
                <p className="rodape-titulo">{grupo.titulo}</p>
                <ul>
                  {grupo.links.map((l) => (
                    <li key={l.href}><Link href={l.href}>{l.texto}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="rodape-letras">
            <p>
              O resultado é uma orientação geral, feita só com as respostas que você deu. Ele não substitui a
              análise de um contador.
            </p>
            <p>
              Não pedimos senha do gov.br. Sem conta, não guardamos as suas respostas. Com conta, você baixa ou
              apaga tudo quando quiser.
            </p>
          </div>
        </footer>
        {GA4 && <Medicao id={GA4} />}
      </body>
    </html>
  );
}
