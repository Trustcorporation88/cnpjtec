import { randomUUID } from "node:crypto";
import type { Venda } from "@cnpjtec/motor-regras";
import { lerXmlDaNota } from "../cofre/nfe";
import type { DepsCaderno, VendaNova } from "../whatsapp/caderno";
import { chamar, textoDoConsentimentoDaConta, VERSAO_CONSENTIMENTO_CONTA, type ConfiguracaoDaConta } from "./servidor";

/** Número do WhatsApp (55 + DDD + número) no formato da conta (+55...). Acrescenta o 9 quando o WhatsApp omite. */
export function telefoneDaConta(numero: string | null): string | null {
  if (!numero) return null;
  const d = numero.replace(/\D/g, "");
  if (/^55[1-9][1-9]9\d{8}$/.test(d)) return `+${d}`;
  if (/^55[1-9][1-9][6-9]\d{7}$/.test(d)) return `+${d.slice(0, 4)}9${d.slice(4)}`;
  return null;
}

export function depsDoCaderno(config: ConfiguracaoDaConta, site: string): DepsCaderno {
  return {
    async temConta(telefone) {
      return (await chamar<unknown>(config, "srv_wa_conta", { p_telefone: telefone })) !== null;
    },
    async criarConta(telefone) {
      await chamar(config, "srv_wa_criar_conta", { p_telefone: telefone, p_consentimento: VERSAO_CONSENTIMENTO_CONTA });
    },
    async incluirVenda(telefone, venda: VendaNova) {
      await chamar(config, "srv_wa_venda_incluir", { p_telefone: telefone, p_venda: venda });
    },
    async vendas(telefone) {
      return (await chamar<Venda[] | null>(config, "srv_wa_vendas", { p_telefone: telefone })) ?? [];
    },
    async desfazer(telefone) {
      return chamar(config, "srv_wa_desfazer_venda", { p_telefone: telefone });
    },
    async guardarNota(telefone, xml) {
      const nota = lerXmlDaNota(xml);
      const r = await chamar<{ ok: boolean }>(config, "srv_wa_nota_gravar", { p_telefone: telefone, p_nota: nota, p_xml: xml });
      if (!r.ok) throw new Error("O cofre aceita até 3 mil notas por conta.");
      return { emitente: nota.emitenteNome ?? "fornecedor", numero: nota.numero, valor: nota.valorTotal };
    },
    async ligarLembretes(telefone) {
      return chamar<boolean>(config, "srv_wa_lembretes_ligar", { p_telefone: telefone });
    },
    async desligarLembretes(telefone) {
      return chamar<boolean>(config, "srv_wa_lembretes_desligar", { p_telefone: telefone });
    },
    agora: () => new Date(),
    site,
    consentimento:
      "Para guardar, eu crio uma conta no ProContador ligada a este WhatsApp. " +
      textoDoConsentimentoDaConta(config).replace(/^Ao criar a conta, /, "Com ela, "),
    novoId: () => randomUUID(),
  };
}
