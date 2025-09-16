"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { FormattedMessage } from "@/components/ui/formatted-message";
import { getAccounts } from "@/lib/accounts";
import { getGoals } from "@/lib/goals";
import { getTransactions } from "@/lib/transactions";

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

export function FinancialChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content:
        "¡Hola! Soy tu asistente financiero personal de Fynco. Puedo ayudarte con consejos sobre tus finanzas, crear metas de ahorro, gestionar cuentas, transferencias y mucho más. ¿En qué puedo ayudarte hoy?",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputMessage.trim() || isLoading) return;

    const messageContent = inputMessage.trim();
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: messageContent,
      sender: "user",
      timestamp: new Date(),
    };

    // Clear input and add user message immediately
    setInputMessage("");
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Gather user context client-side to provide Gemini full view of user data
      let userContextPayload: any = {
        userId: user?.uid || null,
        email: user?.email || null,
      };
      try {
        const uid = user?.uid;
        if (uid) {
          const [accounts, goals, transactions] = await Promise.all([
            getAccounts(uid),
            getGoals(uid),
            getTransactions(uid, 50),
          ]);
          userContextPayload = {
            userId: uid,
            email: user?.email || null,
            accounts,
            goals,
            recentTransactions: transactions,
          };
        }
      } catch (ctxErr) {
        console.warn(
          "Could not load full user context, sending minimal context",
          ctxErr
        );
        userContextPayload = {
          userId: user?.uid || null,
          email: user?.email || null,
        };
      }

      const response = await fetch("/api/financial-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageContent,
          userContext: userContextPayload,
        }),
      });

      // Try to parse body safely
      let parsed: any = null;
      try {
        const text = await response.text();
        parsed = text ? JSON.parse(text) : null;
      } catch (e) {
        // If parsing fails, keep parsed=null and handle accordingly
        console.warn("Failed to parse response body as JSON");
      }

      if (!response.ok) {
        const serverMessage = parsed?.error || `Error ${response.status}`;
        const serverErrorMessage: Message = {
          id: `server-error-${Date.now()}`,
          content: `El asistente no está disponible: ${serverMessage}`,
          sender: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, serverErrorMessage]);
        return;
      }

      const data = parsed || {};
      const assistantText =
        data.message ?? data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!assistantText || typeof assistantText !== "string") {
        const noDataMessage: Message = {
          id: `nodata-${Date.now()}`,
          content:
            "El asistente no devolvió una respuesta válida en este momento.",
          sender: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, noDataMessage]);
        return;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: assistantText,
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Any unexpected error ends up here but we do NOT rethrow
      console.error("Error in sendMessage:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content:
          "Lo siento, hubo un error de comunicación. Por favor, inténtalo de nuevo.",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome",
        content:
          "¡Hola! Soy tu asistente financiero personal de Fynco. Puedo ayudarte con consejos sobre tus finanzas, crear metas de ahorro, gestionar cuentas, transferencias y mucho más. ¿En qué puedo ayudarte hoy?",
        sender: "assistant",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          // iPhone SE (320px) -> small floating button and inset, scale up on md
          "fixed bottom-3 right-3 z-50 h-10 w-10 sm:h-11 sm:w-11 md:h-14 md:w-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110",
          "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
          "border-2 border-white/20",
          isOpen && "bg-red-500 hover:bg-red-600"
        )}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card
          className={cn(
            // full-width modal on very small screens, centered inset on larger phones and desktops
            // widths approximate common iPhone widths: 320 (SE) -> 430 (Plus/Pro Max)
            "fixed z-50 shadow-2xl border-0 bg-white/95 backdrop-blur-sm",
            // Positioning: small screens sit bottom with small sides inset; larger screens more to the right
            "left-2 right-2 bottom-20 h-[70vh] max-h-[700px] sm:left-4 sm:right-4 sm:bottom-20 sm:h-[68vh] md:right-6 md:bottom-24 md:w-[420px] md:h-[550px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Fynco AI</h3>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4 h-[50vh] sm:h-[54vh] md:h-[420px]">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 max-w-full",
                    message.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.sender === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}

                  <div
                    className={cn(
                      // small screens: message bubbles occupy up to ~85% width; larger screens cap at 320px
                      "rounded-2xl px-4 py-3 break-words max-w-[85%] sm:max-w-[75%] md:max-w-[320px]",
                      message.sender === "user"
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                        : "bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg border border-blue-100/50 dark:from-blue-950/30 dark:to-indigo-950/30 dark:border-blue-800/30"
                    )}
                  >
                    {message.sender === "user" ? (
                      <p className="text-sm leading-relaxed text-white">
                        {message.content}
                      </p>
                    ) : (
                      <FormattedMessage content={message.content} />
                    )}
                    <p
                      className={cn(
                        "text-xs mt-2 opacity-70",
                        message.sender === "user"
                          ? "text-white/70"
                          : "text-gray-500"
                      )}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {message.sender === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                      <p className="text-sm text-gray-500">Escribiendo...</p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div
            className="p-4 border-t bg-gray-50/80 rounded-b-lg"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <form onSubmit={sendMessage} className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Pregúntame sobre tus finanzas..."
                className="flex-1 border-gray-200 focus:border-blue-500 bg-white text-black placeholder-gray-500"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputMessage.trim() || isLoading}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
