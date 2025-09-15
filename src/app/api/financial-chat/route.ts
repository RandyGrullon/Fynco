import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

export async function POST(request: NextRequest) {
  // Validate API key early to provide clear error message
  if (!GEMINI_API_KEY || GEMINI_API_KEY.length === 0) {
    console.error("GEMINI_API_KEY is not set in environment variables");
    return NextResponse.json(
      { error: "Configuración del servidor incompleta: falta GEMINI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    // 1. Validar body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON inválido en el request" },
        { status: 400 }
      );
    }

    const { message, userContext } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Message es requerido" },
        { status: 400 }
      );
    }

    // 2. Prompt del sistema
    const systemPrompt = `Eres un consejero financiero personal especializado que trabaja exclusivamente con la aplicación de finanzas personales Fynco. 

INSTRUCCIONES ESTRICTAS:
- Solo puedes responder preguntas relacionadas con finanzas personales y el uso de la aplicación Fynco
- Debes ayudar al usuario a gestionar sus finanzas: crear metas de ahorro, crear cuentas, hacer transferencias entre cuentas, crear transacciones, analizar gastos
- NO respondas preguntas generales que no estén relacionadas con finanzas personales
- Si el usuario pregunta algo no relacionado con finanzas, redirígelo amablemente a temas financieros
- Mantén un tono profesional pero cercano y amigable
- Siempre enfócate en el futuro financiero del usuario y sus objetivos
- Puedes sugerir acciones específicas que el usuario puede tomar en la aplicación

FUNCIONALIDADES DE FYNCO que puedes mencionar:
- Crear y gestionar múltiples cuentas (ahorro, corriente, inversión, crédito)
- Registrar transacciones de ingresos y gastos
- Crear metas de ahorro con seguimiento de progreso
- Transferir dinero entre cuentas
- Categorizar gastos (comida, transporte, entretenimiento, etc.)
- Ver estadísticas y análisis de gastos
- Configurar transacciones recurrentes
- Exportar datos financieros

El usuario actual tiene la siguiente información: ${
      userContext
        ? JSON.stringify(userContext)
        : "No hay información del usuario disponible"
    }

Responde siempre en español y de manera concisa pero útil.`;

    // 3. Body para Gemini
    const requestBody = {
      contents: [
        {
          parts: [{ text: systemPrompt }, { text: `Usuario: ${message}` }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE",
        },
      ],
    };

    // 4. Llamada a Gemini
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", errorData);

      let userMessage = "El asistente no está disponible en este momento.";
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson?.error?.message) {
          userMessage = `Error del asistente: ${errorJson.error.message}`;
        }
      } catch {
        // ignorar error al parsear
      }

      return NextResponse.json(
        { error: userMessage },
        { status: response.status || 502 }
      );
    }

    // 5. Procesar respuesta de Gemini
    const data = await response.json();

    const assistantMessage =
      data.candidates?.[0]?.content?.parts?.[0]?.text || null;

    if (!assistantMessage) {
      return NextResponse.json(
        { error: "El asistente no devolvió respuesta" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: assistantMessage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("=== Error in financial chat API ===");
    console.error("Error details:", error);

    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
