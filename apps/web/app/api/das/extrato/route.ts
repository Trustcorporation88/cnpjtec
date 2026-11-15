import { z } from "zod";
import { comSessao } from "@/lib/conta/rota";
import { mesmaOrigem, problema } from "@/lib/conta/servidor";
import { anoEmSaoPaulo, cnpjValido, configuracaoDas, consultarExtrato, ErroDas, pedirExtrato } from "@/lib/das/procontador";
import { criarLimite } from "@/lib/radar";

export const dynamic = "force-dynamic";

/** Cada consulta concluída custa: no máximo 5 por conta por dia. */
const porConta = criarLimite(5, 24 * 60 * 60 * 1000);
const Pedido = z.object({ cnpj: z.string().max(20), ano: z.number().int().optional() }).strict();

function erroDas(erro: unknown): Response {
  if (erro instanceof ErroDas) {
    if (erro.status === 429) return problema(429, "Limite do dia", "Muitas consultas hoje. Tente amanhã ou use o PGMEI direto.");
    if (erro.status === 400 || erro.status === 404) return problema(erro.status, "Consulta inválida", erro.message);
  }
  console.error("das:", erro instanceof Error ? erro.message : erro);
  return problema(502, "PGMEI fora do ar", "Não conseguimos consultar agora. Tente de novo mais tarde ou use o PGMEI direto.");
}

export async function GET(request: Request): Promise<Response> {
  const das = configuracaoDas();
  if (!das) return problema(503, "Indisponível", "A consulta do DAS ainda não está ligada.");
  const pedido = new URL(request.url).searchParams.get("pedido") ?? "";
  return comSessao(request, async () => {
    try {
      return Response.json(await consultarExtrato(das, pedido), { headers: { "Cache-Control": "no-store" } });
    } catch (erro) {
      return erroDas(erro);
    }
  });
}

/** Pede ao ProContador o extrato do DAS do ano para um CNPJ de MEI. */
export async function POST(request: Request): Promise<Response> {
  const das = configuracaoDas();
  if (!das) return problema(503, "Indisponível", "A consulta do DAS ainda não está ligada.");
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const corpo = Pedido.safeParse(await request.json().catch(() => null));
  const cnpj = corpo.success ? cnpjValido(corpo.data.cnpj) : null;
  if (!corpo.success || !cnpj) return problema(400, "CNPJ inválido", "Confira os 14 números do CNPJ do MEI.");
  const anoAtual = anoEmSaoPaulo();
  const ano = corpo.data.ano ?? anoAtual;
  if (ano < 2009 || ano > anoAtual) return problema(400, "Ano inválido", `Escolha um ano entre 2009 e ${anoAtual}.`);

  return comSessao(request, async (_config, tokenHash) => {
    if (!porConta(tokenHash)) return problema(429, "Limite do dia", "Você já fez 5 consultas hoje. Tente amanhã.");
    try {
      return Response.json(await pedirExtrato(das, cnpj, ano), { status: 202 });
    } catch (erro) {
      return erroDas(erro);
    }
  });
}
