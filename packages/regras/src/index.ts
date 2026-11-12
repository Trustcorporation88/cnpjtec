import dados from "../dados/regras.json";
import { BaseDeRegras, type Regra } from "./esquema";

export * from "./esquema";

/** Base de regras validada. Falha na carga se o arquivo estiver fora do esquema. */
export const baseDeRegras: BaseDeRegras = BaseDeRegras.parse(dados);

const porId = new Map<string, Regra>(baseDeRegras.regras.map((r) => [r.id, r]));

/** Devolve a regra pelo identificador. Lança erro se não existir, para nunca citar regra inventada. */
export function buscarRegra(id: string): Regra {
  const regra = porId.get(id);
  if (!regra) throw new Error(`Regra ${id} não existe na base de regras.`);
  return regra;
}

/** Regras que ainda não podem ser afirmadas ao usuário como certas. */
export function regrasIncertas(): Regra[] {
  return baseDeRegras.regras.filter(
    (r) => r.status === "PENDENTE" || r.status === "ANUNCIADO" || r.status === "A_CONFIRMAR",
  );
}
