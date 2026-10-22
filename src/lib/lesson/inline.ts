import katex from "katex";

/**
 * Emphasis and mathematical formulas in slide and quiz text, written the way
 * a human or model writes it.
 *
 * Supports:
 * - Bold (`**text**`), Italic (`*text*`), Code (`` `code` ``)
 * - Math inline (`$formula$` or `\(formula\)`) via KaTeX
 * - Math display (`$$formula$$` or `\[formula\]`) via KaTeX
 * - Robust auto-detection and normalization of bare mathematical formulas (e.g. `lim_{h→0}`, fractions, powers, equations, intervals)
 *
 * Shared by the two renderers that have to agree: the React one on screen
 * (`InlineText`) and the standalone file's own HTML (`inlineHtml`).
 */
export const INLINE_MARKS =
  /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;

export type InlineMark = "plain" | "bold" | "italic" | "code" | "math" | "math-display";

export interface InlinePart {
  /** The text as the reader sees it: the markers are already taken off. */
  text: string;
  mark: InlineMark;
}

export const VIETNAMESE_ACCENTS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export const LATEX_COMMAND_REGEX =
  /\\(frac|sqrt|lim|to|alpha|beta|gamma|theta|lambda|mu|sigma|omega|Delta|Omega|pi|vec|overrightarrow|int|sum|prod|in|notin|subset|subseteq|cup|cap|emptyset|forall|exists|le|ge|neq|approx|pm|mp|times|cdot|infty|mathbb|mathrm|mathbf|text|left|right|begin|end|sin|cos|tan|cot|ln|log|exp|cases|matrix|pmatrix|bmatrix|partial|equiv|perp|parallel|circ|setminus|angle|triangle)\b/;

/**
 * Cleans up and normalizes math formula strings for KaTeX.
 * Handles outer wrappers, Unicode math symbols, operators, and missing function backslashes.
 */
