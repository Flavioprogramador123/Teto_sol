import { cloneElement, isValidElement, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from "react";

/** Mostra um balão de ajuda após o ponteiro ficar parado ~0,55 s. */
export function HoverTip({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => () => clear(), []);

  const show = () => {
    clear();
    timer.current = window.setTimeout(() => setOpen(true), 550);
  };

  const hide = () => {
    clear();
    setOpen(false);
  };

  if (!isValidElement(children)) return null;

  const prev = children.props as {
    onPointerEnter?: (e: PointerEvent) => void;
    onPointerLeave?: (e: PointerEvent) => void;
    onFocus?: (e: FocusEvent) => void;
    onBlur?: (e: FocusEvent) => void;
  };

  const child = cloneElement(children, {
    onPointerEnter: (e: PointerEvent) => {
      prev.onPointerEnter?.(e);
      show();
    },
    onPointerLeave: (e: PointerEvent) => {
      prev.onPointerLeave?.(e);
      hide();
    },
    onFocus: (e: FocusEvent) => {
      prev.onFocus?.(e);
      show();
    },
    onBlur: (e: FocusEvent) => {
      prev.onBlur?.(e);
      hide();
    },
  } as Partial<typeof children.props>);

  return (
    <span className={`hover-tip${open ? " open" : ""}`}>
      {child}
      {open ? (
        <span className="hover-tip-pop" role="tooltip">
          <b>{title}</b>
          <span>{text}</span>
        </span>
      ) : null}
    </span>
  );
}

export function ToolGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tool-group" role="group" aria-label={label}>
      <span className="tool-group-label">{label}</span>
      <div className="tool-group-items">{children}</div>
    </div>
  );
}
