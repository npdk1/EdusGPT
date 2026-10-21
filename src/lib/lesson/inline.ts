import katex from "katex";

/**
 * Emphasis and mathematical formulas in slide and quiz text, written the way
 * a human or model writes it.
 *
 * Supports:
 * - Bold (`**text**`), Italic (`*text*`), Code (`` `code` ``)
 * - Math inline (`$formula$` or `\(formula\)`) via KaTeX
 * - Math display (`$$formula$$` or `\[formula\]`) via KaTeX
 * - Auto-detection and normalization of bare mathematical formulas (e.g. `lim_{h→0}`, fractions, powers)
 *
 * Shared by the two renderers that have to agree: the React one on screen
 * (`InlineText`) and the standalone file's own HTML (`inlineHtml`).
 */
export const INLINE_MARKS =
  /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

export type InlineMark = "plain" | "bold" | "italic" | "code" | "math" | "math-display";

export interface InlinePart {
  /** The text as the reader sees it: the markers are already taken off. */
  text: string;
  mark: InlineMark;
}

/**
 * Checks if a string is a standalone bare mathematical expression without $ delimiters.
 */
export function isBareFormula(str: string): boolean {
  const s = str.trim();
  if (!s) return false;
  // If already delimited, not bare
  if (s.startsWith("$") || s.startsWith("\\[") || s.startsWith("\\(")) return false;
  // If contains Vietnamese accented characters, it's natural language, not a pure formula
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(s)) {
    return false;
  }
  // Explicit LaTeX commands like \frac, \lim, \sqrt, \alpha, etc.
  if (/^\\[a-zA-Z]/.test(s)) return true;
  // Limit or calculus notation: lim_{...} or lim_
  if (/^lim_|\blim_\{/i.test(s)) return true;
  // Math symbols / powers / arrows: x^2, e^{a}, √x, →
  if (/[a-zA-Z0-9]\^[\{0-9a-zA-Z]+|[a-zA-Z0-9]_[\{0-9a-zA-Z]+|√|→/.test(s)) return true;
  // Algebraic fraction or division with math operators: "(x^2 - a^2)/(x-a)"
  if (/^[\d\s+\-*/()a-zA-Z^_,.=]+$/.test(s) && /[a-zA-Z]/.test(s) && /[+\-*/^=]/.test(s)) {
    if (!/^(true|false|none|null|undefined)$/i.test(s)) return true;
  }
  return false;
}

/**
 * Cleans up and normalizes math formula strings for KaTeX.
 */
export function cleanLatex(formula: string): string {
  let s = formula.trim();
  if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
  else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();
  else if (s.startsWith("\\[") && s.endsWith("\\]")) s = s.slice(2, -2).trim();
  else if (s.startsWith("\\(") && s.endsWith("\\)")) s = s.slice(2, -2).trim();

  s = s.replace(/→/g, "\\to ");
  s = s.replace(/(^|[^\\])\blim_/g, "$1\\lim_");
  s = s.replace(/√\s*\{([^}]+)\}/g, "\\sqrt{$1}");
  s = s.replace(/√\s*([a-zA-Z0-9]+)/g, "\\sqrt{$1}");
  s = s.replace(/·/g, "\\cdot ");
  return s;
}

/**
 * Automatically wraps bare math expressions in $ if no delimiters exist.
 */
export function autoWrapMath(text: string): string {
  if (!text) return text;
  // If already delimited, preserve exact author markup
  if (text.includes("$") || text.includes("\\[") || text.includes("\\(")) {
    return text;
  }
  // If the whole string is a bare formula, wrap it completely
  if (isBareFormula(text)) {
    return `$${cleanLatex(text)}$`;
  }

  let s = text;
  // 1. Expressions with lim_{...} inside text
  s = s.replace(/(^|[\s,.:;?!(])(lim_\{[^}]+\}[^\s,.:;?!]*(\s*[-+*/=]\s*[^\s,.:;?!]+)*)/g, (match, prefix, expr) => {
    return `${prefix}$${cleanLatex(expr)}$`;
  });

  // 2. Function equations: f(x)=x^2, g(x)=√x, f(x)=1/x
  s = s.replace(/(^|[\s,.:;?!(])([a-zA-Z]'?\([a-zA-Z0-9+\-*/, ]+\)\s*=\s*[^,.:;?!\s]+)/g, (match, prefix, expr) => {
    return `${prefix}$${cleanLatex(expr)}$`;
  });

  // 3. Standalone derivative/function evaluations: f'(a), f'(2), g'(x)
  s = s.replace(/(^|[\s,.:;?!(])([a-zA-Z]'+\([a-zA-Z0-9+\-*/, ]+\))(?=[,.:;?!\s]|$)/g, (match, prefix, expr) => {
    return `${prefix}$${cleanLatex(expr)}$`;
  });

  // 4. Simple variable equalities: x=3, x=4, x=0, a=2
  s = s.replace(/(^|[\s,.:;?!(])([a-zA-Z]\s*=\s*-?\d+)(?=[,.:;?!\s]|$)/g, (match, prefix, expr) => {
    return `${prefix}$${expr}$`;
  });

  // 5. Exponential/power tokens: e^{a+h}, e^{a}, x^2, x^3
  s = s.replace(/(^|[\s,.:;?!(])([a-zA-Z0-9]\^(\{[^}]+\}|\d+))(?=[,.:;?!\s]|$)/g, (match, prefix, expr) => {
    return `${prefix}$${expr}$`;
  });

  return s;
}

/** Splits a string into its plain, marked, and math parts, in order. */
export function inlineParts(text: string): InlinePart[] {
  const normalized = autoWrapMath(text);
  const parts: InlinePart[] = [];
  for (const chunk of normalized.split(INLINE_MARKS)) {
    if (chunk === "") continue;
    if (chunk.length >= 4 && chunk.startsWith("$$") && chunk.endsWith("$$")) {
      parts.push({ text: cleanLatex(chunk.slice(2, -2)), mark: "math-display" });
    } else if (chunk.length >= 4 && chunk.startsWith("\\[") && chunk.endsWith("\\]")) {
      parts.push({ text: cleanLatex(chunk.slice(2, -2)), mark: "math-display" });
    } else if (chunk.length >= 2 && chunk.startsWith("$") && chunk.endsWith("$")) {
      parts.push({ text: cleanLatex(chunk.slice(1, -1)), mark: "math" });
    } else if (chunk.length >= 4 && chunk.startsWith("\\(") && chunk.endsWith("\\)")) {
      parts.push({ text: cleanLatex(chunk.slice(2, -2)), mark: "math" });
    } else if (chunk.length > 4 && chunk.startsWith("**") && chunk.endsWith("**")) {
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

/**
 * The same parts as HTML, for the standalone file.
 *
 * Every piece of text goes through `escape` before a tag is wrapped around it, so
 * the caller supplies its own escaping and nothing reaches the file unescaped.
 */
export function inlineHtml(text: string, escape: (value: string) => string): string {
  return inlineParts(text)
    .map((part) => {
      if (part.mark === "plain") {
        return escape(part.text);
      }
      if (part.mark === "bold") {
        return `<strong>${escape(part.text)}</strong>`;
      }
      if (part.mark === "italic") {
        return `<em>${escape(part.text)}</em>`;
      }
      if (part.mark === "code") {
        return `<code class="inline-code">${escape(part.text)}</code>`;
      }
      if (part.mark === "math") {
        try {
          return katex.renderToString(part.text, { displayMode: false, throwOnError: false });
        } catch {
          return `<span class="math-fallback">${escape(part.text)}</span>`;
        }
      }
      if (part.mark === "math-display") {
        try {
          return `<div class="formula-block">${katex.renderToString(part.text, { displayMode: true, throwOnError: false })}</div>`;
        } catch {
          return `<div class="formula-fallback">${escape(part.text)}</div>`;
        }
      }
      return escape(part.text);
    })
    .join("");
}
