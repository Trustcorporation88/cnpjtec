import { ParametroAusente, PerfilInvalido } from "@cnpjtec/motor-regras";
import { medir, PedidoDoMedidor } from "@/lib/medidor";

export const dynamic = "force-dynamic";

function problema(status: number, titulo: string, detalhe: string): Response {
  return Response.json(
    { type: "about:blank", title: titulo, status, detail: detalhe },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Mede o uso do limite no ano. Não grava nada. */
export async function POST(request: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return problema(400, "Pedido inválido", "O corpo do pedido não é um JSON válido.");
  }
  const pedido = PedidoDoMedidor.safeParse(corpo);
  if (!pedido.success) {
    return problema(400, "Valores inválidos", "Confira os valores e tente de novo.");
  }
  try {
    return Response.json(medir(pedido.data), { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    if (erro instanceof PerfilInvalido) return problema(422, "Não deu para medir", erro.message);
    if (erro instanceof ParametroAusente) return problema(422, "Ano ainda sem regra", erro.message);
    throw erro;
  }
}
