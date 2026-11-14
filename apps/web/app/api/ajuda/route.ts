import { z } from "zod";
import {
  chamar,
  configuracaoDaConta,
  ErroDeSessao,
  mesmaOrigem,
  problema,
  sessaoDoPedido,
} from "@/lib/conta/servidor";
import { criarLimite, normalizarContato } from "@/lib/radar";
import { configuracaoEvolution, enviarTexto } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

const porOrigem = criarLimite(4, 60 * 60 * 1000);
const TRILHAS = ["A_NANO", "B_PF_CONTRIBUINTE", "C_MEI_SERVICO", "D_MEI_REVENDA", "E_ME_EPP", "FORA_DO_ALCANCE"] as const;
const Pedido = z
  .object({
    pergunta: z.string().trim().min(5).max(2000),
    telefone: z.string().max(30).optional(),
    trilhas: z.array(z.enum(TRILHAS)).max(6).default([]),
    aceite: z.literal(true),
  })
  .strict();

/** Registra a dúvida e avisa o contador de plantão pelo WhatsApp. */
export async function POST(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return problema(503, "Indisponível", "O pedido de ajuda ainda não está disponível.");
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!porOrigem(ip)) return problema(429, "Muitos pedidos", "Você já mandou várias perguntas. Espere um pouco.");

  const corpo = Pedido.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return problema(400, "Pedido inválido", "Escreva a sua dúvida e marque que concorda.");

  let tokenHash: string | null = null;
  let telefone: string | null = null;
  try {
    const sessao = await sessaoDoPedido(config, request);
    if (sessao) {
      tokenHash = sessao.tokenHash;
      telefone = sessao.telefone;
    }
  } catch (erro) {
    if (!(erro instanceof ErroDeSessao)) throw erro;
  }
  telefone ??= corpo.data.telefone ? normalizarContato("whatsapp", corpo.data.telefone) : null;
  if (!telefone) return problema(400, "Celular inválido", "Digite o celular com DDD para a gente responder.");

  const id = await chamar<string>(config, "srv_pedido_ajuda", {
    p_token_hash: tokenHash,
    p_contato: telefone,
    p_pergunta: corpo.data.pergunta,
    p_resumo: { trilhas: corpo.data.trilhas, comConta: tokenHash !== null },
  });

  const evolution = configuracaoEvolution();
  const plantao = process.env.CONTADOR_WHATSAPP?.replace(/\D/g, "");
  if (evolution && plantao) {
    const texto = [
      "*Nova dúvida no ProContador*",
      `Pedido ${id.slice(0, 8)}`,
      `Situação: ${corpo.data.trilhas.join(", ") || "não informada"}`,
      `Responder para: ${telefone}`,
      "",
      corpo.data.pergunta.slice(0, 1500),
    ].join("\n");
    await enviarTexto(evolution, plantao, texto).catch((e) =>
      console.error("ajuda: falha ao avisar o plantão", e instanceof Error ? e.message : e),
    );
  }
  return Response.json({ ok: true });
}
