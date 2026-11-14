import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

/**
 * Acesso do servidor às funções srv_ do Supabase. Nada daqui roda no navegador.
 * A chave do servidor fica só no Railway; o banco guarda apenas o hash dela.
 */

export const COOKIE_SESSAO = "pc_sessao";
export const VERSAO_CONSENTIMENTO_CONTA = "2026-11-14";
const TRINTA_DIAS = 30 * 24 * 60 * 60;

export interface ConfiguracaoDaConta {
  url: string;
  chavePublica: string;
  chaveServidor: string;
  controladorCnpj: string;
  controladorNome: string | null;
}

export function configuracaoDaConta(
  env: Record<string, string | undefined> = process.env,
): ConfiguracaoDaConta | null {
  const ler = (n: string) => env[n]?.trim() || null;
  const url = ler("SUPABASE_URL");
  const chavePublica = ler("SUPABASE_PUBLISHABLE_KEY");
  const chaveServidor = ler("SUPABASE_CHAVE_SERVIDOR");
  const controladorCnpj = ler("CONTROLADOR_CNPJ");
  if (!url || !chavePublica || !chaveServidor || chaveServidor.length < 32 || !controladorCnpj) return null;
  return {
    url: url.replace(/\/$/, ""),
    chavePublica,
    chaveServidor,
    controladorCnpj,
    controladorNome: ler("CONTROLADOR_NOME"),
  };
}

export class ErroDeSessao extends Error {}

/** Chama uma função srv_ do banco. Sessão inválida vira ErroDeSessao. */
export async function chamar<T>(
  config: ConfiguracaoDaConta,
  funcao: string,
  parametros: Record<string, unknown>,
  buscar: typeof fetch = fetch,
): Promise<T> {
  const resposta = await buscar(`${config.url}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.chavePublica,
      Authorization: `Bearer ${config.chavePublica}`,
    },
    body: JSON.stringify({ p_chave: config.chaveServidor, ...parametros }),
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const texto = await resposta.text();
  if (!resposta.ok) {
    if (texto.includes("28000") || texto.includes("sessao invalida")) throw new ErroDeSessao();
    throw new Error(`Banco respondeu ${resposta.status} em ${funcao}.`);
  }
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Hash do token de sessão. O token só existe no cookie da pessoa. */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Hash do código, amarrado ao telefone e à chave do servidor, para não dar para adivinhar pelo banco. */
export function hashDoCodigo(config: ConfiguracaoDaConta, telefone: string, codigo: string): string {
  return createHmac("sha256", config.chaveServidor).update(`${telefone}:${codigo}`).digest("hex");
}

export function novoCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

export function opcoesDoCookie(segundos = TRINTA_DIAS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: segundos,
  };
}

/** Lê o token do cabeçalho Cookie. */
export function tokenDoPedido(request: Request): string | null {
  const cabecalho = request.headers.get("cookie") ?? "";
  for (const parte of cabecalho.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === COOKIE_SESSAO) {
      const valor = resto.join("=");
      return /^[A-Za-z0-9_-]{40,60}$/.test(valor) ? valor : null;
    }
  }
  return null;
}

export interface Sessao {
  id: string;
  telefone: string;
  criadaEm: string;
  tokenHash: string;
}

export async function sessaoDoPedido(config: ConfiguracaoDaConta, request: Request): Promise<Sessao | null> {
  const token = tokenDoPedido(request);
  if (!token) return null;
  const tokenHash = hashDoToken(token);
  const dados = await chamar<Omit<Sessao, "tokenHash"> | null>(config, "srv_sessao", { p_token_hash: tokenHash });
  return dados ? { ...dados, tokenHash } : null;
}

/** Confere se um pedido que muda dados veio do próprio site. */
export function mesmaOrigem(request: Request): boolean {
  const origem = request.headers.get("origin");
  if (!origem) return request.method === "GET";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origem).host === host;
  } catch {
    return false;
  }
}

/** Resposta de erro no formato problem+json, igual às outras rotas do site. */
export function problema(status: number, titulo: string, detalhe: string): Response {
  return Response.json(
    { type: "about:blank", title: titulo, status, detail: detalhe },
    { status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" } },
  );
}

export function textoDoConsentimentoDaConta(config: ConfiguracaoDaConta): string {
  const quem = config.controladorNome
    ? `${config.controladorNome}, CNPJ ${config.controladorCnpj}`
    : `a empresa de CNPJ ${config.controladorCnpj}, dona da marca ProContador`;
  return (
    `Ao criar a conta, você autoriza o ProContador a guardar o seu celular e o que você anotar ` +
    `(vendas e notas de compra) para prestar o serviço. Não pedimos senha do gov.br. ` +
    `Você pode baixar ou apagar tudo a qualquer momento na página Minha conta. ` +
    `Quem responde pelos seus dados é ${quem}.`
  );
}
