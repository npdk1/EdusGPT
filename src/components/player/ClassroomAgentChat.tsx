"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronDown, ChevronUp, Send, User, Sparkles, LoaderCircle, Maximize2, Minimize2 } from "lucide-react";
import katex from "katex";
import type { LessonScene } from "@/lib/lesson/types";
import { useCopy } from "@/i18n/provider";

/**
 * The panel's own sentences, in both languages.
 *
 * The seed questions further down stay Vietnamese on purpose: a clicked chip is
 * sent to the model as the user's own question, so it is a prompt, not a label.
 */
const COPY = {
  en: {
    agentGreeting:
      'AI tutor, you are on scene "{title}". If anything is unclear, just ask here.',
    agentSceneFallback: "the lesson",
    agentLessonFallback: "the lesson",
    agentQuotaHint:
      "Daily AI quota or rate limit reached. Please try again in a few minutes or switch providers in Settings.",
    agentErrorHint: "Something went wrong. Try asking again.",
    agentOfflineHint: "The connection dropped or the server did not answer.",
    agentTitle: "Online AI tutor",
    agentSubtitle: "Questions about the current scene",
    agentThinking: "The tutor is thinking...",
    agentPlaceholder: 'Ask about "{title}"...',
    agentExpand: "Expand the tutor",
    agentCollapse: "Collapse the tutor",
    agentOpen: "Open the AI tutor",
    agentHide: "Hide the AI tutor",
    suggestExplain: "Explain this part more simply",
    suggestExample: "Give me a real-world example",
  },
  vi: {
    agentGreeting:
      'Trợ giảng AI, đang ở cảnh "{title}". Có chỗ nào chưa hiểu, bạn cứ hỏi ở đây.',
    agentSceneFallback: "Bài giảng",
    agentLessonFallback: "bài học",
    agentQuotaHint:
      "Hạn mức gọi AI tạm thời hết hoặc quá tải. Vui lòng thử lại sau ít phút hoặc đổi nhà cung cấp trong Cài đặt.",
    agentErrorHint: "Có lỗi xảy ra. Bạn thử hỏi lại.",
    agentOfflineHint: "Mạng bị ngắt kết nối hoặc server chưa phản hồi.",
    agentTitle: "Trợ giảng AI trực tuyến",
    agentSubtitle: "Hỏi đáp theo cảnh học",
    agentThinking: "Trợ giảng đang suy nghĩ câu trả lời...",
    agentPlaceholder: 'Hỏi về "{title}"...',
    agentExpand: "Phóng to khung trợ giảng",
    agentCollapse: "Thu nhỏ khung trợ giảng",
    agentOpen: "Mở khung trợ giảng AI",
    agentHide: "Ẩn khung trợ giảng",
    suggestExplain: "Giải thích dễ hiểu hơn về phần này",
    suggestExample: "Cho mình 1 ví dụ thực tế liên quan",
  },
} satisfies Record<string, Record<string, string>>;

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Assistant answers with LaTeX (`$…$` inline, `$$…$$` display) and `**bold**`.
 *
 * Plain interpolation would show the source, so assistant bubbles go through
 * this renderer: math via KaTeX (a failed parse falls back to the raw text,
 * never to red error markup), bold via <strong>, line breaks via paragraphs.
 * User bubbles stay raw — echoing back exactly what was typed.
 */
