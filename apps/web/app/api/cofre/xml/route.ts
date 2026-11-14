import { comSessao } from "@/lib/conta/rota";
import { chamar, problema } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

/** Devolve o XML original guardado, para a pessoa baixar. */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return problema(400, "Pedido inválido", "Nota não encontrada.");
  return comSessao(request, async (config, tokenHash) => {
    const xml = await chamar<string | null>(config, "srv_nota_xml", { p_token_hash: tokenHash, p_id: id });
    if (!xml) return problema(404, "Sem XML", "Essa nota foi guardada só pela chave, sem o arquivo.");
    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="nota-${id.slice(0, 8)}.xml"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
