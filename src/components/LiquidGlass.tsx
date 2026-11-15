import { type ReactNode } from "react";

/** Нативное стекло размывает актуальный фон без снимков страницы и WebGL-слоёв. */
export function LiquidGlass(props: {
  className?: string;
  children: ReactNode;
  as?: "div" | "nav";
  ariaLabel?: string;
}) {
  const Tag = props.as ?? "div";
  return (
    <Tag className={`glass ${props.className ?? ""}`} aria-label={props.ariaLabel}>
      <div className="glass__content">{props.children}</div>
    </Tag>
  );
}
