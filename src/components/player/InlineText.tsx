import { Fragment } from "react";
import { inlineParts } from "@/lib/lesson/inline";

export { plainText } from "@/lib/lesson/inline";

/**
 * Emphasis turned into elements, for anywhere a slide shows a string.
 *
 * The marks themselves are recognised in `@/lib/lesson/inline`, which the
 * standalone export reads too — the download and the web player have to agree on
 * which words were emphasised, or the same lesson reads two ways.
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
        return <Fragment key={index}>{part.text}</Fragment>;
      })}
    </span>
  );
}
