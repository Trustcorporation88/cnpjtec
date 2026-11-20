/**
 * Roda uma vez quando o servidor sobe. Quando o número público do WhatsApp está configurado,
 * aponta o webhook da instância dele para o ProContador. Sem o número, não faz nada.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { configuracaoEvolution, configurarWebhook, numeroPublicoDoWhatsapp } = await import("@/lib/whatsapp/evolution");
  const config = configuracaoEvolution();
  const site = process.env.SITE_URL?.trim();
  if (!config || !site || !numeroPublicoDoWhatsapp()) return;
  try {
    const ok = await configurarWebhook(config, site);
    console.info(ok ? "whatsapp: webhook configurado" : "whatsapp: a Evolution recusou o webhook", { instancia: config.instancia });
  } catch (erro) {
    console.error("whatsapp: falha ao configurar o webhook", { instancia: config.instancia, erro: String(erro) });
  }
}
