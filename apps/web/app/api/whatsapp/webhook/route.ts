import { NotaInvalida } from "@/lib/cofre/nfe";
import { configuracaoDaConta } from "@/lib/conta/servidor";
import { depsDoCaderno, telefoneDaConta } from "@/lib/conta/whatsapp";
import { criarLimite } from "@/lib/radar";
import { tratarCaderno, tratarNotaRecebida, type RespostaDoCaderno } from "@/lib/whatsapp/caderno";
import {
  anoEmSaoPaulo,
  configuracaoDas,
  consultarExtrato,
  ErroDas,
  PGMEI,
  pedirExtrato,
  resumoParaWhatsapp,
} from "@/lib/das/procontador";
import { conversar, iaAtiva, minimizar, type Mensagem } from "@/lib/ia/assistente";
import { ehPerguntaLivre, limpar, responder, type Estado } from "@/lib/whatsapp/conversa";
import {
  baixarArquivo,
  ehXml,
  configuracaoEvolution,
  enviarTexto,
  lerEvento,
  segredoConfere,
  type ConfiguracaoEvolution,
} from "@/lib/whatsapp/evolution";
import { memoriaDoServidor, resumo } from "@/lib/memoria-duravel";

export const dynamic = "force-dynamic";

const MEIA_HORA = 30 * 60;
const UM_DIA = 24 * 60 * 60;
const dentroDoLimite = criarLimite(20, 60 * 1000);

