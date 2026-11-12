import { rotuloDoStatus } from "@cnpjtec/conteudo";
import { buscarRegra } from "@cnpjtec/regras";

export interface RegraNaTela {
  id: string;
  regra: string;
  fonte: string;
  rotuloDoStatus: string;
  emRevisao: boolean;
}

/** Prepara as regras citadas numa página para a lista "De onde tiramos isso". */
export function citar(ids: string[]): RegraNaTela[] {
  return [...new Set(ids)].sort().map((id) => {
    const r = buscarRegra(id);
    return {
      id: r.id,
      regra: r.regra,
      fonte: r.fonte,
      rotuloDoStatus: rotuloDoStatus[r.status] ?? r.status,
      emRevisao: r.conferencia !== "OFICIAL" && r.conferencia !== "SEM_NORMA",
    };
  });
}

/**
 * Data de início ou de fim da vigência de uma regra, no formato brasileiro.
 * As páginas usam esta função para nunca escrever uma data legal à mão.
 */
export function dataDaRegra(id: string, qual: "inicio" | "fim"): string {
  const regra = buscarRegra(id);
  const iso = qual === "inicio" ? regra.vigenciaInicio : regra.vigenciaFim;
  if (!iso) throw new Error(`A regra ${id} não tem data de ${qual} cadastrada.`);
  const [ano, mes, dia] = iso.split("-");
  return `${Number(dia)}/${Number(mes)}/${ano}`;
}
