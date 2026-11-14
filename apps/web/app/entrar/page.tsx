import type { Metadata } from "next";
import { Entrar } from "@/components/Entrar";

export const metadata: Metadata = { title: "Entrar | ProContador" };

export default function PaginaEntrar() {
  return <Entrar />;
}
