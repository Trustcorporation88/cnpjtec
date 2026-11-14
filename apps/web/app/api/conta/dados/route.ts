import { chamar, configuracaoDaConta, ErroDeSessao, problema, sessaoDoPedido } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

/** Entrega à pessoa tudo o que está guardado sobre ela (direito de acesso e portabilidade da LGPD). */
export async function GET(request: Request): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return problema(503, "Conta indisponível", "A conta ainda não está disponível.");
  try {
    const sessao = await sessaoDoPedido(config, request);
    if (!sessao) return problema(401, "Entre na conta", "Entre com o seu celular para baixar os dados.");
    const dados = await chamar<unknown>(config, "srv_exportar", { p_token_hash: sessao.tokenHash });
    const hoje = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify({ geradoEm: new Date().toISOString(), ...(dados as object) }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="procontador-meus-dados-${hoje}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    if (erro instanceof ErroDeSessao) return problema(401, "Entre na conta", "A sua sessão venceu.");
    throw erro;
  }
}
