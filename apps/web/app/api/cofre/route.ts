import { z } from "zod";
import { lerChave, lerXmlDaNota, limparChave, NotaInvalida, type NotaDeCompra } from "@/lib/cofre/nfe";
import { comSessao } from "@/lib/conta/rota";
import { chamar, mesmaOrigem, problema } from "@/lib/conta/servidor";

export const dynamic = "force-dynamic";

const Pedido = z.union([
  z.object({ xml: z.string().min(50).max(1_048_576) }).strict(),
  z.object({ chave: z.string().min(44).max(80) }).strict(),
]);

/** Notas de compra guardadas no cofre (sem o XML, que sai por /api/cofre/xml). */
export async function GET(request: Request): Promise<Response> {
  return comSessao(request, async (config, tokenHash) => {
    const notas = await chamar<unknown[]>(config, "srv_notas", { p_token_hash: tokenHash });
    return Response.json({ notas }, { headers: { "Cache-Control": "no-store" } });
  });
}

/** Guarda uma nota pelo XML ou só pela chave de acesso. */
export async function POST(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const texto = await request.text();
  if (texto.length > 1_200_000) return problema(413, "Arquivo grande demais", "O XML da nota passa de 1 MB.");
  const corpo = Pedido.safeParse((() => { try { return JSON.parse(texto); } catch { return null; } })());
  if (!corpo.success) return problema(400, "Pedido inválido", "Mande o XML da nota ou a chave de acesso.");

  let nota: NotaDeCompra;
  let xml: string | null = null;
  try {
    if ("xml" in corpo.data) {
      nota = lerXmlDaNota(corpo.data.xml);
      xml = corpo.data.xml;
    } else {
      const { uf: _uf, modelo: _m, mesAno: _ma, ...resto } = lerChave(limparChave(corpo.data.chave));
      nota = resto;
    }
  } catch (erro) {
    if (erro instanceof NotaInvalida) return problema(400, "Nota não aceita", erro.message);
    throw erro;
  }

  return comSessao(request, async (config, tokenHash) => {
    const r = await chamar<{ ok: boolean; motivo?: string; id?: string | null }>(config, "srv_nota_gravar", {
      p_token_hash: tokenHash,
      p_nota: nota,
      p_xml: xml,
    });
    if (!r.ok) return problema(409, "Cofre cheio", "O cofre aceita até 3 mil notas por conta.");
    return Response.json({ ok: true, chave: nota.chave, jaTinha: r.id === null });
  });
}

/** Apaga uma nota do cofre. */
export async function DELETE(request: Request): Promise<Response> {
  if (!mesmaOrigem(request)) return problema(403, "Pedido recusado", "Abra o site e tente de novo.");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return problema(400, "Pedido inválido", "Nota não encontrada.");
  return comSessao(request, async (config, tokenHash) => {
    const apagou = await chamar<boolean>(config, "srv_nota_apagar", { p_token_hash: tokenHash, p_id: id });
    return apagou ? Response.json({ ok: true }) : problema(404, "Nota não encontrada", "Ela já foi apagada.");
  });
}
