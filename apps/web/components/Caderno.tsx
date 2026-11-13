"use client";

import { medirLimite, resumirVendas, type ReceitaDoMes } from "@cnpjtec/motor-regras";
import { baseDeRegras } from "@cnpjtec/regras";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { lerValor, mostrarValor } from "@/lib/dinheiro";
import {
  carregarDoAparelho,
  guardarNoAparelho,
  juntarCadernos,
  lerCaderno,
  planilhaDoAno,
  type Caderno as TipoCaderno,
  type VendaGuardada,
} from "@/lib/caderno";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function novoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function Caderno() {
  const [caderno, setCaderno] = useState<TipoCaderno>({ versao: 1, vendas: [] });
  const [carregado, setCarregado] = useState(false);
  const [guardou, setGuardou] = useState(true);
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<"mercadoria" | "servico">("mercadoria");
  const [empresa, setEmpresa] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [apagando, setApagando] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCaderno(carregarDoAparelho());
    setData(hoje());
    setCarregado(true);
  }, []);

  function mudar(novo: TipoCaderno) {
    setCaderno(novo);
    setGuardou(guardarNoAparelho(novo));
  }

  function anotar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setAviso(null);
    const lido = lerValor(valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Escolha a data da venda.");
    if (lido === null || Number(lido) === 0) return setErro("Digite o valor da venda. Exemplo: 80,50");
    const venda: VendaGuardada = {
      id: novoId(),
      data,
      valor: lido,
      tipo,
      compradorTemCnpj: empresa,
      descricao: descricao.trim().slice(0, 120),
    };
    mudar({ versao: 1, vendas: [...caderno.vendas, venda] });
    setAno(Number(data.slice(0, 4)));
    setValor("");
    setDescricao("");
    setAviso(`Venda de ${mostrarValor(lido)} anotada.`);
  }

  function apagar(id: string) {
    mudar({ versao: 1, vendas: caderno.vendas.filter((v) => v.id !== id) });
    setApagando(null);
    setAviso("Venda apagada.");
  }

  async function recuperar(evento: ChangeEvent<HTMLInputElement>) {
    const f = evento.target.files?.[0];
    evento.target.value = "";
    if (!f) return;
    setErro(null);
    try {
      const { caderno: lido, descartadas } = lerCaderno(await f.text());
      const junto = juntarCadernos(caderno, lido);
      mudar(junto);
      const novas = junto.vendas.length - caderno.vendas.length;
      setAviso(
        `${novas} ${novas === 1 ? "venda recuperada" : "vendas recuperadas"}.` +
          (descartadas > 0 ? ` ${descartadas} ${descartadas === 1 ? "linha ignorada" : "linhas ignoradas"} por estar fora do formato.` : ""),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler o arquivo.");
    }
  }

  const anos = useMemo(() => {
    const lista = new Set(caderno.vendas.map((v) => Number(v.data.slice(0, 4))));
    lista.add(new Date().getFullYear());
    lista.add(ano);
    return [...lista].sort((a, b) => b - a);
  }, [caderno, ano]);

  const resumo = useMemo(() => resumirVendas(caderno.vendas, ano), [caderno, ano]);

  const limite = useMemo(() => {
    if (!baseDeRegras.parametros.limiteMeiAnual[String(ano)] || resumo.totalDoAno.quantidade === 0) return null;
    const agora = new Date();
    const ultimoMesFechado = ano < agora.getFullYear() ? 12 : ano === agora.getFullYear() ? agora.getMonth() + 1 : 0;
    if (ultimoMesFechado === 0) return null;
    const receitas: ReceitaDoMes[] = [];
    for (const m of resumo.meses.slice(0, ultimoMesFechado)) {
      receitas.push({ mes: m.mes, tipo: "revenda_mercadoria", valor: m.mercadoria });
      receitas.push({ mes: m.mes, tipo: "servico", valor: m.servico });
    }
    return medirLimite({ anoCalendario: ano, temMei: true, receitas }, baseDeRegras.parametros);
  }, [resumo, ano]);

  const vendasDoAno = caderno.vendas
    .filter((v) => v.data.startsWith(`${ano}-`))
    .sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="guia">
      <h1>Caderno de vendas</h1>
      <p className="resumo">
        Anote cada venda ou serviço. No fim do ano, o caderno já mostra os números que a declaração
        anual do MEI pede.
      </p>
      <p className="aviso-local">
        As vendas ficam guardadas só neste celular ou computador. Ninguém mais vê, nem o ProContador. Salve
        uma cópia de vez em quando, para não perder se trocar de aparelho.
      </p>
      {carregado && !guardou && (
        <p className="erro" role="alert">
          Este navegador não está deixando guardar as vendas. Se fechar a página, elas se perdem. Salve
          uma cópia agora.
        </p>
      )}

      <form className="nova-venda" onSubmit={anotar} noValidate>
        <h2>Nova venda</h2>
        <div className="lado-a-lado campos">
          <label className="campo-uf">
            <span className="dica">Data</span>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label className="campo-uf">
            <span className="dica">Valor</span>
            <input inputMode="decimal" autoComplete="off" placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
        </div>
        <fieldset>
          <legend className="dica">O que você vendeu</legend>
          <div className="opcoes lado-a-lado">
            {(["mercadoria", "servico"] as const).map((t) => (
              <label key={t} className="opcao" data-marcado={tipo === t}>
                <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} />
                <span><strong>{t === "mercadoria" ? "Produto" : "Serviço"}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="dica">Para quem</legend>
          <div className="opcoes lado-a-lado">
            {[false, true].map((e) => (
              <label key={String(e)} className="opcao" data-marcado={empresa === e}>
                <input type="radio" name="para-quem" checked={empresa === e} onChange={() => setEmpresa(e)} />
                <span><strong>{e ? "Empresa" : "Pessoa física"}</strong></span>
              </label>
            ))}
          </div>
        </fieldset>
        {empresa && (
          <p className="observacao">
            Venda para empresa precisa de nota fiscal. Anote aqui e emita a nota também.{" "}
            <a className="ref" href="#regra-R34">(regra R34)</a>
          </p>
        )}
        <label className="campo-contato">
          <span>Descrição (opcional)</span>
          <input maxLength={120} placeholder="Ex.: perfume para a Ana" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        {aviso && <p className="confirmacao" role="status">{aviso}</p>}
        <div className="acoes">
          <button type="submit" className="principal">Anotar venda</button>
        </div>
      </form>

      <div className="lado-a-lado campos">
        <label className="campo-uf">
          <span className="dica">Ver o ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      <section className="declaracao" aria-labelledby="t-dasn">
        <h2 id="t-dasn">Para a declaração anual de {ano}</h2>
        <p className="dica">
          Entregue até 31 de maio de {ano + 1}. <a className="ref" href="#regra-R33">(regra R33)</a>
        </p>
        <dl className="conta">
          <div><dt>Revenda de mercadorias (comércio)</dt><dd>{mostrarValor(resumo.totalDoAno.mercadoria)}</dd></div>
          <div><dt>Prestação de serviços</dt><dd>{mostrarValor(resumo.totalDoAno.servico)}</dd></div>
          <div className="total"><dt>Receita bruta total</dt><dd>{mostrarValor(resumo.totalDoAno.total)}</dd></div>
        </dl>
        <p className="observacao">
          A declaração também pergunta se você teve empregado no ano. Isso o caderno não sabe, responda na hora.
        </p>
        {resumo.totalDoAno.vendasParaEmpresa > 0 && (
          <p className="observacao">
            {resumo.totalDoAno.vendasParaEmpresa}{" "}
            {resumo.totalDoAno.vendasParaEmpresa === 1 ? "venda foi para empresa" : "vendas foram para empresa"} neste
            ano. Confira se a nota fiscal de cada uma foi emitida.
          </p>
        )}
      </section>

      {limite && (
        <section aria-labelledby="t-limite">
          <h2 id="t-limite">Limite do MEI em {ano}</h2>
          <div className="medidor" role="img" aria-label={`Você já usou ${limite.percentualUsado}% do limite.`}>
            <div className="medidor-uso" style={{ width: `${Math.min(Number(limite.percentualUsado), 100)}%` }} />
          </div>
          <p className="medidor-legenda">
            Já usado: {limite.percentualUsado.replace(".", ",")}% de {mostrarValor(limite.limite)}
          </p>
          <p>
            {limite.mesQueEstoura === null
              ? "No ritmo das vendas anotadas, você fecha o ano dentro do limite."
              : limite.estouroConfirmado
                ? `Pelas vendas anotadas, você passou do limite em ${MESES[limite.mesQueEstoura - 1]}. Fale com um contador.`
                : `No ritmo das vendas anotadas, você passa do limite em ${MESES[limite.mesQueEstoura - 1]}.`}
          </p>
          <p className="observacao">
            Meses sem venda anotada contam como zero. Se você começou a usar o caderno no meio do ano,
            anote também as vendas dos meses anteriores.
          </p>
        </section>
      )}

      <section aria-labelledby="t-vendas">
        <h2 id="t-vendas">Vendas de {ano}</h2>
        {vendasDoAno.length === 0 ? (
          <p>Nenhuma venda anotada em {ano}. Use o formulário acima para anotar a primeira.</p>
        ) : (
          resumo.meses
            .filter((m) => m.quantidade > 0)
            .reverse()
            .map((m) => (
              <div key={m.mes} className="mes-vendas">
                <h3>
                  <span>{MESES[m.mes - 1]}</span>
                  <span>{mostrarValor(m.total)}</span>
                </h3>
                <ul>
                  {vendasDoAno
                    .filter((v) => Number(v.data.slice(5, 7)) === m.mes)
                    .map((v) => (
                      <li key={v.id}>
                        <span className="venda-info">
                          <strong>{v.descricao || (v.tipo === "mercadoria" ? "Produto" : "Serviço")}</strong>
                          <small>
                            {v.data.slice(8, 10)}/{v.data.slice(5, 7)}, {v.tipo === "mercadoria" ? "produto" : "serviço"},{" "}
                            {v.compradorTemCnpj ? "empresa" : "pessoa física"}
                          </small>
                        </span>
                        <span className="venda-valor">{mostrarValor(v.valor)}</span>
                        {apagando === v.id ? (
                          <span className="venda-acoes">
                            <button type="button" className="secundario perigo" onClick={() => apagar(v.id)}>Apagar mesmo</button>
                            <button type="button" className="secundario" onClick={() => setApagando(null)}>Manter</button>
                          </span>
                        ) : (
                          <button type="button" className="secundario" onClick={() => setApagando(v.id)}>Apagar</button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))
        )}
      </section>

      <section aria-labelledby="t-copia">
        <h2 id="t-copia">Cópias</h2>
        <div className="acoes">
          <button type="button" className="secundario" onClick={() => baixar(`vendas-${ano}.csv`, "﻿" + planilhaDoAno(caderno, ano), "text/csv;charset=utf-8")}>
            Baixar a planilha de {ano}
          </button>
          <button type="button" className="secundario" onClick={() => baixar(`caderno-procontador-${hoje()}.json`, JSON.stringify(caderno), "application/json")}>
            Salvar cópia do caderno
          </button>
          <button type="button" className="secundario" onClick={() => arquivo.current?.click()}>
            Recuperar uma cópia
          </button>
          <input ref={arquivo} type="file" accept="application/json,.json" hidden onChange={recuperar} />
        </div>
      </section>

      <details className="fontes">
        <summary>De onde tiramos isso</summary>
        <ul>
          {(["R33", "R34"] as const).map((id) => {
            const r = baseDeRegras.regras.find((x) => x.id === id)!;
            return (
              <li key={id} id={`regra-${id}`}>
                <p><strong>Regra {id}.</strong> {r.regra}</p>
                <p className="fonte">Fonte: {r.fonte}. Em conferência pelo contador.</p>
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
