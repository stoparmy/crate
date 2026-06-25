# Crate для Chatwoot

Crate — это встроенное dashboard-приложение для Chatwoot, которое показывает вложения из текущего диалога. Агент может открыть файл в новой вкладке и скачать все вложения текущего разговора.

## Docker-образ

Crate публикуется как Docker-образ:

```text
ghcr.io/stoparmy/crate
```

Образ поддерживает произвольный slug во время запуска. Его можно смонтировать на `/crate/`, `/attachments/` или другом фиксированном пути на том же хосте, где работает Chatwoot.

## Конфигурация

Скопируйте `.env.example` в `.env` и задайте:

- `CHATWOOT_BASE_URL`: публичный URL Chatwoot, например `https://helpdesk.example.org`
- `CHATWOOT_APP_TOKEN`: токен приложения Chatwoot для установленного dashboard-приложения Crate
- `PORT`: необязательный порт сервера, по умолчанию `3000`

## Локальная разработка

Установите зависимости:

```bash
cd server && npm install
cd ../web && npm install
```

Соберите приложение:

```bash
cd server && npm run build
cd ../web && npm run build
```

Запуск через Docker Compose:

```bash
docker compose up --build
```

Запуск опубликованного образа напрямую:

```bash
docker run --rm -p 3000:3000 \
  -e CHATWOOT_BASE_URL=https://helpdesk.example.org \
  -e CHATWOOT_APP_TOKEN=your-chatwoot-app-token \
  ghcr.io/stoparmy/crate:latest
```

Проверка состояния:

```text
GET /api/health
```

## Встраивание в Chatwoot

Crate работает за тем же origin, что и Chatwoot, и получает контекст dashboard из родительского приложения.

Для работы используются:

- cookie `cw_d_session_info`
- `CHATWOOT_APP_TOKEN`
- заголовки авторизации Chatwoot dashboard: `access-token`, `token-type`, `client`, `expiry` и `uid`
- контекст активного диалога через `postMessage` из Chatwoot

При обратном проксировании направьте выбранный slug на контейнер Crate и сохраните редирект на путь с завершающим `/`, чтобы относительные пути к ассетам и API разрешались корректно.

Пример конфигурации nginx:

```nginx
location = /crate {
  return 302 /crate/;
}

location /crate/ {
  proxy_pass http://crate:3000/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header X-Forwarded-Ssl on;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_http_version 1.1;
  proxy_buffering off;
}
```

Тот же пример есть в `examples/nginx/chatwoot-crate.conf`.

## Релизы

GitHub Actions запускает `semantic-release` из `.github/workflows/publish-image.yml`.

Каждый релиз создает:

- релиз на GitHub
- тег образа `latest`
- semver-теги образа, например `<major>`, `<major>.<minor>` и `<major>.<minor>.<patch>`

Версия релиза определяется по Conventional Commit сообщениям в `main`:

- `fix:` для patch-релизов
- `feat:` для minor-релизов
- `BREAKING CHANGE:` или `!` для major-релизов
