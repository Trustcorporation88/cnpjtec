"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GRUPOS_DO_MENU } from "@/lib/menu";

export function MenuPrincipal() {
  const menu = useRef<HTMLDetailsElement>(null);
  const caminho = usePathname();

  // Ao trocar de página, o menu fecha.
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [caminho]);

  // Esc fecha o menu e devolve o foco ao botão.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <nav className="menu" aria-label="Principal">
      <ul className="menu-atalhos">
        <li><Link href="/minha-situacao" aria-current={caminho === "/minha-situacao" ? "page" : undefined}>Minha situação</Link></li>
        <li><Link href="/assistente" aria-current={caminho === "/assistente" ? "page" : undefined}>Perguntar</Link></li>
        <li><Link href="/ajuda" aria-current={caminho === "/ajuda" ? "page" : undefined}>Contador</Link></li>
      </ul>
      <Link className="menu-entrar" href="/conta">Entrar</Link>
      <details className="menu-completo" ref={menu}>
        <summary>
          <span className="menu-icone" aria-hidden="true" />
          Menu
        </summary>
        <div className="menu-painel">
          {GRUPOS_DO_MENU.map((grupo) => (
            <section key={grupo.titulo}>
              <h2>{grupo.titulo}</h2>
              <ul>
                {grupo.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} aria-current={caminho === l.href ? "page" : undefined}>{l.texto}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </nav>
  );
}
