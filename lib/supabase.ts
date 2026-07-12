import { createClient } from "@supabase/supabase-js";

// Estes valores são públicos por definição e protegidos pelas políticas RLS.
// O fallback evita tela branca em builds onde variáveis NEXT_PUBLIC não são
// incorporadas ao JavaScript do navegador.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://minwfnroczaiwjravdgf.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_JZhtT9DE3B4YeimR4q3SVw_S-CxK4NH";

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
