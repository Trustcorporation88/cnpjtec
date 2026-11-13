import { createHash } from "node:crypto";

/**
 * Reduz uma página ao texto que importa, para que mudança de propaganda, data de acesso
 * ou script não pareça mudança de norma.
 * @param {string} html
 * @returns {string}
 */
export function normalizar(html) {
  const corpo = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  return corpo
    .replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} texto */
export function resumo(texto) {
  return createHash("sha256").update(texto).digest("hex");
}

/**
 * @typedef {{ id: string, nome: string, url: string, regras: string[] }} Fonte
 * @typedef {{ estado: "ok", resumo: string } | { estado: "erro", detalhe: string }} Leitura
 * @typedef {{ id: string, nome: string, url: string, regras: string[], tipo: "mudou" | "voltou" | "parou" }} Achado
 */

/**
 * Compara a leitura de hoje com a anterior. Só gera achado quando algo muda,
 * para não abrir o mesmo aviso todo dia.
 * @param {Fonte[]} fontes
 * @param {Record<string, Leitura>} antes
 * @param {Record<string, Leitura>} agora
 * @returns {Achado[]}
 */
export function comparar(fontes, antes, agora) {
  /** @type {Achado[]} */
  const achados = [];
  for (const f of fontes) {
    const a = antes[f.id];
    const b = agora[f.id];
    if (!a || !b) continue;
    const base = { id: f.id, nome: f.nome, url: f.url, regras: f.regras };
    if (a.estado === "ok" && b.estado === "ok" && a.resumo !== b.resumo) achados.push({ ...base, tipo: "mudou" });
    else if (a.estado === "ok" && b.estado === "erro") achados.push({ ...base, tipo: "parou" });
    else if (a.estado === "erro" && b.estado === "ok") achados.push({ ...base, tipo: "voltou" });
  }
  return achados;
}

/**
 * Texto do aviso para o contador.
 * @param {Achado} achado
 */
export function textoDoAviso(achado) {
  const motivo = {
    mudou: "O texto desta página mudou desde a última verificação.",
    parou: "Esta página deixou de responder. Pode ter saído do ar ou mudado de endereço.",
    voltou: "Esta página voltou a responder. Vale reler, porque não sabemos o que mudou enquanto esteve fora.",
  }[achado.tipo];
  return [
    motivo,
    "",
    `Página: ${achado.url}`,
    `Regras que dependem dela: ${achado.regras.join(", ")}`,
    "",
    "O que fazer:",
    "1. Abrir a página e ver o que mudou.",
    "2. Se mudou alguma regra, abrir um PR em `packages/regras/dados/regras.json` com a fonte e o trecho.",
    "3. Se não mudou nada que importe, fechar este aviso.",
    "",
    "A sentinela nunca altera regra sozinha.",
  ].join("\n");
}
