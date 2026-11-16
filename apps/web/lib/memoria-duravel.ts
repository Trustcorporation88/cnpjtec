import { createHash } from "node:crypto";
import { chamar, configuracaoDaConta, type ConfiguracaoDaConta } from "./conta/servidor";
import { criarMemoria } from "./whatsapp/memoria";

/**
 * Memória curta que sobrevive às publicações do site: guarda no banco (funções srv_mem_* e srv_contar).
 * Sem banco configurado, ou se ele falhar, usa a memória do processo, para o WhatsApp nunca parar.
 */
export interface MemoriaDuravel {
  ler<T>(item: string): Promise<T | undefined>;
  gravar<T>(item: string, valor: T | undefined, segundos: number): Promise<void>;
  /** Grava só se não existir. Devolve verdadeiro quando gravou agora (o item era novo). */
  reservar(item: string, segundos: number): Promise<boolean>;
  /** Devolve o valor já guardado, ou guarda e devolve o novo. */
  obterOuGuardar<T>(item: string, valor: T, segundos: number): Promise<T>;
  /** Soma um. Verdadeiro enquanto não passar do máximo na janela. */
  contar(item: string, maximo: number, segundos: number): Promise<boolean>;
}

/** Resumo de um identificador (número, JID) para não guardar o dado em claro. */
export function resumo(texto: string): string {
  return createHash("sha256").update(`procontador:${texto}`).digest("hex").slice(0, 32);
}

function memoriaLocal(): MemoriaDuravel {
  const itens = criarMemoria<unknown>(48 * 60 * 60 * 1000, 20000);
  const validade = new Map<string, number>();
  const vivo = (item: string) => {
    const fim = validade.get(item);
    if (fim === undefined) return false;
    if (fim <= Date.now()) {
      validade.delete(item);
      itens.gravar(item, undefined);
      return false;
    }
    return true;
  };
  const guardar = (item: string, valor: unknown, segundos: number) => {
    itens.gravar(item, valor);
    validade.set(item, Date.now() + segundos * 1000);
  };
  return {
    async ler<T>(item: string) {
      return vivo(item) ? (itens.ler(item) as T | undefined) : undefined;
    },
    async gravar(item, valor, segundos) {
      if (valor === undefined) {
        itens.gravar(item, undefined);
        validade.delete(item);
      } else guardar(item, valor, segundos);
    },
    async reservar(item, segundos) {
      if (vivo(item)) return false;
      guardar(item, true, segundos);
      return true;
    },
    async obterOuGuardar<T>(item: string, valor: T, segundos: number) {
      if (vivo(item)) return itens.ler(item) as T;
      guardar(item, valor, segundos);
      return valor;
    },
    async contar(item, maximo, segundos) {
      const atual = vivo(item) ? ((itens.ler(item) as number) ?? 0) : 0;
      if (atual === 0) guardar(item, 1, segundos);
      else itens.gravar(item, atual + 1);
      return atual + 1 <= maximo;
    },
  };
}

export function criarMemoriaDuravel(
  config: ConfiguracaoDaConta | null,
  buscar: typeof fetch = fetch,
): MemoriaDuravel {
  const local = memoriaLocal();
  if (!config) return local;
  const falhou = (onde: string, e: unknown) =>
    console.error(`memoria: ${onde} falhou, usando a do processo`, e instanceof Error ? e.message : e);
  return {
    async ler<T>(item: string) {
      try {
        const v = await chamar<T | null>(config, "srv_mem_ler", { p_item: item }, buscar);
        return v ?? undefined;
      } catch (e) {
        falhou("ler", e);
        return local.ler<T>(item);
      }
    },
    async gravar(item, valor, segundos) {
      try {
        await chamar(config, "srv_mem_gravar", { p_item: item, p_valor: valor ?? null, p_segundos: segundos }, buscar);
      } catch (e) {
        falhou("gravar", e);
        await local.gravar(item, valor, segundos);
      }
    },
    async reservar(item, segundos) {
      const marca = `${Date.now()}:${Math.random()}`;
      try {
        const v = await chamar<string>(config, "srv_mem_reservar", { p_item: item, p_valor: marca, p_segundos: segundos }, buscar);
        return v === marca;
      } catch (e) {
        falhou("reservar", e);
        return local.reservar(item, segundos);
      }
    },
    async obterOuGuardar<T>(item: string, valor: T, segundos: number) {
      try {
        return await chamar<T>(config, "srv_mem_reservar", { p_item: item, p_valor: valor, p_segundos: segundos }, buscar);
      } catch (e) {
        falhou("obterOuGuardar", e);
        return local.obterOuGuardar(item, valor, segundos);
      }
    },
    async contar(item, maximo, segundos) {
      try {
        return await chamar<boolean>(config, "srv_contar", { p_item: item, p_maximo: maximo, p_segundos: segundos }, buscar);
      } catch (e) {
        falhou("contar", e);
        return local.contar(item, maximo, segundos);
      }
    },
  };
}

let unica: MemoriaDuravel | null = null;

/** Memória do processo inteiro, ligada ao banco quando as variáveis da conta existem. */
export function memoriaDoServidor(): MemoriaDuravel {
  unica ??= criarMemoriaDuravel(configuracaoDaConta());
  return unica;
}
