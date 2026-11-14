import { XMLParser } from "fast-xml-parser";

/**
 * Leitura de NF-e de compra (modelo 55) para o Cofre de Provas.
 * Só extrai o que serve para provar a origem da mercadoria e somar compras.
 * Não decide imposto: o ICMS-ST aparece como informação da nota, não como conclusão.
 */

export interface ItemDaNota {
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  quantidade: string | null;
  unidade: string | null;
  valor: string;
  /** Situação tributária do ICMS como veio na nota (CST ou CSOSN). */
  situacaoIcms: string | null;
  /** Verdadeiro quando a nota indica ICMS cobrado por substituição tributária. */
  comSt: boolean;
}

export interface NotaDeCompra {
  chave: string;
  origem: "xml" | "chave";
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  numero: string | null;
  dataEmissao: string | null;
  valorTotal: string | null;
  valorIcmsSt: string | null;
  itens: ItemDaNota[];
}

export class NotaInvalida extends Error {}

const UF_POR_CODIGO: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA",
  "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
  "41": "PR", "42": "SC", "43": "RS",
  "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/** Limpa o que a pessoa digitou ou colou (espaços, pontos, o prefixo "NFe"). */
export function limparChave(texto: string): string {
  return texto.toUpperCase().replace(/^NFE/, "").replace(/[^0-9A-Z]/g, "");
}

/**
 * Confere o dígito da chave de acesso (módulo 11, pesos de 2 a 9 da direita para a esquerda).
 * Letras do CNPJ alfanumérico valem o código ASCII menos 48, como na regra da Receita.
 */
export function chaveValida(chave: string): boolean {
  if (!/^[0-9]{6}[0-9A-Z]{14}[0-9]{24}$/.test(chave)) return false;
  if (!UF_POR_CODIGO[chave.slice(0, 2)]) return false;
  const mes = Number(chave.slice(4, 6));
  if (mes < 1 || mes > 12) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += (chave.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const digito = resto < 2 ? 0 : 11 - resto;
  return digito === Number(chave[43]);
}

/** O que dá para saber só pela chave, sem o XML. */
export function lerChave(chave: string): NotaDeCompra & { uf: string; modelo: string; mesAno: string } {
  if (!chaveValida(chave)) throw new NotaInvalida("Essa chave de acesso não confere. Confira os 44 caracteres.");
  const modelo = chave.slice(20, 22);
  if (modelo !== "55") throw new NotaInvalida("Essa chave não é de uma NF-e de compra (modelo 55).");
  return {
    chave,
    origem: "chave",
    emitenteCnpj: chave.slice(6, 20),
    emitenteNome: null,
    numero: String(Number(chave.slice(25, 34))),
    dataEmissao: null,
    valorTotal: null,
    valorIcmsSt: null,
    itens: [],
    uf: UF_POR_CODIGO[chave.slice(0, 2)]!,
    modelo,
    mesAno: `${chave.slice(4, 6)}/20${chave.slice(2, 4)}`,
  };
}

type No = Record<string, unknown>;

function lista<T>(x: T | T[] | undefined): T[] {
  return x === undefined ? [] : Array.isArray(x) ? x : [x];
}

function texto(x: unknown, maximo = 120): string | null {
  if (x === undefined || x === null) return null;
  const t = String(x).trim();
  return t ? t.slice(0, maximo) : null;
}

function dinheiro(x: unknown): string | null {
  const t = texto(x, 20);
  if (!t || !/^\d{1,13}(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro = "0", centavos = ""] = t.split(".");
  return `${inteiro}.${centavos.padEnd(2, "0")}`;
}

function quantidade(x: unknown): string | null {
  const t = texto(x, 20);
  return t && /^\d{1,11}(\.\d{1,4})?$/.test(t) ? t : null;
}

const CST_COM_ST = new Set(["10", "30", "60", "70"]);
const CSOSN_COM_ST = new Set(["201", "202", "203", "500"]);

function lerIcms(imposto: No | undefined): { situacao: string | null; comSt: boolean; valorSt: number } {
  const icms = (imposto?.ICMS ?? {}) as No;
  const grupo = Object.values(icms)[0] as No | undefined;
  if (!grupo) return { situacao: null, comSt: false, valorSt: 0 };
  const cst = texto(grupo.CST, 3);
  const csosn = texto(grupo.CSOSN, 3);
  const valorSt = Number(grupo.vICMSST ?? 0);
  const comSt =
    (cst !== null && CST_COM_ST.has(cst)) ||
    (csosn !== null && CSOSN_COM_ST.has(csosn)) ||
    valorSt > 0 ||
    grupo.vICMSSTRet !== undefined;
  return { situacao: csosn ?? cst, comSt, valorSt: Number.isFinite(valorSt) ? valorSt : 0 };
}

const leitor = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
});

