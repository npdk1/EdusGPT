/**
 * Emphasis in a slide, written the way a writer types it.
 *
 * A model asked for a slide with one key word in it writes `**năng lượng**`, and
 * a slide that shows the asterisks looks like a broken export. The marks are
 * understood here — and only these three — so the words on the slide are the
 * words the model wrote and nothing else.
 *
 * It is deliberately not an HTML parser. Slide text comes from a model, and a
 * lesson file is written to disk: neither is a place to evaluate markup. Anything
 * that is not one of the three marks stays literal text.
 *
 * Shared by the two renderers that have to agree: the React one on screen
 * (`InlineText`) and the standalone file's own HTML (`inlineHtml`). When these
 * were two copies of the regex, the download and the web player drifted apart on
 * exactly the slides where the model wrote emphasis.
 */
export const INLINE_MARKS = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

export type InlineMark = "plain" | "bold" | "italic" | "code";

export interface InlinePart {
  /** The text as the reader sees it: the markers are already taken off. */
  text: string;
  mark: InlineMark;
}

/** Splits a string into its plain and marked parts, in order. */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  for (const chunk of text.split(INLINE_MARKS)) {
    if (chunk === "") continue;
    if (chunk.length > 4 && chunk.startsWith("**") && chunk.endsWith("**")) {
      parts.push({ text: chunk.slice(2, -2), mark: "bold" });
    } else if (chunk.length > 2 && chunk.startsWith("*") && chunk.endsWith("*")) {
      parts.push({ text: chunk.slice(1, -1), mark: "italic" });
    } else if (chunk.length > 2 && chunk.startsWith("`") && chunk.endsWith("`")) {
      parts.push({ text: chunk.slice(1, -1), mark: "code" });
    } else {
      parts.push({ text: chunk, mark: "plain" });
    }
  }
  return parts;
}

/** The words with the emphasis marks taken out — what the reader actually sees. */
export function plainText(text: string): string {
  return inlineParts(text)
    .map((part) => part.text)
    .join("");
}

const TAG: Record<Exclude<InlineMark, "plain">, string> = {
  bold: "strong",
  italic: "em",
  code: "code",
};

/**
 * The same parts as HTML, for the standalone file.
 *
 * Every piece of text goes through `escape` before a tag is wrapped around it, so
 * the caller supplies its own escaping and nothing reaches the file unescaped.
 */
export function inlineHtml(text: string, escape: (value: string) => string): string {
  return inlineParts(text)
    .map((part) =>
      part.mark === "plain"
        ? escape(part.text)
        : `<${TAG[part.mark]}${part.mark === "code" ? ' class="inline-code"' : ""}>${escape(part.text)}</${TAG[part.mark]}>`,
    )
    .join("");
}
