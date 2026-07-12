import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "SSV — Sistema de Supervisão de Viaturas", description: "Supervisão de viaturas, movimentações, manutenção e relatórios." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
