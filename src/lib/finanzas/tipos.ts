// Documento del plan (pf_estado.datos). Los montos van en la moneda
// indicada (no en centavos): así lo escribe y lo lee el asistente.

export type Moneda = "DOP" | "USD" | "EUR";

export interface Tarjeta {
  clave: string; // "ikea", "jetblue"…: lo que usan los movimientos en `tarjeta`
  prefijo: string; // para los ids de los cortes: "ikea-2026-10"
  nombre: string; // "IKEA Family 5263"
  corto: string; // "IKEA"
  red?: string;
  last4?: string;
  corte_dia: number;
  vence_dia: number;
  pago_dia: number; // el día que de verdad se paga
  limite_dop?: number;
  uso?: string;
}

export interface Cuenta {
  id: string;
  cuenta: string;
  saldo: number;
  principal?: boolean;
  last4?: string;
}

export interface Ingreso {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  estado: "pendiente" | "hecho";
  // La nómina marca el inicio de cada quincena; lo extra (Navidad, bono) no.
  tipo?: "nomina" | "extra";
}

export interface CorteConocido {
  id: string;
  tarjeta: string;
  corte: string;
  vence?: string;
  dop: number;
  usd: number;
  estado: "pendiente" | "pagado";
}

export interface Otro {
  id: string;
  fecha: string;
  concepto: string;
  monto?: number;
  monto_eur?: number;
  estado: "planificado" | "hecho";
  categoria?: string;
  medio?: string;
}

export interface Movimiento {
  id: string;
  fecha: string;
  // Clave de una tarjeta, o "cuenta" (débito de la cuenta principal) o "efectivo".
  tarjeta: string;
  moneda: Moneda;
  monto: number;
  descripcion: string;
  // "día a día" cuenta para el presupuesto; "viaje" para el del viaje; lo demás va aparte.
  categoria: string;
  estado: "real" | "planificado";
  corte?: string; // forzar el corte (si el banco lo metió en otro)
  nota?: string;
}

export interface Prestado {
  id: string;
  de: string;
  monto: number;
  estado: "en la cuenta" | "por entrar" | "devuelto";
  para: string;
  devolver: string;
}

export interface PagoDeuda {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  estado: "hecho" | "pendiente";
}

export interface Deuda {
  acreedor: string;
  nombre: string;
  deuda_original: number;
  abonos_previos: PagoDeuda[];
  plan: PagoDeuda[];
}

export interface Viaje {
  nombre?: string;
  inicio: string;
  fin: string;
  presupuesto_eur: number;
  efectivo_eur: number;
  tarjeta: string;
  incluye?: string;
}

export interface Supuesto {
  id: string;
  supuesto: string;
  valor: string;
}

export interface Estado {
  version_esquema: 2;
  actualizado?: string;
  inicio_plan: string;
  horizonte: string;
  tasas: { USD: number; EUR: number };
  tasas_nota?: { USD?: string; EUR?: string };
  cuentas: Cuenta[];
  tarjetas: Tarjeta[];
  tarjeta_dia_a_dia: string;
  presupuesto_casa_mes: number;
  colchon: number;
  viaje: Viaje;
  ingresos: Ingreso[];
  cortes_conocidos: CorteConocido[];
  otros: Otro[];
  movimientos: Movimiento[];
  prestado: Prestado[];
  deuda: Deuda;
  supuestos?: Supuesto[];
}

// ---------- Salida del motor (lo que pinta la pantalla) ----------

export interface FilaResumen {
  clave: string;
  valor: number | null;
  texto: string;
}

export interface FilaCalendario {
  id: string;
  fecha: string;
  tipo: string; // "Hoy" | "Cobro" | acreedor de la deuda | "Tarjeta" | "Otro"
  concepto: string;
  medio: string;
  monto: number;
  saldo: number;
}

export interface FilaTarjeta {
  id: string;
  tarjeta: string;
  corte: string;
  pagar: string;
  vence: string;
  cargado: number;
  por_venir: number;
  total: number;
  usd_cargado: number;
  estado: string;
}

export interface FilaDeuda {
  id: string;
  fecha: string;
  concepto: string;
  monto: number;
  queda_despues: number;
  estado: "Hecho" | "Pendiente";
}

export interface FilaPresupuesto {
  id: string;
  periodo: string;
  desde: string;
  hasta: string;
  tipo: "En casa" | "Viaje";
  presupuesto: number;
  gastado: number;
  queda: number;
  estado: "actual" | "pasado" | "próximo";
}

export interface FilaMovimiento {
  id: string;
  fecha: string;
  tarjeta: string;
  moneda: string;
  monto: number;
  monto_dop: number;
  descripcion: string;
  categoria: string;
  estado: "Cargado" | "Planificado" | "Hecho";
  paga_el: string;
  nota: string;
}

export interface FilaPrestado {
  id: string;
  de: string;
  monto: number;
  estado: string;
  para: string;
  devolver: string;
}

export interface Plan {
  hoy: string;
  resumen: FilaResumen[];
  calendario: FilaCalendario[];
  tarjetas: FilaTarjeta[];
  papi: FilaDeuda[];
  presupuesto: FilaPresupuesto[];
  movimientos: FilaMovimiento[];
  supuestos: Supuesto[];
  prestado: FilaPrestado[];
}
