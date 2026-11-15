import { useEffect, useRef, useState } from "react";

/** A trackless overlay: the page extends underneath the six-pixel thumb. */
export function PageScrollbar() {
  const [metrics, setMetrics] = useState({ top: 12, height: 40, max: 0, value: 0 });
  const drag = useRef<{ y: number; scroll: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const viewport = window.innerHeight;
      const max = Math.max(0, document.documentElement.scrollHeight - viewport);
      const track = Math.max(0, viewport - 24);
      const height = Math.min(track, Math.max(40, track * viewport / (max + viewport)));
      setMetrics({ height, max, value: window.scrollY, top: 12 + (max ? window.scrollY / max * (track - height) : 0) });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); };
  }, []);
  if (!metrics.max) return null;
  return <section className="page-scrollbar" role="scrollbar" aria-label="Прокрутка страницы" aria-controls="page-content" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={metrics.max} aria-valuenow={Math.round(metrics.value)} tabIndex={0}
    style={{ top: metrics.top, height: metrics.height }}
    onPointerDown={event => { if(event.button!==0)return; drag.current={y:event.clientY,scroll:window.scrollY}; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
    onPointerMove={event => { if(!drag.current)return; const travel=window.innerHeight-24-metrics.height; if(travel>0)window.scrollTo({top:drag.current.scroll+(event.clientY-drag.current.y)*metrics.max/travel,behavior:"instant"}); }}
    onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }}
    onKeyDown={event => { const steps:Record<string,number>={ArrowDown:40,ArrowUp:-40,PageDown:window.innerHeight*.9,PageUp:-window.innerHeight*.9}; if(event.key in steps||event.key==='Home'||event.key==='End'){event.preventDefault();window.scrollTo({top:event.key==='Home'?0:event.key==='End'?metrics.max:window.scrollY+steps[event.key],behavior:"instant"});} }} />;
}
