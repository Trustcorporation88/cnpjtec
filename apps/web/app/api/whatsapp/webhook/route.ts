import { criarLimite } from "@/lib/radar";
import { responder, type Estado } from "@/lib/whatsapp/conversa";
import { configuracaoEvolution, enviarTexto, lerEvento, segredoConfere } from "@/lib/whatsapp/evolution";
import { criarMemoria } from "@/lib/whatsapp/memoria";

export const dynamic = "force-dynamic";

const conversas = criarMemoria<Estado>(30 * 60 * 1000);
const jaVistas = criarMemoria<true>(10 * 60 * 1000, 20000);
const dentroDoLimite = criarLimite(20, 60 * 1000);

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
    return Response.json({ ok: true, ignorado: "corpo" });
  }

  const mensagem = lerEvento(corpo);
  if (!mensagem) return Response.json({ ok: true, ignorado: "evento" });
  if (jaVistas.ler(mensagem.id)) return Response.json({ ok: true, ignorado: "repetida" });
  jaVistas.gravar(mensagem.id, true);

  if (config.permitidos.size > 0 && !(mensagem.numero && config.permitidos.has(mensagem.numero))) {
    console.info("whatsapp: remetente fora da lista de teste", { jid: mensagem.destino.slice(-6) });
    return Response.json({ ok: true, ignorado: "remetente" });
  }
  if (!dentroDoLimite(mensagem.destino)) return Response.json({ ok: true, ignorado: "limite" });

  const { estado, mensagens } = responder(conversas.ler(mensagem.destino), mensagem.texto);
  conversas.gravar(mensagem.destino, estado);

  try {
    for (const texto of mensagens) await enviarTexto(config, mensagem.destino, texto);
  } catch (erro) {
    console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
  }
  return Response.json({ ok: true });
}
