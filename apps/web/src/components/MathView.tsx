import React, { useMemo } from "react";
import katex from "katex";

interface MathViewProps {
  math: string;
  block?: boolean;
  className?: string;
  darkMode?: boolean;
}

export const MathView: React.FC<MathViewProps> = ({
  math,
  block = false,
  className = "",
  darkMode = true,
}) => {
  const renderedHtml = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
        strict: false,
      });
    } catch {
      return math;
    }
  }, [math, block]);

  if (block) {
    return (
      <div
        className={`my-3 p-3.5 rounded-xl border font-mono text-sm overflow-x-auto shadow-inner transition-colors ${
          darkMode
            ? "border-[#27272a] bg-[#0c0c0e] text-[#f4f4f5] shadow-black/40"
            : "border-[#e4e2dd] bg-[#fbfaf8] text-[#111113] shadow-stone-200/50"
        } ${className}`}
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }

  return (
    <span
      className={`inline-block font-mono ${
        darkMode ? "text-amber-400" : "text-amber-700"
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
};

export const MathBlock: React.FC<Omit<MathViewProps, "block">> = (props) => (
  <MathView {...props} block={true} />
);

export const InlineMath: React.FC<Omit<MathViewProps, "block">> = (props) => (
  <MathView {...props} block={false} />
);
