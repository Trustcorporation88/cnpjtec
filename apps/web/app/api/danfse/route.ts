import { configuracaoDanfse, gerarDanfse, XmlNaoEhNfse } from "@/lib/danfse";
import { mesmaOrigem, problema } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

/** Recebe o XML de uma NFS-e e devolve o PDF oficial (DANFSe). Nada é guardado. */
export async function POST(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const config = configuracaoDanfse();
  if (!config) return problema(503, "Indisponível", "O gerador de PDF da nota de serviço ainda não está ligado.");
  const tamanho = Number(request.headers.get("content-length") ?? "0");
  if (tamanho > 1_048_576) return problema(413, "Arquivo grande demais", "Mande um XML de até 1 MB.");
  const xml = await request.text();
  try {
    const pdf = await gerarDanfse(config, xml);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="nota-de-servico.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof XmlNaoEhNfse) return problema(400, "XML não reconhecido", e.message);
    console.error("danfse:", e instanceof Error ? e.message : e);
    return problema(502, "Falha ao gerar", "Não conseguimos gerar o PDF agora. Tente de novo em instantes.");
  }
}
