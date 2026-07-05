# Build web
FROM node:24-bookworm AS web-build
ARG CRATE_PUBLIC_BASE_PATH=./
ARG CRATE_GOOGLE_DRIVE_SAVE_ALL_ENABLED=false
ARG CRATE_GOOGLE_DRIVE_CLIENT_ID=
ARG CRATE_GOOGLE_DRIVE_FOLDER_PREFIX=Crate
ENV VITE_PUBLIC_BASE_PATH=${CRATE_PUBLIC_BASE_PATH}
ENV VITE_GOOGLE_DRIVE_SAVE_ALL_ENABLED=${CRATE_GOOGLE_DRIVE_SAVE_ALL_ENABLED}
ENV VITE_GOOGLE_DRIVE_CLIENT_ID=${CRATE_GOOGLE_DRIVE_CLIENT_ID}
ENV VITE_GOOGLE_DRIVE_FOLDER_PREFIX=${CRATE_GOOGLE_DRIVE_FOLDER_PREFIX}
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Build server
FROM node:24-bookworm AS server-build
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

# Runtime
FROM node:24-bookworm
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server-build /app/dist ./dist
COPY --from=server-build /app/node_modules ./node_modules
COPY --from=server-build /app/package.json ./package.json
COPY --from=web-build /app/web/dist ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]
