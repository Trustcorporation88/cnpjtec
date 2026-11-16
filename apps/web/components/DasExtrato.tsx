"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Consulta } from "@/lib/das/procontador";
import { medir } from "@/lib/medir";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ROTULO: Record<string, string> = { PAGO: "Paga", VENCIDO: "Em atraso", EMITIDO: "Em aberto", PENDENTE: "Em aberto", CANCELADO: "Cancelada" };

function data(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Consulta a situação do DAS no PGMEI pelo robô do ProContador. Só aparece com conta e serviço ligado. */
export function DasExtrato({ pgmei }: { pgmei: string }) {
  const [estado, setEstado] = useState<"verificando" | "sem-conta" | "pronto">("verificando");
  const [cnpj, setCnpj] = useState("");
  const [pedido, setPedido] = useState<string | null>(null);
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const tentativas = useRef(0);

  useEffect(() => {
    fetch("/api/conta", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ conta: unknown }>)
      .then((e) => setEstado(e.conta ? "pronto" : "sem-conta"))
      .catch(() => setEstado("sem-conta"));
  }, []);

  useEffect(() => {
    if (!pedido) return;
    let parar = false;
    const olhar = async () => {
      tentativas.current += 1;
      const r = await fetch(`/api/das/extrato?pedido=${encodeURIComponent(pedido)}`, { cache: "no-store" }).catch(() => null);
      if (parar) return;
      if (!r || !r.ok) return setErro("Não conseguimos acompanhar a consulta. Tente de novo mais tarde.");
      const c = (await r.json()) as Consulta;
      setConsulta(c);
      if (!c.pronto) {
        if (tentativas.current >= 40) return setErro("O PGMEI está demorando. Volte daqui a pouco nesta página.");
        setTimeout(olhar, 10_000);
      }
    };
    void olhar();
    return () => {
      parar = true;
    };
  }, [pedido]);

  async function consultar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setConsulta(null);
    setEnviando(true);
    const r = await fetch("/api/das/extrato", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cnpj }),
    }).catch(() => null);
    setEnviando(false);
    if (!r) return setErro("Sem conexão.");
    if (r.status === 503) return setErro("A consulta automática ainda não está ligada. Use o PGMEI pelo botão acima.");
    if (!r.ok) {
      const c = (await r.json().catch(() => null)) as { detail?: string } | null;
      return setErro(c?.detail ?? "Não deu certo. Tente de novo.");
    }
    medir("das_consultado");
    tentativas.current = 0;
    setPedido(((await r.json()) as { pedido: string }).pedido);
  }

  if (estado === "verificando") return null;

  return (
    <section aria-labelledby="t-situacao" className="caixa-das">
      <h2 id="t-situacao">Veja se o seu DAS está em dia</h2>
      {estado === "sem-conta" ? (
        <p>
          O ProContador consulta o PGMEI para você e mostra mês a mês o que está pago e o que está em aberto.{" "}
          <Link href="/entrar?voltar=/das">Entre com o seu celular</Link> para usar.
        </p>
      ) : (
        <>
          <p>O ProContador consulta o PGMEI e mostra o ano mês a mês. Leva de um a cinco minutos.</p>
          <form onSubmit={consultar} noValidate>
            <label className="campo-contato">
              <span>CNPJ do MEI</span>
              <input inputMode="numeric" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
            </label>
            <div className="acoes">
              <button type="submit" className="principal" disabled={enviando || (pedido !== null && consulta?.pronto === false)}>
                {enviando ? "Pedindo…" : "Consultar o meu DAS"}
              </button>
            </div>
          </form>
        </>
      )}
      <div aria-live="polite">
        {erro && <p className="erro" role="alert">{erro}</p>}
        {pedido && consulta && !consulta.pronto && !erro && <p className="carregando">Consultando o PGMEI…</p>}
        {consulta?.pronto && !consulta.extrato && (
          <p className="erro" role="alert">
            {consulta.erro ?? "Não conseguimos ler o PGMEI desta vez."} <a href={pgmei} target="_blank" rel="noopener noreferrer">Consulte direto no PGMEI</a>.
          </p>
        )}
        {consulta?.pronto && consulta.extrato && (
          <>
            {consulta.extrato.dividaAtiva && (
              <p className="erro" role="alert">O PGMEI indica débito em dívida ativa. <Link href="/ajuda">Fale com um contador</Link>.</p>
            )}
            {consulta.guias.length === 0 ? (
              <p>O PGMEI não mostrou guias com valor neste ano.</p>
            ) : (
              <table className="tabela">
                <thead>
                  <tr><th scope="col">Mês</th><th scope="col">Situação</th><th scope="col">Vencimento</th><th scope="col" className="valor">Valor</th></tr>
                </thead>
                <tbody>
                  {consulta.guias.map((g) => (
                    <tr key={`${g.ano}-${g.mes}`}>
                      <td>{MESES[g.mes - 1]}</td>
                      <td>{ROTULO[g.situacao] ?? g.situacao}</td>
                      <td>{g.situacao === "PAGO" ? `paga em ${data(g.dataPagamento)}` : data(g.vencimento)}</td>
                      <td className="valor">{g.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {consulta.guias.some((g) => g.linhaDigitavel) ? (
              consulta.guias.filter((g) => g.linhaDigitavel).map((g) => (
                <p key={g.mes}>
                  Linha digitável de {MESES[g.mes - 1]}: <code style={{ wordBreak: "break-all" }}>{g.linhaDigitavel}</code>
                </p>
              ))
            ) : consulta.guias.some((g) => g.situacao !== "PAGO" && g.situacao !== "CANCELADO") ? (
              <p>
                Para pagar o que está em aberto, gere a guia no PGMEI, só com o CNPJ.{" "}
                <a className="botao" href={pgmei} target="_blank" rel="noopener noreferrer">Gerar a guia no PGMEI</a>
              </p>
            ) : null}
            <p className="fonte">Fonte: PGMEI, da Receita Federal, consultado agora pelo robô do ProContador.</p>
          </>
        )}
      </div>
    </section>
  );
}
