# Публикация на GitHub Pages

Адрес: https://livi1i.github.io/Soker/s/soker/

Workflow `.github/workflows/pages.yml` собирает проект и публикует его после каждого push в main.
В Settings → Pages выбран источник GitHub Actions.

В .env.production записаны только публичные настройки браузера:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY (только anon, никогда service_role)
- VITE_VAPID_PUBLIC_KEY

Сервер и база продолжают работать в Supabase. Локальные .env, учётные данные владельца
и серверные ключи в репозиторий не включаются.

Для локальной проверки сборки с адресами Pages в PowerShell:

```powershell
$env:SITE_BASE_PATH='/Soker/'
pnpm build
pnpm preview
Remove-Item Env:SITE_BASE_PATH
```

После публикации откройте сайт на телефоне в Safari или Chrome.
Плашка установки находится под главным экраном. После закрытия скрывается на 7 дней.
В установленном приложении плашка скрыта. Настоящий системный диалог Android доступен,
когда браузер разрешает установку. Работоспособность интерфейса не зависит от установки.
