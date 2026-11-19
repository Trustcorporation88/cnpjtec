import { configuracaoDaConta, problema } from "@/lib/conta/servidor";
import { dispararLembretes } from "@/lib/lembretes-envio";
import { configuracaoEvolution, segredoConfere } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Disparo diário dos lembretes. Chamado pelo agendador do Railway com o segredo no cabeçalho. */
export async function POST(request: Request): Promise<Response> {
  const segredo = process.env.LEMBRETES_SEGREDO;
  if (!segredo || !segredoConfere(segredo, request.headers.get("x-segredo"))) {
    return problema(401, "Não autorizado", "Segredo ausente ou errado.");
  }
  const conta = configuracaoDaConta();
  const evolution = configuracaoEvolution();
  if (!conta || !evolution) return problema(503, "Indisponível", "Banco ou WhatsApp não configurados.");
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const site = (process.env.SITE_URL ?? "https://app.procontador.com.br").replace(/\/$/, "");
  const resultado = await dispararLembretes(conta, evolution, hoje, site, { pausaMs: 1500 });
  console.log("lembretes:", hoje, JSON.stringify(resultado));
  return Response.json({ hoje, ...resultado });
}
