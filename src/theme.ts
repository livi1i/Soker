// Тема Astryx «neutral» в тёмном режиме. Фирменные цвета и шрифты студии задаются токенами в styles/global.css.
// Файл шрифтов темы (Google Fonts, без кириллицы) не подключаем: шрифты с кириллицей лежат в самом приложении.
import { neutralTheme } from "@astryxdesign/theme-neutral/built";
import "@astryxdesign/theme-neutral/theme.css";

export const appTheme = neutralTheme;
