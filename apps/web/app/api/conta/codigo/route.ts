import { z } from "zod";
import {
  chamar,
  configuracaoDaConta,
  hashDoCodigo,
  mesmaOrigem,
  novoCodigo,
  problema,
} from "@/lib/conta/servidor";
import { criarLimite, normalizarContato } from "@/lib/radar";
import { configuracaoEvolution, enviarTexto } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

const porOrigem = criarLimite(6, 15 * 60 * 1000);
const Pedido = z.object({ telefone: z.string().min(8).max(30), aceite: z.literal(true) }).strict();

/** Envia pelo WhatsApp o código de 6 números para entrar. */
export async function POST(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  const evolution = configuracaoEvolution();
  if (!config || !evolution) {
    return problema(503, "Conta indisponível", "A conta ainda não está disponível. Tente mais tarde.");
  }
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!porOrigem(ip)) return problema(429, "Muitos pedidos", "Espere alguns minutos e tente de novo.");

  const corpo = Pedido.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return problema(400, "Pedido inválido", "Digite o celular e marque que concorda.");

  const telefone = normalizarContato("whatsapp", corpo.data.telefone);
  if (!telefone) return problema(400, "Celular inválido", "Digite o celular com DDD. Exemplo: 14 99999 9999");

  const codigo = novoCodigo();
  const gravou = await chamar<boolean>(config, "srv_registrar_codigo", {
    p_telefone: telefone,
    p_codigo_hash: hashDoCodigo(config, telefone, codigo),
  });
  if (!gravou) {
    return problema(429, "Muitos códigos", "Você já pediu 3 códigos. Espere 15 minutos e tente de novo.");
  }

  try {
    await enviarTexto(
      evolution,
      telefone.slice(1),
      `Seu código do ProContador é *${codigo}*.\nEle vale por 10 minutos. Não passe esse código para ninguém.`,
    );
  } catch (erro) {
    console.error("conta: falha ao enviar código", erro instanceof Error ? erro.message : erro);
    return problema(502, "Não conseguimos enviar", "O WhatsApp não respondeu. Tente de novo em instantes.");
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
