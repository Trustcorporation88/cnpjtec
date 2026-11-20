import { RaioX } from "@/components/RaioX";
import { lerPerfil } from "@/lib/perfis";
import { configuracaoDoRadar, textoDoConsentimento } from "@/lib/radar";
import { ANO_AVALIADO } from "@/lib/respostas";

// A página lê a configuração do Radar a cada pedido, e não na hora da construção.
export const dynamic = "force-dynamic";

export const metadata = { title: "Minha situação em 2027 | ProContador" };

export default async function Pagina({ searchParams }: { searchParams: Promise<{ perfil?: string }> }) {
  const { perfil } = await searchParams;
  const escolhido = lerPerfil(perfil);
  const config = configuracaoDoRadar();
  const radar = config ? { consentimento: textoDoConsentimento(config.controlador) } : null;
  return <RaioX key={escolhido ?? "inicio"} ano={ANO_AVALIADO} radar={radar} perfil={escolhido} />;
}
