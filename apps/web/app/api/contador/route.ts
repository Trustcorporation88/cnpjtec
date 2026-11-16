import { z } from "zod";
import { comSessao } from "@/lib/conta/rota";
import { chamar, ErroDePermissao, mesmaOrigem, problema } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

const semAcesso = () => problema(403, "Área do contador", "Esta área é só para o contador do ProContador.");

/** Pedidos de ajuda e números de uso. A permissão é conferida no banco. */
export async function GET(request: Request): Promise<Response> {
  return comSessao(request, async (config, tokenHash) => {
    try {
      const painel = await chamar<unknown>(config, "srv_contador_painel", { p_token_hash: tokenHash });
      return Response.json(painel, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof ErroDePermissao) return semAcesso();
      throw e;
    }
  });
}

const Mudanca = z
  .object({ id: z.string().uuid(), situacao: z.enum(["aberto", "respondido", "cancelado"]) })
  .strict();

/** Marca um pedido como respondido, cancelado ou de volta para aberto. */
export async function PATCH(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const corpo = Mudanca.safeParse(await request.json().catch(() => null));
  if (!corpo.success) return problema(400, "Pedido inválido", "Situação desconhecida.");
  return comSessao(request, async (config, tokenHash) => {
    try {
      await chamar(config, "srv_contador_situacao", {
        p_token_hash: tokenHash,
        p_id: corpo.data.id,
        p_situacao: corpo.data.situacao,
      });
      return Response.json({ ok: true });
    } catch (e) {
      if (e instanceof ErroDePermissao) return semAcesso();
      throw e;
    }
  });
}