/** Lê o XML de uma NF-e (com ou sem o protocolo de autorização). */
export function lerXmlDaNota(xml: string): NotaDeCompra {
  if (xml.length > 1_048_576) throw new NotaInvalida("O arquivo passa de 1 MB. Isso não parece uma NF-e.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new NotaInvalida("O arquivo tem conteúdo que não aceitamos.");

  let raiz: No;
  try {
    raiz = leitor.parse(xml) as No;
  } catch {
    throw new NotaInvalida("Não conseguimos ler o arquivo. Mande o XML da nota, do jeito que veio.");
  }
  const nfe = ((raiz.nfeProc as No | undefined)?.NFe ?? raiz.NFe) as No | undefined;
  const inf = nfe?.infNFe as No | undefined;
  if (!inf) throw new NotaInvalida("Esse arquivo não é o XML de uma NF-e.");

  const chave = limparChave(String(inf["@Id"] ?? ""));
  if (!chaveValida(chave)) throw new NotaInvalida("A chave de acesso dentro do XML não confere.");

  const ide = (inf.ide ?? {}) as No;
  if (texto(ide.mod, 2) !== "55") throw new NotaInvalida("Esse XML não é de uma NF-e de compra (modelo 55).");
  const emit = (inf.emit ?? {}) as No;
  const total = ((inf.total as No | undefined)?.ICMSTot ?? {}) as No;
  const dataBruta = texto(ide.dhEmi, 40) ?? texto(ide.dEmi, 10);
  const data = dataBruta && /^\d{4}-\d{2}-\d{2}/.test(dataBruta) ? dataBruta.slice(0, 10) : null;

  const detalhes = lista(inf.det as No | No[] | undefined);
  if (detalhes.length > 990) throw new NotaInvalida("A nota tem itens demais para o cofre.");
  let somaSt = 0;
  const itens: ItemDaNota[] = detalhes.map((det) => {
    const prod = (det.prod ?? {}) as No;
    const icms = lerIcms(det.imposto as No | undefined);
    somaSt += icms.valorSt;
    return {
      descricao: texto(prod.xProd, 120) ?? "Item sem descrição",
      ncm: texto(prod.NCM, 8),
      cfop: texto(prod.CFOP, 4),
      quantidade: quantidade(prod.qCom),
      unidade: texto(prod.uCom, 6),
      valor: dinheiro(prod.vProd) ?? "0.00",
      situacaoIcms: icms.situacao,
      comSt: icms.comSt,
    };
  });

  const emitenteCnpj = texto(emit.CNPJ, 14) ?? texto(emit.CPF, 11);
  return {
    chave,
    origem: "xml",
    emitenteCnpj: emitenteCnpj?.toUpperCase() ?? null,
    emitenteNome: texto(emit.xNome, 120),
    numero: texto(ide.nNF, 12),
    dataEmissao: data,
    valorTotal: dinheiro(total.vNF),
    valorIcmsSt: dinheiro(total.vST) ?? (somaSt > 0 ? somaSt.toFixed(2) : null),
    itens,
  };
}

export { somar } from "./valores";
