import { NavLink } from "react-router";
import { HouseSimple, ListBullets, CalendarCheck } from "@phosphor-icons/react";
import { LiquidGlass } from "./LiquidGlass";


export function BottomNav({ slug, hasBooking }: { slug: string; hasBooking: boolean }) {
  const base = `/s/${slug}`;
  const items = [
    { to: `${base}/`, label: "Главная", Icon: HouseSimple, end: true },
    { to: `${base}/services`, label: "Услуги", Icon: ListBullets, end: false },
    { to: `${base}/my`, label: "Моя запись", Icon: CalendarCheck, end: false, dot: hasBooking },
  ];
  return (
    <div className="bottom-nav-wrap">
      <LiquidGlass as="nav" className="bottom-nav" ariaLabel="Основная навигация">
        <ul>
          {items.map(({ to, label, Icon, end, dot }) => (
            <li key={to}>
              <NavLink to={to} end={end} viewTransition>
                {({ isActive }) => (
                  <>
                    <span style={{ position: "relative", display: "inline-flex" }}>
                      <Icon size={24} weight={isActive ? "fill" : "regular"} aria-hidden />
                      {dot && <span className="dot" aria-hidden />}
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </LiquidGlass>
    </div>
  );
}
