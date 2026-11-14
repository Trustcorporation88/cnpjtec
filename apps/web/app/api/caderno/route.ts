import { lerCaderno } from "@/lib/caderno";
import { comSessao } from "@/lib/conta/rota";
import { chamar, mesmaOrigem, problema } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

/** Vendas guardadas na conta. */
export async function GET(request: Request): Promise<Response> {
  return comSessao(request, async (config, tokenHash) => {
    const vendas = await chamar<unknown[]>(config, "srv_vendas", { p_token_hash: tokenHash });
    return Response.json({ versao: 1, vendas }, { headers: { "Cache-Control": "no-store" } });
  });
}

/** Substitui as vendas da conta pela lista enviada. Vendas fora do formato são descartadas. */
export async function PUT(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const texto = await request.text();
  if (texto.length > 1_500_000) return problema(413, "Caderno grande demais", "O limite é de 5 mil vendas.");
  let caderno;
  try {
    caderno = lerCaderno(texto).caderno;
  } catch {
    return problema(400, "Caderno inválido", "Não foi possível ler as vendas enviadas.");
  }
  if (caderno.vendas.length > 5000) return problema(413, "Caderno grande demais", "O limite é de 5 mil vendas.");
  return comSessao(request, async (config, tokenHash) => {
    const total = await chamar<number>(config, "srv_vendas_substituir", {
      p_token_hash: tokenHash,
      p_vendas: caderno.vendas,
    });
    return Response.json({ ok: true, total });
  });
}
