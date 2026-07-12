import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function AcessoNegadoPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldX className="mx-auto h-12 w-12 text-red-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">Acesso não autorizado</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sua conta está pendente, bloqueada ou não possui permissão para esta área.
        </p>
        <Link
          className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white"
          href="/"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
