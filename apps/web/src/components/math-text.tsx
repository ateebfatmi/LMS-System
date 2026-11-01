import katex from "katex";
import type { ReactNode } from "react";

type MathTextProps = {
  as?: "span" | "p";
  className?: string;
  children?: string | null;
};

const mathDelimiterPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

function renderMathSegment(segment: string, index: number): ReactNode {
  const displayMode = segment.startsWith("$$") || segment.startsWith("\\[");
  const expression = segment.startsWith("$$")
    ? segment.slice(2, -2)
    : segment.startsWith("\\[") || segment.startsWith("\\(")
      ? segment.slice(2, -2)
      : segment.slice(1, -1);

  const html = katex.renderToString(expression, {
    displayMode,
    output: "htmlAndMathml",
    strict: false,
    throwOnError: false,
    trust: false,
  });

  return (
    <span
      className={displayMode ? "math-expression math-expression-display" : "math-expression"}
      dangerouslySetInnerHTML={{ __html: html }}
      key={`${index}-${segment}`}
    />
  );
}

function isMathSegment(segment: string) {
  return (
    (segment.startsWith("$$") && segment.endsWith("$$")) ||
    (segment.startsWith("\\[") && segment.endsWith("\\]")) ||
    (segment.startsWith("\\(") && segment.endsWith("\\)")) ||
    (segment.startsWith("$") && segment.endsWith("$"))
  );
}

/** Renders trusted plain text with only delimited LaTeX converted by KaTeX. */
export function MathText({ as: Element = "span", children, className }: MathTextProps) {
  const parts = (children ?? "").split(mathDelimiterPattern);

  return (
    <Element className={["math-text", className].filter(Boolean).join(" ")}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (isMathSegment(part)) return renderMathSegment(part, index);
        return part;
      })}
    </Element>
  );
}
