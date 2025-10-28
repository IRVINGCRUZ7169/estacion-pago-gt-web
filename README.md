# Estación Pago GT Web

Pequeña aplicación front-end para la estación de pago (Vite + React). Este repositorio contiene el frontend, un proxy local para evitar CORS y utilidades para realizar recargas.

## Requisitos
- Node.js (recomendado: v22)
- npm
- Git

## Desarrollo

1. Instala dependencias:

```bash
npm install
```

2. Levanta el proxy (en otra terminal):

```bash
node server/proxy.js
```

3. Levanta el servidor de desarrollo (Vite):

```bash
npm run dev
```

La aplicación se abrirá normalmente en `http://localhost:5173`.

## Build y preview

```bash
npm run build
npm run preview
```

## CI

Se incluye un workflow de GitHub Actions que ejecuta `npm ci` y `npm run build` en Node 18 y 22. El fichero está en `.github/workflows/ci.yml`.

## Proxy y logs

El proxy de server (archivo `server/proxy.js`) orquesta llamadas a los upstreams configurados en `server/config/credentials.json` y guarda peticiones/respuestas en `src/procesos/`.

## Contribuir

1. Haz fork y crea una rama de trabajo.
2. Haz commits pequeños y descriptivos.
3. Abre un Pull Request hacia `main`.

## Licencia

MIT — ver `LICENSE`.
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
