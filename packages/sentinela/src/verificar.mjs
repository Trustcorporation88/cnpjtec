// Lê as fontes oficiais, compara com a última leitura e escreve os achados.
// Uso: node src/verificar.mjs <arquivo-de-estado.json> <arquivo-de-achados.json>
import { readFile, writeFile } from "node:fs/promises";
import { comparar, normalizar, resumo } from "./comparar.mjs";

const [arquivoEstado = "estado.json", arquivoAchados = "achados.json"] = process.argv.slice(2);
/** @type {import("./comparar.mjs").Fonte[]} */
const fontes = JSON.parse(await readFile(new URL("./fontes.json", import.meta.url), "utf8"));

/** @type {Record<string, import("./comparar.mjs").Leitura>} */
let antes = {};
try {
  antes = JSON.parse(await readFile(arquivoEstado, "utf8"));
} catch {
  console.log("Primeira leitura: nada para comparar ainda.");
}

/** @type {Record<string, import("./comparar.mjs").Leitura>} */
const agora = {};
for (const f of fontes) {
  try {
    const r = await fetch(f.url, {
      headers: { "User-Agent": "MEiSHOP-sentinela/0.1 (monitoramento de legislação)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    agora[f.id] = { estado: "ok", resumo: resumo(normalizar(await r.text())) };
  } catch (e) {
    agora[f.id] = { estado: "erro", detalhe: e instanceof Error ? e.message : String(e) };
  }
  const l = agora[f.id];
  console.log(`${f.id}: ${l?.estado === "ok" ? "lida" : `não lida (${l?.estado === "erro" ? l.detalhe : ""})`}`);
}

const achados = comparar(fontes, antes, agora);
await writeFile(arquivoEstado, JSON.stringify(agora, null, 2));
await writeFile(arquivoAchados, JSON.stringify(achados, null, 2));
console.log(`${achados.length} achado(s).`);
