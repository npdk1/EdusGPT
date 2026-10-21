import { Fragment } from "react";
import katex from "katex";
import { inlineParts } from "@/lib/lesson/inline";

export { plainText } from "@/lib/lesson/inline";

function renderMathToString(tex: string, display: boolean): string | null {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false,
      output: "html",
    });
  } catch {
    return null;
  }
}

/**
 * Emphasis and mathematical formulas turned into elements, for anywhere a slide or quiz shows a string.
 *
 * The marks themselves are recognised in `@/lib/lesson/inline`, which the
 * standalone export reads too — the download and the web player have to agree on
 * which words were emphasised and which formulas are rendered.
 */
export function InlineText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {inlineParts(text).map((part, index) => {
        if (part.mark === "bold") return <strong key={index}>{part.text}</strong>;
        if (part.mark === "italic") return <em key={index}>{part.text}</em>;
        if (part.mark === "code") {
          return (
            <code key={index} className="scene-inline-code">
              {part.text}
            </code>
          );
        }
        if (part.mark === "math" || part.mark === "math-display") {
          const isDisplay = part.mark === "math-display";
          const html = renderMathToString(part.text, isDisplay);
          if (html) {
            return (
              <span
                key={index}
                className={
                  isDisplay
                    ? "scene-inline-math-block my-2 block overflow-x-auto text-center [&_.katex]:!text-inherit"
                    : "scene-inline-math inline-block align-baseline [&_.katex]:!text-inherit"
                }
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }
          return (
            <span key={index} className="font-mono">
              {part.text}
            </span>
          );
        }
        return <Fragment key={index}>{part.text}</Fragment>;
      })}
    </span>
  );
}
