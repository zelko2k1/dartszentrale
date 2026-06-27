# PocketBase-Image mit eingebackenem Schema (Migrations) + Hooks.
# Warum nicht per Bind-Mount? Relative Compose-Mounts (./pb_migrations) greifen in
# Coolify je nach Arbeitsverzeichnis NICHT und liefern leere Ordner. Hier liegen die
# Dateien fest im Image-Layer und werden bei jedem Rebuild/Redeploy aktualisiert.
# Bewusst NICHT nach /pb_migrations bzw. /pb_hooks kopiert, da das Basis-Image dort
# u. U. Volumes deklariert (anonyme Volumes würden Updates verschlucken).
FROM ghcr.io/muchobien/pocketbase:latest
COPY pb_migrations /pb/migrations
COPY pb_hooks /pb/hooks
