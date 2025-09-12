import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Create the intl middleware
const intlMiddleware = createIntlMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log(`Middleware: Processing request to ${pathname}`);

  // First, handle i18n routing for non-api routes
  if (!pathname.startsWith('/api') && !pathname.startsWith('/_next') && !pathname.includes('.')) {
    const intlResponse = intlMiddleware(request);
    if (intlResponse) {
      return intlResponse;
    }
  }

  // Bloquear acceso directo a rutas de transacciones eliminadas
  if (pathname.includes('/transactions')) {
    console.warn(`Middleware: Blocking access to removed transactions route: ${pathname}`);
    
    const dashboardUrl = new URL('/dashboard', request.url);
    dashboardUrl.searchParams.set('blocked', 'transactions-removed');
    
    return NextResponse.redirect(dashboardUrl);
  }

  // Bloquear rutas que podrían contener IDs de usuarios no válidos
  // Esto es una capa adicional de seguridad
  if (pathname.includes('/users/')) {
    const segments = pathname.split('/');
    const userIdIndex = segments.indexOf('users') + 1;
    
    if (userIdIndex < segments.length) {
      const userId = segments[userIdIndex];
      console.log(`Middleware: Validating user ID in URL: ${userId}`);
      
      // Si el ID del usuario no es válido, redirigir al dashboard
      if (!userId || userId.length < 10) { // Firebase UIDs son típicamente más largos
        console.warn(`Middleware: Invalid user ID detected: ${userId}`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // Permitir que todas las demás rutas pasen - Firebase Auth maneja
  // la autenticación del lado del cliente
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Set a cookie to remember the previous locale for
    // all requests that have a locale prefix
    '/(es|en)/:path*',

    // Enable redirects that add missing locales
    // (e.g. `/pathnames` -> `/en/pathnames`)
    '/((?!_next|_vercel|.*\\..*).*)'
  ],
};
