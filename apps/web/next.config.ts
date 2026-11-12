import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@cnpjtec/conteudo", "@cnpjtec/motor-regras", "@cnpjtec/regras"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Enquanto as regras estão em revisão, o site não deve aparecer em buscadores.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default config;
