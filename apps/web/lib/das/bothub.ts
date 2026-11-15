/**
 * Consulta do extrato do DAS MEI direto no robô do BotHub (automação "Captura de boleto DAS" do PGMEI),
 * com o mesmo contrato que o ProContador SaaS usa (contador-saas, services/bothub). Serve quando o SaaS
 * não está disponível. O robô entra no PGMEI, aplicativo oficial: o DAS continua sendo da Receita.
 *
 * Custo: cada pedido FINISHED é cobrado. Travas aqui: um pedido por CNPJ, ano e dia e teto diário
 * (BOTHUB_LIMITE_DIARIO, padrão 30), guardados em memória do servidor.
 */

const BASE = "https://api.bothub.bot";

export interface ConfiguracaoBothub {
  token: string;
  automacaoId: string;
  changelogId: string | null;
  limiteDiario: number;
}

export function configuracaoBothub(env: Record<string, string | undefined> = process.env): ConfiguracaoBothub | null {
  const token = env.BOTHUB_TOKEN?.trim();
  const automacaoId = env.BOTHUB_AUTOMACAO_DAS_MEI_ID?.trim();
  if (!token || !automacaoId) return null;
  const limite = Number(env.BOTHUB_LIMITE_DIARIO);
  return {
    token,
    automacaoId,
    changelogId: env.BOTHUB_AUTOMACAO_DAS_MEI_CHANGELOG_ID?.trim() || null,
    limiteDiario: env.BOTHUB_LIMITE_DIARIO && Number.isInteger(limite) && limite >= 0 ? limite : 30,
  };
}

