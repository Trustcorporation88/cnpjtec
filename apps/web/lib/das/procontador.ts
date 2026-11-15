import { z } from "zod";
import { configuracaoBothub, consultarRobo, ErroBothub, guiasDoExtrato, lerExtrato, lerPedido, pedirAoRobo, type ConfiguracaoBothub } from "./bothub";

/**
 * Cliente do serviço de extrato do DAS MEI no ProContador SaaS.
 * O robô do SaaS entra no PGMEI (oficial) e traz a situação do ano, mês a mês.
 * Cada consulta concluída é cobrada pelo fornecedor do robô: o SaaS limita por dia
 * e o site limita por pessoa.
 */

export interface ConfiguracaoDas {
  url: string;
  token: string;
  /** Quando presente, a consulta vai direto ao robô do BotHub, sem passar pelo SaaS. */
  bothub?: ConfiguracaoBothub;
}

export function configuracaoDas(env: Record<string, string | undefined> = process.env): ConfiguracaoDas | null {
  const bothub = configuracaoBothub(env);
  if (bothub) return { url: "", token: "", bothub };
  const url = env.PROCONTADOR_API_URL?.trim().replace(/\/$/, "");
  const token = env.PROCONTADOR_SERVICO_TOKEN?.trim();
  if (!url || !token || token.length < 32) return null;
  return { url, token };
}

const Guia = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int(),
  vencimento: z.string(),
  situacao: z.string(),
  valorTotal: z.number(),
  dataPagamento: z.string().nullable(),
  codigoBarras: z.string().nullable(),
  linhaDigitavel: z.string().nullable(),
  temPdf: z.boolean(),
});
export type Guia = z.infer<typeof Guia>;

const Mes = z
  .object({
    mes: z.number().int(),
    situacao: z.string(),
    situacaoTexto: z.string().nullable(),
    dataVencimento: z.string().nullable(),
    total: z.string().nullable(),
    dataAcolhimento: z.string().nullable(),
  })
  .passthrough();

const Consulta = z.union([
  z.object({ pronto: z.literal(false), status: z.string() }).passthrough(),
  z
    .object({
      pronto: z.literal(true),
      status: z.string(),
      extrato: z
        .object({
          situacaoGeralTexto: z.string().nullable(),
          dividaAtiva: z.boolean().nullable(),
          meses: z.array(Mes),
        })
        .passthrough()
        .nullable(),
      guias: z.array(Guia),
      erro: z.string().nullable(),
    })
    .passthrough(),
]);
export type Consulta = z.infer<typeof Consulta>;

