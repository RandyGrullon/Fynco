"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Briefcase,
  Car,
  Circle,
  CirclePlus,
  Clapperboard,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Home,
  Laptop,
  Plane,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Users,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Category, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  car: Car,
  home: Home,
  zap: Zap,
  "heart-pulse": HeartPulse,
  clapperboard: Clapperboard,
  "shopping-bag": ShoppingBag,
  "graduation-cap": GraduationCap,
  plane: Plane,
  repeat: Repeat,
  circle: Circle,
  briefcase: Briefcase,
  laptop: Laptop,
  "trending-up": TrendingUp,
  gift: Gift,
  "circle-plus": CirclePlus,
};

export const CATEGORY_ICON_NAMES = Object.keys(ICONS);

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Circle;
}

/** Ícono cuadrado de 40px para filas de movimientos. */
export function TxIcon({ tx, category, className }: { tx: Pick<Transaction, "kind">; category?: Category | null; className?: string }) {
  let Icon: LucideIcon = iconFor(category?.icon);
  let color = category?.color;
  if (tx.kind === "transfer") {
    Icon = ArrowLeftRight;
    color = undefined;
  } else if (tx.kind === "settlement") {
    Icon = HandCoins;
    color = undefined;
  } else if (tx.kind === "shared" && !category) {
    Icon = Users;
  } else if (!category) {
    Icon = tx.kind === "income" ? ArrowDownLeft : ArrowUpRight;
  }
  return (
    <span
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-secondary bg-card", className)}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </span>
  );
}

// Paleta de avatares (texto oscuro encima, contraste > 7:1).
const AVATAR_COLORS = ["#F5A3C7", "#8EC5FF", "#FFC56E", "#B9A6FF", "#7CE0C3", "#FF9F8E", "#A3E3FF", "#E6D27A"];

export function colorFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  seed?: string;
  size?: number;
  isMe?: boolean;
  ring?: string;
  className?: string;
}

export function MemberAvatar({ name, seed, size = 32, isMe, ring, className }: AvatarProps) {
  const label = isMe ? "Tú" : initials(name);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-background", isMe && "bg-primary", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        background: isMe ? undefined : colorFor(seed ?? name),
        boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
      title={name}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 28,
  max = 4,
  ring = "rgb(var(--card))",
}: {
  people: { key: string; name: string; isMe?: boolean }[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((p, i) => (
        <MemberAvatar key={p.key} name={p.name} seed={p.key} isMe={p.isMe} size={size} ring={ring} className={i ? "-ml-2" : ""} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground"
          style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}` }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** Cuadrito con iniciales para cuentas y grupos. */
export function Monogram({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-extrabold uppercase", className)} aria-hidden="true">
      {text.slice(0, 3)}
    </span>
  );
}

export function accountMonogram(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}
