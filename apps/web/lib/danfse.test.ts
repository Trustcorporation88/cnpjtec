import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { configuracaoDanfse, ehXmlDeNfse, FalhaNoDanfse, gerarDanfse, XmlNaoEhNfse } from "./danfse";

// Exemplo oficial de NFS-e válida, do repositório da calculadora da Receita (testes do regime regular).
const nfse = readFileSync(new URL("./__fixtures__/nfse-exemplo-receita.xml", import.meta.url), "utf8");
const config = { url: "http://rtc-danfse.railway.internal:8080" };

describe("DANFSe", () => {
  it("liga só com a variável", () => {
    expect(configuracaoDanfse({})).toBeNull();
    expect(configuracaoDanfse({ RTC_DANFSE_URL: "http://x:8080/" })).toEqual({ url: "http://x:8080" });
  });

  it("reconhece o XML da NFS-e nacional e recusa nota de compra", () => {
    expect(ehXmlDeNfse(nfse)).toBe(true);
    expect(ehXmlDeNfse('<nfeProc><NFe><infNFe Id="x"></infNFe></NFe></nfeProc>')).toBe(false);
  });

  it("manda o XML cru ao gerador oficial e devolve o PDF", async () => {
    const buscar = vi.fn(async () => new Response(new Uint8Array(Buffer.from("%PDF-1.7 teste")), { status: 200 }));
    const pdf = await gerarDanfse(config, nfse, buscar as unknown as typeof fetch);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const [url, init] = buscar.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://rtc-danfse.railway.internal:8080/api/danfse");
    expect(init.body).toBe(nfse);
  });

  it("traduz os erros", async () => {
    await expect(gerarDanfse(config, "<a/>")).rejects.toBeInstanceOf(XmlNaoEhNfse);
    const ruim = vi.fn(async () => new Response("x", { status: 400 }));
    await expect(gerarDanfse(config, nfse, ruim as unknown as typeof fetch)).rejects.toBeInstanceOf(XmlNaoEhNfse);
    const fora = vi.fn(async () => new Response("x", { status: 500 }));
    await expect(gerarDanfse(config, nfse, fora as unknown as typeof fetch)).rejects.toBeInstanceOf(FalhaNoDanfse);
  });
});
