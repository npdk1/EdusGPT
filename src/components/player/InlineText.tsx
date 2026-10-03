import { Fragment } from "react";

/**
 * Emphasis in a slide, written the way a writer types it.
 *
 * A model asked for a slide with one key word in it writes `**năng lượng**`, and
 * a slide that shows the asterisks looks like a broken export. This turns those
 * marks into real `<strong>` and `<em>` and drops the markers, so the words on
 * the slide are the words the model wrote and nothing else.
 *
 * It is deliberately not an HTML parser: only three marks are understood, and
 * anything else stays as literal text. Slide text comes from a model, and a
 * lesson file is written to disk — neither is a place to evaluate markup.
 */
const MARKS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

/** The words with the emphasis marks taken out — what the reader actually sees. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

/** Emphasis turned into elements, for anywhere a slide shows a string. */
export function InlineText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const parts = text.split(MARKS).filter((part) => part !== "");
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={index}>{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
          return (
            <code key={index} className="scene-inline-code">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </span>
  );
}