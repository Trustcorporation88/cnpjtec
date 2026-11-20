/** Perfis da página inicial: um toque já responde as primeiras perguntas do Raio-X. */
export const PERFIS = {
  motorista: { estado: { vinculo: "conta_propria", tipos: ["transporte_passageiros"] }, passo: 1 },
  entregador: { estado: { vinculo: "conta_propria", tipos: ["entrega_de_bens"] }, passo: 1 },
  servico: { estado: { vinculo: "conta_propria", tipos: ["servico"] }, passo: 1 },
  revenda: { estado: { vinculo: "conta_propria", tipos: ["revenda_mercadoria"] }, passo: 1 },
  mei: { estado: { vinculo: "conta_propria", temMei: "sim", tipos: [] }, passo: 2 },
} as const;

export type Perfil = keyof typeof PERFIS;

export function lerPerfil(valor: string | undefined): Perfil | undefined {
  return valor && Object.hasOwn(PERFIS, valor) ? (valor as Perfil) : undefined;
}
