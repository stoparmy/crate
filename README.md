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
- `CRATE_GOOGLE_DRIVE_SAVE_ALL_ENABLED`: необязательный флаг `true/false`, включает кнопку сохранения всех файлов в папку Google Drive через Drive API
- `CRATE_GOOGLE_DRIVE_CLIENT_ID`: OAuth Client ID для браузерного доступа к Google Drive API
- `CRATE_GOOGLE_DRIVE_FOLDER_PREFIX`: необязательный префикс имени папки для массовой загрузки, по умолчанию `Crate`
- `CRATE_PUBLIC_BASE_PATH`: необязательный базовый путь фронтенда во время сборки, например `/crate/` при проксировании под slug

Параметры `CRATE_GOOGLE_DRIVE_*` читаются во время запуска контейнера и попадают во фронтенд через runtime-конфиг. Пересборка образа для их изменения не требуется.

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
  -e PORT=3000 \
  ghcr.io/stoparmy/crate:latest
```

Для сборки под фиксированный публичный slug передайте только `CRATE_PUBLIC_BASE_PATH` как build arg:

```bash
docker build \
  --build-arg CRATE_PUBLIC_BASE_PATH=/crate/ \
  -t crate:local .
```

Save to Drive включается runtime-переменными запуска контейнера:

```bash
docker run --rm -p 3000:3000 \
  -e CHATWOOT_BASE_URL=https://helpdesk.example.org \
  -e CHATWOOT_APP_TOKEN=your-chatwoot-app-token \
  -e CRATE_GOOGLE_DRIVE_SAVE_ALL_ENABLED=true \
  -e CRATE_GOOGLE_DRIVE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com" \
  -e CRATE_GOOGLE_DRIVE_FOLDER_PREFIX="Stoparmy Helpdesk" \
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

Beta-ветка `beta` публикует prerelease-образы:

- semver prerelease-тег, например `1.4.0-beta.1`
- плавающий тег `beta`

Beta-релизы не обновляют `latest`.

Версия релиза определяется по Conventional Commit сообщениям в `main`:

- `fix:` для patch-релизов
- `feat:` для minor-релизов
- `BREAKING CHANGE:` или `!` для major-релизов
