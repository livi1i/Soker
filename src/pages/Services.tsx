import { Link, useSearchParams } from "react-router";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { useTenant } from "../components/TenantLayout";
import { Reveal } from "../components/Reveal";
import { durationLabel, priceLabel } from "../lib/format";
import { groupByCategory } from "./Home";
import { serviceImage } from "../lib/serviceImages";
import { ArrowLeft, ArrowUpRight } from "@phosphor-icons/react";

export function ServicesPage() {
  const { bundle, slug } = useTenant();
  const [params, setParams] = useSearchParams();
  const active = bundle.services.filter((s) => s.is_active);
  const groups = groupByCategory(active);
  const selected = params.get("c");
  const shown = selected ? groups.filter(([c]) => c === selected) : groups;

  return (
    <div className="container" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)" }}>
      <nav className="page-back-links" aria-label="Вернуться"><Link to={`/s/${slug}/`}><ArrowLeft size={18} aria-hidden />На главную</Link></nav>
      <VStack gap={1}>
        <span className="eyebrow">{bundle.studio.name}</span>
        <h1 className="book-title">Услуги и цены</h1>
        <Text type="supporting">Нажмите на услугу, чтобы выбрать время.</Text>
      </VStack>

      <div className="chips" role="group" aria-label="Категории" style={{ margin: "20px calc(var(--gutter) * -1) 4px" }}>
        <button type="button" className="chip" aria-pressed={!selected} onClick={() => setParams({}, { replace: true })}>Все</button>
        {groups.map(([c]) => (
          <button key={c} type="button" className="chip" aria-pressed={selected === c} onClick={() => setParams({ c }, { replace: true })}>
            {c}
          </button>
        ))}
      </div>

      {shown.map(([cat, list]) => (
        <Reveal key={cat} className="section" ariaLabelledby={`cat-${cat}`} >
          <h2 id={`cat-${cat}`} className="section-title" style={{ fontSize: 20 }}>{cat}</h2>
          <div className="service-products">
            {list.map((s) => (
              <Link key={s.id} to={`/s/${slug}/book?service=${s.id}`} className="service-product">
                <img className="service-product__image" src={serviceImage(s.category, s.name)} alt="" loading="lazy" decoding="async" />
                <article className="service-product__body">
                  <h3>{s.name}</h3>
                  <small className="service-product__duration">{durationLabel(s.duration_minutes, s.duration_days)}</small>
                  {s.description && <p>{s.description}</p>}
                  <footer className="service-product__price"><strong>{priceLabel(s.price, s.price_from)}</strong><ArrowUpRight size={20} aria-hidden /></footer>
                </article>
              </Link>
            ))}
          </div>
        </Reveal>
      ))}
      <Text type="supporting" as="p" display="block">
        Цены указаны для ориентира: итог зависит от размера и состояния автомобиля.
      </Text>
    </div>
  );
}
