"use client";

import { simularSaidaDoMei, type SaidaDoMei as Resultado } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";
import { useMemo, useState } from "react";
import { lerValor, mostrarValor } from "@/lib/dinheiro";

const ANOS = Object.keys(baseDeRegras.parametros.simplesNacional ?? {}).map(Number);

function porcento(texto: string): string {
  return `${texto.replace(".", ",")}%`;
}

/** Simulação de quanto custa deixar de ser MEI e virar ME no Simples Nacional. */
export function SaidaDoMei() {
  const [ano, setAno] = useState(ANOS[0] ?? 2027);
  const [comercio, setComercio] = useState("");
  const [servico, setServico] = useState("");

  const resultado: Resultado | string | null = useMemo(() => {
    const c = comercio.trim() ? lerValor(comercio) : "0";
    const s = servico.trim() ? lerValor(servico) : "0";
    if (c === null || s === null) return "Confira os valores digitados.";
    if (Number(c) + Number(s) === 0) return null;
    try {
      return simularSaidaDoMei({ anoCalendario: ano, comercioMensal: c, servicoMensal: s }, baseDeRegras.parametros);
    } catch (e) {
      return e instanceof Error ? e.message : "Não deu para simular.";
    }
  }, [ano, comercio, servico]);

  return (
    <>
      <div className="campos">
        <label className="campo-busca">
          <span>Quanto você vende de mercadoria por mês, em média</span>
          <input inputMode="decimal" value={comercio} onChange={(e) => setComercio(e.target.value)} placeholder="Ex.: 9.000" />
        </label>
        <label className="campo-busca">
          <span>Quanto você recebe de serviço por mês, em média</span>
          <input inputMode="decimal" value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex.: 0" />
        </label>
        <label className="campo-uf">
          <span className="dica">Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {ANOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <div aria-live="polite">
        {typeof resultado === "string" && <p className="erro" role="alert">{resultado}</p>}
        {resultado && typeof resultado !== "string" && (
          <section aria-labelledby="t-resultado">
            <h2 id="t-resultado">Como ME no Simples Nacional, em {resultado.anoCalendario}</h2>
            <dl className="conta">
              <div className="total">
                <dt>Guia por mês como ME (Simples)</dt>
                <dd>{mostrarValor(resultado.guiaMensalSimples)}</dd>
              </div>
              <div>
                <dt>Guia por mês como MEI</dt>
                <dd>{mostrarValor(resultado.guiaMensalMei)}</dd>
              </div>
              <div className="total">
                <dt>Diferença por mês</dt>
                <dd>{mostrarValor(resultado.diferencaMensal)}</dd>
              </div>
            </dl>
            <p className="observacao">
              Conta feita com {mostrarValor(resultado.receitaAnual)} por ano (a média de hoje vezes 12).
            </p>

            {resultado.partes.map((p) => (
              <div key={p.anexo}>
                <h3>{p.anexo === "I" ? "Venda de mercadoria (Anexo I)" : "Serviço (Anexo III)"}</h3>
                <p>
                  Faixa {p.faixa}, alíquota de {porcento(p.aliquotaNominal)} na tabela e {porcento(p.aliquotaEfetiva)} de verdade
                  sobre {mostrarValor(p.receitaMensal)} por mês: guia de {mostrarValor(p.guiaMensal)}.
                </p>
                <p className="dica">
                  Dentro dessa guia, {mostrarValor(p.cbsMensal)} são de CBS e {mostrarValor(p.ibsMensal)} de IBS. Na nota, vão
                  destacados {porcento(p.cbsNaNota)} de CBS e {porcento(p.ibsNaNota)} de IBS, que é o crédito de quem compra
                  de você sendo empresa.
                </p>
              </div>
            ))}

            <h3>Antes de decidir</h3>
            <ul className="lista">
              {resultado.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>
                Para quem passou do limite do MEI, a mudança não é escolha: fale com um contador para fazer a transição
                certa. <a href="/ajuda">Falar com um contador</a>
              </li>
            </ul>
            <p className="observacao">Regras usadas: {resultado.regrasAplicadas.join(", ")}.</p>
          </section>
        )}
      </div>
    </>
  );
}
