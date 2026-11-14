"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { somar } from "@/lib/cofre/valores";
import { mostrarValor } from "@/lib/dinheiro";

export interface NotaGuardada {
  id: string;
  chave: string;
  origem: "xml" | "chave";
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  numero: string | null;
  dataEmissao: string | null;
  valorTotal: string | null;
  valorIcmsSt: string | null;
  itens: { descricao: string; ncm: string | null; valor: string; comSt: boolean; situacaoIcms: string | null }[];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function mostrarCnpj(c: string | null): string {
  if (!c) return "sem CNPJ";
  if (c.length === 11) return `CPF final ${c.slice(-4)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function nomeDoFornecedor(n: Pick<NotaGuardada, "emitenteNome" | "emitenteCnpj">): string {
  return n.emitenteNome ?? `Fornecedor ${mostrarCnpj(n.emitenteCnpj)}`;
}

export function anoDaNota(n: NotaGuardada): number | null {
  if (n.dataEmissao) return Number(n.dataEmissao.slice(0, 4));
  return 2000 + Number(n.chave.slice(2, 4));
}

function mesDaNota(n: NotaGuardada): number {
  return n.dataEmissao ? Number(n.dataEmissao.slice(5, 7)) : Number(n.chave.slice(4, 6));
}

export function useNotas() {
  const [notas, setNotas] = useState<NotaGuardada[] | null>(null);
  const [semConta, setSemConta] = useState(false);
  const [falhou, setFalhou] = useState(false);
  async function recarregar() {
    try {
      const r = await fetch("/api/cofre", { cache: "no-store" });
      if (r.status === 401 || r.status === 503) return setSemConta(true);
      if (!r.ok) return setFalhou(true);
      setNotas(((await r.json()) as { notas: NotaGuardada[] }).notas);
    } catch {
      setFalhou(true);
    }
  }
  useEffect(() => {
    void recarregar();
  }, []);
  return { notas, semConta, falhou, recarregar };
}

async function detalhe(r: Response): Promise<string> {
  const c = (await r.json().catch(() => null)) as { detail?: string } | null;
  return c?.detail ?? "Não deu certo. Tente de novo.";
}

export function Cofre() {
  const { notas, semConta, falhou, recarregar } = useNotas();
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [chave, setChave] = useState("");
  const [mensagens, setMensagens] = useState<{ tipo: "ok" | "erro"; texto: string }[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  const doAno = useMemo(() => (notas ?? []).filter((n) => anoDaNota(n) === ano), [notas, ano]);
  const anos = useMemo(() => {
    const s = new Set((notas ?? []).map(anoDaNota).filter((a): a is number => a !== null));
    s.add(new Date().getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [notas]);

  const porFornecedor = useMemo(() => {
    const grupos = new Map<string, { nome: string; cnpj: string | null; meses: (string | null)[][]; total: (string | null)[] }>();
    for (const n of doAno) {
      const k = n.emitenteCnpj ?? n.emitenteNome ?? "?";
      const g = grupos.get(k) ?? { nome: nomeDoFornecedor(n), cnpj: n.emitenteCnpj, meses: Array.from({ length: 12 }, () => []), total: [] };
      if (n.emitenteNome) g.nome = n.emitenteNome;
      g.meses[mesDaNota(n) - 1]!.push(n.valorTotal);
      g.total.push(n.valorTotal);
      grupos.set(k, g);
    }
    return [...grupos.values()].sort((a, b) => Number(somar(b.total)) - Number(somar(a.total)));
  }, [doAno]);

  const semValor = doAno.filter((n) => n.valorTotal === null).length;

  async function enviar(corpo: object): Promise<string | null> {
    const r = await fetch("/api/cofre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);
    if (!r) return "Sem conexão.";
    if (!r.ok) return detalhe(r);
    return null;
  }

  async function aoEscolherArquivos(e: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(e.target.files ?? [])].slice(0, 50);
    e.target.value = "";
    if (arquivos.length === 0) return;
    setEnviando(true);
    const novas: typeof mensagens = [];
    let guardadas = 0;
    for (const f of arquivos) {
      if (f.size > 1_048_576) {
        novas.push({ tipo: "erro", texto: `${f.name}: passa de 1 MB, não parece o XML de uma nota.` });
        continue;
      }
      const erro = await enviar({ xml: await f.text() });
      if (erro) novas.push({ tipo: "erro", texto: `${f.name}: ${erro}` });
      else guardadas++;
    }
    if (guardadas) novas.unshift({ tipo: "ok", texto: guardadas === 1 ? "1 nota guardada." : `${guardadas} notas guardadas.` });
    setMensagens(novas);
    setEnviando(false);
    await recarregar();
  }

  async function aoGuardarChave(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const erro = await enviar({ chave });
    setEnviando(false);
    setMensagens([erro ? { tipo: "erro", texto: erro } : { tipo: "ok", texto: "Chave guardada. Se tiver o XML dessa nota, mande também." }]);
    if (!erro) {
      setChave("");
      await recarregar();
    }
  }

  async function apagar(id: string) {
    const r = await fetch(`/api/cofre?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) return setMensagens([{ tipo: "erro", texto: "Não conseguimos apagar essa nota agora." }]);
    await recarregar();
  }

  if (semConta) {
    return (
      <div className="guia">
        <h1>Cofre de notas</h1>
        <p className="resumo">
          Guarde aqui as notas das compras que você faz da marca. Elas provam de onde veio cada produto e você
          precisa guardar por cinco anos.
        </p>
        <p>
          O cofre fica na sua conta, para não se perder.{" "}
          <Link className="botao" href="/entrar?voltar=/cofre">Entrar com o celular</Link>
        </p>
      </div>
    );
  }
  if (falhou) return <p className="erro" role="alert">Não conseguimos abrir o cofre agora. Recarregue a página.</p>;
  if (!notas) return <p className="carregando">Abrindo o cofre…</p>;

  return (
    <div className="guia">
      <h1>Cofre de notas</h1>
      <p className="resumo">
        Guarde as notas das compras que você faz da marca. Elas provam de onde veio cada produto. O MEI precisa
        guardar as notas por cinco anos (<a href="#regra-R22">regra R22</a>).
      </p>

      <section aria-labelledby="t-incluir">
        <h2 id="t-incluir">Incluir notas</h2>
        <p>
          O melhor é o arquivo XML da nota. A marca manda por e-mail ou deixa no site de pedidos. Pode escolher
          vários de uma vez.
        </p>
        <div className="acoes">
          <button type="button" className="principal" disabled={enviando} onClick={() => arquivo.current?.click()}>
            {enviando ? "Guardando…" : "Escolher arquivos XML"}
          </button>
          <input ref={arquivo} type="file" accept=".xml,text/xml,application/xml" multiple hidden onChange={aoEscolherArquivos} />
        </div>
        <form onSubmit={aoGuardarChave} noValidate>
          <label className="campo-contato">
            <span>Não tem o XML? Cole a chave de acesso (44 caracteres, fica embaixo do código de barras do DANFE)</span>
            <input value={chave} onChange={(e) => setChave(e.target.value)} inputMode="text" autoComplete="off" />
          </label>
          <div className="acoes">
            <button type="submit" className="secundario" disabled={enviando || chave.trim().length < 44}>Guardar a chave</button>
          </div>
        </form>
        <div aria-live="polite">
          {mensagens.map((m, i) => (
            <p key={i} className={m.tipo === "erro" ? "erro" : "aviso-local"}>{m.texto}</p>
          ))}
        </div>
      </section>

      <section aria-labelledby="t-compras">
        <h2 id="t-compras">Compras de {ano}</h2>
        <label className="campo-uf">
          <span>Ano</span>
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        {doAno.length === 0 ? (
          <p>Nenhuma nota de {ano} no cofre ainda.</p>
        ) : (
          <>
            <p>
              {doAno.length} {doAno.length === 1 ? "nota" : "notas"}, total de{" "}
              <strong>{mostrarValor(somar(doAno.map((n) => n.valorTotal)))}</strong>.
              {semValor > 0 && ` ${semValor} guardada${semValor > 1 ? "s" : ""} só pela chave, sem valor.`}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table className="tabela">
                <caption className="visualmente-oculto">Compras por fornecedor e mês</caption>
                <thead>
                  <tr>
                    <th scope="col">Fornecedor</th>
                    {MESES.map((m) => <th key={m} scope="col" className="valor">{m}</th>)}
                    <th scope="col" className="valor">Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {porFornecedor.map((g) => (
                    <tr key={g.cnpj ?? g.nome}>
                      <th scope="row">{g.nome}</th>
                      {g.meses.map((m, i) => (
                        <td key={i} className="valor">{m.length ? mostrarValor(somar(m)) : ""}</td>
                      ))}
                      <td className="valor"><strong>{mostrarValor(somar(g.total))}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="acoes">
              <Link className="botao" href={`/cofre/dossie?ano=${ano}`}>Dossiê de {ano} para imprimir</Link>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="t-notas">
        <h2 id="t-notas">Notas guardadas</h2>
        {doAno.map((n) => (
          <article key={n.id} className="nota">
            <h3>
              {nomeDoFornecedor(n)}
              {n.itens.some((i) => i.comSt) && <span className="selo-st" title="A nota indica ICMS por substituição tributária">ICMS-ST</span>}
            </h3>
            <p>
              Nota {n.numero ?? "?"}
              {n.dataEmissao ? ` de ${new Date(`${n.dataEmissao}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
              {n.valorTotal ? `, ${mostrarValor(n.valorTotal)}` : ", guardada só pela chave"}
            </p>
            <div className="acoes">
              {n.itens.length > 0 && (
                <button type="button" className="secundario" onClick={() => setAberta(aberta === n.id ? null : n.id)} aria-expanded={aberta === n.id}>
                  {aberta === n.id ? "Esconder itens" : `Ver ${n.itens.length} ${n.itens.length === 1 ? "item" : "itens"}`}
                </button>
              )}
              {n.origem === "xml" && <a className="secundario" href={`/api/cofre/xml?id=${n.id}`}>Baixar o XML</a>}
              <button type="button" className="secundario perigo" onClick={() => apagar(n.id)}>Apagar</button>
            </div>
            {aberta === n.id && (
              <table className="tabela">
                <thead><tr><th scope="col">Item</th><th scope="col">NCM</th><th scope="col">ICMS</th><th scope="col" className="valor">Valor</th></tr></thead>
                <tbody>
                  {n.itens.map((i, k) => (
                    <tr key={k}>
                      <td>{i.descricao}</td>
                      <td>{i.ncm ?? ""}</td>
                      <td>{i.comSt ? "com ST" : i.situacaoIcms ?? ""}</td>
                      <td className="valor">{mostrarValor(i.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        ))}
      </section>

      <details className="fontes" id="regra-R22">
        <summary>De onde tiramos isso</summary>
        <p><strong>Regra R22.</strong> O MEI deve guardar as notas fiscais de compra e de venda por cinco anos. Fonte: Portal do Empreendedor. Em conferência pelo contador.</p>
        <p>
          O selo ICMS-ST só repete o que está escrito na nota do fornecedor. Se o ICMS do seu produto já foi pago por
          substituição tributária depende do produto e da lei de São Paulo, e isso ainda está sendo conferido
          (regra R28, pendente).
        </p>
      </details>
    </div>
  );
}
