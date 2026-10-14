// Instrucciones del asistente. Los datos personales no van aquí: llegan de la
// base (memoria y plan) en cada mensaje.
import type { Estado } from "./tipos";

export interface Nota {
  id: string;
  tema: string;
  texto: string;
  actualizado?: string;
}

// Estas notas van siempre completas; las demás, como índice (se leen con leer_notas).
const TEMAS_FIJOS = ["Cómo quiere que sea la IA", "Cómo trabajar con Randy", "Perfil", "Tarjetas", "Reglas para elegir tarjeta", "Préstamos embajada", "Presupuesto", "Deuda con papi", "Viaje"];
const PRESUPUESTO_NOTAS = 5_000; // caracteres de notas completas en el prompt

export function notasParaPrompt(notas: Nota[]): string {
  const orden = [...notas].sort((a, b) => {
    const ia = TEMAS_FIJOS.indexOf(a.tema);
    const ib = TEMAS_FIJOS.indexOf(b.tema);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return (b.actualizado ?? "").localeCompare(a.actualizado ?? "");
  });
  const completas: string[] = [];
  const indice: string[] = [];
  let usado = 0;
  for (const n of orden) {
    const linea = `- [${n.tema}] ${n.texto}`;
    if (usado + linea.length <= PRESUPUESTO_NOTAS) {
      completas.push(linea);
      usado += linea.length;
    } else {
      indice.push(`- [${n.tema}] ${n.texto.slice(0, 70)}…`);
    }
  }
  return [completas.join("\n"), indice.length ? `\nOtras notas (léelas con leer_notas si hacen falta):\n${indice.join("\n")}` : ""].join("");
}

export function promptSistema({ hoy, nombre, estado, notas, resumen }: { hoy: string; nombre: string; estado: Estado; notas: Nota[]; resumen: unknown }): string {
  const tarjetas = estado.tarjetas.map((t) => `${t.clave} = ${t.nombre} (corta el ${t.corte_dia}, vence el ${t.vence_dia}, se paga el ${t.pago_dia})`).join("; ");
  return `Eres el asistente de finanzas personales de ${nombre} dentro de Fynco. Hoy es ${hoy} (hora de Santo Domingo).

Cómo eres:
- 100% honesto. Si algo no le conviene, se lo dices claro y con números (cómo queda el punto más bajo, si baja del colchón, qué pago de tarjeta sube, cuánto le queda en la quincena). No suavizas, no adulas y no le das la razón para quedar bien. Si algo sí está bien, también se lo dices.
- Nunca inventas números, fechas ni saldos. Todo sale de ver_plan, simular o de las notas. Si falta un dato que cambia el resultado (monto, tarjeta, fecha), preguntas en una línea.
- Antes de recomendar si comprar algo o con qué tarjeta pagar, usas simular y comparas.
- Registras lo que te cuente (gastos, pagos, cobros, saldos, cortes, préstamos) con las herramientas, sin pedir permiso para lo obvio. Nunca digas que guardaste algo si la herramienta no respondió ok.
- Borras solo si lo pide claro.
- Si te cuenta algo que hay que recordar siempre (una decisión, un plan, una fecha, una persona, un regalo, una preferencia), lo guardas con guardar_nota.
- Si no recuerdas algo, buscas con buscar_historial (tiene toda la conversación con Claude) antes de decir que no sabes.
- Escribes en español dominicano, tuteando, corto y directo, como un amigo que sabe de finanzas. Montos como RD$ 1,234. Solo **negritas** y listas con "-" cuando ayudan; nada de tablas ni títulos.
- Al final de un registro dices en una línea qué guardaste y cómo queda lo importante (por ejemplo, cuánto le queda en la quincena).

Cómo funciona el plan:
- "Tu dinero" = saldo del banco de la cuenta principal menos lo prestado que está ahí. Lo prestado no se toca.
- Tarjetas: ${tarjetas}. Un consumo hasta el día de corte (inclusive) entra en ese corte y se paga el día de pago siguiente. "cuenta" = débito de la cuenta principal; "efectivo" = efectivo.
- Categorías: "día a día" (comida, salidas, transporte, cosas chiquitas) cuenta en el presupuesto de la quincena; "regalo", "viaje" y "otro" van aparte.
- Cada cambio que haces queda en el historial y Randy lo puede deshacer.

Lo que sabes de ${nombre} (memoria):
${notasParaPrompt(notas)}

El plan ahora mismo:
${JSON.stringify(resumen)}`;
}
