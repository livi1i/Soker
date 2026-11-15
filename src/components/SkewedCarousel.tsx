import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import { architectureSlides } from "./carouselSlides";

export interface CarouselSlide {
  id: string; image: string; title: string;
  photos?: { image: string; title: string }[];
  review?: { author: string; excerpt: string; rating: number; date: string; url: string };
}
const wrap = (index: number, count: number) => ((index % count) + count) % count;

export function SkewedCarousel({ slides = architectureSlides, label = "Фотографии" }: {
  slides?: CarouselSlide[]; label?: string; openAlbums?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const suppressClick = useRef(false);
  const count = slides.length;
  const active = count ? wrap(selected, count) : 0;
  // Virtual positions keep every photo moving in the same direction across the loop.
  const move = (delta: number) => setSelected(current => current + delta);
  const select = (index: number) => setSelected(current => {
    let delta = wrap(index - wrap(current, count), count);
    if (delta > count / 2) delta -= count;
    return current + delta;
  });
  const positions = Array.from({length: count === 1 ? 1 : 9}, (_, i) => selected + i - (count === 1 ? 0 : 4));
  const finish = (event: PointerEvent<HTMLOListElement>) => {
    const start = gesture.current; gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX-start.x; const dy = event.clientY-start.y;
    if (Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.2) { suppressClick.current = true; move(dx<0?1:-1); }
  };
  if (!count) return null;
  return (
    <section className="skew-carousel" aria-label={label} aria-roledescription="карусель" tabIndex={0}
      onKeyDown={event => {
        if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) {
          event.preventDefault(); if(event.key==="Home") select(0); else if(event.key==="End") select(count-1); else move(event.key==="ArrowRight"?1:-1);
        }
      }}>
      <ol className="skew-carousel__stage" data-single={count===1}
        onPointerDown={event => { if (!event.isPrimary || event.button!==0) return; suppressClick.current=false; gesture.current={x:event.clientX,y:event.clientY,id:event.pointerId}; }}
        onPointerMove={event => { const start=gesture.current; if(start && Math.abs(event.clientX-start.x)>12 && Math.abs(event.clientX-start.x)>Math.abs(event.clientY-start.y)) event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerUp={finish} onPointerCancel={()=>{gesture.current=null;}}
        onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}}>
        {positions.map(position=>{const index=wrap(position,count); const slide=slides[index]; const offset=position-selected; return (
          <li key={position} className="skew-carousel__slide" data-active={offset===0} aria-hidden={Math.abs(offset)>2} style={{ "--offset": offset, "--distance": Math.abs(offset), "--float-delay": `${-wrap(position,7)*1.1}s` } as CSSProperties}>
            <button type="button" className="skew-carousel__card" disabled={Math.abs(offset)>2} tabIndex={offset===0?0:-1}
              aria-label={`${index+1} из ${count}: ${slide.title}`} aria-current={offset===0?"true":undefined}
              onClick={()=>move(offset)}>
              <img src={slide.image} alt={slide.title} decoding="async" draggable={false} />
              {offset===0&&<strong className="skew-carousel__title">{slide.title}</strong>}
            </button>
          </li>
        );})}
      </ol>
      {count>1&&<nav className="skew-carousel__controls" aria-label="Переключение фотографий">
        <button type="button" onClick={()=>move(-1)} aria-label="Предыдущее фото"><ArrowLeft size={22} aria-hidden /></button>
        <ol className="skew-carousel__indicators">{slides.map((slide,index)=><li key={slide.id}><button type="button" onClick={()=>select(index)} aria-label={`Показать фото ${index+1}: ${slide.title}`} aria-current={index===active?"true":undefined} /></li>)}</ol>
        <button type="button" onClick={()=>move(1)} aria-label="Следующее фото"><ArrowRight size={22} aria-hidden /></button>
      </nav>}
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">{active+1} из {count}: {slides[active].title}</p>
    </section>
  );
}
