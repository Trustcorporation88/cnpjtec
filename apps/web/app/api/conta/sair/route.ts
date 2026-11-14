import { cookies } from "next/headers";
import { chamar, configuracaoDaConta, COOKIE_SESSAO, hashDoToken, mesmaOrigem, problema, tokenDoPedido } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const token = tokenDoPedido(request);
  if (config && token) await chamar(config, "srv_sair", { p_token_hash: hashDoToken(token) }).catch(() => null);
  (await cookies()).delete(COOKIE_SESSAO);
  return Response.json({ ok: true });
}
