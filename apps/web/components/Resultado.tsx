"use client";

import Link from "next/link";
import { mostrarValor } from "@/lib/dinheiro";
import type { RespostaDoRaioX } from "@/lib/respostas";
import { Radar, type DadosDoRadar } from "./Radar";

interface Frase {
  texto: string;
  regra?: string;
}

/** Abre a lista de fontes antes de o navegador pular para a regra citada. */
function abrirFontes() {
  const fontes = document.querySelector<HTMLDetailsElement>("details.fontes");
  if (fontes) fontes.open = true;
}

function Lista({ frases, classe }: { frases: Frase[]; classe: string }) {
  return (
    <ul className={classe}>
      {frases.map((f) => (
        <li key={f.texto}>
          {f.texto}
          {f.regra && (
            <>
              {" "}
              <a className="ref" href={`#regra-${f.regra}`} onClick={abrirFontes}>
                (regra {f.regra})
              </a>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Resultado({
  resposta,
  aoRecomecar,
  radar,
  uf,
}: {
  resposta: RespostaDoRaioX;
  aoRecomecar: () => void;
  radar: DadosDoRadar | null;
  uf: string;
}) {
  const d = resposta.diagnostico;
  const fora = d.trilhas.includes("FORA_DO_ALCANCE");
  const mei = d.trilhas.some((t) => t === "C_MEI_SERVICO" || t === "D_MEI_REVENDA" || t === "E_ME_EPP");
  const contaDiferente = d.numeros.receitaBrutaTotal !== d.numeros.receitaComputadaNano;

  return (
    <article className="resultado" aria-live="polite">
      <div className="placa">
        <p>Sua situação em {resposta.ano}</p>
        <h1>{d.titulo}</h1>
      </div>

      <p className="resumo">{d.resumo}</p>

      {!fora && (
        <section aria-labelledby="t-conta">
          <h2 id="t-conta">A conta</h2>
          <dl className="conta">
            <div>
              <dt>Você recebe no ano</dt>
              <dd>{mostrarValor(d.numeros.receitaBrutaTotal)}</dd>
            </div>
            {!mei && contaDiferente && (
              <div>
                <dt>Entra na conta do limite (corridas e entregas contam só uma parte)</dt>
                <dd>{mostrarValor(d.numeros.receitaComputadaNano)}</dd>
              </div>
            )}
            {mei ? (
              <div>
                <dt>Limite do MEI</dt>
                <dd>{mostrarValor(d.numeros.limiteMei)}</dd>
              </div>
            ) : (
              <div>
                <dt>Limite do nanoempreendedor</dt>
                <dd>menos de {mostrarValor(d.numeros.limiteNano)}</dd>
              </div>
            )}
          </dl>
          {resposta.observacoes.map((o) => (
            <p key={o} className="observacao">
              {o}
            </p>
          ))}
        </section>
      )}

      <section aria-labelledby="t-agora">
        <h2 id="t-agora">Faça agora</h2>
        <Lista frases={d.fazerAgora} classe="lista fazer" />
      </section>

      {d.naoPrecisa.length > 0 && (
        <section aria-labelledby="t-nao">
          <h2 id="t-nao">Você não precisa</h2>
          <Lista frases={d.naoPrecisa} classe="lista dispensa" />
        </section>
      )}

      {d.semDefinicao.length > 0 && (
        <section className="indefinido" aria-labelledby="t-gov">
          <h2 id="t-gov">O governo ainda não definiu</h2>
          <p>Estes pontos podem mudar o seu resultado. Quando saírem, a gente atualiza.</p>
          <Lista frases={d.semDefinicao} classe="lista" />
        </section>
      )}

      {!fora && (
        <p>
          <Link className="botao" href="/limite">
            Medir o meu limite mês a mês
          </Link>
        </p>
      )}

      {d.trilhas.includes("B_PF_CONTRIBUINTE") && (
        <p>
          <Link className="botao" href="/cnpj-tecnico">
            Ver o caminho do CNPJ técnico
          </Link>
        </p>
      )}

      {d.fazerAgora.some((f) => f.regra === "R23" || f.regra === "R24" || f.regra === "R25") && (
        <p>
          <Link className="botao" href="/cadesp">
            Ver como tirar a inscrição estadual
          </Link>
        </p>
      )}

      {(d.trilhas.includes("C_MEI_SERVICO") || d.trilhas.includes("D_MEI_REVENDA")) && (
        <p>
          <Link className="botao" href="/caderno">
            Abrir o caderno de vendas
          </Link>
        </p>
      )}

      {(d.trilhas.includes("C_MEI_SERVICO") || d.trilhas.includes("D_MEI_REVENDA")) && (
        <p>
          <Link className="botao" href="/das">
            Ver como gerar a guia do MEI
          </Link>
        </p>
      )}

      {radar && d.trilhas.includes("B_PF_CONTRIBUINTE") && (
        <Radar dados={radar} trilha="B_PF_CONTRIBUINTE" uf={uf} />
      )}

      {d.comContador.length > 0 && (
        <section aria-labelledby="t-contador">
          <h2 id="t-contador">Para olhar com um contador</h2>
          <Lista frases={d.comContador} classe="lista" />
        </section>
      )}

      <details className="fontes">
        <summary>De onde tiramos isso</summary>
        <ul>
          {d.regras.map((r) => (
            <li key={r.id} id={`regra-${r.id}`}>
              <p>
                <strong>Regra {r.id}.</strong> {r.regra}
              </p>
              <p className="fonte">
                Fonte: {r.fonte}. {r.rotuloDoStatus}.{r.emRevisao ? " Em conferência pelo contador." : ""}
              </p>
            </li>
          ))}
        </ul>
        <p className="fonte">Versão das regras: {resposta.versaoDasRegras}.</p>
      </details>

      <div className="acoes">
        <button type="button" className="secundario" onClick={aoRecomecar}>
          Refazer as perguntas
        </button>
      </div>
    </article>
  );
}
