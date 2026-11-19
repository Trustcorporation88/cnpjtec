"use client";

import type { CodigosDoServico } from "@cnpjtec/regras/servicos";
import { useEffect, useRef, useState } from "react";
import { medir } from "@/lib/medir";

interface Resposta {
  resultados: CodigosDoServico[];
  versaoBase: { versao: string; data: string };
  dataReferencia: string;
}

const EXEMPLOS = ["manicure", "faxina", "conserto de celular", "aula particular", "fotografia", "6.01"];

function Codigo({ nome, valor }: { nome: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="codigo">
      <dt>{nome}</dt>
      <dd>
        <code>{valor}</code>
        <button
          type="button"
          className="secundario nao-imprimir"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(valor);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            } catch {
              // Sem área de transferência: o código continua visível para copiar à mão.
            }
          }}
        >
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </dd>
    </div>
  );
}

/** Busca dos códigos da NFS-e pelo que a pessoa faz, na tabela oficial da Receita. */
export function CodigosDaNota() {
  const [consulta, setConsulta] = useState("");
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aberto, setAberto] = useState(0);
  const ultimo = useRef(0);

  useEffect(() => {
    const q = consulta.trim();
    if (q.length < 3) {
      setResposta(null);
      return;
    }
    const pedido = ++ultimo.current;
    const espera = setTimeout(async () => {
      setCarregando(true);
      try {
        const r = await fetch(`/api/servicos?q=${encodeURIComponent(q)}`);
        if (pedido !== ultimo.current) return;
        if (r.ok) {
          setResposta((await r.json()) as Resposta);
          setAberto(0);
        }
      } finally {
        if (pedido === ultimo.current) setCarregando(false);
      }
    }, 250);
    return () => clearTimeout(espera);
  }, [consulta]);

  return (
    <>
      <label className="campo-busca nao-imprimir">
        <span>O que você faz?</span>
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder="Ex.: manicure, faxina, conserto de celular"
          autoComplete="off"
          maxLength={120}
        />
        <span className="dica">
          Também aceita o código de tributação nacional (como 6.01) ou a NBS.{" "}
          {EXEMPLOS.map((e, i) => (
            <span key={e}>
              {i > 0 && ", "}
              <button type="button" className="secundario" onClick={() => setConsulta(e)}>
                {e}
              </button>
            </span>
          ))}
        </span>
      </label>

      <div aria-live="polite">
        {carregando && <p className="observacao">Procurando na tabela da Receita…</p>}
        {resposta && !carregando && resposta.resultados.length === 0 && (
          <p className="observacao">
            Não achamos esse serviço. Tente outra palavra, mais simples (por exemplo, "limpeza" em vez de
            "faxina pesada"), ou o código de tributação nacional que você já usa na nota.
          </p>
        )}
        {resposta && resposta.resultados.length > 0 && (
          <ol className="resultados-servico">
            {resposta.resultados.map((r, i) => (
              <li key={`${r.item.codigo}-${r.nbs.codigo}`} className="resultado-servico">
                <button
                  type="button"
                  className="titulo-resultado"
                  aria-expanded={aberto === i}
                  onClick={() => {
                    setAberto(aberto === i ? -1 : i);
                    if (aberto !== i) medir("codigos_consultados");
                  }}
                >
                  <strong>{r.nbs.descricao}</strong>
                  <span className="dica">
                    Item {r.item.codigo} da lista de serviços: {r.item.descricao}
                  </span>
                </button>
                {aberto === i && (
                  <div className="detalhe-resultado">
                    <dl className="codigos">
                      <Codigo nome="Código de tributação nacional (item da LC 116)" valor={r.item.codigo} />
                      <Codigo nome="NBS" valor={r.nbs.codigo} />
                    </dl>

                    <h3>IBS e CBS: situação e classificação</h3>
                    {r.tributacao.length > 1 && (
                      <p className="dica">
                        Este serviço tem mais de uma classificação possível. A primeira, "tributação integral", é a
                        regra geral. As outras valem só nos casos descritos.
                      </p>
                    )}
                    <ul className="lista-simples">
                      {r.tributacao.map((t) => (
                        <li key={t.cClassTrib}>
                          <dl className="codigos">
                            <Codigo nome="CST" valor={t.cst} />
                            <Codigo nome="cClassTrib" valor={t.cClassTrib} />
                          </dl>
                          <p className="dica">
                            {t.cstDescricao}. {t.descricao}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <h3>Onde o serviço é feito (indicador de operação)</h3>
                    <p className="dica">Escolha o que descreve o seu caso. Ele diz para qual cidade vai o IBS.</p>
                    <ul className="lista-simples">
                      {r.operacoes.map((o) => (
                        <li key={o.cIndOp}>
                          <dl className="codigos">
                            <Codigo nome="cIndOp" valor={o.cIndOp} />
                          </dl>
                          <p className="dica">
                            {o.tipoOperacao}. O imposto fica com: {o.localIncidencia.toLowerCase()}.
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {resposta && (
          <p className="observacao">
            Tabela oficial da calculadora da Receita Federal, base {resposta.versaoBase.versao} de{" "}
            {resposta.versaoBase.data.split("-").reverse().join("/")}, para notas a partir de{" "}
            {resposta.dataReferencia.split("-").reverse().join("/")}.
          </p>
        )}
      </div>
    </>
  );
}
