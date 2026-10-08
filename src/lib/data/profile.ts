import type { Profile } from "@/lib/types";
import { db, myUserId, unwrap } from "./base";

export async function fetchProfile(): Promise<Profile> {
  const id = await myUserId();
  return unwrap(await db().from("profiles").select("*").eq("id", id).single());
}

export type ProfilePatch = Partial<Pick<Profile, "display_name" | "avatar_url" | "default_currency" | "hide_amounts" | "app_lock_enabled">>;

export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const id = await myUserId();
  return unwrap(await db().from("profiles").update(patch).eq("id", id).select("*").single());
}

export async function hasPin(): Promise<boolean> {
  return unwrap(await db().rpc("has_pin"));
}

export type PinResult = { ok: boolean; reason?: "no_pin" | "locked" | "wrong_pin" | "current_required"; attempts_left?: number; locked_until?: string };

export async function verifyPin(pin: string): Promise<PinResult> {
  return unwrap(await db().rpc("verify_pin", { p_pin: pin }));
}

export async function setPin(pin: string, current?: string): Promise<PinResult> {
  return unwrap(await db().rpc("set_pin", { p_pin: pin, p_current: current ?? null }));
}

export async function clearPin(current: string): Promise<PinResult> {
  return unwrap(await db().rpc("clear_pin", { p_current: current }));
}

export async function deleteMyAccount(): Promise<void> {
  unwrap(await db().rpc("delete_my_account"));
  await db().auth.signOut();
}
