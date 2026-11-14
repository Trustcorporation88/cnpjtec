"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { somar } from "@/lib/cofre/valores";
import { mostrarValor } from "@/lib/dinheiro";
import { anoDaNota, mostrarCnpj, nomeDoFornecedor, useNotas } from "./Cofre";

/** Dossiê de origem da mercadoria: lista das notas de compra do ano, pronta para imprimir ou salvar em PDF. */
export function Dossie() {
  const { notas, semConta, falhou } = useNotas();
  const [ano, setAno] = useState<number | null>(null);
  const [telefone, setTelefone] = useState<string | null>(null);

  useEffect(() => {
    const a = Number(new URLSearchParams(location.search).get("ano"));
    setAno(a >= 2000 && a <= 2100 ? a : new Date().getFullYear());
    fetch("/api/conta", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ conta: { telefone: string } | null }>)
      .then((e) => setTelefone(e.conta?.telefone ?? null))
      .catch(() => null);
  }, []);

  const doAno = useMemo(
    () =>
      (notas ?? [])
        .filter((n) => anoDaNota(n) === ano)
        .sort((a, b) => (a.dataEmissao ?? a.chave.slice(2, 6)).localeCompare(b.dataEmissao ?? b.chave.slice(2, 6))),
    [notas, ano],
  );

  if (semConta) return <p>Entre na conta para ver o dossiê. <Link href="/entrar?voltar=/cofre">Entrar</Link></p>;
  if (falhou) return <p className="erro" role="alert">Não conseguimos montar o dossiê agora.</p>;
  if (!notas || ano === null) return <p className="carregando">Montando o dossiê…</p>;

  return (
    <div className="guia dossie">
      <div className="acoes nao-imprimir">
        <button type="button" className="principal" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>
        <Link className="secundario" href="/cofre">Voltar ao cofre</Link>
      </div>
      <h1>Notas de compra de {ano}</h1>
      <p>
        Relação das notas fiscais de compra guardadas no Cofre do ProContador
        {telefone ? ` pela conta do celular final ${telefone.slice(-4)}` : ""}, para comprovar a origem das mercadorias
        revendidas. Gerado em {new Date().toLocaleDateString("pt-BR")}.
      </p>
      <p>
        <strong>{doAno.length}</strong> notas, total de <strong>{mostrarValor(somar(doAno.map((n) => n.valorTotal)))}</strong>.
      </p>
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Fornecedor</th>
            <th scope="col">Nota</th>
            <th scope="col">Chave de acesso</th>
            <th scope="col" className="valor">Valor</th>
          </tr>
        </thead>
        <tbody>
          {doAno.map((n) => (
            <tr key={n.id}>
              <td>{n.dataEmissao ? new Date(`${n.dataEmissao}T12:00:00`).toLocaleDateString("pt-BR") : `${n.chave.slice(4, 6)}/20${n.chave.slice(2, 4)}`}</td>
              <td>{nomeDoFornecedor(n)}<br /><small>{mostrarCnpj(n.emitenteCnpj)}</small></td>
              <td>{n.numero ?? ""}</td>
              <td><small style={{ wordBreak: "break-all" }}>{n.chave}</small></td>
              <td className="valor">{n.valorTotal ? mostrarValor(n.valorTotal) : "só a chave"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Cada nota pode ser conferida pela chave de acesso no Portal da Nota Fiscal Eletrônica
        (www.nfe.fazenda.gov.br, consulta pública). Os arquivos XML originais estão guardados no cofre e podem ser
        entregues quando pedidos.
      </p>
    </div>
  );
}
