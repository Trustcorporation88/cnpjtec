"use client";

import { anoDaDeclaracao, prepararDeclaracao, type Declaracao as TipoDeclaracao } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { carregarDoAparelho, juntarCadernos, lerCaderno, type Caderno } from "@/lib/caderno";
import { fraseDoLimite, fraseDoPrazo, fraseDosMeses, MESES, SERVICO_DASN } from "@/lib/declaracao";
import { mostrarValor } from "@/lib/dinheiro";
import { medir } from "@/lib/medir";

function hoje(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Valores da declaração anual montados a partir do caderno, para copiar no site da Receita. */
export function Declaracao() {
  const [caderno, setCaderno] = useState<Caderno>({ versao: 1, vendas: [] });
  const [carregado, setCarregado] = useState(false);
  const [dataHoje, setDataHoje] = useState("");
  const [ano, setAno] = useState<number | null>(null);
  const [inicio, setInicio] = useState(1);
  const [empregado, setEmpregado] = useState<"sim" | "nao" | null>(null);

  useEffect(() => {
    const d = hoje();
    setDataHoje(d);
    setAno(anoDaDeclaracao(d));
    const local = carregarDoAparelho();
    setCaderno(local);
    (async () => {
      try {
        const r = await fetch("/api/caderno", { cache: "no-store" });
        if (r.ok) setCaderno(juntarCadernos(lerCaderno(await r.text()).caderno, local));
      } catch {
        // Sem conta ou sem rede: fica com o que está no aparelho.
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  const anos = useMemo(() => {
    const atual = Number(dataHoje.slice(0, 4)) || new Date().getFullYear();
    return Object.keys(baseDeRegras.parametros.limiteMeiAnual)
      .map(Number)
      .filter((a) => a <= atual)
      .sort((a, b) => b - a);
  }, [dataHoje]);

  const declaracao: TipoDeclaracao | null = useMemo(() => {
    if (ano === null || !dataHoje) return null;
    try {
      return prepararDeclaracao(
        { vendas: caderno.vendas, anoCalendario: ano, hoje: dataHoje, mesInicio: inicio },
        baseDeRegras.parametros,
      );
    } catch {
      return null;
    }
  }, [caderno, ano, dataHoje, inicio]);

  if (!carregado || ano === null) return <p className="observacao">Carregando o caderno…</p>;

  const limite = declaracao ? fraseDoLimite(declaracao) : null;
  const meses = declaracao ? fraseDosMeses(declaracao) : null;

  return (
    <>
      <div className="lado-a-lado campos nao-imprimir">
        <label className="campo-uf">
          <span className="dica">Ano da declaração</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="campo-uf">
          <span className="dica">Quando abriu o MEI</span>
          <select value={inicio} onChange={(e) => setInicio(Number(e.target.value))}>
            <option value={1}>Antes de {ano}</option>
            {MESES.slice(1).map((m, i) => (
              <option key={m} value={i + 2}>Em {m} de {ano}</option>
            ))}
          </select>
        </label>
      </div>

      {!declaracao ? (
        <p className="erro" role="alert">Não deu para montar a declaração deste ano.</p>
      ) : (
        <>
          <section className="declaracao" aria-labelledby="t-valores">
            <h2 id="t-valores">Declaração de {declaracao.anoCalendario}</h2>
            <p className={declaracao.situacao === "atrasada" ? "erro" : "dica"}>
              {fraseDoPrazo(declaracao)}{" "}
              <a className="ref" href={declaracao.situacao === "atrasada" ? "#regra-R39" : "#regra-R33"}>
                (regra {declaracao.situacao === "atrasada" ? "R39" : "R33"})
              </a>
            </p>
            {declaracao.quantidadeDeVendas === 0 ? (
              <p>
                Não há vendas anotadas em {declaracao.anoCalendario}. Se você não faturou nada, a declaração é
                entregue mesmo assim, com R$ 0,00 nos campos de receita. Se vendeu, anote primeiro no{" "}
                <Link href="/caderno">caderno</Link>.
              </p>
            ) : (
              <>
                <p>Copie estes valores nos campos da declaração:</p>
                <dl className="conta">
                  <div className="total">
                    <dt>Receita bruta total</dt>
                    <dd>{mostrarValor(declaracao.receitaTotal)}</dd>
                  </div>
                  <div className="total">
                    <dt>Dessa receita, comércio e indústria</dt>
                    <dd>{mostrarValor(declaracao.receitaComercio)}</dd>
                  </div>
                  <div>
                    <dt>Serviços (já estão no total, só para conferir)</dt>
                    <dd>{mostrarValor(declaracao.receitaServicos)}</dd>
                  </div>
                </dl>
                <p className="observacao">
                  Soma de {declaracao.quantidadeDeVendas}{" "}
                  {declaracao.quantidadeDeVendas === 1 ? "venda anotada" : "vendas anotadas"} no caderno.
                </p>
              </>
            )}

            <fieldset className="campos">
              <legend>Teve empregado em {declaracao.anoCalendario}?</legend>
              <label>
                <input type="radio" name="empregado" checked={empregado === "nao"} onChange={() => setEmpregado("nao")} /> Não
              </label>{" "}
              <label>
                <input type="radio" name="empregado" checked={empregado === "sim"} onChange={() => setEmpregado("sim")} /> Sim
              </label>
              <p className="observacao">A declaração pergunta isso. O caderno não sabe, então marque aqui para levar anotado.</p>
            </fieldset>
          </section>

          {(limite || meses || declaracao.vendasParaEmpresa > 0) && (
            <section aria-labelledby="t-conferir">
              <h2 id="t-conferir">Antes de entregar, confira</h2>
              <ul className="lista alerta">
                {limite && (
                  <li>
                    {limite} <Link href="/sair-do-mei">Ver quanto fica a guia como ME</Link> e{" "}
                    <Link href="/ajuda">falar com um contador</Link>.{" "}
                    <a className="ref" href="#regra-R38">(regra R38)</a>
                  </li>
                )}
                {meses && <li>{meses}</li>}
                {declaracao.vendasParaEmpresa > 0 && (
                  <li>
                    {declaracao.vendasParaEmpresa}{" "}
                    {declaracao.vendasParaEmpresa === 1 ? "venda foi" : "vendas foram"} para empresa. Confira se a
                    nota fiscal de cada uma foi emitida.
                  </li>
                )}
              </ul>
            </section>
          )}

          <section aria-labelledby="t-entregar">
            <h2 id="t-entregar">Como entregar</h2>
            <ol className="passos">
              <li className="passo">
                <h3>Confira as guias do ano</h3>
                <p>
                  A Receita só aceita a declaração com as apurações de todos os meses do ano feitas no PGMEI e
                  com as declarações dos anos anteriores entregues. <Link href="/das">Veja como gerar a guia</Link>.
                </p>
              </li>
              <li className="passo">
                <h3>Abra o serviço oficial</h3>
                <p>A declaração é feita no Portal do Simples Nacional ou no app MEI. É de graça.</p>
                <p className="nao-imprimir">
                  <a className="botao" href={SERVICO_DASN} target="_blank" rel="noopener noreferrer">
                    Abrir a declaração no gov.br
                  </a>
                </p>
              </li>
              <li className="passo">
                <h3>Escolha o ano {declaracao.anoCalendario} e digite os valores</h3>
                <p>Use os valores acima e responda se teve empregado.</p>
              </li>
              <li className="passo">
                <h3>Transmita e guarde o recibo</h3>
                <p>Salve ou imprima o recibo de entrega. Se aparecer uma guia junto, pague no prazo dela.</p>
              </li>
            </ol>
            <div className="acoes nao-imprimir">
              <button type="button" className="principal" onClick={() => {
                  medir("declaracao_impressa");
                  window.print();
                }}>
                Imprimir ou salvar em PDF
              </button>
              <Link className="botao" href="/caderno">Voltar ao caderno</Link>
            </div>
          </section>
        </>
      )}
    </>
  );
}
