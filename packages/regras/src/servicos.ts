import { z } from "zod";
import dados from "../dados/servicos-nfse.json";

/**
 * Tabela oficial de serviços para a NFS-e na Reforma Tributária: item da LC 116 (código de
 * tributação nacional), NBS, indicador de operação (cIndOp) e situação e classificação
 * tributária do IBS e da CBS (CST e cClassTrib). Gerada do banco da calculadora oficial da
 * Receita Federal por servicos/calculadora-rtc/gerar_servicos_nfse.py.
 */
const Indicador = z.object({ tipoOperacao: z.string(), localIncidencia: z.string() }).strict();
const Classificacao = z.object({ cst: z.string(), cstDescricao: z.string(), descricao: z.string() }).strict();
const Nbs = z
  .object({
    codigo: z.string().regex(/^\d+$/),
    descricao: z.string().min(1),
    cIndOp: z.array(z.string().regex(/^\d{6}$/)).min(1),
    cClassTrib: z.array(z.string().regex(/^\d{6}$/)).min(1),
  })
  .strict();
const Item = z
  .object({ codigo: z.string().regex(/^\d+(\.\d+)*$/), descricao: z.string(), nbs: z.array(Nbs).min(1) })
  .strict();
export const TabelaDeServicos = z
  .object({
    fonte: z.string(),
    commit: z.string().regex(/^([0-9a-f]{40}|pacote oficial \S+)$/),
    versaoBase: z.object({ versao: z.string(), data: z.string(), descricao: z.string() }).strict(),
    dataReferencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    indicadores: z.record(z.string(), Indicador),
    classificacoes: z.record(z.string(), Classificacao),
    itens: z.array(Item).min(1),
  })
  .strict()
  .superRefine((t, ctx) => {
    for (const item of t.itens) {
      for (const n of item.nbs) {
        for (const c of n.cIndOp) {
          if (!t.indicadores[c]) ctx.addIssue({ code: "custom", message: `cIndOp ${c} sem descrição` });
        }
        for (const c of n.cClassTrib) {
          if (!t.classificacoes[c]) ctx.addIssue({ code: "custom", message: `cClassTrib ${c} sem descrição` });
        }
      }
    }
  });
export type TabelaDeServicos = z.infer<typeof TabelaDeServicos>;

export const tabelaDeServicos: TabelaDeServicos = TabelaDeServicos.parse(dados);

export interface CodigosDoServico {
  item: { codigo: string; descricao: string };
  nbs: { codigo: string; descricao: string };
  operacoes: { cIndOp: string; tipoOperacao: string; localIncidencia: string }[];
  tributacao: { cst: string; cstDescricao: string; cClassTrib: string; descricao: string }[];
}

/** Sem acento, minúsculo, só letras e números. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

const PALAVRAS_VAZIAS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os", "para", "com", "por", "no", "na",
  "nos", "nas", "um", "uma", "servico", "servicos", "eu", "faco", "trabalho", "sou", "presto", "meu", "minha",
]);

/** Raiz grosseira para casar plural, singular e gênero: "cabeleireiras" ~ "cabeleireiros". */
function raiz(palavra: string): string {
  if (palavra.length <= 4) return palavra;
  if (palavra.endsWith("coes")) palavra = `${palavra.slice(0, -4)}cao`;
  const singular = palavra.replace(/(oes|aes|ais|eis|res|s)$/, (m) => (m === "res" ? "r" : ""));
  return singular.length > 5 ? singular.replace(/[aoe]$/, "") : singular;
}

/**
 * Palavras do dia a dia ligadas às palavras que a tabela oficial usa. Liga palavras, nunca códigos:
 * o código continua saindo só da tabela da Receita.
 */
