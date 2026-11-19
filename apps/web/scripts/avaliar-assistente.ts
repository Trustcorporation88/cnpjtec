/**
 * Roda a bateria de perguntas na assistente de verdade (precisa de ANTHROPIC_API_KEY) e confere
 * cada resposta. Sai com erro se menos de 90% dos casos passarem.
 * Uso: pnpm --filter @cnpjtec/web avaliar   (opcional: CASOS=uber-1,manicure-mei)
 */
import { CASOS } from "../lib/ia/avaliacao/casos";
import { conferir } from "../lib/ia/avaliacao/conferir";
import { conversar } from "../lib/ia/assistente";

const filtro = process.env.CASOS?.split(",").map((s) => s.trim());
const casos = filtro ? CASOS.filter((c) => filtro.includes(c.id)) : CASOS;
const linhas: string[] = [];
let passou = 0;

for (const caso of casos) {
  const ferramentas: string[] = [];
  let resposta = "";
  try {
    resposta = await conversar([{ role: "user", content: caso.pergunta }], {
      canal: "whatsapp",
      aoUsarFerramenta: (nome) => ferramentas.push(nome),
    });
  } catch (e) {
    resposta = `ERRO: ${e instanceof Error ? e.message : String(e)}`;
  }
  const falhas = resposta.startsWith("ERRO:") ? [resposta] : conferir(caso, resposta, ferramentas);
  if (falhas.length === 0) passou++;
  linhas.push(`${falhas.length === 0 ? "ok  " : "FALHA"} ${caso.id} [${ferramentas.join(", ") || "sem ferramenta"}]${falhas.length ? `\n      ${falhas.join("\n      ")}` : ""}`);
  console.log(linhas.at(-1));
}

const taxa = casos.length ? passou / casos.length : 1;
const resumo = `\nResultado: ${passou} de ${casos.length} (${Math.round(taxa * 100)}%)`;
console.log(resumo);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, "```\n" + linhas.join("\n") + resumo + "\n```\n");
}
process.exit(taxa >= 0.9 ? 0 : 1);
