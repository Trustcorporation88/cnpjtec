/**
 * PDF da NFS-e (DANFSe) pelo gerador oficial da Receita, rodando como serviço interno
 * (servicos/calculadora-rtc/Dockerfile.danfse). Liga com RTC_DANFSE_URL.
 */
export interface ConfiguracaoDanfse {
  url: string;
}

export class XmlNaoEhNfse extends Error {}
export class FalhaNoDanfse extends Error {}

export function configuracaoDanfse(env: Record<string, string | undefined> = process.env): ConfiguracaoDanfse | null {
  const url = env.RTC_DANFSE_URL?.trim();
  return url ? { url: url.replace(/\/$/, "") } : null;
}

/** NFS-e do padrão nacional: raiz NFSe, com o grupo infNFSe. */
export function ehXmlDeNfse(xml: string): boolean {
  const inicio = xml.slice(0, 4000);
  return /<(?:\w+:)?NFSe[\s>]/.test(inicio) && /<(?:\w+:)?infNFSe[\s>]/.test(xml);
}

export async function gerarDanfse(
  config: ConfiguracaoDanfse,
  xml: string,
  buscar: typeof fetch = fetch,
): Promise<Buffer> {
  if (!ehXmlDeNfse(xml)) throw new XmlNaoEhNfse("Esse arquivo não é o XML de uma NFS-e do padrão nacional.");
  if (Buffer.byteLength(xml) > 1_048_576) throw new XmlNaoEhNfse("Arquivo grande demais.");
  const r = await buscar(`${config.url}/api/danfse`, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
    signal: AbortSignal.timeout(30_000),
  });
  if (r.status === 400) throw new XmlNaoEhNfse("O gerador oficial não conseguiu ler esse XML de NFS-e.");
  if (!r.ok) throw new FalhaNoDanfse(`Gerador do DANFSe respondeu ${r.status}.`);
  const pdf = Buffer.from(await r.arrayBuffer());
  if (pdf.subarray(0, 4).toString() !== "%PDF") throw new FalhaNoDanfse("O gerador não devolveu um PDF.");
  return pdf;
}
