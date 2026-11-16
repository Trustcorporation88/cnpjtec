"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Situacao = "aberto" | "respondido" | "cancelado";

interface Pedido {
  id: string;
  contato: string;
  pergunta: string;
  resumo: { trilhas?: string[] };
  criadoEm: string;
  situacao: Situacao;
  comConta: boolean;
}

interface Painel {
  numeros: {
    contas: number;
    contasNaSemana: number;
    vendasNaSemana: number;
    notas: number;
    pedidosAbertos: number;
    consultasDasHoje: number;
  };
  pedidos: Pedido[];
}

const NOMES_DAS_TRILHAS: Record<string, string> = {
  A_NANO: "Nano",
  B_PF_CONTRIBUINTE: "Pessoa física",
  C_MEI_SERVICO: "MEI de serviço",
  D_MEI_REVENDA: "MEI revendedor",
  E_ME_EPP: "ME ou EPP",
  FORA_DO_ALCANCE: "Fora do alcance",
};

const NOMES_DAS_SITUACOES: Record<Situacao, string> = {
  aberto: "Aberto",
  respondido: "Respondido",
  cancelado: "Cancelado",
};

function linkDoWhatsapp(contato: string): string | null {
  const n = contato.replace(/\D/g, "");
  if (n.length < 10) return null;
  const texto = encodeURIComponent("Olá! Aqui é do ProContador, sobre a dúvida que você mandou pelo site.");
  return `https://wa.me/${n}?text=${texto}`;
}

const quando = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Painel do contador: dúvidas que chegaram pelo site e números de uso da plataforma. */
export function PainelDoContador() {
  const [painel, setPainel] = useState<Painel | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "sem_acesso" | "erro">("carregando");
  const [filtro, setFiltro] = useState<Situacao | "todos">("aberto");
  const [mudando, setMudando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/contador", { cache: "no-store" }).catch(() => null);
    if (!r) return setEstado("erro");
    if (r.status === 401) return window.location.replace("/entrar?voltar=/contador");
    if (r.status === 403) return setEstado("sem_acesso");
    if (!r.ok) return setEstado("erro");
    setPainel((await r.json()) as Painel);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function mudar(id: string, situacao: Situacao) {
    setMudando(id);
    const r = await fetch("/api/contador", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, situacao }),
    }).catch(() => null);
    setMudando(null);
    if (!r || !r.ok) return setEstado("erro");
    await carregar();
  }

  if (estado === "carregando") return <p className="carregando">Carregando o painel…</p>;
  if (estado === "sem_acesso") {
    return (
      <div className="guia">
        <h1>Painel do contador</h1>
        <p className="resumo">
          Esta área é só para o contador do ProContador. Se você tem uma dúvida, mande pela página{" "}
          <Link href="/ajuda">Falar com um contador</Link>.
        </p>
      </div>
    );
  }
  if (estado === "erro" || !painel) {
    return (
      <p className="erro" role="alert">
        Não conseguimos abrir o painel agora. Recarregue a página em instantes.
      </p>
    );
  }

  const n = painel.numeros;
  const pedidos = painel.pedidos.filter((p) => filtro === "todos" || p.situacao === filtro);

  return (
    <div className="guia painel">
      <h1>Painel do contador</h1>
      <dl className="numeros">
        <div>
          <dt>Dúvidas abertas</dt>
          <dd>{n.pedidosAbertos}</dd>
        </div>
        <div>
          <dt>Contas</dt>
          <dd>
            {n.contas} <small>+{n.contasNaSemana} na semana</small>
          </dd>
        </div>
        <div>
          <dt>Vendas anotadas na semana</dt>
          <dd>{n.vendasNaSemana}</dd>
        </div>
        <div>
          <dt>Notas no cofre</dt>
          <dd>{n.notas}</dd>
        </div>
        <div>
          <dt>Consultas do DAS hoje</dt>
          <dd>{n.consultasDasHoje}</dd>
        </div>
      </dl>

      <section aria-labelledby="t-duvidas">
        <h2 id="t-duvidas">Dúvidas</h2>
        <div className="filtros" role="group" aria-label="Mostrar">
          {(["aberto", "respondido", "cancelado", "todos"] as const).map((f) => (
            <button key={f} type="button" className="secundario" aria-pressed={filtro === f} onClick={() => setFiltro(f)}>
              {f === "todos" ? "Todas" : NOMES_DAS_SITUACOES[f]}
            </button>
          ))}
        </div>
        {pedidos.length === 0 ? (
          <p className="observacao">Nenhuma dúvida {filtro === "todos" ? "ainda" : `com a situação ${NOMES_DAS_SITUACOES[filtro].toLowerCase()}`}.</p>
        ) : (
          <ul className="pedidos">
            {pedidos.map((p) => {
              const wa = linkDoWhatsapp(p.contato);
              const trilhas = (p.resumo.trilhas ?? []).map((t) => NOMES_DAS_TRILHAS[t] ?? t);
              return (
                <li key={p.id} className={`pedido situacao-${p.situacao}`}>
                  <p className="dica">
                    {quando.format(new Date(p.criadoEm))}. {trilhas.length ? trilhas.join(", ") : "Situação não informada"}.{" "}
                    {p.comConta ? "Tem conta." : "Sem conta."} {NOMES_DAS_SITUACOES[p.situacao]}.
                  </p>
                  <p className="pergunta">{p.pergunta}</p>
                  <div className="acoes">
                    {wa && (
                      <a className="botao" href={wa} target="_blank" rel="noopener noreferrer">
                        Responder no WhatsApp
                      </a>
                    )}
                    {p.situacao !== "respondido" && (
                      <button type="button" className="principal" disabled={mudando === p.id} onClick={() => mudar(p.id, "respondido")}>
                        Marcar como respondida
                      </button>
                    )}
                    {p.situacao === "aberto" ? (
                      <button type="button" className="secundario" disabled={mudando === p.id} onClick={() => mudar(p.id, "cancelado")}>
                        Cancelar
                      </button>
                    ) : (
                      <button type="button" className="secundario" disabled={mudando === p.id} onClick={() => mudar(p.id, "aberto")}>
                        Reabrir
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
