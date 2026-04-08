"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/stores/chatStore";
import { useVaultStore } from "@/stores/vaultStore";
import * as commands from "@/lib/commands";
import { AiMessageBubble } from "./AiMessageBubble";

export function AiChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const error = useChatStore((s) => s.error);
  const lastModel = useChatStore((s) => s.lastModel);
  const includeContext = useChatStore((s) => s.includeContext);
  const includeSource = useChatStore((s) => s.includeSource);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearChat = useChatStore((s) => s.clearChat);
  const setIncludeContext = useChatStore((s) => s.setIncludeContext);
  const setIncludeSource = useChatStore((s) => s.setIncludeSource);

  const projects = useVaultStore((s) => s.projects);
  const [selectedProject, setSelectedProject] = useState("");
  const [input, setInput] = useState("");
  const [toolsSupported, setToolsSupported] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0].name);
    }
  }, [projects, selectedProject]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || !selectedProject || isLoading) return;
    setInput("");
    sendMessage(msg, selectedProject);
  };

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/50">
        <div className="flex items-center gap-2">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 outline-none text-xs"
          >
            {projects.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          {lastModel && (
            <span className="text-[10px] text-neutral-600 font-mono truncate">
              {lastModel}
            </span>
          )}
          {toolsSupported === true && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-green-900/30 text-green-400 border border-green-800/30">
              Tools
            </span>
          )}
          {toolsSupported === false && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-yellow-900/30 text-yellow-400 border border-yellow-800/30">
              Text only
            </span>
          )}
        </div>
        <button
          onClick={clearChat}
          className="text-neutral-500 hover:text-neutral-300 text-[10px]"
        >
          Clear
        </button>
      </div>

      {/* Options */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-neutral-800/50">
        <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <input
            type="checkbox"
            checked={includeContext}
            onChange={(e) => setIncludeContext(e.target.checked)}
            className="rounded w-3 h-3"
          />
          Include docs
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-neutral-500">
          <input
            type="checkbox"
            checked={includeSource}
            onChange={(e) => setIncludeSource(e.target.checked)}
            className="rounded w-3 h-3"
          />
          Include source
        </label>
        {toolsSupported === null && (
          <button
            onClick={async () => {
              try {
                const supported = await commands.aiTestTools();
                setToolsSupported(supported);
              } catch {
                setToolsSupported(false);
              }
            }}
            className="text-[10px] text-neutral-600 hover:text-neutral-400"
          >
            Test tools
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-600 text-center gap-2">
            <svg className="w-8 h-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            <span className="text-[11px]">Ask about your project</span>
            <div className="text-[10px] space-y-1 mt-2">
              <button
                onClick={() => setInput("Summarize this project")}
                className="block text-neutral-500 hover:text-neutral-300"
              >
                Summarize this project
              </button>
              <button
                onClick={() => setInput("What architecture decisions have been made?")}
                className="block text-neutral-500 hover:text-neutral-300"
              >
                What decisions have been made?
              </button>
              <button
                onClick={() => setInput("Generate a getting started guide")}
                className="block text-neutral-500 hover:text-neutral-300"
              >
                Generate a getting started guide
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <AiMessageBubble key={i} message={msg} project={selectedProject} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-neutral-500">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-[10px]">Thinking...</span>
          </div>
        )}

        {error && (
          <div className="p-2 rounded bg-red-900/20 border border-red-800/50 text-red-300 text-[10px]">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-neutral-800/50">
        <div className="flex gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about your project..."
            rows={2}
            className="flex-1 px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 outline-none focus:border-blue-600 resize-none text-xs"
            disabled={isLoading || !selectedProject}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !selectedProject}
            className="self-end px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-xs font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
