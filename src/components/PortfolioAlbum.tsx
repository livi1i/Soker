import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X, Star } from "@phosphor-icons/react";
import type { CarouselSlide } from "./SkewedCarousel";

export function PortfolioAlbum({ slide, onClose }: { slide: CarouselSlide; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const backdrop = useRef(false);
  const photos = slide.photos?.length ? slide.photos : [{ image: slide.image, title: slide.title }];
  const move = (step: number) => setIndex(i => (i + step + photos.length) % photos.length);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.body.style.overflow;
    element.showModal(); document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  return (
    <dialog ref={dialog} className="portfolio-album" aria-label={slide.review ? `Отзыв: ${slide.review.author}` : slide.title}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onPointerDown={event => { backdrop.current = event.target === event.currentTarget; }}
      onClick={event => { event.stopPropagation(); if (backdrop.current && event.target === event.currentTarget) onClose(); backdrop.current = false; }}
      onKeyDown={event => { event.stopPropagation(); if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <article className="portfolio-album__panel">
        <header className="portfolio-album__header"><h2>{slide.review?.author || slide.title}</h2><button type="button" aria-label="Закрыть альбом" onClick={onClose} autoFocus><X size={24} aria-hidden /></button></header>
        <figure className="portfolio-album__photo" onPointerDown={event => { swipe.current = { x: event.clientX, y: event.clientY }; }}
          onPointerUp={event => { const start = swipe.current; swipe.current = null; if (start && Math.abs(event.clientX-start.x) > 45 && Math.abs(event.clientX-start.x) > Math.abs(event.clientY-start.y)) move(event.clientX < start.x ? 1 : -1); }}
          onPointerCancel={() => { swipe.current = null; }}>
          <img src={photos[index].image} alt={photos[index].title} draggable={false} />
          {photos.length > 1 && <nav aria-label="Фото в альбоме"><button type="button" aria-label="Предыдущее фото альбома" onClick={() => move(-1)}><ArrowLeft size={24} aria-hidden /></button><button type="button" aria-label="Следующее фото альбома" onClick={() => move(1)}><ArrowRight size={24} aria-hidden /></button></nav>}
          <figcaption aria-live="polite">{index + 1} / {photos.length}</figcaption>
        </figure>
        {photos.length > 1 && <nav className="portfolio-album__thumbs" aria-label="Все фото альбома">{photos.map((photo, i) => <button type="button" key={photo.image} aria-label={`Фото ${i+1}`} aria-current={i === index ? "true" : undefined} onClick={() => setIndex(i)}><img src={photo.image} alt="" loading="lazy" /></button>)}</nav>}
        {slide.review && <section className="portfolio-album__review" aria-label="Отзыв клиента">
          <p className="portfolio-album__rating">{Array.from({length:slide.review.rating},(_,i)=><Star key={i} size={17} weight="fill" aria-hidden />)}<small>{slide.review.rating} / 5 · {slide.review.date}</small></p>
          <blockquote>{slide.review.excerpt}</blockquote>
          <a href={slide.review.url} target="_blank" rel="noreferrer">Читать полный отзыв на Яндекс Картах ↗</a>
        </section>}
      </article>
    </dialog>
  );
}
