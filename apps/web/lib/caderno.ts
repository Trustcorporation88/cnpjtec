import type { Venda } from "@cnpjtec/motor-regras";

/** Venda guardada no aparelho, com um identificador e uma descrição opcional. */
export interface VendaGuardada extends Venda {
  id: string;
  descricao: string;
}

export interface Caderno {
  versao: 1;
  vendas: VendaGuardada[];
}

const CHAVE = "meishop.caderno.v1";

function valida(v: unknown): v is VendaGuardada {
  if (typeof v !== "object" || v === null) return false;
  const x = v as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.data === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(x.data) &&
    typeof x.valor === "string" &&
    /^\d{1,9}(\.\d{1,2})?$/.test(x.valor) &&
    (x.tipo === "mercadoria" || x.tipo === "servico") &&
    typeof x.compradorTemCnpj === "boolean" &&
    typeof x.descricao === "string" &&
    x.descricao.length <= 120
  );
}

/** Lê um caderno vindo de arquivo ou do aparelho. Descarta o que estiver fora do formato. */
export function lerCaderno(texto: string | null): { caderno: Caderno; descartadas: number } {
  if (!texto) return { caderno: { versao: 1, vendas: [] }, descartadas: 0 };
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    throw new Error("O arquivo não é um caderno do MEiSHOP.");
  }
  const lista = (bruto as { vendas?: unknown })?.vendas;
  if (!Array.isArray(lista)) throw new Error("O arquivo não é um caderno do MEiSHOP.");
  const vendas = lista.filter(valida);
  return { caderno: { versao: 1, vendas }, descartadas: lista.length - vendas.length };
}

/** Junta dois cadernos sem repetir vendas com o mesmo identificador. */
export function juntarCadernos(atual: Caderno, novo: Caderno): Caderno {
  const ids = new Set(atual.vendas.map((v) => v.id));
  return { versao: 1, vendas: [...atual.vendas, ...novo.vendas.filter((v) => !ids.has(v.id))] };
}

export function carregarDoAparelho(): Caderno {
  try {
    return lerCaderno(window.localStorage.getItem(CHAVE)).caderno;
  } catch {
    return { versao: 1, vendas: [] };
  }
}

/** Devolve falso quando o navegador não deixa guardar (modo anônimo, por exemplo). */
export function guardarNoAparelho(caderno: Caderno): boolean {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(caderno));
    return true;
  } catch {
    return false;
  }
}

function campoCsv(texto: string): string {
  // Evita que planilhas tratem o texto como fórmula.
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/** Planilha das vendas de um ano, no formato que o Excel brasileiro abre direto. */
export function planilhaDoAno(caderno: Caderno, ano: number): string {
  const linhas = caderno.vendas
    .filter((v) => v.data.startsWith(`${ano}-`))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((v) => {
      const [a, m, d] = v.data.split("-");
      return [
        `${d}/${m}/${a}`,
        v.tipo === "mercadoria" ? "Produto" : "Serviço",
        v.compradorTemCnpj ? "Empresa" : "Pessoa física",
        v.valor.replace(".", ","),
        campoCsv(v.descricao),
      ].join(";");
    });
  return ["Data;Tipo;Para quem;Valor;Descrição", ...linhas].join("\r\n");
}
