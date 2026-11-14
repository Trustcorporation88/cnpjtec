import { describe, expect, it } from "vitest";
import { chaveValida, lerChave, lerXmlDaNota, limparChave, NotaInvalida, somar } from "./nfe";

const CHAVE = "35261171606245000251550010001234561123456780";
const CHAVE_ALFA = "35261112ABC34501DE35550010001234561123456789";

function xml(opcoes: { chave?: string; mod?: string; extra?: string } = {}) {
  const chave = opcoes.chave ?? CHAVE;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe${chave}" versao="4.00">
    <ide><mod>${opcoes.mod ?? "55"}</mod><nNF>123456</nNF><dhEmi>2026-11-03T10:15:00-03:00</dhEmi></ide>
    <emit><CNPJ>71606245000251</CNPJ><xNome>Marca de Cosmeticos S.A.</xNome></emit>
    <det nItem="1"><prod><xProd>Perfume 100 ml</xProd><NCM>33030010</NCM><CFOP>5405</CFOP><uCom>UN</uCom><qCom>2.0000</qCom><vProd>159.80</vProd></prod>
      <imposto><ICMS><ICMS60><orig>0</orig><CST>60</CST><vICMSSTRet>10.00</vICMSSTRet></ICMS60></ICMS></imposto></det>
    <det nItem="2"><prod><xProd>Sabonete</xProd><NCM>34011190</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>3</qCom><vProd>20.1</vProd></prod>
      <imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det>
    <total><ICMSTot><vST>0.00</vST><vNF>179.90</vNF></ICMSTot></total>
  </infNFe></NFe>${opcoes.extra ?? ""}
  <protNFe><infProt><cStat>100</cStat></infProt></protNFe>
</nfeProc>`;
}

describe("chave de acesso", () => {
  it("confere o dígito, inclusive com CNPJ alfanumérico", () => {
    expect(chaveValida(CHAVE)).toBe(true);
    expect(chaveValida(CHAVE_ALFA)).toBe(true);
    expect(chaveValida(CHAVE.slice(0, 43) + "1")).toBe(false);
    expect(chaveValida("123")).toBe(false);
  });

  it("limpa o que foi colado", () => {
    expect(limparChave("NFe 3526 1171 6062 4500 0251 5500 1000 1234 5611 2345 6780")).toBe(CHAVE);
  });

  it("lê emitente, número e mês só pela chave", () => {
    const n = lerChave(CHAVE);
    expect(n.emitenteCnpj).toBe("71606245000251");
    expect(n.numero).toBe("123456");
    expect(n.uf).toBe("SP");
    expect(n.mesAno).toBe("11/2026");
  });

  it("recusa chave de outro modelo", () => {
    const base = CHAVE.slice(0, 20) + "65" + CHAVE.slice(22, 43);
    let s = 0;
    let p = 2;
    for (let i = 42; i >= 0; i--) {
      s += (base.charCodeAt(i) - 48) * p;
      p = p === 9 ? 2 : p + 1;
    }
    const r = s % 11;
    const nfce = base + String(r < 2 ? 0 : 11 - r);
    expect(() => lerChave(nfce)).toThrow(NotaInvalida);
  });
});

describe("XML da NF-e", () => {
  it("lê a nota com protocolo", () => {
    const n = lerXmlDaNota(xml());
    expect(n.chave).toBe(CHAVE);
    expect(n.emitenteNome).toBe("Marca de Cosmeticos S.A.");
    expect(n.numero).toBe("123456");
    expect(n.dataEmissao).toBe("2026-11-03");
    expect(n.valorTotal).toBe("179.90");
    expect(n.itens).toHaveLength(2);
    expect(n.itens[0]).toMatchObject({ ncm: "33030010", situacaoIcms: "60", comSt: true, valor: "159.80" });
    expect(n.itens[1]).toMatchObject({ situacaoIcms: "102", comSt: false, valor: "20.10" });
  });

  it("recusa XML com DOCTYPE, de outro modelo ou com chave errada", () => {
    expect(() => lerXmlDaNota(`<!DOCTYPE x [<!ENTITY a "b">]>${xml()}`)).toThrow(NotaInvalida);
    expect(() => lerXmlDaNota(xml({ mod: "65" }))).toThrow(NotaInvalida);
    expect(() => lerXmlDaNota(xml({ chave: CHAVE.slice(0, 43) + "1" }))).toThrow(NotaInvalida);
    expect(() => lerXmlDaNota("<html></html>")).toThrow(NotaInvalida);
  });
});

describe("somar", () => {
  it("soma sem erro de arredondamento", () => {
    expect(somar(["0.10", "0.20", null, "159.80"])).toBe("160.10");
  });
});
