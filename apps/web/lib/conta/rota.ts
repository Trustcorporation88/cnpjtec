import { configuracaoDaConta, ErroDeSessao, problema, sessaoDoPedido, type ConfiguracaoDaConta } from "./servidor";

/** Roda a ação só com sessão válida. Responde 401 sem sessão e 503 sem conta configurada. */
export async function comSessao(
  request: Request,
  fazer: (config: ConfiguracaoDaConta, tokenHash: string) => Promise<Response>,
): Promise<Response> {
  const config = configuracaoDaConta();
  if (!config) return problema(503, "Conta indisponível", "A conta ainda não está disponível.");
  try {
    const sessao = await sessaoDoPedido(config, request);
    if (!sessao) return problema(401, "Entre na conta", "Entre com o seu celular para continuar.");
    return await fazer(config, sessao.tokenHash);
  } catch (erro) {
    if (erro instanceof ErroDeSessao) return problema(401, "Entre na conta", "A sua sessão venceu. Entre de novo.");
    throw erro;
  }
}
