// Utilidades puras de autenticación (sirven en cliente y en el route handler).
import { errorMessage } from "@/lib/errors";

/**
 * Solo rutas internas ("/algo"). Rechaza "//dominio", "/\dominio" y caracteres de control:
 * el parser de URL descarta tabs y saltos, así que "/\t/evil.com" acabaría en otro sitio.
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\x00-\x1f\x7f\\]/.test(raw)) return null;
  const base = "https://fynco.invalid";
  try {
    const url = new URL(raw, base);
    if (url.origin !== base) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Errores que llegan en ?error= a /login (los pone /auth/callback). */
export function linkErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "enlace") return "El enlace no es válido o ya expiró. Ábrelo en el mismo navegador donde lo pediste, o pide uno nuevo.";
  if (code === "acceso") return "No se completó el inicio de sesión. Intenta de nuevo.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

// Códigos de Supabase Auth (error.code) que errorMessage no cubre por texto.
const AUTH_CODES: Record<string, string> = {
  invalid_credentials: "Correo o contraseña incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de entrar. Revisa tu bandeja.",
  user_already_exists: "Ya existe una cuenta con ese correo.",
  email_exists: "Ya existe una cuenta con ese correo.",
  weak_password: "Esa contraseña es muy débil. Usa al menos 8 caracteres y mezcla letras y números.",
  same_password: "La nueva contraseña debe ser distinta a la anterior.",
  email_address_invalid: "Ese correo no parece válido.",
  over_email_send_rate_limit: "Enviamos demasiados correos seguidos. Espera unos minutos y vuelve a intentar.",
  over_request_rate_limit: "Demasiados intentos. Espera un momento y vuelve a intentar.",
  signup_disabled: "Por ahora no se pueden crear cuentas nuevas.",
  email_provider_disabled: "Por ahora no se puede entrar con correo.",
  provider_disabled: "Ese método de acceso no está disponible.",
  otp_expired: "El enlace expiró. Pide uno nuevo.",
  reauthentication_needed: "Por seguridad, pide un enlace en «¿Olvidaste tu contraseña?» y cámbiala desde ahí.",
  session_not_found: "Tu sesión expiró. Vuelve a entrar.",
};

export function authErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "";
  return AUTH_CODES[code] ?? errorMessage(error);
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const MIN_PASSWORD = 8;