export function cleanLatex(formula: string): string {
  if (!formula) return "";
  let s = formula.trim();

  // Strip accidental trailing punctuation from sentence boundaries (e.g. "x = 2." -> "x = 2")
  while (
    s.endsWith(".") ||
    s.endsWith(",") ||
    s.endsWith(";") ||
    s.endsWith(":") ||
    s.endsWith("?")
  ) {
    s = s.slice(0, -1).trim();
  }

  // Strip outer wrappers
  while (
    (s.startsWith("$$") && s.endsWith("$$") && s.length >= 4) ||
    (s.startsWith("\\[") && s.endsWith("\\]") && s.length >= 4) ||
    (s.startsWith("\\(") && s.endsWith("\\)") && s.length >= 4) ||
    (s.startsWith("$") && s.endsWith("$") && s.length >= 2)
  ) {
    if (s.startsWith("$$") && s.endsWith("$$")) s = s.slice(2, -2).trim();
    else if (s.startsWith("\\[") && s.endsWith("\\]")) s = s.slice(2, -2).trim();
    else if (s.startsWith("\\(") && s.endsWith("\\)")) s = s.slice(2, -2).trim();
    else if (s.startsWith("$") && s.endsWith("$")) s = s.slice(1, -1).trim();
  }

  // Escape lone & inside \text{...} to prevent KaTeX parse errors
  s = s.replace(/(\\text\{[^}]*?)(&)([^}]*?\})/g, (m, p1, amp, p2) => `${p1}\\&${p2}`);

  // Remove trailing bare backslash if any
  s = s.replace(/\\\s*$/, "");

  // Unicode arrows
  s = s.replace(/→/g, "\\to ");
  s = s.replace(/←/g, "\\leftarrow ");
  s = s.replace(/⇒/g, "\\Rightarrow ");
  s = s.replace(/⇔/g, "\\Leftrightarrow ");

  // Mathematical operators & relations
  s = s.replace(/·/g, "\\cdot ");
  s = s.replace(/×/g, "\\times ");
  s = s.replace(/÷/g, "\\div ");
  s = s.replace(/±/g, "\\pm ");
  s = s.replace(/∓/g, "\\mp ");
  s = s.replace(/≤/g, "\\le ");
  s = s.replace(/≥/g, "\\ge ");
  s = s.replace(/≠/g, "\\neq ");
  s = s.replace(/≈/g, "\\approx ");
  s = s.replace(/≡/g, "\\equiv ");
  s = s.replace(/∞/g, "\\infty ");
  s = s.replace(/°/g, "^\\circ ");
  s = s.replace(/⊥/g, "\\perp ");
  s = s.replace(/∥/g, "\\parallel ");

  // Set theory & logic symbols
  s = s.replace(/∈/g, "\\in ");
  s = s.replace(/∉/g, "\\notin ");
  s = s.replace(/⊂/g, "\\subset ");
  s = s.replace(/⊆/g, "\\subseteq ");
  s = s.replace(/∪/g, "\\cup ");
  s = s.replace(/∩/g, "\\cap ");
  s = s.replace(/∅/g, "\\emptyset ");
  s = s.replace(/∀/g, "\\forall ");
  s = s.replace(/∃/g, "\\exists ");

  // Greek letters & symbols
  s = s.replace(/[Δ∆]/g, "\\Delta ");
  s = s.replace(/π/g, "\\pi ");
  s = s.replace(/α/g, "\\alpha ");
  s = s.replace(/β/g, "\\beta ");
  s = s.replace(/γ/g, "\\gamma ");
  s = s.replace(/θ/g, "\\theta ");
  s = s.replace(/λ/g, "\\lambda ");
  s = s.replace(/μ/g, "\\mu ");
  s = s.replace(/σ/g, "\\sigma ");
  s = s.replace(/ω/g, "\\omega ");
  s = s.replace(/Ω/g, "\\Omega ");
  s = s.replace(/∑/g, "\\sum ");
  s = s.replace(/∏/g, "\\prod ");
  s = s.replace(/∫/g, "\\int ");

  // Common text-based operators
  s = s.replace(/<=/g, "\\le ");
  s = s.replace(/>=/g, "\\ge ");
  s = s.replace(/!=/g, "\\neq ");

  // Missing backslash for standard functions
  s = s.replace(/(^|[^\\])\blim_/g, "$1\\lim_");
  s = s.replace(
    /(^|[^\\])\b(sin|cos|tan|cot|ln|log|exp|arcsin|arccos|arctan)\b(?!\s*\{)/g,
    "$1\\$2",
  );
  s = s.replace(/(^|[^\\])\bmax_/g, "$1\\max_");
  s = s.replace(/(^|[^\\])\bmin_/g, "$1\\min_");

  // Square roots
  s = s.replace(/√\s*\{([^}]+)\}/g, "\\sqrt{$1}");
  s = s.replace(/√\s*\(([^)]+)\)/g, "\\sqrt{$1}");
  s = s.replace(/√\s*([a-zA-Z0-9]+)/g, "\\sqrt{$1}");
  s = s.replace(/√/g, "\\sqrt{}");

  return s;
}

/**
 * Checks if a string is a standalone bare mathematical expression without $ delimiters.
 */
