import {
  CalendarCheck, CreditCard, Gift, Drop, Sparkle, ShieldCheck, Car, Clock, MapPin, Star, Wrench, Coffee, WifiHigh,
  Medal, Lightning, Handshake, type Icon,
} from "@phosphor-icons/react";

/** Иконки, которые владелец может выбрать для информационных карточек. */
export const cardIcons: Record<string, Icon> = {
  CalendarCheck, CreditCard, Gift, Drop, Sparkle, ShieldCheck, Car, Clock, MapPin, Star, Wrench, Coffee, WifiHigh, Medal, Lightning, Handshake,
};

export const cardIconLabels: Record<string, string> = {
  CalendarCheck: "Календарь", CreditCard: "Оплата", Gift: "Подарок", Drop: "Капля", Sparkle: "Блеск", ShieldCheck: "Защита",
  Car: "Машина", Clock: "Часы", MapPin: "Метка", Star: "Звезда", Wrench: "Ключ", Coffee: "Кофе", WifiHigh: "Wi-Fi",
  Medal: "Медаль", Lightning: "Молния", Handshake: "Рукопожатие",
};

export function CardIcon({ name, size = 22 }: { name: string; size?: number }) {
  const C = cardIcons[name] ?? Sparkle;
  return <C size={size} weight="duotone" aria-hidden />;
}
