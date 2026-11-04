# Práctica de canciones

App en español para organizar un repertorio, practicar canciones con audio o vídeos de YouTube, repetir fragmentos y generar listas de canciones. Está hecha con Svelte 5, Vite y TypeScript, y se distribuye como web y como app de escritorio con Tauri 2 para Linux y Windows.

No tiene backend: guarda los datos en localStorage y los audios adjuntos en IndexedDB. Cada navegador y la app de escritorio mantienen sus propios datos. YouTube, Drive y Google Fonts necesitan conexión; el manifiesto web no añade una caché sin conexión.

## Desarrollo web

Usa Node.js 24 y la versión de pnpm indicada en `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Abre `http://localhost:5173`. El puerto es fijo para que coincida con Tauri.

```bash
pnpm check
pnpm build
pnpm preview
```

El build queda en `dist/`. `VITE_BASE` configura la ruta pública y vale `/` si no se define. Para alojar la web en un subdirectorio:

```bash
VITE_BASE=/nombre-del-repositorio/ pnpm build
```

## Publicación en GitHub Pages

En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions**. El workflow `.github/workflows/deploy-web.yml` compila y publica al recibir cambios en `main`; también se puede ejecutar manualmente sobre una rama elegida.

El workflow usa `VITE_BASE=/${{ github.event.repository.name }}/` y publica `dist/` con las acciones oficiales de Pages. El favicon y el manifiesto respetan esa base. Para un dominio que sirva la app en la raíz, cambia la variable a `/`.

## App de escritorio

Instala Rust estable con Cargo y las dependencias de tu sistema según los [requisitos de Tauri 2](https://v2.tauri.app/start/prerequisites/).

En Fedora:

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
sudo dnf group install "c-development"
```

El grupo **C Development Tools and Libraries** proporciona el compilador y las herramientas de C necesarias. Para desarrollar con la ventana de escritorio:

```bash
pnpm tauri:dev
```

Para compilar y empaquetar en tu sistema:

```bash
pnpm tauri:build
```

Tauri ejecuta `pnpm build` y coloca los paquetes en `src-tauri/target/release/bundle/`. No definas la base de Pages para este build: usa `/`. En Linux se generan AppImage, RPM y DEB; en Windows, MSI y NSIS. Cada sistema genera sus propios formatos.

La app registra el [plugin opener](https://v2.tauri.app/plugin/opener/) para abrir enlaces en el navegador del sistema. El botón **Abrir en YouTube** está siempre disponible porque el reproductor integrado puede devolver el error 153 en el webview. **Abrir en ventana** de Drive también abre el navegador del sistema en escritorio y conserva el popup en la web.

La selección de audio usa un `<input type="file">` y guarda una copia en IndexedDB, por lo que funciona sin `showOpenFilePicker`, ausente en WebKitGTK. Los archivos heredados que requieren permisos no disponibles se pueden reemplazar desde **Editar**.

La CSP de Tauri está en `null` para permitir las fuentes de Google, los reproductores de YouTube y Drive y los recursos locales `blob:` y `data:`.

### Iconos

Para regenerar los iconos a partir del favicon:

```bash
pnpm tauri icon public/favicon.svg
```

El favicon original no es cuadrado y usa colores `display-p3` que el generador no interpreta. Los iconos incluidos se generaron con `src-tauri/icons/source.svg`, una copia cuadrada que conserva los colores sRGB del favicon. Para regenerarlos sin esos errores:

```bash
pnpm tauri icon src-tauri/icons/source.svg --output src-tauri/icons
```

Los archivos de escritorio van en `src-tauri/icons/`, donde los busca `tauri.conf.json`. Si el generador rechaza el SVG, expórtalo primero como PNG RGBA cuadrado de al menos 1024 × 1024, con transparencia y conservando la proporción, y ejecuta:

```bash
pnpm tauri icon /ruta/al/icono.png --output src-tauri/icons
```

### Releases de Linux y Windows

El workflow `.github/workflows/tauri-release.yml` usa `tauri-apps/tauri-action@v0` con Ubuntu 22.04 y Windows. Se ejecuta al subir un tag `v*` o manualmente y adjunta los instaladores a un **release borrador**, que se publica después de revisarlo. El build de Windows sale de este workflow; no se compila desde Linux.

Antes de crear un tag, actualiza la versión en `src-tauri/Cargo.toml` y `src-tauri/tauri.conf.json` para que coincida. En una ejecución manual se usa el tag `v` seguido de la versión configurada. Consulta también la [documentación de tauri-action](https://github.com/tauri-apps/tauri-action/tree/v0).
