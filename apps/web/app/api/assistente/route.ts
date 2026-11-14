import { z } from "zod";
import { mesmaOrigem, problema } from "@/lib/conta/servidor";
import { conversar, iaAtiva } from "@/lib/ia/assistente";
import { criarLimite } from "@/lib/radar";

export const dynamic = "force-dynamic";

const porOrigem = criarLimite(40, 60 * 60 * 1000);
const Pedido = z
  .object({
    mensagens: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }).strict())
      .min(1)
      .max(30),
  })
  .strict();

export async function GET(): Promise<Response> {
  return Response.json({ ativo: iaAtiva() });
}

/** Responde uma mensagem da conversa livre. O histórico fica no navegador da pessoa. */
export async function POST(request: Request): Promise<Response> {
  if (!iaAtiva()) return problema(503, "Assistente desligada", "A conversa com a assistente ainda não está ligada.");
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!porOrigem(ip)) return problema(429, "Muitas mensagens", "Você mandou muitas mensagens. Espere um pouco.");
  const corpo = Pedido.safeParse(await request.json().catch(() => null));
  if (!corpo.success || corpo.data.mensagens.at(-1)?.role !== "user") {
    return problema(400, "Mensagem inválida", "Escreva a sua pergunta.");
  }
  try {
    const resposta = await conversar(corpo.data.mensagens, { canal: "site" });
    return Response.json({ resposta }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error("assistente:", erro instanceof Error ? erro.message : erro);
    return problema(502, "Assistente fora do ar", "A assistente não respondeu. Tente de novo em instantes.");
  }
}
