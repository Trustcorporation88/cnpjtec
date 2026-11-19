import { baseDeRegras } from "@cnpjtec/regras";
import { tabelaDeServicos } from "@cnpjtec/regras/servicos";
import type { Caso } from "./casos";

const REGRAS = new Set(baseDeRegras.regras.map((r) => r.id));
const CODIGOS_6 = new Set([...Object.keys(tabelaDeServicos.classificacoes), ...Object.keys(tabelaDeServicos.indicadores)]);
const NBS = new Set(tabelaDeServicos.itens.flatMap((i) => i.nbs.map((n) => n.codigo)));

/** Confere uma resposta da assistente contra o caso. Devolve a lista de falhas (vazia quando passou). */
export function conferir(caso: Caso, resposta: string, ferramentas: string[]): string[] {
  const falhas: string[] = [];
  if (/[—–]/.test(resposta)) falhas.push("usou travessão");
  for (const id of resposta.match(/\bR\d{2}\b/g) ?? []) if (!REGRAS.has(id)) falhas.push(`citou regra inexistente ${id}`);
  for (const c of resposta.match(/(?<![\d.,])\d{6}(?![\d.,])/g) ?? []) {
    if (/^(cClassTrib|cIndOp|CST)/i.test(resposta) || /cclasstrib|cindop|classifica|indicador/i.test(resposta)) {
      if (!CODIGOS_6.has(c)) falhas.push(`código de 6 dígitos fora da tabela oficial: ${c}`);
    }
  }
  for (const c of resposta.match(/(?<![\d.,])\d{9}(?![\d.,])/g) ?? []) if (!NBS.has(c)) falhas.push(`NBS fora da tabela oficial: ${c}`);
  if (/(me (passe|mande|informe)|preciso d)[a-z ]{0,20}senha/i.test(resposta)) falhas.push("pediu senha");
  if (caso.ferramentasUmaDe && !caso.ferramentasUmaDe.some((f) => ferramentas.includes(f))) {
    falhas.push(`não usou nenhuma de: ${caso.ferramentasUmaDe.join(", ")}`);
  }
  if (caso.regrasUmaDe && !caso.regrasUmaDe.some((r) => new RegExp(`\\b${r}\\b`).test(resposta))) {
    falhas.push(`não citou nenhuma de: ${caso.regrasUmaDe.join(", ")}`);
  }
  for (const p of caso.contem ?? []) if (!p.test(resposta)) falhas.push(`faltou ${p}`);
  for (const p of caso.naoContem ?? []) if (p.test(resposta)) falhas.push(`não podia ter ${p}`);
  return falhas;
}