export class ErroBothub extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function diaEmSaoPaulo(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

const pedidosDoDia = new Map<string, string>();
let contagem = { dia: "", total: 0 };

/** Esquece os pedidos guardados (usado nos testes). */
export function zerarMemoria(): void {
  pedidosDoDia.clear();
  contagem = { dia: "", total: 0 };
}

async function chamar(config: ConfiguracaoBothub, metodo: "GET" | "POST", caminho: string, corpo: unknown, buscar: typeof fetch) {
  let r: Response;
  try {
    r = await buscar(`${BASE}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    throw new ErroBothub(502, `Sem resposta do robô em ${metodo} ${caminho}`);
  }
  if (!r.ok) throw new ErroBothub(r.status === 401 ? 502 : r.status, `Robô respondeu ${r.status} em ${metodo} ${caminho}`);
  return (await r.json()) as Record<string, unknown>;
}

/** Pede o extrato do ano. No mesmo dia, para o mesmo CNPJ e ano, devolve o pedido já feito. */
export async function pedirAoRobo(
  config: ConfiguracaoBothub,
  cnpj: string,
  ano: number,
  buscar: typeof fetch = fetch,
  agora: Date = new Date(),
): Promise<{ pedido: string; repetido: boolean }> {
  const dia = diaEmSaoPaulo(agora);
  const chave = `${cnpj}:${ano}:${dia}`;
  const existente = pedidosDoDia.get(chave);
  if (existente) return { pedido: existente, repetido: true };
  if (contagem.dia !== dia) contagem = { dia, total: 0 };
  if (contagem.total >= config.limiteDiario) throw new ErroBothub(429, "Limite diário de consultas atingido.");

  const cnpjFormatado = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const corpo = await chamar(
    config,
    "POST",
    "/api/v1/job",
    {
      automation_id: config.automacaoId,
      ...(config.changelogId ? { automation_changelog_id: config.changelogId } : {}),
      automation_data: { ANO: String(ano), CNPJ_FORMATADO: cnpjFormatado },
      automation_id_externo: `cnpjtec:das-mei:${chave}`,
    },
    buscar,
  );
  const id = corpo.id;
  if (typeof id !== "string" && typeof id !== "number") throw new ErroBothub(502, "Robô não devolveu o número do pedido.");
  contagem.total += 1;
  const pedido = `bh:${String(id)}:${cnpj}:${ano}`;
  pedidosDoDia.set(chave, pedido);
  return { pedido, repetido: false };
}

export function lerPedido(pedido: string): { jobId: string; cnpj: string; ano: number } | null {
  const m = /^bh:([A-Za-z0-9_-]{1,64}):(\d{14}):(\d{4})$/.exec(pedido);
  return m ? { jobId: m[1]!, cnpj: m[2]!, ano: Number(m[3]) } : null;
}

const TERMINAIS = new Set(["ERROR", "PARTIAL_EXECUTED", "FINISHED"]);

export async function consultarRobo(
  config: ConfiguracaoBothub,
  jobId: string,
  buscar: typeof fetch = fetch,
): Promise<{ status: string; terminal: boolean; resposta: unknown }> {
  const corpo = await chamar(config, "GET", `/api/v1/job/${encodeURIComponent(jobId)}`, undefined, buscar);
  const bruto = String(corpo.status ?? "").trim().toUpperCase();
  const status = bruto === "ERRO" ? "ERROR" : bruto;
  // A API real devolve o resultado em payload.response; a documentação fala em payload_response.
  const resposta = (corpo.payload as { response?: unknown } | undefined)?.response ?? corpo.payload_response;
  return { status, terminal: TERMINAIS.has(status), resposta };
}

// ---------------------------------------------------------------- extrato (mesma leitura do SaaS)

export type SituacaoMes = "LIQUIDADO" | "NAO_OPTANTE" | "DESCONHECIDA";

export interface MesDoExtrato {
  mes: number;
  situacao: SituacaoMes;
  situacaoTexto: string | null;
  dataVencimento: string | null;
  total: string | null;
  valorPrincipal: string | null;
  dataAcolhimento: string | null;
}

function vazio(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "-" || s.toLowerCase() === "null" ? null : s;
}

function canonico(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

function situacao(texto: string | null): SituacaoMes {
  if (!texto) return "DESCONHECIDA";
  const c = canonico(texto);
  if (c === "liquidado") return "LIQUIDADO";
  if (c === "naooptante" || c === "nooptante") return "NAO_OPTANTE";
  return "DESCONHECIDA";
}

function moeda(v: unknown): string | null {
  const s = vazio(v)?.replace(/^R\$\s*/, "") ?? null;
  if (!s || !/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) return null;
  return s.replace(/\./g, "").replace(",", ".");
}

export interface ExtratoLido {
  confiavel: boolean;
  erro: string | null;
  dividaAtiva: boolean | null;
  situacaoGeralTexto: string | null;
  meses: MesDoExtrato[];
}

export function lerExtrato(resposta: unknown): ExtratoLido {
  if (!resposta || typeof resposta !== "object") throw new ErroBothub(502, "Resposta do robô vazia.");
  const r = resposta as Record<string, unknown>;
  const contador = Number(r.contador);
  const qtd = Number.isInteger(contador) && contador >= 0 && contador <= 12 ? contador : 12;
  const meses: MesDoExtrato[] = [];
  for (let i = 0; i < qtd; i++) {
    const texto = vazio(r[`situacao_${i}`]);
    meses.push({
      mes: i + 1,
      situacao: situacao(texto),
      situacaoTexto: texto,
      dataVencimento: vazio(r[`data_vencimento_${i}`]),
      total: moeda(r[`total_${i}`]),
      valorPrincipal: moeda(r[`valor_principal_${i}`]),
      dataAcolhimento: vazio(r[`data_acolhimento_${i}`]),
    });
  }
  const divida = vazio(r.dividaAtiva)?.toUpperCase() ?? null;
  return {
    confiavel: vazio(r.structure) === "STRUCTURE_OK",
    erro: vazio(r.erro),
    dividaAtiva: divida === "SIM" ? true : divida === "NAO" ? false : null,
    situacaoGeralTexto: vazio(r.situacao),
    meses,
  };
}

function iso(br: string | null): string | null {
  const m = br ? /^(\d{2})\/(\d{2})\/(\d{4})/.exec(br) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Guias com valor no extrato. Paga quando o PGMEI diz Liquidado; senão em aberto ou vencida pela data. */
export function guiasDoExtrato(extrato: ExtratoLido, ano: number, agora: Date = new Date()) {
  const hoje = diaEmSaoPaulo(agora);
  return extrato.meses.flatMap((m) => {
    const valor = m.total ?? m.valorPrincipal;
    const vencimento = iso(m.dataVencimento);
    if (m.situacao === "NAO_OPTANTE" || !valor || !vencimento) return [];
    const paga = m.situacao === "LIQUIDADO";
    return [
      {
        mes: m.mes,
        ano,
        vencimento,
        situacao: paga ? "PAGO" : vencimento < hoje ? "VENCIDO" : "EMITIDO",
        valorTotal: Number(valor),
        dataPagamento: paga ? iso(m.dataAcolhimento) : null,
        codigoBarras: null,
        linhaDigitavel: null,
        temPdf: false,
      },
    ];
  });
}
