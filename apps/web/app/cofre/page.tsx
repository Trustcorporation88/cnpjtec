import type { Metadata } from "next";
import { Cofre } from "@/components/Cofre";

export const metadata: Metadata = {
  title: "Cofre de notas | ProContador",
  description: "Guarde as notas das compras que você faz da marca e prove de onde veio cada produto.",
};

export default function PaginaDoCofre() {
  return <Cofre />;
}
