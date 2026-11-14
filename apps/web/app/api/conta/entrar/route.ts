import { cookies } from "next/headers";
import { z } from "zod";
import {
  chamar,
  configuracaoDaConta,
  COOKIE_SESSAO,
  hashDoCodigo,
  hashDoToken,
  mesmaOrigem,
  novoToken,
  opcoesDoCookie,
  problema,
  VERSAO_CONSENTIMENTO_CONTA,
} from "@/lib/conta/servidor";
import { criarLimite, normalizarContato } from "@/lib/radar";

export const dynamic = "force-dynamic";

const porOrigem = criarLimite(20, 15 * 60 * 1000);
const Pedido = z.object({ telefone: z.string().min(8).max(30), codigo: z.string().regex(/^\d{6}$/) }).strict();

/** Confere o código e abre a sessão. Cria a conta no primeiro acesso. */
export async function POST(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return problema(503, "Conta indisponível", "A conta ainda não está disponível.");
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!porOrigem(ip)) return problema(429, "Muitas tentativas", "Espere alguns minutos e tente de novo.");

  const corpo = Pedido.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return problema(400, "Código inválido", "O código tem 6 números.");
  const telefone = normalizarContato("whatsapp", corpo.data.telefone);
  if (!telefone) return problema(400, "Celular inválido", "Digite o celular com DDD.");

  const token = novoToken();
  const resultado = await chamar<{ ok: boolean; motivo?: string; nova?: boolean }>(config, "srv_entrar", {
    p_telefone: telefone,
    p_codigo_hash: hashDoCodigo(config, telefone, corpo.data.codigo),
    p_token_hash: hashDoToken(token),
    p_consentimento: VERSAO_CONSENTIMENTO_CONTA,
  });
  if (!resultado.ok) {
    return resultado.motivo === "errado"
      ? problema(400, "Código errado", "Confira os 6 números que chegaram no WhatsApp.")
      : problema(400, "Código vencido", "Esse código venceu ou foi tentado vezes demais. Peça outro.");
  }

  (await cookies()).set(COOKIE_SESSAO, token, opcoesDoCookie());
  return Response.json({ ok: true, nova: resultado.nova === true }, { headers: { "Cache-Control": "no-store" } });
}
