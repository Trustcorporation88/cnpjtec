import {
  configuracaoDoRadar,
  criarLimite,
  gravarPedido,
  normalizarContato,
  PedidoDeAviso,
} from "@/lib/radar";

export const dynamic = "force-dynamic";

const dentroDoLimite = criarLimite(5, 10 * 60 * 1000);

function problema(status: number, titulo: string, detalhe: string): Response {
  return Response.json(
    { type: "about:blank", title: titulo, status, detail: detalhe },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Registra o pedido de aviso sobre o CNPJ técnico. */
export async function POST(request: Request): Promise<Response> {
  const config = configuracaoDoRadar();
  if (!config) {
    return problema(503, "Aviso indisponível", "O aviso ainda não está disponível. Tente outro dia.");
  }

  const origem = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (!dentroDoLimite(origem)) {
    return problema(429, "Muitos pedidos", "Espere alguns minutos e tente de novo.");
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return problema(400, "Pedido inválido", "O corpo do pedido não é um JSON válido.");
  }

  const pedido = PedidoDeAviso.safeParse(corpo);
  if (!pedido.success) {
    return problema(400, "Pedido inválido", "Confira o contato e marque que aceita receber o aviso.");
  }

  const contato = normalizarContato(pedido.data.canal, pedido.data.contato);
  if (!contato) {
    return problema(
      400,
      "Contato inválido",
      pedido.data.canal === "whatsapp"
        ? "Digite o celular com DDD. Exemplo: 14 99999 9999"
        : "Digite um e-mail válido. Exemplo: nome@email.com",
    );
  }

  try {
    const gravou = await gravarPedido(config, {
      canal: pedido.data.canal,
      contato,
      trilha: pedido.data.trilha,
      uf: pedido.data.uf ?? null,
    });
    if (!gravou) throw new Error("O banco recusou a gravação.");
  } catch (erro) {
    console.error("radar: falha ao gravar pedido", erro instanceof Error ? erro.message : erro);
    return problema(502, "Não deu para anotar", "Não conseguimos anotar o seu contato. Tente de novo.");
  }

  return Response.json({ anotado: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
