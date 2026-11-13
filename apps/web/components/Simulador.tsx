"use client";

import { receitaAnualDeMedia, simularRegimes, type ResultadoDoSimulador } from "@cnpjtec/motor-regras";
import { baseDeRegras, buscarRegra } from "@cnpjtec/regras";
import { textoDaPendencia, rotuloDoStatus } from "@cnpjtec/conteudo";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { lerValor, mostrarValor } from "@/lib/dinheiro";

type Tipo = "transporte_passageiros" | "entrega_de_bens" | "servico" | "revenda_mercadoria" | "intermediacao_comissao";

const ATIVIDADES: { tipo: Tipo; rotulo: string; nome: string }[] = [
  { tipo: "transporte_passageiros", rotulo: "Levo passageiros por aplicativo", nome: "as corridas" },
  { tipo: "entrega_de_bens", rotulo: "Faço entregas", nome: "as entregas" },
  { tipo: "servico", rotulo: "Presto serviço", nome: "os serviços" },
  { tipo: "revenda_mercadoria", rotulo: "Compro produtos para revender", nome: "as vendas" },
  { tipo: "intermediacao_comissao", rotulo: "Vendo por comissão", nome: "as comissões" },
];

function anosDisponiveis(): number[] {
  const p = baseDeRegras.parametros;
  return Object.keys(p.limiteMeiAnual).filter((a) => a in p.salarioMinimo).map(Number).sort();
}

