import type { ReactNode } from "react";

export function HelpTip({ children }: { children: ReactNode }) {
  return (
    <span
      className="help-tip"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="help-tip-icon" tabIndex={0} aria-label="Ajuda">❓</span>
      <span className="help-tip-pop" role="tooltip">{children}</span>
    </span>
  );
}
