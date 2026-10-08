"use client";

import { markUnlocked } from "@/components/security/app-lock";
import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/forms/fields";
import { PageHeader } from "@/components/shell/page-header";
import { useUser } from "@/components/providers/session-provider";
import { SettingsRow, SettingsSection, SwitchRow } from "@/components/settings/settings-ui";
import { PinPanel, type PinMode } from "@/components/settings/pin-panel";
import { DeleteAccountPanel } from "@/components/settings/delete-account-panel";
import { useAccounts, useCategories, useHasPin, useProfile, useUpdateProfile } from "@/hooks/queries";
import { toast } from "@/hooks/use-toast";
import { fetchAllTransactions } from "@/lib/data/transactions";
import { todayISO } from "@/lib/dates";
import { errorMessage } from "@/lib/errors";
import { downloadFile, transactionsToCsv } from "@/lib/export";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money";
import { getSupabase } from "@/lib/supabase/client";

const rowButton = "h-11 rounded-full px-4 text-[13px]";

export default function AjustesPage() {
  const user = useUser();
  const { data: profile, isLoading } = useProfile();
  const { data: hasPin, isLoading: pinLoading } = useHasPin();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const updateProfile = useUpdateProfile();

  const [pinMode, setPinMode] = useState<PinMode>("create");
  const [pinOpen, setPinOpen] = useState(false);
  const openPin = (mode: PinMode) => {
    setPinMode(mode);
    setPinOpen(true);
  };
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function save(patch: Parameters<typeof updateProfile.mutateAsync>[0], title: string, description?: string) {
    try {
      await updateProfile.mutateAsync(patch);
      toast({ title, description });
      return true;
    } catch {
      return false; // el aviso de error ya lo muestra el MutationCache
    }
  }

  async function toggleAppLock(on: boolean) {
    if (on) {
      // Acabas de demostrar que estás aquí: que AppLock no te pida el PIN en el mismo instante.
      markUnlocked(user.id);
    }
    await save({ app_lock_enabled: on }, on ? "Bloqueo activado" : "Bloqueo desactivado", on ? "Te pediremos el PIN al abrir la app." : undefined);
  }

  async function exportAll() {
    setExporting(true);
    try {
      const txs = await fetchAllTransactions({});
      if (!txs.length) {
        toast({ title: "Nada que exportar", description: "Aún no tienes movimientos." });
        return;
      }
      downloadFile(`fynco-movimientos-${todayISO()}.csv`, transactionsToCsv(txs, accounts, categories));
      toast({ title: "CSV descargado", description: `${txs.length} ${txs.length === 1 ? "movimiento" : "movimientos"}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "No se pudo exportar", description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await getSupabase().auth.signOut();
      if (error) throw error;
      // SessionProvider redirige a /login al recibir SIGNED_OUT.
    } catch (e) {
      setSigningOut(false);
      toast({ variant: "destructive", title: "No se pudo cerrar la sesión", description: errorMessage(e) });
    }
  }

  const email = profile?.email ?? user.email ?? "";
  const pinReady = !pinLoading && hasPin !== undefined;

  return (
    <div className="flex flex-col gap-7 pb-6">
      <PageHeader title="Ajustes" back="/mas" />

      {/* a) Perfil */}
      <SettingsSection title="Perfil">
        <div className="flex flex-col gap-4 p-4">
          {isLoading || !profile ? (
            <>
              <Skeleton className="h-[74px] w-full rounded-lg" />
              <Skeleton className="h-[74px] w-full rounded-lg" />
              <Skeleton className="h-[74px] w-full rounded-lg" />
            </>
          ) : (
            <>
              <NameField key={profile.id} saved={profile.display_name} onSave={(display_name) => save({ display_name }, "Nombre actualizado")} />
              <Field label="Correo" htmlFor="settings-email" hint="Es el correo con el que entras.">
                <Input id="settings-email" value={email} readOnly className="text-muted-foreground" />
              </Field>
              <Field label="Moneda principal" htmlFor="settings-currency" hint="Se usa en Inicio y Estadísticas. Cada cuenta mantiene su propia moneda.">
                <Select
                  value={profile.default_currency}
                  onValueChange={(c) => c !== profile.default_currency && save({ default_currency: c }, "Moneda principal actualizada", `${c} · ${CURRENCIES[c]?.name ?? ""}`)}
                >
                  <SelectTrigger id="settings-currency">
                    <SelectValue>{`${profile.default_currency} · ${CURRENCIES[profile.default_currency]?.name ?? ""}`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_CODES.map((c) => (
                      <SelectItem key={c} value={c} className="min-h-11">
                        {c} · {CURRENCIES[c].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </div>
      </SettingsSection>

      {/* b) Privacidad */}
      <SettingsSection title="Privacidad">
        <SwitchRow
          title="Ocultar montos"
          description="Muestra •••• en lugar de las cifras. Útil en lugares públicos."
          checked={profile?.hide_amounts ?? false}
          onCheckedChange={(v) => save({ hide_amounts: v }, v ? "Montos ocultos" : "Montos visibles")}
          disabled={!profile}
        />
      </SettingsSection>

      {/* c) Seguridad */}
      <SettingsSection title="Seguridad">
        <SettingsRow
          title="PIN"
          description={!pinReady ? "Cargando…" : hasPin ? "Activo. Lo usas para desbloquear la app y confirmar acciones delicadas." : "Un código de 4 dígitos para bloquear la app."}
          stack={hasPin}
        >
          {!pinReady ? (
            <Skeleton className="h-11 w-24 rounded-full" />
          ) : hasPin ? (
            <>
              <Button variant="secondary" className={rowButton} onClick={() => openPin("change")}>
                Cambiar PIN
              </Button>
              <Button variant="destructive-ghost" className={rowButton} onClick={() => openPin("remove")}>
                Quitar PIN
              </Button>
            </>
          ) : (
            <Button className={rowButton} onClick={() => openPin("create")}>
              Crear PIN
            </Button>
          )}
        </SettingsRow>
        <SwitchRow
          title="Bloquear la app con PIN"
          description={hasPin ? "Se pide al abrir la app y tras 5 minutos sin uso." : "Se pide al abrir la app y tras 5 minutos sin uso. Crea un PIN primero."}
          checked={Boolean(hasPin && profile?.app_lock_enabled)}
          onCheckedChange={toggleAppLock}
          disabled={!hasPin || !profile}
        />
        <Link
          href="/nueva-contrasena"
          className="flex min-h-16 items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#1b1e24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Cambiar contraseña</span>
            <span className="block text-[13px] text-muted-foreground">La que usas para entrar con tu correo.</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </SettingsSection>

      {/* d) Datos */}
      <SettingsSection title="Datos">
        <SettingsRow title="Exportar todos mis movimientos (CSV)" description="Un archivo que abre Excel o Google Sheets, con todas tus cuentas.">
          <Button variant="secondary" className={rowButton} onClick={exportAll} disabled={exporting} aria-label="Exportar todos mis movimientos en CSV">
            <Download className="!size-4" />
            {exporting ? "Exportando…" : "Exportar"}
          </Button>
        </SettingsRow>
      </SettingsSection>

      {/* e) Sesión */}
      <SettingsSection title="Sesión">
        <SettingsRow title="Cerrar sesión" description={email ? `Entraste como ${email}.` : undefined}>
          <Button variant="secondary" className={rowButton} onClick={signOut} disabled={signingOut}>
            <LogOut className="!size-4" />
            {signingOut ? "Cerrando…" : "Salir"}
          </Button>
        </SettingsRow>
      </SettingsSection>

      {/* f) Zona de peligro */}
      <SettingsSection title="Zona de peligro" danger>
        <SettingsRow
          title="Eliminar mi cuenta"
          description="Borra tu perfil y todos tus datos personales. En los grupos compartidos quedarás como invitado con tu nombre para que los demás conserven su historial."
          stack
        >
          <Button variant="destructive-ghost" className={`${rowButton} border border-negative/40`} onClick={() => setDeleting(true)} disabled={!pinReady}>
            <Trash2 className="!size-4" />
            Eliminar mi cuenta
          </Button>
        </SettingsRow>
      </SettingsSection>

      <PinPanel mode={pinMode} open={pinOpen} onOpenChange={setPinOpen} />
      <DeleteAccountPanel open={deleting} onOpenChange={setDeleting} hasPin={hasPin === true} />
    </div>
  );
}

/** Nombre visible: se guarda al salir del campo, con Enter o con el botón. */
function NameField({ saved, onSave }: { saved: string; onSave: (name: string) => Promise<boolean> }) {
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const dirty = value.trim() !== saved;

  async function commit() {
    if (saving.current) return;
    const name = value.trim();
    if (name === saved) return setValue(saved);
    if (!name) {
      setError("Escribe tu nombre.");
      return;
    }
    setError(null);
    saving.current = true;
    const ok = await onSave(name);
    saving.current = false;
    if (!ok) setValue(saved);
  }

  return (
    <Field label="Nombre" htmlFor="settings-name" hint="Así te ven en los grupos compartidos." error={error}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <Input
          id="settings-name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onBlur={(e) => {
            // Si el foco va al botón Guardar, deja que el submit lo maneje.
            if (e.relatedTarget instanceof HTMLButtonElement && e.relatedTarget.form === e.currentTarget.form) return;
            commit();
          }}
          autoComplete="name"
          maxLength={60}
          aria-invalid={Boolean(error) || undefined}
        />
        {dirty && (
          <Button type="submit" className="shrink-0">
            Guardar
          </Button>
        )}
      </form>
    </Field>
  );
}
