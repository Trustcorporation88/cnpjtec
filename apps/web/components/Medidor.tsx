"use client";

import { useState, type FormEvent } from "react";
import { lerValor, mostrarValor } from "@/lib/dinheiro";
import type { RespostaDoMedidor } from "@/lib/medidor";
import { Fontes } from "./Fontes";

type Tipo = "transporte_passageiros" | "entrega_de_bens" | "servico" | "revenda_mercadoria" | "intermediacao_comissao";

const ATIVIDADES: { tipo: Tipo; rotulo: string; curto: string }[] = [
  { tipo: "transporte_passageiros", rotulo: "Levo passageiros por aplicativo", curto: "Corridas" },
  { tipo: "entrega_de_bens", rotulo: "Faço entregas", curto: "Entregas" },
  { tipo: "servico", rotulo: "Presto serviço", curto: "Serviços" },
  { tipo: "revenda_mercadoria", rotulo: "Compro produtos para revender", curto: "Vendas" },
  { tipo: "intermediacao_comissao", rotulo: "Vendo por comissão", curto: "Comissões" },
];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function Medidor({ anos }: { anos: number[] }) {
  const [ano, setAno] = useState(anos[anos.length - 1] ?? 2027);
  const [temMei, setTemMei] = useState<boolean | null>(null);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [mesInicio, setMesInicio] = useState(1);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDoMedidor | null>(null);

  const meses = Array.from({ length: 13 - mesInicio }, (_, i) => mesInicio + i);

  async function aoMedir(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (temMei === null) return setErro("Diga se você tem MEI.");
    if (tipos.length === 0) return setErro("Marque pelo menos uma atividade.");
    const receitas: { mes: number; tipo: Tipo; valor: string }[] = [];
    for (const mes of meses) {
      for (const tipo of tipos) {
        const digitado = valores[`${mes}:${tipo}`]?.trim() ?? "";
        if (digitado === "") continue;
        const valor = lerValor(digitado);
        if (valor === null) {
          return setErro(`O valor de ${MESES[mes - 1]} não está certo. Use só números, como 2500.`);
        }
        receitas.push({ mes, tipo, valor });
      }
    }
    if (receitas.length === 0) return setErro("Preencha o valor de pelo menos um mês.");
    setEnviando(true);
    try {
      const r = await fetch("/api/limite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anoCalendario: ano, temMei, mesInicio, receitas }),
      });
      if (!r.ok) {
        const problema = (await r.json().catch(() => null)) as { detail?: string } | null;
        return setErro(problema?.detail ?? "Não deu para medir. Tente de novo.");
      }
      setResposta((await r.json()) as RespostaDoMedidor);
      requestAnimationFrame(() => document.getElementById("resultado")?.scrollIntoView());
    } catch {
      setErro("Sem conexão com a internet. Confira o sinal e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="guia">
      <h1>Meu limite do ano</h1>
      <p className="resumo">
        Coloque quanto entrou em cada mês. A gente mostra quanto do limite você já usou e em que mês,
        no ritmo atual, você passa dele. Mês em branco é estimado pela média dos meses preenchidos.
      </p>

      <form onSubmit={aoMedir} noValidate>
        <fieldset>
          <legend><h2>Você tem MEI?</h2></legend>
          <div className="opcoes lado-a-lado">
            {[true, false].map((v) => (
              <label key={String(v)} className="opcao" data-marcado={temMei === v}>
                <input type="radio" name="mei" checked={temMei === v} onChange={() => setTemMei(v)} />
                <span><strong>{v ? "Sim" : "Não"}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend><h2>O que você faz?</h2></legend>
          <div className="opcoes">
            {ATIVIDADES.map((a) => (
              <label key={a.tipo} className="opcao" data-marcado={tipos.includes(a.tipo)}>
                <input
                  type="checkbox"
                  checked={tipos.includes(a.tipo)}
                  onChange={() =>
                    setTipos(
                      tipos.includes(a.tipo)
                        ? tipos.filter((t) => t !== a.tipo)
                        : ATIVIDADES.map((x) => x.tipo).filter((t) => t === a.tipo || tipos.includes(t)),
                    )
                  }
                />
                <span><strong>{a.rotulo}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="lado-a-lado campos">
          <label className="campo-uf">
            <span className="dica">Ano</span>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="campo-uf">
            <span className="dica">Comecei em</span>
            <select value={mesInicio} onChange={(e) => setMesInicio(Number(e.target.value))}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>

        {tipos.length > 0 && (
          <fieldset>
            <legend><h2>Quanto entrou em cada mês?</h2></legend>
            <p className="dica">
              Coloque o total recebido, antes de tirar gastos. Corridas e entregas: o valor cheio, antes da
              taxa do aplicativo.
            </p>
            <div className="meses">
              {meses.map((mes) => (
                <div key={mes} className="mes">
                  <span className="nome-mes">{MESES[mes - 1]}</span>
                  {tipos.map((tipo) => (
                    <label key={tipo} className="valor-mes">
                      <span className={tipos.length > 1 ? "" : "invisivel"}>
                        {ATIVIDADES.find((a) => a.tipo === tipo)?.curto}
                      </span>
                      <input
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="R$"
                        aria-label={`${ATIVIDADES.find((a) => a.tipo === tipo)?.curto} em ${MESES[mes - 1]}`}
                        value={valores[`${mes}:${tipo}`] ?? ""}
                        onChange={(e) => setValores({ ...valores, [`${mes}:${tipo}`]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="submit" className="principal" disabled={enviando}>
            {enviando ? "Medindo" : "Medir o meu limite"}
          </button>
        </div>
      </form>

      {resposta && <ResultadoDoMedidor resposta={resposta} ano={ano} />}
    </div>
  );
}

function ResultadoDoMedidor({ resposta, ano }: { resposta: RespostaDoMedidor; ano: number }) {
  const r = resposta.resultado;
  const nome = r.tipoDeLimite === "NANO" ? "limite do nanoempreendedor" : "limite do MEI";
  const titulo =
    r.mesQueEstoura === null
      ? `No ritmo atual, você fecha ${ano} dentro do limite.`
      : r.estouroConfirmado
        ? `Você passou do limite em ${MESES[r.mesQueEstoura - 1]}.`
        : `No ritmo atual, você passa do limite em ${MESES[r.mesQueEstoura - 1]}.`;
  const usado = Math.min(Number(r.percentualUsado), 100);
  const topo = Math.max(Number(r.projetadoNoAno), Number(r.limite));

  return (
    <article id="resultado" className="resultado" aria-live="polite">
      <div className="placa">
        <p>{nome[0]?.toUpperCase() + nome.slice(1)} em {ano}</p>
        <h1>{titulo}</h1>
      </div>

      <div className="medidor" role="img" aria-label={`Você já usou ${r.percentualUsado}% do limite.`}>
        <div className="medidor-uso" style={{ width: `${usado}%` }} />
      </div>
      <p className="medidor-legenda">Já usado: {r.percentualUsado.replace(".", ",")}%</p>

      <dl className="conta">
        <div><dt>Já entrou na conta</dt><dd>{mostrarValor(r.realizado)}</dd></div>
        <div>
          <dt>{r.tipoDeLimite === "NANO" ? "Limite (precisa ficar abaixo)" : "Limite"}</dt>
          <dd>{mostrarValor(r.limite)}</dd>
        </div>
        <div><dt>Ainda cabe</dt><dd>{mostrarValor(r.folga)}</dd></div>
        <div><dt>Previsto para o ano</dt><dd>{mostrarValor(r.projetadoNoAno)}</dd></div>
      </dl>
      {r.tipoDeLimite === "NANO" && (
        <p className="observacao">Corridas e entregas contam só uma parte, por isso o valor na conta é menor.</p>
      )}

      <h2>Mês a mês</h2>
      <ol className="linha-do-ano">
        {r.meses.map((m) => (
          <li key={m.mes} data-estimado={m.estimado} data-estoura={r.mesQueEstoura !== null && m.mes >= r.mesQueEstoura}>
            <span className="nome-mes">{MESES[m.mes - 1]}{m.estimado ? " (estimado)" : ""}</span>
            <span className="trilho">
              <span className="enchimento" style={{ width: `${(Number(m.acumulado) / topo) * 100}%` }} />
              <span className="marca-limite" style={{ left: `${(Number(r.limite) / topo) * 100}%` }} />
            </span>
            <span className="acumulado">{mostrarValor(m.acumulado)}</span>
          </li>
        ))}
      </ol>
      <p className="observacao">A linha preta marca o limite. Meses tracejados são estimados.</p>

      {r.mesQueEstoura !== null && (
        <section aria-labelledby="t-agora">
          <h2 id="t-agora">O que fazer</h2>
          <ul className="lista fazer">
            {r.tipoDeLimite === "NANO" ? (
              <>
                <li>Ao passar do limite, você deixa de ser nanoempreendedor e entra nos impostos novos.</li>
                <li>Compare com abrir um MEI antes disso. Faça o Raio-X para ver o seu caso.</li>
              </>
            ) : (
              <li>Passar do limite do MEI muda o seu regime. Fale com um contador antes do fim do ano.</li>
            )}
          </ul>
        </section>
      )}

      {resposta.semDefinicao.length > 0 && (
        <section className="indefinido" aria-labelledby="t-gov">
          <h2 id="t-gov">O governo ainda não definiu</h2>
          <ul className="lista">
            {resposta.semDefinicao.map((f) => <li key={f.regra}>{f.texto}</li>)}
          </ul>
        </section>
      )}

      <Fontes regras={resposta.regras} versao={resposta.versaoDasRegras} />
    </article>
  );
}
