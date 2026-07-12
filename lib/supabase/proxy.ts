import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/cadastro", "/acesso-negado", "/auth/callback"];
const ADMIN_PREFIXES = ["/admin"];
const SERGEANT_PREFIXES = ["/claviculario", "/relatorios", "/movimentacoes"];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(path + "/")),
  );

  if (!claims) {
    if (isPublic) return response;
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", claims.sub)
    .single();

  if (!profile || profile.status !== "approved") {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/acesso-negado";
    deniedUrl.search = "";
    return NextResponse.redirect(deniedUrl);
  }

  const adminRoles = ["admin", "master_admin"];
  const operationalRoles = ["duty_sergeant", "admin", "master_admin"];

  if (startsWithAny(pathname, ADMIN_PREFIXES) && !adminRoles.includes(profile.role)) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/acesso-negado";
    deniedUrl.search = "";
    return NextResponse.redirect(deniedUrl);
  }

  if (startsWithAny(pathname, SERGEANT_PREFIXES) && !operationalRoles.includes(profile.role)) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/acesso-negado";
    deniedUrl.search = "";
    return NextResponse.redirect(deniedUrl);
  }

  return response;
}
