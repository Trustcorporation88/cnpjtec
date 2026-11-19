import { buscarServicos, tabelaDeServicos } from "@cnpjtec/regras/servicos";

/** Busca os códigos da NFS-e na tabela oficial da Receita. Nada é guardado. */
export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.slice(0, 120) ?? "";
  return Response.json(
    {
      resultados: buscarServicos(q, 6),
      versaoBase: tabelaDeServicos.versaoBase,
      dataReferencia: tabelaDeServicos.dataReferencia,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
