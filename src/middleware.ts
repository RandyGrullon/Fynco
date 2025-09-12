import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`Middleware: Processing request to ${pathname}`);

  // Bloquear acceso directo a rutas de transacciones eliminadas
  if (pathname.startsWith('/transactions')) {
    console.warn(`Middleware: Blocking access to removed transactions route: ${pathname}`);
    
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('blocked', 'transactions-removed');
    
    return NextResponse.redirect(dashboardUrl);
  }

  // Bloquear rutas que podrían contener IDs de usuarios no válidos
  // Esto es una capa adicional de seguridad
  const protectedPatterns = [
    /^\/api\/.*\/[a-zA-Z0-9]{20,}/, // APIs con IDs largos
    /^\/users\/[a-zA-Z0-9]{20,}/,   // Rutas de usuarios directas
  ];

  if (protectedPatterns.some(pattern => pattern.test(pathname))) {
    console.warn(`Middleware: Blocking suspicious route pattern: ${pathname}`);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Permitir que todas las demás rutas pasen - Firebase Auth maneja
  // la autenticación del lado del cliente
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
