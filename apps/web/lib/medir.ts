/**
 * Eventos do Google Analytics 4. Só saem quando a pessoa aceitou a medição e o GA4 está ligado
 * (variável GA4_ID). Nunca mandar CPF, CNPJ, telefone, valores digitados ou texto livre.
 */
export type Evento =
  | "raio_x_concluido"
  | "venda_anotada"
  | "duvida_enviada"
  | "das_consultado"
  | "declaracao_impressa"
  | "conta_criada"
  | "codigos_consultados";

export const CHAVE_DO_ACEITE = "procontador.medicao.v1";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function medir(evento: Evento, parametros: Record<string, string | number | boolean> = {}): void {
  try {
    if (typeof window === "undefined" || !window.gtag) return;
    if (localStorage.getItem(CHAVE_DO_ACEITE) !== "sim") return;
    window.gtag("event", evento, parametros);
  } catch {
    // Medição nunca atrapalha o uso.
  }
}
