/**
 * Lê um valor digitado em formato brasileiro ("1.200,50", "1200", "R$ 800") e devolve
 * texto decimal ("1200.50"). Devolve null quando não dá para entender.
 */
export function lerValor(digitado: string): string | null {
  const limpo = digitado.replace(/R\$|\s/g, "");
  if (limpo === "") return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro = "", centavos = ""] = limpo.replace(/\./g, "").split(",");
  const semZeros = inteiro.replace(/^0+(?=\d)/, "");
  if (semZeros.length > 9) return null;
  return centavos ? `${semZeros}.${centavos.padEnd(2, "0")}` : semZeros;
}

const formato = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Mostra um texto decimal como dinheiro. Só para exibição, nunca para conta. */
export function mostrarValor(decimal: string): string {
  return formato.format(Number(decimal)).replace(/ /g, " ");
}
