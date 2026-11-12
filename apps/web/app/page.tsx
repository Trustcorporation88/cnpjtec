import { RaioX } from "@/components/RaioX";
import { configuracaoDoRadar, textoDoConsentimento } from "@/lib/radar";
import { ANO_AVALIADO } from "@/lib/respostas";

// A página lê a configuração do Radar a cada pedido, e não na hora da construção.
export const dynamic = "force-dynamic";

export default function Pagina() {
  const config = configuracaoDoRadar();
  const radar = config ? { consentimento: textoDoConsentimento(config.controlador) } : null;
  return <RaioX ano={ANO_AVALIADO} radar={radar} />;
}
