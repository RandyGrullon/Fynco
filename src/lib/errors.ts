// Traduce errores de Supabase/RPC a mensajes para el usuario.
const MESSAGES: Record<string, string> = {
  not_authenticated: "Tu sesión expiró. Vuelve a entrar.",
  not_a_member: "No eres miembro de este grupo.",
  not_found: "No se encontró. Puede que alguien lo haya borrado.",
  invalid_amount: "El monto debe ser mayor que cero.",
  invalid_account: "Elige una de tus cuentas.",
  same_account: "La cuenta de origen y destino deben ser distintas.",
  payers_sum_mismatch: "Lo que pagó cada uno no suma el total.",
  shares_sum_mismatch: "Las partes no suman el total.",
  member_not_in_group: "Hay alguien que no pertenece al grupo.",
  member_has_balance: "Esa persona tiene saldo pendiente. Salden primero.",
  member_already_claimed: "Ese lugar ya lo ocupó otra persona.",
  invalid_code: "El enlace de invitación no es válido o el grupo se archivó.",
  group_has_history: "El grupo tiene gastos. Archívalo en vez de borrarlo.",
  direct_needs_one_member: "Un gasto directo es con una sola persona.",
  not_a_party: "Solo quien paga o recibe puede ligar su cuenta.",
  currency_mismatch: "Esa cuenta está en otra moneda que el grupo. Elige una cuenta en la moneda del grupo.",
  invalid_invite: "Esa invitación ya no está disponible.",
  already_member: "Ya eres miembro de ese grupo.",
  invalid_pin_format: "El PIN debe tener de 4 a 6 dígitos.",
  wrong_pin: "PIN incorrecto.",
  "Invalid login credentials": "Correo o contraseña incorrectos.",
  "Email not confirmed": "Confirma tu correo antes de entrar. Revisa tu bandeja.",
  "User already registered": "Ya existe una cuenta con ese correo.",
};

export function errorMessage(error: unknown, fallback = "Algo salió mal. Intenta de nuevo."): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  for (const [key, msg] of Object.entries(MESSAGES)) {
    if (raw.includes(key)) return msg;
  }
  if (/fetch|network/i.test(raw)) return "Sin conexión. Revisa tu internet.";
  return raw && raw.length < 140 ? raw : fallback;
}