export class ErroDas extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function chamar(config: ConfiguracaoDas, caminho: string, init: RequestInit, buscar: typeof fetch): Promise<unknown> {
  const r = await buscar(`${config.url}/servico/das-mei/${caminho}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const corpo = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new ErroDas(r.status, corpo?.error ?? `ProContador respondeu ${r.status}`);
  return corpo;
}

export async function pedirExtrato(
  config: ConfiguracaoDas,
  cnpj: string,
  ano: number,
  buscar: typeof fetch = fetch,
): Promise<{ pedido: string; repetido: boolean }> {
  if (config.bothub) {
    try {
      return await pedirAoRobo(config.bothub, cnpj, ano, buscar);
    } catch (erro) {
      if (erro instanceof ErroBothub) throw new ErroDas(erro.status, erro.message);
      throw erro;
    }
  }
  const c = (await chamar(config, "extrato", { method: "POST", body: JSON.stringify({ cnpj, ano }) }, buscar)) as {
    pedido: string;
    repetido: boolean;
  };
  if (!/^site:das-mei:\d{14}:\d{4}:\d{4}-\d{2}-\d{2}$/.test(c.pedido)) throw new ErroDas(502, "Resposta inesperada do ProContador.");
  return { pedido: c.pedido, repetido: c.repetido };
}

export async function consultarExtrato(config: ConfiguracaoDas, pedido: string, buscar: typeof fetch = fetch): Promise<Consulta> {
  if (config.bothub) {
    const lido = lerPedido(pedido);
    if (!lido) throw new ErroDas(400, "Pedido inválido.");
    let r;
    try {
      r = await consultarRobo(config.bothub, lido.jobId, buscar);
    } catch (erro) {
      if (erro instanceof ErroBothub) throw new ErroDas(erro.status, erro.message);
      throw erro;
    }
    if (!r.terminal) return { pronto: false, status: r.status };
    if (r.status !== "FINISHED") {
      return { pronto: true, status: r.status, extrato: null, guias: [], erro: "O robô não conseguiu ler o PGMEI desta vez." };
    }
    try {
      const extrato = lerExtrato(r.resposta);
      if (!extrato.confiavel) {
        return { pronto: true, status: r.status, extrato: null, guias: [], erro: "O PGMEI mudou de formato e a leitura não é confiável." };
      }
      return {
        pronto: true,
        status: r.status,
        extrato: { situacaoGeralTexto: extrato.situacaoGeralTexto, dividaAtiva: extrato.dividaAtiva, meses: extrato.meses.map((m) => ({ ...m })) },
        guias: guiasDoExtrato(extrato, lido.ano),
        erro: extrato.erro,
      };
    } catch {
      return { pronto: true, status: r.status, extrato: null, guias: [], erro: "Não conseguimos ler a resposta do robô." };
    }
  }
  if (!/^site:das-mei:\d{14}:\d{4}:\d{4}-\d{2}-\d{2}$/.test(pedido)) throw new ErroDas(400, "Pedido inválido.");
  const corpo = await chamar(config, `extrato/${encodeURIComponent(pedido)}`, { method: "GET" }, buscar);
  const lido = Consulta.safeParse(corpo);
  if (!lido.success) throw new ErroDas(502, "Resposta inesperada do ProContador.");
  return lido.data;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nomeDoMes(m: number): string {
  return MESES[m - 1] ?? String(m);
}

/** Texto curto da situação de cada guia, para o WhatsApp e para a tela. */
export function rotuloDaSituacao(s: string): string {
  if (s === "PAGO") return "paga";
  if (s === "VENCIDO") return "vencida, em atraso";
  if (s === "EMITIDO" || s === "PENDENTE") return "em aberto";
  if (s === "CANCELADO") return "cancelada";
  return s.toLowerCase();
}

function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function data(iso: string | null): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Resumo para o WhatsApp. Nunca diz que a guia foi gerada: manda ao PGMEI quando não há linha digitável. */
export function resumoParaWhatsapp(cnpj: string, ano: number, c: Consulta, pgmei: string): string {
  if (!c.pronto) return "Ainda estou consultando o PGMEI. Assim que terminar, eu te mando aqui.";
  if (!c.extrato) {
    return `Não consegui ler o PGMEI agora para o CNPJ final ${cnpj.slice(-6)}. Você pode ver direto no site da Receita:\n${pgmei}`;
  }
  const abertas = c.guias.filter((g) => g.situacao !== "PAGO" && g.situacao !== "CANCELADO");
  const linhas = [`*DAS do MEI em ${ano}*, CNPJ final ${cnpj.slice(-6)}`];
  if (c.extrato.dividaAtiva) linhas.push("", "Atenção: o PGMEI indica débito em dívida ativa. Fale com um contador.");
  if (c.guias.length === 0) {
    linhas.push("", "O PGMEI não mostrou guias com valor neste ano. Se você abriu o MEI agora, a primeira guia aparece depois.");
  }
  for (const g of c.guias) {
    linhas.push(`• ${nomeDoMes(g.mes)}: ${rotuloDaSituacao(g.situacao)}, ${reais(g.valorTotal)}${g.situacao === "PAGO" ? "" : `, vence ${data(g.vencimento)}`}`);
  }
  if (abertas.length > 0) {
    const comLinha = abertas.find((g) => g.linhaDigitavel);
    linhas.push("");
    if (comLinha) {
      linhas.push(`Linha digitável de ${nomeDoMes(comLinha.mes)} (confira o valor no app do banco antes de pagar):`, comLinha.linhaDigitavel!);
    } else {
      linhas.push("Para pagar, gere a guia no PGMEI, só com o CNPJ, sem senha:", pgmei);
    }
  }
  linhas.push("", "Fonte: PGMEI, Receita Federal, consultado agora pelo ProContador.");
  return linhas.join("\n");
}

/** Confere os dígitos de um CNPJ numérico. */
export function cnpjValido(texto: string): string | null {
  const c = texto.replace(/\D/g, "");
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return null;
  const digito = (base: string) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const ch of base) {
      soma += Number(ch) * peso;
      peso = peso === 2 ? 9 : peso - 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digito(c.slice(0, 12));
  const d2 = digito(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`) ? c : null;
}

export function anoEmSaoPaulo(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(agora));
}

export const PGMEI =
  "https://www8.receita.fazenda.gov.br/SimplesNacional/Aplicacoes/ATSPO/pgmei.app/Identificacao";
