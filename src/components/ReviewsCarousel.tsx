import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Star } from "@phosphor-icons/react";
import type { ReviewAlbum } from "../lib/types";

export function ReviewsCarousel({ reviews }: { reviews: ReviewAlbum[] }) {
  const [selected, setSelected] = useState(0);
  const [photo, setPhoto] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  if (!reviews.length) return null;
  const active = selected % reviews.length;
  const review = reviews[active];
  const currentPhoto = Math.min(photo, review.photo_urls.length - 1);
  const move = (step: number) => { setSelected(i => (i + step + reviews.length) % reviews.length); setPhoto(0); };
  return (
    <section className="client-reviews" aria-label="Отзывы с Яндекс Карт" aria-roledescription="карусель" tabIndex={0}
      onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1); } }}>
      <article className="client-reviews__story" key={review.id}>
        <figure className="client-reviews__visual"
          onPointerDown={event => { gesture.current = { x: event.clientX, y: event.clientY }; }}
          onPointerUp={event => { const start = gesture.current; gesture.current = null; if (start && Math.abs(event.clientX-start.x) > 45 && Math.abs(event.clientX-start.x) > Math.abs(event.clientY-start.y)) setPhoto(i => (i + (event.clientX < start.x ? 1 : -1) + review.photo_urls.length) % review.photo_urls.length); }}
          onPointerCancel={() => { gesture.current = null; }}>
          <img className="client-reviews__main-photo" src={review.photo_urls[currentPhoto]} alt={`Фото ${currentPhoto+1} из отзыва: ${review.author}`} draggable={false} loading="lazy" />
          <figcaption>{String(currentPhoto+1).padStart(2,"0")} / {String(review.photo_urls.length).padStart(2,"0")}</figcaption>
        </figure>
        <section className="client-reviews__text" aria-label={`Отзыв: ${review.author}`}>
          <p className="client-reviews__source">Яндекс Карты</p>
          <p className="client-reviews__stars" aria-label={`Оценка ${review.rating} из 5`}>{Array.from({length:review.rating},(_,i)=><Star size={16} weight="fill" key={i} aria-hidden />)}</p>
          <blockquote>«{review.excerpt}»</blockquote>
          <footer><strong>{review.author}</strong><time>{review.reviewed_at}</time></footer>
          {review.photo_urls.length > 1 && <nav className="client-reviews__photos" aria-label={`Фотографии: ${review.author}`}>{review.photo_urls.map((url,i)=><button type="button" key={url} aria-label={`Показать фото ${i+1}`} aria-current={i===currentPhoto ? "true" : undefined} onClick={()=>setPhoto(i)}><img src={url} alt="" loading="lazy" /></button>)}</nav>}
          <a className="client-reviews__original" href={review.source_url} target="_blank" rel="noreferrer">Читать отзыв на Яндексе <ArrowUpRight size={16} aria-hidden /></a>
        </section>
      </article>
      <nav className="client-reviews__navigation" aria-label="Переключение отзывов">
        <p aria-live="polite"><strong>{String(active+1).padStart(2,"0")}</strong><span> / {String(reviews.length).padStart(2,"0")}</span></p>
        <ol>{reviews.map((r,i)=><li key={r.id}><button type="button" aria-label={`Отзыв: ${r.author}`} aria-current={i===active ? "true" : undefined} onClick={()=>{setSelected(i);setPhoto(0);}} /></li>)}</ol>
        <section className="client-reviews__arrows"><button type="button" onClick={()=>move(-1)} aria-label="Предыдущий отзыв"><ArrowLeft size={20} aria-hidden /></button><button type="button" onClick={()=>move(1)} aria-label="Следующий отзыв"><ArrowRight size={20} aria-hidden /></button></section>
      </nav>
    </section>
  );
}
