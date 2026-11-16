"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CHAVE_DO_ACEITE } from "@/lib/medir";

function carregarGa(id: string) {
  if (document.getElementById("ga4")) return;
  const w = window as unknown as { dataLayer: unknown[] };
  w.dataLayer = w.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });
  const s = document.createElement("script");
  s.id = "ga4";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

/** Pede o aceite antes de medir. Sem aceite, nada do Google é carregado. */
export function Medicao({ id }: { id: string }) {
  const [aceite, setAceite] = useState<"sim" | "nao" | null | undefined>(undefined);
  const caminho = usePathname();

  useEffect(() => {
    try {
      const v = localStorage.getItem(CHAVE_DO_ACEITE);
      setAceite(v === "sim" || v === "nao" ? v : null);
    } catch {
      setAceite("nao");
    }
  }, []);

  useEffect(() => {
    if (aceite !== "sim") return;
    carregarGa(id);
    window.gtag?.("event", "page_view", { page_path: caminho, page_location: window.location.origin + caminho });
  }, [aceite, caminho, id]);

  function escolher(v: "sim" | "nao") {
    try {
      localStorage.setItem(CHAVE_DO_ACEITE, v);
    } catch {
      // Sem armazenamento, vale só para esta visita.
    }
    setAceite(v);
  }

  if (aceite !== null) return null;
  return (
    <div className="medicao" role="region" aria-label="Medição de visitas">
      <p>
        Podemos contar as visitas com o Google Analytics para melhorar o site? Não enviamos o que você digita nem
        os seus números.
      </p>
      <div className="acoes">
        <button type="button" className="principal" onClick={() => escolher("sim")}>
          Pode contar
        </button>
        <button type="button" className="secundario" onClick={() => escolher("nao")}>
          Não, obrigado
        </button>
      </div>
    </div>
  );
}
