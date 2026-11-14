import { criarLimite } from "@/lib/radar";
import { conversar, iaAtiva, type Mensagem } from "@/lib/ia/assistente";
import { ehPerguntaLivre, limpar, responder, type Estado } from "@/lib/whatsapp/conversa";
import { configuracaoEvolution, enviarTexto, lerEvento, segredoConfere } from "@/lib/whatsapp/evolution";
import { criarMemoria } from "@/lib/whatsapp/memoria";

export const dynamic = "force-dynamic";

const conversas = criarMemoria<Estado>(30 * 60 * 1000);
const jaVistas = criarMemoria<true>(10 * 60 * 1000, 20000);
const dentroDoLimite = criarLimite(20, 60 * 1000);
const historicos = criarMemoria<Mensagem[]>(30 * 60 * 1000);
const perguntasPorHora = criarLimite(30, 60 * 60 * 1000);

/** Recebe os eventos da Evolution e responde a conversa guiada. Sempre devolve 200 para a Evolution não repetir. */
export async function POST(request: Request): Promise<Response> {
  const config = configuracaoEvolution();
  if (!config) return new Response(null, { status: 503 });

  const segredo = new URL(request.url).searchParams.get("segredo");
  if (!segredoConfere(config.segredo, segredo)) return new Response(null, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ ok: true, tratou: false, ignorado: "corpo" });
  }

  const mensagem = lerEvento(corpo);
  if (!mensagem) return Response.json({ ok: true, tratou: false, ignorado: "evento" });
  if (jaVistas.ler(mensagem.id)) return Response.json({ ok: true, tratou: false, ignorado: "repetida" });
  jaVistas.gravar(mensagem.id, true);

  if (config.permitidos.size > 0 && !(mensagem.numero && config.permitidos.has(mensagem.numero))) {
    console.info("whatsapp: remetente fora da lista de teste", { jid: mensagem.destino.slice(-6) });
    return Response.json({ ok: true, tratou: false, ignorado: "remetente" });
  }
  if (!dentroDoLimite(mensagem.destino)) return Response.json({ ok: true, tratou: false, ignorado: "limite" });

  const anterior = conversas.ler(mensagem.destino);
  // Em números que também falam com outros robôs, só entramos com a palavra de entrada.
  if (!anterior && mensagem.numero && config.comPalavra.has(mensagem.numero) && limpar(mensagem.texto) !== config.palavra) {
    return Response.json({ ok: true, tratou: false });
  }

  if (iaAtiva() && ehPerguntaLivre(anterior, mensagem.texto) && perguntasPorHora(mensagem.destino)) {
    const historico = [...(historicos.ler(mensagem.destino) ?? []), { role: "user" as const, content: mensagem.texto }];
    let resposta: string;
    try {
      resposta = await conversar(historico, { canal: "whatsapp" });
    } catch (erro) {
      console.error("whatsapp: assistente falhou", erro instanceof Error ? erro.message : erro);
      resposta = "Não consegui responder agora. Responda com o número de uma opção do menu ou tente de novo daqui a pouco.";
    }
    historicos.gravar(mensagem.destino, [...historico, { role: "assistant" as const, content: resposta }].slice(-16));
    conversas.gravar(mensagem.destino, anterior);
    try {
      await enviarTexto(config, mensagem.destino, `${resposta}\n\nMande 0 para ver o menu.`);
    } catch (erro) {
      console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
    }
    return Response.json({ ok: true, tratou: true });
  }

  const { estado, mensagens } = responder(anterior, mensagem.texto);
  if (!estado) historicos.gravar(mensagem.destino, undefined);
  conversas.gravar(mensagem.destino, estado);

  try {
    for (const texto of mensagens) await enviarTexto(config, mensagem.destino, texto);
  } catch (erro) {
    console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
  }
  return Response.json({ ok: true, tratou: true });
}
