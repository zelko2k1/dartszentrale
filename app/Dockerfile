# Frontend (Vite/React SPA) – Multi-Stage-Build.
# Eigenes Dockerfile statt Nixpacks, weil Nixpacks eine zu alte Node-Version (22.11)
# pinnt; Vite 8 / rolldown verlangen >=22.12. Bei zu altem Node überspringt npm zudem
# das optionale rolldown-Binding (engines-Constraint) → "Cannot find native binding".
# node:24-bookworm-slim = glibc (passt zu @rolldown/binding-linux-x64-gnu) und >=22.12.

# ---- Build-Stufe ----
FROM node:24-bookworm-slim AS build
WORKDIR /app
# Manifeste zuerst → Layer-Cache für npm ci
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite backt VITE_PB_URL beim Build ins Bundle. Der Wert kommt als Build-Arg aus der
# Compose-Datei (app/docker-compose.yaml → build.args), z. B. bei Arcane im Homelab.
ARG VITE_PB_URL
ENV VITE_PB_URL=$VITE_PB_URL
RUN npm run build

# ---- Serve-Stufe ----
FROM nginx:1.27-alpine
# SPA-Fallback: unbekannte Pfade auf index.html (sonst 404 bei Reload auf Unterseiten)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
