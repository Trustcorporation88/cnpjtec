import type { Metadata } from "next";
import { PainelDoContador } from "@/components/PainelDoContador";

export const metadata: Metadata = {
  title: "Painel do contador | ProContador",
  robots: { index: false, follow: false },
};

export default function PaginaDoContador() {
  return <PainelDoContador />;
}
