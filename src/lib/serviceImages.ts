import { sitePath } from "./sitePath";
const categoryImages: Record<string,string> = {
  "Мойка": "wash-sedan",
  "Детейлинг-мойка": "detail-sedan",
  "Химчистка": "clean-cabin-v2",
  "Полировка и керамика": "polish-light",
  "Фары": "headlight-polish",
  "Оклейка": "film-full",
  "Дополнительно": "hard-wax"
};
const serviceImages: Record<string,string> = {
  "Комплексная мойка — седан": "wash-sedan",
  "Комплексная мойка — кроссовер": "wash-crossover",
  "Комплексная мойка — джип": "wash-jeep",
  "Комплексная мойка — микроавтобус": "wash-van",
  "Обезжиривание кузова": "degrease",
  "Детейлинг-мойка — седан": "detail-sedan",
  "Детейлинг-мойка — кроссовер": "detail-crossover",
  "Детейлинг-мойка — джип": "detail-jeep",
  "Детейлинг-мойка — микроавтобус": "detail-van",
  "Химчистка автомобиля": "clean-cabin-v2",
  "Чистка кожи": "clean-leather",
  "Химчистка элемента": "clean-element-v2",
  "Химчистка дисков": "clean-wheels",
  "Химчистка ворсовых ковров": "clean-mats",
  "Лёгкая полировка + керамика QM Light": "polish-light",
  "Глубокая полировка + керамика QM Pater": "polish-deep",
  "Полировка 2 фар": "headlight-polish",
  "Шлифовка и полировка 2 фар": "headlight-restore",
  "Оклейка 2 фар плёнкой": "headlight-film",
  "Оклейка элемента": "film-panel",
  "Индивидуальный пакет": "film-custom",
  "Полная оклейка полиуретаном": "film-full",
  "Матовый полиуретан": "film-matte",
  "Цветной полиуретан": "film-color-v3",
  "Твёрдый воск": "hard-wax",
  "Антидождь — передняя полусфера": "rain-shield",
  "Замена лобового стекла": "windshield-v2"
};
export function serviceImage(category: string, name?: string) { return sitePath(`/images/services/items/${(name && serviceImages[name]) || categoryImages[category] || "detail-sedan"}.webp`); }