export function Simulador() {
  const anos = anosDisponiveis();
  const [ano, setAno] = useState(anos[anos.length - 1] ?? 2027);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [valores, setValores] = useState<Partial<Record<Tipo, string>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [r, setR] = useState<ResultadoDoSimulador | null>(null);

  function comparar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (tipos.length === 0) return setErro("Marque pelo menos uma atividade.");
    const atividades = [];
    for (const tipo of tipos) {
      const media = lerValor(valores[tipo] ?? "");
      if (media === null) {
        return setErro(`Digite quanto entra por mês com ${ATIVIDADES.find((a) => a.tipo === tipo)?.nome}. Exemplo: 2500`);
      }
      atividades.push({ tipo, receitaBrutaAnual: receitaAnualDeMedia(media, 12) });
    }
    try {
      setR(simularRegimes({ anoCalendario: ano, atividades }, baseDeRegras.parametros));
      requestAnimationFrame(() => document.getElementById("comparacao")?.scrollIntoView());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para comparar.");
    }
  }

  return (
    <div className="guia">
      <h1>Nano, MEI ou CNPJ técnico?</h1>
      <p className="resumo">
        Coloque quanto entra por mês e veja, lado a lado, o que cada caminho pede e quanto custa. A
        gente mostra os fatos. A escolha é sua.
      </p>

      <form onSubmit={comparar} noValidate>
        <fieldset>
          <legend><h2>O que você faz?</h2></legend>
          <div className="opcoes">
            {ATIVIDADES.map((a) => (
              <label key={a.tipo} className="opcao" data-marcado={tipos.includes(a.tipo)}>
                <input
                  type="checkbox"
                  checked={tipos.includes(a.tipo)}
                  onChange={() =>
                    setTipos(tipos.includes(a.tipo) ? tipos.filter((t) => t !== a.tipo) : ATIVIDADES.map((x) => x.tipo).filter((t) => t === a.tipo || tipos.includes(t)))
                  }
                />
                <span><strong>{a.rotulo}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>

        {tipos.map((tipo) => {
          const a = ATIVIDADES.find((x) => x.tipo === tipo)!;
          return (
            <label key={tipo} className="campo-contato">
              <span>Quanto entra por mês com {a.nome}, em média?</span>
              <input inputMode="decimal" autoComplete="off" placeholder="R$" value={valores[tipo] ?? ""} onChange={(e) => setValores({ ...valores, [tipo]: e.target.value })} />
            </label>
          );
        })}

        <div className="lado-a-lado campos">
          <label className="campo-uf">
            <span className="dica">Ano</span>
            <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="acoes">
          <button type="submit" className="principal">Comparar os caminhos</button>
        </div>
      </form>

      {r && <Comparacao r={r} />}
    </div>
  );
}

function Comparacao({ r }: { r: ResultadoDoSimulador }) {
  const estimadas = r.regrasAplicadas.map(buscarRegra).filter((x) => x.status === "ESTIMATIVA");
  const titulo = r.nano.cabe
    ? "Você pode continuar sem CNPJ."
    : r.mei.cabe
      ? "Você vai precisar escolher: MEI ou CNPJ técnico."
      : "Você passa do limite do MEI.";
  const ids = [...new Set([...r.regrasAplicadas, ...r.pendencias, "R33", "R35", "R25"])].sort();

  return (
    <article id="comparacao" className="resultado" aria-live="polite">
      <div className="placa">
        <p>Seus caminhos em {r.ano}</p>
        <h1>{titulo}</h1>
      </div>

      <p>
        Você recebe cerca de <strong>{mostrarValor(r.receitaBrutaTotal)}</strong> no ano.
      </p>

      {estimadas.length > 0 && (
        <p className="aviso-local">
          O valor da guia do MEI em {r.ano} usa o salário mínimo previsto no Orçamento. O valor
          oficial sai em dezembro e pode mudar um pouco.
        </p>
      )}

      <section className="caminho" data-cabe={r.nano.cabe}>
        <h2>Continuar sem CNPJ (nanoempreendedor)</h2>
        <p className="veredito">{r.nano.cabe ? "Dá para você." : "Não dá: você passa do limite."}</p>
        <dl className="conta">
          <div><dt>Entra na conta do limite</dt><dd>{mostrarValor(r.nano.receitaComputada)}</dd></div>
          <div><dt>Precisa ficar abaixo de</dt><dd>{mostrarValor(r.nano.limite)}</dd></div>
          {r.nano.cabe && <div><dt>Impostos novos (IBS e CBS)</dt><dd>R$ 0,00</dd></div>}
        </dl>
        {r.nano.cabe && (
          <ul className="lista fazer">
            <li>Anotar quanto entra todo mês, para não passar do limite sem perceber.</li>
            <li>Não tem guia mensal. O INSS como autônomo é à parte e não entra nesta conta.</li>
            <li>Continuam valendo as regras da sua cidade (nota de serviço) e do estado (se revende).</li>
          </ul>
        )}
      </section>

      <section className="caminho" data-cabe={r.mei.cabe}>
        <h2>Abrir um MEI</h2>
        <p className="veredito">{r.mei.cabe ? "Dá para você." : "Não dá: você passa do limite do MEI."}</p>
        <dl className="conta">
          <div><dt>Limite do MEI no ano</dt><dd>{mostrarValor(r.mei.limite)}</dd></div>
          <div><dt>Guia por mês</dt><dd>{mostrarValor(r.mei.dasMensal)}</dd></div>
          <div><dt>Guias no ano</dt><dd>{mostrarValor(r.mei.dasNoAno)}</dd></div>
        </dl>
        <p className="observacao">
          A guia junta {mostrarValor(r.mei.inss)} de INSS
          {r.mei.icms !== "0.00" ? `, ${mostrarValor(r.mei.icms)} de ICMS` : ""}
          {r.mei.iss !== "0.00" ? `, ${mostrarValor(r.mei.iss)} de ISS` : ""}. O valor é o mesmo
          todo mês, não importa quanto você vende.
          {r.mei.pesoNaReceita && ` No ano, dá ${r.mei.pesoNaReceita.replace(".", ",")}% do que você recebe.`}{" "}
          <a className="ref" href="#regra-R35">(regra R35)</a>
        </p>
        {r.mei.cabe && (
          <ul className="lista fazer">
            <li>Pagar a guia todo mês e entregar a declaração anual até 31 de maio.</li>
            <li>Emitir nota quando vender para empresa.</li>
            {r.mei.icms !== "0.00" && <li>Ter inscrição estadual, se você revende em São Paulo.</li>}
            <li>Conferir se a sua atividade é permitida no MEI.</li>
          </ul>
        )}
      </section>

      <section className="caminho" data-cabe={r.regularSeNaoForMei ? "obrigatorio" : "opcional"}>
        <h2>Ficar como pessoa física com CNPJ técnico</h2>
        <p className="veredito">
          {r.regularSeNaoForMei
            ? "É onde você cai se não abrir MEI."
            : "Só se você quiser. Para você não é obrigatório."}
        </p>
        <ul className="lista fazer">
          <li>Receber o CNPJ técnico pela Receita, de graça.</li>
          <li>Emitir nota fiscal eletrônica nas suas vendas e serviços.</li>
          <li>
            Pagar os impostos novos sobre o que vende, descontando o que já veio pago nas compras.
            Esse valor depende da alíquota e das suas compras. Não calculamos aqui.
          </li>
        </ul>
        <p className="observacao">Antes de escolher este caminho, fale com um contador.</p>
      </section>

      {r.pendencias.length > 0 && (
        <section className="indefinido" aria-labelledby="t-gov">
          <h2 id="t-gov">O governo ainda não definiu</h2>
          <ul className="lista">
            {r.pendencias.map((id) => <li key={id}>{textoDaPendencia[id] ?? buscarRegra(id).regra}</li>)}
          </ul>
        </section>
      )}

      <p>
        <Link className="botao" href="/">Fazer o Raio-X completo</Link>
      </p>

      <details className="fontes">
        <summary>De onde tiramos isso</summary>
        <ul>
          {ids.map((id) => {
            const x = buscarRegra(id);
            return (
              <li key={id} id={`regra-${id}`}>
                <p><strong>Regra {id}.</strong> {x.regra}</p>
                <p className="fonte">
                  Fonte: {x.fonte}. {rotuloDoStatus[x.status] ?? x.status}.
                  {x.conferencia !== "OFICIAL" && x.conferencia !== "SEM_NORMA" ? " Em conferência pelo contador." : ""}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="fonte">Versão das regras: {baseDeRegras.versao}.</p>
      </details>
    </article>
  );
}
