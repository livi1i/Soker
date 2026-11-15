import { InstallPrompt } from "../components/InstallPrompt";
import { ReviewsCarousel } from "../components/ReviewsCarousel";
import { serviceImage } from "../lib/serviceImages";
import { useEffect, useState } from "react";
import { BookingModal } from "../components/BookingModal";
import { Link } from "react-router";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { ArrowRight, CalendarPlus, Clock, MapPin, NavigationArrow, Phone, Star, InstagramLogo, ArrowUpRight, LockKey } from "@phosphor-icons/react";
import { useTenant } from "../components/TenantLayout";
import { LiquidGlass } from "../components/LiquidGlass";
import { Reveal } from "../components/Reveal";
import { SkewedCarousel } from "../components/SkewedCarousel";
import { CardIcon } from "../components/icons";
import { mediaUrl } from "../lib/supabase";
import { phoneLabel, priceLabel, rub } from "../lib/format";
import { hoursRows, openStatus } from "../lib/hours";
import type { Service } from "../lib/types";


export function HomePage() {
  const { bundle, slug } = useTenant();
  const { studio, services, gallery, hours, daysOff, reviewAlbums } = bundle;
  const base = `/s/${slug}`;
  const status = openStatus(hours, daysOff, studio.timezone);
  const active = services.filter((s) => s.is_active);
  const categories = groupByCategory(active);
  const todayIso = isoToday(studio.timezone);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [heroFontsReady, setHeroFontsReady] = useState(false);
  useEffect(() => {
    let active = true;
    // Reserve the title's space, but do not show a temporary font on phones.
    Promise.all([
      document.fonts.load('400 48px "Russo One"', 'СОКЕР'),
      document.fonts.load('400 16px "Manrope Variable"', 'Сокер 0123456789'),
    ]).catch(() => {}).finally(() => { if (active) setHeroFontsReady(true); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {bookingOpen && <BookingModal onClose={() => setBookingOpen(false)} />}
      {/* ───── Главное фото ───── */}
      <header className="hero" data-studio={slug} aria-label={studio.name}>
        <div className="hero-media">
          {studio.hero_path && (
            <img
              src={mediaUrl(studio.hero_path)}
              alt={`${studio.name} — фасад студии`}
              crossOrigin="anonymous"
              fetchPriority="high"
              style={{ objectPosition: studio.hero_position }}
            />
          )}
        </div>
        <div className="topbar">
          <div className="container topbar__inner">
            {studio.logo_path ? (
              <img className="topbar__logo" src={mediaUrl(studio.logo_path)} alt={studio.name} />
            ) : (
              <span className="display">{studio.name}</span>
            )}
            <a className="call" href={`tel:${studio.phone}`} aria-label={`Позвонить: ${phoneLabel(studio.phone)}`}>
              <Phone size={18} weight="bold" aria-hidden /> <span>{phoneLabel(studio.phone)}</span>
            </a>
          </div>
        </div>
        <div className="container hero__body">
          {studio.rating && (
            <a className="eyebrow" href={studio.rating.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Star size={14} weight="fill" aria-hidden /> {studio.rating.value.toFixed(1).replace(".", ",")} · {studio.rating.count} оценок · {studio.rating.source}
            </a>
          )}
          <h1 className="hero__title" data-font-ready={heroFontsReady}>{studio.name}</h1>
          <p className="hero__lead">{studio.tagline}.{"\n"}{studio.description}</p>
          {/* Матовое стекло размывает фон под кнопкой в реальном времени. */}
          <LiquidGlass className="hero-cta">
            <button type="button" onClick={() => setBookingOpen(true)} aria-haspopup="dialog">
              <CalendarPlus size={22} weight="bold" aria-hidden /> Записаться
            </button>
          </LiquidGlass>
          <div className="hero__meta">
            <span><Clock size={16} aria-hidden /> {status.text}</span>
            <span><MapPin size={16} aria-hidden /> {studio.address}</span>
          </div>
        </div>
      </header>
      <InstallPrompt slug={slug} name={studio.name} />

      {/* ───── Три карточки ───── */}
      {studio.info_cards.length > 0 && (
        <Reveal className="container section studio-benefits" ariaLabelledby="about-title">
          <h2 id="about-title" className="visually-hidden">О студии</h2>
          <div className="info-grid">
            {studio.info_cards.map((c, i) => (
              <div className="info-card" key={i}>
                <div className="info-card__icon"><CardIcon name={c.icon} /></div>
                <VStack gap={1}>
                  <Text weight="bold" type="large">{c.title}</Text>
                  <Text type="supporting">{c.text}</Text>
                </VStack>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* ───── Услуги и цены ───── */}
      <Reveal className="container section" ariaLabelledby="services-title">
        <div className="section-head">
          <VStack gap={1}>
            <span className="eyebrow">Прайс</span>
            <h2 id="services-title" className="section-title">Услуги и цены</h2>
          </VStack>
          <Button label="Все услуги" variant="ghost" href={`${base}/services`} endContent={<ArrowRight size={16} />} />
        </div>
        <div className="service-category-grid">
          {categories.map(([cat, list]) => (
            <Link key={cat} to={`${base}/services?c=${encodeURIComponent(cat)}`} className="service-category-card">
              <img src={serviceImage(cat)} alt="" loading="lazy" decoding="async" />
              <article className="service-product__body">
                <div className="service-row__name">{cat}</div>
                <ul className="service-category-card__items">{list.slice(0, 3).map(s => <li key={s.id}>{s.name}</li>)}</ul>{list.length > 3 && <small className="service-product__duration">И ещё {list.length - 3}</small>}
                <div className="service-product__price"><strong>от {rub(Math.min(...list.map((s) => s.price)))}</strong><ArrowRight size={18} aria-hidden /></div>
              </article>
            </Link>
          ))}
        </div>
        <Text type="supporting" as="p" display="block">
          Итоговая стоимость зависит от размера и состояния автомобиля — мастер подтвердит её при осмотре.
        </Text>
      </Reveal>

      {/* ───── Работы ───── */}
      {gallery.length > 0 && (
        <Reveal className="container section" ariaLabelledby="works-title">
          <div className="section-head"><VStack gap={1}>
            <span className="eyebrow">Портфолио</span>
            <h2 id="works-title" className="section-title">Наши работы</h2>
          </VStack></div>
          <SkewedCarousel label="Наши работы" slides={[...gallery.map(g => ({
            id: g.id, image: mediaUrl(g.image_path)!, title: g.caption || "Работа студии",
          })), ...(gallery.length < 5 && studio.hero_path && !gallery.some(g => g.image_path === studio.hero_path) ? [{ id: "studio-hero", image: mediaUrl(studio.hero_path)!, title: "Студия на Белинского, 74" }] : [])].slice(0, 5)} />
        </Reveal>
      )}

      {/* ───── Запись ───── */}
      <Reveal className="container section" ariaLabelledby="book-title">
        <h2 id="book-title" className="book-title">Запись в студию</h2>
        <Text type="supporting" as="p" display="block">Выберите услугу — покажем свободное время во всех боксах.</Text>
        <div className="book-card" style={{ marginTop: 16 }}>
          <div className="option-list">
            {popular(active).map((s) => (
              <Link key={s.id} className="option" to={`${base}/book?service=${s.id}`} style={{ textDecoration: "none" }}>
                <Text weight="semibold">{s.name}</Text>
                <Text weight="bold">{priceLabel(s.price, s.price_from)}</Text>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button label="Выбрать услугу и время" variant="primary" size="lg" width="100%" href={`${base}/book`} icon={<CalendarPlus size={20} weight="bold" />} />
          </div>
        </div>
      </Reveal>

      {reviewAlbums.length > 0 && (
        <Reveal id="reviews" className="container section" ariaLabelledby="reviews-title">
          <div className="section-head"><VStack gap={1}>
            <span className="eyebrow">Опыт наших клиентов</span>
            <h2 id="reviews-title" className="section-title">Отзывы клиентов</h2>
          </VStack></div>
          <ReviewsCarousel reviews={reviewAlbums} />
        </Reveal>
      )}

      {/* ───── Контакты ───── */}
      <Reveal className="container section" ariaLabelledby="contacts-title">
        <div className="section-head">
          <VStack gap={1}>
            <span className="eyebrow">Как нас найти</span>
            <h2 id="contacts-title" className="section-title">Адрес и время работы</h2>
          </VStack>
        </div>
        <div className="contact-grid">
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={3}>{studio.address}</Heading>
              <Text type="supporting">{status.text}</Text>
            </VStack>
            <table className="hours-table">
              <tbody>
                {hoursRows(hours).map((r) => (
                  <tr key={r.label} data-today={r.days.includes(todayIso)}>
                    <td>{r.label}</td>
                    <td>{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <HStack gap={2} wrap="wrap">
              <Button label="Позвонить" variant="primary" href={`tel:${studio.phone}`} icon={<Phone size={18} weight="bold" />} />
              {studio.lat != null && studio.lon != null && (
                <Button
                  label="Маршрут"
                  href={`https://yandex.ru/maps/?rtext=~${studio.lat},${studio.lon}&rtt=auto`}
                  target="_blank"
                  rel="noreferrer"
                  icon={<NavigationArrow size={18} weight="bold" />}
                />
              )}
            </HStack>
            {studio.socials.length > 0 && (
              <HStack gap={2} wrap="wrap">
                {studio.socials.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="social-link">
                    <SocialLogo url={s.url} />{s.label}
                  </a>
                ))}
              </HStack>
            )}
          </VStack>
          {studio.lat != null && studio.lon != null && (
            <iframe
              className="map-frame"
              title={`Карта: ${studio.address}`}
              loading="lazy"
              src={`https://yandex.ru/map-widget/v1/?ll=${studio.lon}%2C${studio.lat}&z=16&pt=${studio.lon}%2C${studio.lat}%2Cpm2rdm&lang=ru_RU`}
            />
          )}
        </div>
      </Reveal>

      <footer className="container studio-footer" aria-label="Информация о студии">
        <section className="studio-footer__top" aria-label="Студия и навигация">
          <Link to={`${base}/`} className="studio-footer__brand" aria-label={`${studio.name} — на главную`}>
            {studio.logo_path ? <img src={mediaUrl(studio.logo_path)} alt={studio.name} width={160} height={112} loading="lazy" /> : <strong className="display">{studio.name}</strong>}
          </Link>
          <VStack gap={1} className="studio-footer__address">
            <p>{studio.address}</p>
            {hoursRows(hours).map(row => <p key={row.label}>{row.label} {row.value}</p>)}
          </VStack>
          <nav className="studio-footer__links" aria-label="Ссылки студии">
            {studio.rating?.url && <a href={studio.rating.url} target="_blank" rel="noreferrer">{studio.name} на Яндекс Картах <ArrowUpRight size={14} aria-hidden /></a>}
            <Link to={`${base}/services`}>Услуги и цены <ArrowUpRight size={14} aria-hidden /></Link>
          </nav>
        </section>
        <details className="studio-footer__details">
          <summary>Контакты студии</summary>
          <nav className="studio-footer__contacts" aria-label="Контакты в подвале">
            <a href={`tel:${studio.phone}`}>{phoneLabel(studio.phone)}</a>
            {studio.socials.map(social => <a key={social.url} href={social.url} target="_blank" rel="noreferrer">{social.label} <ArrowUpRight size={14} aria-hidden /></a>)}
          </nav>
        </details>
        <section className="studio-footer__bottom" aria-label="Информация и кабинет владельца">
          <p>© {new Date().getFullYear()} {studio.name}. Детейлинг-студия в {studio.city === "Псков" ? "Пскове" : studio.city}.</p>
          <Link to={`${base}/admin`} className="studio-footer__owner"><LockKey size={16} aria-hidden />Вход для владельца</Link>
        </section>
      </footer>
    </>
  );
}

function isoToday(tz: string) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date());
  return ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd);
}

export function groupByCategory(list: Service[]): [string, Service[]][] {
  const map = new Map<string, Service[]>();
  for (const s of list) {
    if (!map.has(s.category)) map.set(s.category, []);
    map.get(s.category)!.push(s);
  }
  return [...map.entries()];
}


/** По одной самой доступной услуге из первых категорий — для быстрого старта записи. */
function popular(list: Service[]): Service[] {
  return groupByCategory(list).slice(0, 4).map(([, l]) => [...l].sort((a, b) => a.price - b.price)[0]);
}

function SocialLogo({ url }: { url: string }) {
  const host = new URL(url).hostname;
  if (host.includes("instagram.com")) return <InstagramLogo size={22} aria-hidden />;
  if (host.includes("yandex.")) return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect width="24" height="24" rx="6" fill="#fc3f1d" /><text x="12" y="19" textAnchor="middle" fill="white" fontSize="21" fontFamily="Arial">Я</text></svg>;
  if (host === "vk.ru" || host === "vk.com") return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect width="24" height="24" rx="6" fill="#0077ff" /><path fill="white" d="M12.9 17.3c-5.5 0-8.6-3.7-8.7-9.8H7c.1 4.5 2.1 6.4 3.6 6.8V7.5h2.6v3.9c1.5-.2 3.1-2 3.6-3.9h2.6c-.4 2.3-2.2 4-3.4 4.7 1.2.6 3.2 2.1 3.9 5.1H17c-.6-1.9-2-3.4-3.8-3.6v3.6h-.3Z" /></svg>;
  if (host.includes("2gis.")) return <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect width="24" height="24" rx="6" fill="#19aa1e" /><path d="M12 3.5a6 6 0 0 0-6 6c0 4.1 6 11 6 11s6-6.9 6-11a6 6 0 0 0-6-6Z" fill="white" /><circle cx="12" cy="9.5" r="3" fill="#19aa1e" /></svg>;
  return null;
}
