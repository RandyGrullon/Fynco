import type { Metadata } from "next";
import { ChatVista } from "@/components/finanzas/chat-vista";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <ChatVista />;
}