export function isBareFormula(str: string): boolean {
  const s = str.trim();
  if (!s) return false;
  if (s.includes("$") || s.includes("\\[") || s.includes("\\(")) return false;

  // Strip text macros before testing Vietnamese accents
  const strippedOfText = s.replace(/\\(text|mathrm|mathbf|mathit)\{[^}]*\}/g, "");
  if (VIETNAMESE_ACCENTS.test(strippedOfText)) return false;

  // Multi-line / structured LaTeX environments
  if (/^\\begin\{(cases|aligned|matrix|pmatrix|bmatrix|vmatrix|array)\}/.test(s)) return true;

  // Contains any LaTeX command
  if (LATEX_COMMAND_REGEX.test(s)) return true;

  // Equation or assignment: y = ..., f(x) = ..., f'(x) = ...
  if (
    /^[a-zA-Z]'?(\([a-zA-Z0-9+\-*/, ]+\))?\s*(=|<|>|<=|>=|\\le|\\ge|\\neq|≤|≥|≠)\s*.+/i.test(
      s,
    )
  ) {
    return true;
  }

  // Calculus notation: lim_{...} or \int or \sum
  if (/^(\\lim_|lim_|\blim_\{|\\int|\\sum|\\prod)/i.test(s)) return true;

  // Math symbols / powers / subscripts / arrows
  if (
    /[a-zA-Z0-9]\^[\{0-9a-zA-Z]+|[a-zA-Z0-9]_[\{0-9a-zA-Z]+|√|→|≤|≥|≠|±|∈|∞|∫|∑|π|Δ/.test(
      s,
    )
  ) {
    return true;
  }

  // Algebraic fraction or division with math operators: "(x^2 - a^2)/(x-a)"
  if (
    /^[\d\s+\-*/()a-zA-Z^_,.=]+$/.test(s) &&
    /[a-zA-Z]/.test(s) &&
    /[+\-*/^=]/.test(s)
  ) {
    if (!/^(true|false|none|null|undefined)$/i.test(s)) return true;
  }
  return false;
}

/**
 * Automatically wraps bare math expressions in $ without breaking existing markup or Vietnamese text.
 */
export function autoWrapMath(text: string): string {
  if (!text) return text;

  // If the whole string is a bare formula, wrap it completely
  if (isBareFormula(text)) {
    return `$${cleanLatex(text)}$`;
  }

  // Step 1: Protect already delimited blocks with unique placeholder tokens (using Private Use unicode to avoid math regex collision)
  const protectedBlocks: string[] = [];
  const placeholderPrefix = "\uE000P";
  const placeholderSuffix = "\uE001";

  const addProtected = (content: string) => {
    const idx = protectedBlocks.length;
    protectedBlocks.push(content);
    return `${placeholderPrefix}${idx}${placeholderSuffix}`;
  };

  let working = text.replace(
    /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+?\$|\\\([\s\S]+?\\\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g,
    (match) => addProtected(match),
  );

  // Helper to safely wrap matched math chunk into a protected block
  const wrapMath = (prefix: string, mathExpr: string) => {
    let expr = mathExpr.trim();
    if (expr.includes("\uE000")) return `${prefix}${mathExpr}`;

    let trailing = "";
    while (
      expr.endsWith(".") ||
      expr.endsWith(",") ||
      expr.endsWith(";") ||
      expr.endsWith(":") ||
      expr.endsWith("?")
    ) {
      trailing = expr.slice(-1) + trailing;
      expr = expr.slice(0, -1).trim();
    }
    if (!expr) return `${prefix}${mathExpr}`;
    // Strip \text{...} or \mathrm{...} before checking Vietnamese accents,
    // because LaTeX formulas legitimately contain Vietnamese words inside \text{...}
    const strippedOfText = expr.replace(/\\(text|mathrm|mathbf|mathit)\{[^}]*\}/g, "");
    if (VIETNAMESE_ACCENTS.test(strippedOfText)) return `${prefix}${mathExpr}`;

    const token = addProtected(`$${cleanLatex(expr)}$`);
    return `${prefix}${token}${trailing}`;
  };

  // 0. LaTeX environments like \begin{cases} ... \end{cases}
  working = working.replace(
    /(^|[\s,.:;?!([])(\\begin\{(cases|aligned|matrix|pmatrix|bmatrix|vmatrix|array)\}[\s\S]*?\\end\{\3\})(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 1. Integrals & Summations: \int_0^\pi \sin x dx = 2, \int x^2 dx, \sum_{i=1}^n x_i
  working = working.replace(
    /(^|[\s,.:;?!([])(([a-zA-Z]\s*=\s*)?(\\int|\\sum|\\prod)(_\{[^}]+\}|\^[^{}\s]+|\s*[-+*/0-9a-zA-Z^(){}[\].,_\\=]|\\sin|\\cos|\\tan|\\cot|\\ln|\\log|dx|dy|dt)+)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 2. Set expressions & intervals with LaTeX commands:
  // e.g. D = \mathbb{R} \setminus \{1\}, S = [0; +\infty), x \in [1; 3]
  working = working.replace(
    /(^|[\s,.:;?!([])([a-zA-Z]\s*(=|\\in|∈)\s*(\[|\()[-+0-9a-zA-Z^/()_.,; \t\\+\-\\infty]+(\]|\))|D\s*=\s*\\mathbb\{R\}[^\n,.;?!]*)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 3. Inequalities with variable: x \le 2, x \ge 5, x > 0, x <= 10
  working = working.replace(
    /(^|[\s,.:;?!([])([a-zA-Z]\s*(\\le|\\ge|\\neq|<=|>=|!=|<|>|≤|≥|≠)\s*[-+0-9a-zA-Z^/()_.,\\[\];+\\infty]+)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 4. Explicit LaTeX commands with surrounding math tokens, primes, coefficients, and operators:
  // e.g. y = \frac{2x-1}{x+1}, \vec{u} = (1; 2; -3), \Delta' = b^2 - 3ac, [\vec{u}, \vec{v}] \perp \vec{u}, 2\cos^2 x - 1, d(M, P) = \frac{|...|}{\sqrt{...}}
  working = working.replace(
    /(^|[\s,.:;?!([])((?:\[|\()?(?:(?:[a-zA-Z]'?(?:\([-+0-9a-zA-Z, ;_]+\))?|\d+)?\s*(?:=|<|>|<=|>=|\\le|\\ge|\\neq|\\perp|\\parallel|≤|≥|≠)\s*)?(?:[-+]\s*|\pm\s*|\mp\s*|\d+)?\\[a-zA-Z]+'*(?:\{(?:[^{}]*|\{[^{}]*\})*\}|\[(?:[^[\]]*|\[[^[\]]*\])*\]|\([^)]*\)|[-+*/0-9a-zA-Z^_.,;= \t'|]|\\\{|\\\}|\\quad|\\text\{[^}]*\}|\\iff|\\implies|\\perp|\\cdot|\\left[([{]|\\right[)\]}])+)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 5. Algebraic equations & polynomial functions:
  // e.g. y = x^2 - 4x + 3, f(x) = x^3 - 3x + 1, f'(x) = 2x - 1, 2x - y + 5 = 0, y = 4x - 2
  working = working.replace(
    /(^|[\s,.:;?!([])([a-zA-Z]'?(\([a-zA-Z0-9+\-*/, ]+\))?\s*(=|<|>|<=|>=|\\le|\\ge|\\neq|≤|≥|≠)\s*[-+0-9a-zA-Z^/()_.,]+(\s*[-+*/]\s*[-+0-9a-zA-Z^/()_.,]+)+)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => {
      const strippedOfText = expr.replace(/\\(text|mathrm|mathbf|mathit)\{[^}]*\}/g, "");
      if (VIETNAMESE_ACCENTS.test(strippedOfText)) return match;
      if (/^(true|false|null|none)$/i.test(expr.trim())) return match;
      return wrapMath(prefix, expr);
    }
  );

  // 6. Limits: lim_{x -> 0} f(x)
  working = working.replace(
    /(^|[\s,.:;?!([])(lim_\{[^}]+\}[^\s,.:;?!]*(\s*[-+*/=]\s*[^\s,.:;?!]+)*)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 7. Coordinate points: A(1; 2), B(-2; 3; 0), M(x_0; y_0), I(2; -1)
  working = working.replace(
    /(^|[\s,.:;?!([])([A-Z]\([-0-9a-zA-Z_+/.,; ]+\))(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 8. Subscripts / Superscripts / Trig periods: x_1, x_2, y_{CD}, x^2, e^x, k2\pi
  working = working.replace(
    /(^|[\s,.:;?!([])([a-zA-Z0-9Δ∆παβγθ]\^(\{[^}]+\}|\d+)|[a-zA-Z0-9Δ∆παβγθ]_(\{[^}]+\}|[a-zA-Z0-9]+)|[kmn]?\d*\\pi)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // 9. Simple variable equalities: x = 2, m = -1, y = 0
  working = working.replace(
    /(^|[\s,.:;?!([])([a-zA-Z]\s*=\s*-?\d+)(?=[,.:;?!\]\s]|$)/g,
    (match, prefix, expr) => wrapMath(prefix, expr),
  );

  // Step 3: Restore protected blocks
  working = working.replace(
    new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, "g"),
    (_, idxStr) => {
      const idx = parseInt(idxStr, 10);
      return protectedBlocks[idx] ?? "";
    },
  );

  return working;
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
          return katex.renderToString(part.text, {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          return `<span class="math-fallback">${escape(part.text)}</span>`;
        }
      }
      if (part.mark === "math-display") {
        try {
          return `<div class="formula-block">${katex.renderToString(part.text, {
            displayMode: true,
            throwOnError: false,
          })}</div>`;
        } catch {
          return `<div class="formula-fallback">${escape(part.text)}</div>`;
        }
      }
      return escape(part.text);
    })
    .join("");
}
