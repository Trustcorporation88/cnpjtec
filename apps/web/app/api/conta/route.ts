import { cookies } from "next/headers";
import {
  chamar,
  configuracaoDaConta,
  COOKIE_SESSAO,
  ErroDeSessao,
  mesmaOrigem,
  problema,
  sessaoDoPedido,
  textoDoConsentimentoDaConta,
} from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

/** Diz se há sessão aberta. Sem conta configurada, devolve disponivel: false. */
export async function GET(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return Response.json({ disponivel: false, conta: null });
  const sessao = await sessaoDoPedido(config, request).catch(() => null);
  return Response.json(
    {
      disponivel: true,
      consentimento: textoDoConsentimentoDaConta(config),
      conta: sessao ? { telefone: sessao.telefone, criadaEm: sessao.criadaEm } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Apaga a conta e tudo o que estiver ligado a ela (direito de eliminação da LGPD). */
export async function DELETE(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return problema(503, "Conta indisponível", "A conta ainda não está disponível.");
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  try {
    const sessao = await sessaoDoPedido(config, request);
    if (!sessao) return problema(401, "Entre na conta", "Entre com o seu celular para apagar a conta.");
    await chamar(config, "srv_excluir_conta", { p_token_hash: sessao.tokenHash });
    (await cookies()).delete(COOKIE_SESSAO);
    return Response.json({ ok: true });
  } catch (erro) {
    if (erro instanceof ErroDeSessao) return problema(401, "Entre na conta", "A sua sessão venceu.");
    throw erro;
  }
}