function renderMath(tex: string, display: boolean, key: number): ReactNode {
  try {
    const html = katex.renderToString(tex, {
      displayMode: display,
      throwOnError: true,
      strict: false,
      trust: false,
      output: "html",
    });
    return (
      <span
        key={key}
        className={display ? "chat-math-block" : "chat-math"}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  } catch {
    return <span key={key}>{display ? `$$${tex}$$` : `$${tex}$`}</span>;
  }
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*\n]+?\*\*)/g);
  return parts.map((part, index) => {
    if (part.length > 4 && part.startsWith("$$") && part.endsWith("$$")) {
      return renderMath(part.slice(2, -2), true, index);
    }
    if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
      return renderMath(part.slice(1, -1), false, index);
    }
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderRich(content: string): ReactNode[] {
  return content.split(/\n/).map((line, index) => (
    // An empty line is a paragraph break the bubble can feel.
    <p key={index} className={index > 0 ? "mt-1.5 min-h-[1em]" : undefined}>
      {renderInline(line)}
    </p>
  ));
}

interface ClassroomAgentChatProps {
  currentScene?: LessonScene;
  lessonTitle: string;
}

export function ClassroomAgentChat({ currentScene, lessonTitle }: ClassroomAgentChatProps) {
  const t = useCopy(COPY);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: t.agentGreeting.replace(
        "{title}",
        currentScene?.title ?? t.agentSceneFallback,
      ),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    t.suggestExplain,
    t.suggestExample,
  ]);

  useEffect(() => {
    setSuggestions([t.suggestExplain, t.suggestExample]);
  }, [t.suggestExplain, t.suggestExample]);
  /**
   * Expanded mode, for a panel that reads too small in the sidebar: the chat
   * lifts out of the column into a wide floating card on the right, and the
   * same button (or Escape) puts it back. Nothing unmounts, so the thread and
   * the input survive the round trip.
   */
  const [expanded, setExpanded] = useState(false);
  /**
   * The panel starts folded into a title bar. In the lesson player the rail
   * belongs to the outline; the tutor is a "when you need it" tool, and a
   * permanently open conversation box beside the outline reads as two
   * competing panels. Opening is one click, and nothing unmounts — the
   * thread and the input survive every fold.
   */
  const [collapsed, setCollapsed] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  /**
   * Opening the panel scrolls it into view. The rail is one scroller and the
   * outline can be long, so without this the button sits at the rail's bottom
   * edge and the panel it opens lands below the fold — a click that appears
   * to do nothing. `nearest` moves the least amount that shows the panel.
   */
  useEffect(() => {
    if (collapsed || expanded) return;
    panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [collapsed, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/classroom/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          lessonTitle,
          currentScene: currentScene
            ? {
                title: currentScene.title,
                kind: currentScene.kind,
                bullets: currentScene.bullets,
                formula: currentScene.formula,
                narration: currentScene.narration,
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.answer) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
        if (data.suggestedQuestions?.length) {
          setSuggestions(data.suggestedQuestions);
        }
      } else {
        const quota = data.quota === true || res.status === 429;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || (quota ? t.agentQuotaHint : t.agentErrorHint),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: t.agentOfflineHint },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Folded: a title bar that opens the panel. Deliberately not a floating
  // bubble — it sits in the same column the open panel occupies, so opening
  // it never covers the outline the teacher is following.
  if (collapsed && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="panel flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:border-brand-600/70"
        aria-label={t.agentOpen}
        aria-expanded={false}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
          <Bot className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-mist-100">
            {t.agentTitle}
          </span>
          <span className="block truncate text-[10px] text-mist-400">{t.agentSubtitle}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-mist-400" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={
        expanded
          ? "panel fixed inset-y-3 right-3 z-[70] flex w-[min(36rem,94vw)] flex-col overflow-hidden shadow-2xl"
          : // `lg:min-h-[24rem]` rather than `lg:min-h-0`: the outline above is a
            // natural-height sibling in the same rail, so a `flex-1` tutor with no
            // floor got squeezed to a 2px strip the moment the outline grew past
            // the rail. The floor makes the rail (its normal overflow) scroll it
            // into view instead of clipping it to nothing.
            "panel flex h-[480px] flex-col overflow-hidden lg:h-auto lg:min-h-[24rem] lg:flex-1"
      }
    >
      <div className="flex items-center justify-between border-b border-ink-700/70 bg-ink-950/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/20 text-brand-300">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-mist-100">
              {t.agentTitle}
            </h3>
            <p className="text-[10px] text-mist-400">{t.agentSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setCollapsed(true);
              setExpanded(false);
            }}
            className="btn-icon"
            title={t.agentHide}
            aria-label={t.agentHide}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="btn-icon"
            title={expanded ? t.agentCollapse : t.agentExpand}
            aria-label={expanded ? t.agentCollapse : t.agentExpand}
            aria-pressed={expanded}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                msg.role === "user" ? "bg-gold-500/20 text-gold-300" : "bg-brand-500/20 text-brand-300"
              }`}
            >
              {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-500/20 text-brand-100 rounded-tr-none border border-brand-500/30"
                  : "bg-ink-850 text-mist-200 rounded-tl-none border border-ink-700/70"
              }`}
            >
              {msg.role === "assistant" ? renderRich(msg.content) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-mist-400">
            <LoaderCircle className="h-4 w-4 animate-spin text-brand-300" />
            <span>{t.agentThinking}</span>
          </div>
        )}
      </div>

      {suggestions.length > 0 && !loading && (
        <div className="flex flex-wrap gap-1.5 border-t border-ink-800 bg-ink-950/40 p-2.5">
          {suggestions.slice(0, 2).map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(s)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700/80 bg-ink-900/80 px-2 py-1 text-[11px] text-mist-300 hover:border-brand-500 hover:text-brand-200"
            >
              <Sparkles className="h-3 w-3 text-gold-300" />
              <span>{s}</span>
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-ink-700/70 bg-ink-950 p-2.5"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.agentPlaceholder.replace(
            "{title}",
            currentScene?.title ?? t.agentLessonFallback,
          )}
          className="field flex-1 text-xs py-2"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="btn-primary h-9 w-9 p-0 shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
