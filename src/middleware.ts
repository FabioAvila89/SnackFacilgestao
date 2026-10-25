import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "snack-facil-segredo-super-seguro-troque-em-producao-2026"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas que não requerem autenticação
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/health-check") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/export/template") // Modelo de importação público
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("snack_auth_session")?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const role = (payload.role as string) || "EDITOR";
    const mustChangePassword = !!payload.mustChangePassword;

    // Se o usuário precisa trocar a senha obrigatoriamente
    if (mustChangePassword) {
      const allowedPathsForPasswordChange = [
        "/trocar-senha-obrigatoria",
        "/api/auth/trocar-senha-obrigatoria",
        "/api/auth/logout",
        "/api/auth/me",
      ];

      const isAllowed = allowedPathsForPasswordChange.some(
        (allowed) => pathname === allowed || pathname.startsWith(allowed + "/")
      );

      if (!isAllowed) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Troca obrigatória de senha pendente. Conclua a troca para continuar." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/trocar-senha-obrigatoria", request.url));
      }
    } else {
      // Se não precisa trocar senha mas tenta entrar na página de troca obrigatória
      if (pathname === "/trocar-senha-obrigatoria") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // Proteção de rotas exclusivas para ADMIN: Gestão de Acesso
    if (
      pathname.startsWith("/gestao-acesso") ||
      pathname.startsWith("/api/users") ||
      pathname.startsWith("/api/audit-logs")
    ) {
      if (role !== "ADMIN") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "Acesso negado. Recurso restrito a administradores." },
            { status: 403 }
          );
        }
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return NextResponse.next();
  } catch (err) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