/** Estado e histórico da conversa ficam no banco: uma publicação do site não derruba quem está no meio. */
const conversas = {
  ler: (destino: string) => memoriaDoServidor().ler<Estado>(`wa:estado:${resumo(destino)}`),
  gravar: (destino: string, estado: Estado | undefined) =>
    memoriaDoServidor().gravar(`wa:estado:${resumo(destino)}`, estado, MEIA_HORA),
};
const historicos = {
  ler: (destino: string) => memoriaDoServidor().ler<Mensagem[]>(`wa:historico:${resumo(destino)}`),
  // Guardado já sem CPF, CNPJ, cartão e e-mail, por no máximo meia hora.
  gravar: (destino: string, h: Mensagem[] | undefined) =>
    memoriaDoServidor().gravar(
      `wa:historico:${resumo(destino)}`,
      h?.map((m) => ({ ...m, content: minimizar(m.content) })),
      MEIA_HORA,
    ),
};
const perguntasPorHora = (destino: string) => memoriaDoServidor().contar(`wa:perguntas:${resumo(destino)}`, 30, 60 * 60);
/** Cada consulta concluída do DAS custa: no máximo 3 por número por dia. */
const consultasDasPorDia = (destino: string) => memoriaDoServidor().contar(`wa:das:${resumo(destino)}`, 3, UM_DIA);

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pede o extrato ao ProContador e, quando o robô terminar, manda o resumo na conversa. */
async function consultarDasEmSegundoPlano(config: ConfiguracaoEvolution, destino: string, cnpj: string): Promise<void> {
  const das = configuracaoDas();
  if (!das) return;
  const ano = anoEmSaoPaulo();
  const avisar = (texto: string) =>
    enviarTexto(config, destino, texto).catch((e) => console.error("whatsapp: falha ao enviar", e instanceof Error ? e.message : e));
  if (!(await consultasDasPorDia(destino))) {
    await avisar(`Você já fez 3 consultas hoje. Amanhã consulto de novo. Enquanto isso, veja direto no PGMEI:\n${PGMEI}`);
    return;
  }
  try {
    const { pedido } = await pedirExtrato(das, cnpj, ano);
    for (let i = 0; i < 40; i++) {
      const c = await consultarExtrato(das, pedido);
      if (c.pronto) {
        await avisar(`${resumoParaWhatsapp(cnpj, ano, c, PGMEI)}\n\nMande 0 para ver o menu.`);
        return;
      }
      await esperar(15_000);
    }
    await avisar(`O PGMEI está demorando para responder. Tente de novo mais tarde, ou veja direto:\n${PGMEI}`);
  } catch (erro) {
    console.error("whatsapp: consulta do DAS falhou", erro instanceof Error ? erro.message : erro);
    const limite = erro instanceof ErroDas && erro.status === 429;
    await avisar(
      limite
        ? `Hoje já fizemos muitas consultas. Tente amanhã, ou veja direto no PGMEI:\n${PGMEI}`
        : `Não consegui consultar o PGMEI agora. Você pode ver direto no site da Receita, só com o CNPJ:\n${PGMEI}`,
    );
  }
}

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
  if (!(await memoriaDoServidor().reservar(`wa:vista:${resumo(mensagem.id)}`, 10 * 60))) {
    return Response.json({ ok: true, tratou: false, ignorado: "repetida" });
  }

  if (config.permitidos.size > 0 && !(mensagem.numero && config.permitidos.has(mensagem.numero))) {
    console.info("whatsapp: remetente fora da lista de teste", { jid: mensagem.destino.slice(-6) });
    return Response.json({ ok: true, tratou: false, ignorado: "remetente" });
  }
  if (!dentroDoLimite(mensagem.destino)) return Response.json({ ok: true, tratou: false, ignorado: "limite" });

  const anterior = await conversas.ler(mensagem.destino);
  // Em números que também falam com outros robôs, só entramos com a palavra de entrada.
  if (!anterior && mensagem.numero && config.comPalavra.has(mensagem.numero) && limpar(mensagem.texto) !== config.palavra) {
    return Response.json({ ok: true, tratou: false });
  }

  const conta = configuracaoDaConta();
  const site = (process.env.SITE_URL ?? "https://web-production-5fc35120.up.railway.app").replace(/\/$/, "");
  const telefone = telefoneDaConta(mensagem.numero);
  const responderCaderno = async (r: RespostaDoCaderno) => {
    await conversas.gravar(mensagem.destino, r.estado);
    try {
      for (const texto of r.mensagens) await enviarTexto(config, mensagem.destino, texto);
    } catch (erro) {
      console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
    }
    return Response.json({ ok: true, tratou: true });
  };

  if (mensagem.documento) {
    if (!conta || !ehXml(mensagem.documento)) {
      return responderCaderno({
        estado: anterior ?? { etapa: "menu", atividades: [] },
        mensagens: ["Por enquanto eu só leio o arquivo XML da nota de compra. Foto e PDF ainda não. Mande 0 para ver o menu."],
      });
    }
    try {
      const xml = (await baixarArquivo(config, mensagem.id)).toString("utf8");
      return responderCaderno(await tratarNotaRecebida(telefone, xml, depsDoCaderno(conta, site)));
    } catch (erro) {
      const texto =
        erro instanceof NotaInvalida
          ? `Não consegui guardar essa nota: ${erro.message}`
          : "Não consegui abrir o arquivo agora. Tente de novo daqui a pouco ou guarde pelo site, no cofre.";
      if (!(erro instanceof NotaInvalida)) console.error("whatsapp: nota", erro instanceof Error ? erro.message : erro);
      return responderCaderno({ estado: anterior ?? { etapa: "menu", atividades: [] }, mensagens: [texto] });
    }
  }

  if (conta) {
    try {
      const r = await tratarCaderno(anterior, mensagem.texto, telefone, depsDoCaderno(conta, site));
      if (r) return responderCaderno(r);
    } catch (erro) {
      console.error("whatsapp: caderno", erro instanceof Error ? erro.message : erro);
      return responderCaderno({
        estado: { etapa: "menu", atividades: [] },
        mensagens: [`Não consegui anotar agora. Tente de novo daqui a pouco ou anote pelo site: ${site}/caderno`],
      });
    }
  }

  if (iaAtiva() && ehPerguntaLivre(anterior, mensagem.texto) && (await perguntasPorHora(mensagem.destino))) {
    const historico = [...((await historicos.ler(mensagem.destino)) ?? []), { role: "user" as const, content: mensagem.texto }];
    let resposta: string;
    try {
      resposta = await conversar(historico, { canal: "whatsapp" });
    } catch (erro) {
      console.error("whatsapp: assistente falhou", erro instanceof Error ? erro.message : erro);
      resposta = "Não consegui responder agora. Responda com o número de uma opção do menu ou tente de novo daqui a pouco.";
    }
    await historicos.gravar(mensagem.destino, [...historico, { role: "assistant" as const, content: resposta }].slice(-16));
    await conversas.gravar(mensagem.destino, anterior);
    try {
      await enviarTexto(config, mensagem.destino, `${resposta}\n\nMande 0 para ver o menu.`);
    } catch (erro) {
      console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
    }
    return Response.json({ ok: true, tratou: true });
  }

  const { estado, mensagens, acao } = responder(anterior, mensagem.texto);
  if (!estado) await historicos.gravar(mensagem.destino, undefined);
  await conversas.gravar(mensagem.destino, estado);

  try {
    for (const texto of mensagens) await enviarTexto(config, mensagem.destino, texto);
  } catch (erro) {
    console.error("whatsapp: falha ao enviar", erro instanceof Error ? erro.message : erro);
  }
  if (acao?.tipo === "consultar_das") {
    // Não esperamos: o robô leva minutos e o webhook precisa responder logo.
    void consultarDasEmSegundoPlano(config, mensagem.destino, acao.cnpj);
  }
  return Response.json({ ok: true, tratou: true });
}
