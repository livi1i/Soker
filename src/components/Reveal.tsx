import { useEffect, useRef, type ReactNode } from "react";


/** Плавное появление раздела при прокрутке. При «уменьшить движение» раздел виден сразу (см. global.css). */
export function Reveal({ children, as = "section", className = "", id, ariaLabelledby }: {
  children: ReactNode;
  as?: "section" | "div";
  className?: string;
  id?: string;
  ariaLabelledby?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      el.classList.add("is-visible");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref as never} id={id} aria-labelledby={ariaLabelledby} className={`reveal ${className}`}>
      {children}
    </Tag>
  );
}
