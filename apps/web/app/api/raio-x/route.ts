import { ParametroAusente, PerfilInvalido } from "@cnpjtec/motor-regras";
import { diagnosticar, Respostas } from "@/lib/respostas";

export const dynamic = "force-dynamic";

function problema(status: number, titulo: string, detalhe: string): Response {
  return Response.json(
    { type: "about:blank", title: titulo, status, detail: detalhe },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

/** Recebe as respostas do questionário e devolve o diagnóstico. Não grava nada. */
export async function POST(request: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return problema(400, "Pedido inválido", "O corpo do pedido não é um JSON válido.");
  }

  const respostas = Respostas.safeParse(corpo);
  if (!respostas.success) {
    return problema(400, "Respostas inválidas", "Confira as respostas e tente de novo.");
  }

  try {
    return Response.json(diagnosticar(respostas.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (erro) {
    if (erro instanceof PerfilInvalido) {
      return problema(422, "Não deu para avaliar", erro.message);
    }
    if (erro instanceof ParametroAusente) {
      return problema(422, "Ano ainda sem regra", erro.message);
    }
    throw erro;
  }
}