const SINONIMOS: Record<string, string[]> = {
  celular: ["eletroeletronico", "telefone"],
  conserto: ["reparacao", "manutencao"],
  concerto: ["reparacao", "manutencao"],
  arrumar: ["reparacao", "manutencao"],
  faxina: ["limpeza"],
  diarista: ["limpeza"],
  pedreiro: ["edificacao", "residencial", "construcao"],
  obra: ["construcao"],
  reforma: ["construcao", "reparacao"],
  pintor: ["pintura"],
  eletricista: ["eletrica", "instalacao"],
  encanador: ["hidraulica", "instalacao"],
  aula: ["ensino", "educacao", "treinamento"],
  professor: ["ensino", "educacao"],
  curso: ["ensino", "treinamento", "educacao"],
  software: ["programa", "aplicativo"],
  sistema: ["programa", "aplicativo"],
  site: ["pagina", "eletronico"],
  personal: ["desportiva", "condicionamento", "fisico"],
  academia: ["desportiva", "condicionamento", "fisico"],
  manicure: ["manicure", "pedicure"],
  unha: ["manicure", "pedicure"],
  cabelo: ["cabeleireiro", "barbeiro"],
  barba: ["barbeiro"],
  estetica: ["beleza", "cosmetico"],
  maquiagem: ["beleza", "cosmetico"],
  massagem: ["beleza", "bem-estar", "fisico"],
  motorista: ["motorista", "passageiro", "transporte"],
  uber: ["motorista", "passageiro", "transporte"],
  frete: ["transporte", "carga"],
  mudanca: ["mudanca", "transporte"],
  entregador: ["entrega", "coleta"],
  motoboy: ["entrega", "coleta"],
  costura: ["confeccao", "vestuario"],
  costureira: ["confeccao", "vestuario"],
  bolo: ["buffet", "alimentacao"],
  festa: ["evento", "buffet"],
  designer: ["design"],
  contador: ["contabilidade", "contabil"],
  advogado: ["juridico", "advocacia"],
  psicologo: ["psicologia"],
  dentista: ["odontologia", "odontologico"],
  veterinario: ["veterinaria"],
  pet: ["animal", "adestramento", "embelezamento"],
  banho: ["embelezamento", "animal"],
  cachorro: ["animal", "adestramento", "embelezamento"],
  gato: ["animal", "adestramento", "embelezamento"],
};

function montar(item: TabelaDeServicos["itens"][number], nbs: TabelaDeServicos["itens"][number]["nbs"][number]): CodigosDoServico {
  return {
    item: { codigo: item.codigo, descricao: item.descricao },
    nbs: { codigo: nbs.codigo, descricao: nbs.descricao },
    operacoes: nbs.cIndOp.map((c) => ({ cIndOp: c, ...tabelaDeServicos.indicadores[c]! })),
    tributacao: nbs.cClassTrib.map((c) => {
      const cl = tabelaDeServicos.classificacoes[c]!;
      return { cst: cl.cst, cstDescricao: cl.cstDescricao, cClassTrib: c, descricao: cl.descricao };
    }),
  };
}

const indice = tabelaDeServicos.itens.flatMap((item) =>
  item.nbs.map((nbs) => ({
    item,
    nbs,
    palavras: new Set(
      normalizar(`${item.descricao} ${nbs.descricao}`)
        .split(" ")
        .filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p))
        .map(raiz),
    ),
    textoNbs: normalizar(nbs.descricao),
  })),
);

/**
 * Procura os códigos da nota pelo que a pessoa faz ("manicure", "conserto de celular") ou pelo
 * código ("6.01", "126022000"). Devolve os pares item/NBS mais parecidos, do mais ao menos provável.
 */
export function buscarServicos(consulta: string, limite = 5): CodigosDoServico[] {
  const texto = normalizar(consulta);
  if (!texto) return [];
  if (/^\d+(\.\d+)+$/.test(texto)) {
    const item = tabelaDeServicos.itens.find((i) => i.codigo === texto);
    return item ? item.nbs.slice(0, limite).map((n) => montar(item, n)) : [];
  }
  if (/^\d{6,9}$/.test(texto)) {
    return indice.filter((e) => e.nbs.codigo === texto).slice(0, limite).map((e) => montar(e.item, e.nbs));
  }
  const palavras = [...new Set(texto.split(" ").filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p)))];
  if (palavras.length === 0) return [];
  // Cada palavra vale pela melhor das suas formas: ela mesma ou um sinônimo da tabela oficial.
  const grupos = palavras.map((p) => [...new Set([p, ...(SINONIMOS[p] ?? SINONIMOS[raiz(p)] ?? [])].map(raiz))]);
  const casa = (palavras: Set<string>, t: string) =>
    palavras.has(t) ? 3 : t.length >= 5 && [...palavras].some((p) => p.length >= 5 && (p.startsWith(t) || t.startsWith(p))) ? 1 : 0;
  return indice
    .map((e) => {
      let nota = 0;
      let achadas = 0;
      for (const g of grupos) {
        // A palavra digitada e o primeiro sinônimo valem mais que os demais.
        const melhor = Math.max(...g.map((t, i) => Math.max(0, casa(e.palavras, t) - (i >= 2 ? 1 : 0))));
        nota += melhor;
        if (melhor > 0) achadas += 1;
      }
      // Prefere a NBS que descreve o serviço, não só o item genérico da LC 116.
      if (grupos.some((g) => g.some((t) => e.textoNbs.includes(t)))) nota += 1;
      return { e, nota, achadas };
    })
    .filter((r) => r.nota >= 3 && r.achadas >= Math.ceil(grupos.length / 2))
    .sort((a, b) => b.nota - a.nota || a.e.nbs.descricao.length - b.e.nbs.descricao.length)
    .slice(0, limite)
    .map((r) => montar(r.e.item, r.e.nbs));
}
