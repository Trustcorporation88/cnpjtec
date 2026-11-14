/** Soma valores em texto ("12.34") sem erro de arredondamento. */
export function somar(valores: (string | null)[]): string {
  let centavos = 0n;
  for (const v of valores) {
    if (!v) continue;
    const [i = "0", c = ""] = v.split(".");
    centavos += BigInt(i) * 100n + BigInt((c + "00").slice(0, 2));
  }
  const inteiro = centavos / 100n;
  const resto = (centavos % 100n).toString().padStart(2, "0");
  return `${inteiro}.${resto}`;
}
