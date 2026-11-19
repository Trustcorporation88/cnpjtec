import { chamar, type ConfiguracaoDaConta } from "./conta/servidor";
import { lembretesDoDia, type Assinante } from "./lembretes";
import { enviarTexto, type ConfiguracaoEvolution } from "./whatsapp/evolution";

export interface ResultadoDoDisparo {
  assinantes: number;
  enviados: number;
  repetidos: number;
  falhas: number;
}

/** Número no formato da Evolution: só dígitos, com 55. */
export function destinoDoTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

/**
 * Manda os lembretes do dia. Marca cada um antes de enviar (para nunca repetir) e desmarca se o
 * envio falhar, para tentar de novo no dia seguinte.
 */
export async function dispararLembretes(
  conta: ConfiguracaoDaConta,
  evolution: ConfiguracaoEvolution,
  hoje: string,
  site: string,
  opcoes: { buscar?: typeof fetch; pausaMs?: number } = {},
): Promise<ResultadoDoDisparo> {
  const buscar = opcoes.buscar ?? fetch;
  const assinantes = await chamar<Assinante[]>(conta, "srv_lembretes_assinantes", {}, buscar);
  const r: ResultadoDoDisparo = { assinantes: assinantes.length, enviados: 0, repetidos: 0, falhas: 0 };
  for (const a of assinantes) {
    for (const l of lembretesDoDia(a, hoje, site)) {
      const novo = await chamar<boolean>(conta, "srv_lembrete_marcar", { p_telefone: a.telefone, p_lembrete: l.chave }, buscar);
      if (!novo) {
        r.repetidos++;
        continue;
      }
      try {
        await enviarTexto(evolution, destinoDoTelefone(a.telefone), l.texto, buscar);
        r.enviados++;
        if (opcoes.pausaMs) await new Promise((ok) => setTimeout(ok, opcoes.pausaMs));
      } catch (erro) {
        r.falhas++;
        console.error("lembretes: envio", l.chave, erro instanceof Error ? erro.message : erro);
        await chamar(conta, "srv_lembrete_desmarcar", { p_telefone: a.telefone, p_lembrete: l.chave }, buscar).catch(() => {});
      }
    }
  }
  return r;
}
