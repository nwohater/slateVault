import { create } from "zustand";
import type { AiChatMessage, AiChatResult } from "@/types";
import * as commands from "@/lib/commands";

interface ChatState {
  messages: AiChatMessage[];
  isLoading: boolean;
  error: string | null;
  lastModel: string | null;
  lastUsage: AiChatResult["usage"] | null;
  includeContext: boolean;
  includeSource: boolean;

  sendMessage: (message: string, project: string) => Promise<void>;
  clearChat: () => void;
  setIncludeContext: (v: boolean) => void;
  setIncludeSource: (v: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  lastModel: null,
  lastUsage: null,
  includeContext: true,
  includeSource: false,

  sendMessage: async (message, project) => {
    const { messages, includeContext, includeSource } = get();

    // Add user message
    const userMsg: AiChatMessage = { role: "user", content: message };
    set({ messages: [...messages, userMsg], isLoading: true, error: null });

    try {
      const result = await commands.aiChat(
        message,
        project,
        includeContext,
        includeSource,
        messages // send full history (excluding current message, backend adds it)
      );

      const assistantMsg: AiChatMessage = {
        role: "assistant",
        content: result.content,
        documents_written: result.documents_written,
      };

      set((s) => ({
        messages: [...s.messages, assistantMsg],
        isLoading: false,
        lastModel: result.model,
        lastUsage: result.usage,
      }));
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  clearChat: () =>
    set({
      messages: [],
      error: null,
      lastModel: null,
      lastUsage: null,
    }),

  setIncludeContext: (v) => set({ includeContext: v }),
  setIncludeSource: (v) => set({ includeSource: v }),
}));
