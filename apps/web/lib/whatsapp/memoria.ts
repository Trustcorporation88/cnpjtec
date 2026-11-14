/** Guarda em memória, com prazo de validade. Some quando o servidor reinicia, e tudo bem: a conversa recomeça no menu. */
export function criarMemoria<T>(validadeMs: number, maximo = 5000, agora: () => number = Date.now) {
  const itens = new Map<string, { valor: T; expira: number }>();
  return {
    ler(chave: string): T | undefined {
      const item = itens.get(chave);
      if (!item) return undefined;
      if (item.expira <= agora()) {
        itens.delete(chave);
        return undefined;
      }
      return item.valor;
    },
    gravar(chave: string, valor: T | undefined): void {
      if (valor === undefined) {
        itens.delete(chave);
        return;
      }
      if (itens.size >= maximo && !itens.has(chave)) {
        const maisAntiga = itens.keys().next().value;
        if (maisAntiga !== undefined) itens.delete(maisAntiga);
      }
      itens.delete(chave);
      itens.set(chave, { valor, expira: agora() + validadeMs });
    },
  };
}
