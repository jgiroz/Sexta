# Cuartel — Levantamiento de problemas (Etapa 1)

PWA (React + Vite + Supabase) para reportar y gestionar problemas del cuartel.
Ver `../ARQUITECTURA.md` para el diseño completo.

## 1. Crear el backend (Supabase, gratis)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo.
2. Ve a **SQL Editor** → pega el contenido de `supabase/schema.sql` → **Run**.
   Esto crea todas las tablas, roles, permisos y datos de ejemplo (carros B6, RX6, R6, M6).
3. Ve a **Storage** → crea dos buckets:
   - `levantamientos-fotos` → público (lectura pública, subida solo autenticados).
   - `facturas-adjuntos` → puede ser público también para simplificar la etapa 1, o privado si se prefiere.
4. Ve a **Project Settings → API** y copia:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`

## 2. Configurar el proyecto local

```bash
cp .env.example .env
# edita .env con tus valores de Supabase
npm install
npm run dev
```

Abre http://localhost:5173

## 3. Crear el primer administrador

1. Regístrate normalmente desde la app (queda como `usuario`).
2. En Supabase → **Table Editor** → tabla `profiles` → busca tu fila → cambia `rol` a `admin`.
3. Vuelve a entrar a la app: ahora verás las opciones de gestión (asignar, cambiar estado, cargar facturas).

## 4. Desplegar gratis (para que todo el cuartel lo use)

**Opción recomendada: Cloudflare Pages**

```bash
npm run build
```

1. Sube este proyecto a un repositorio de GitHub.
2. En Cloudflare Pages → "Create a project" → conecta el repo.
3. Build command: `npm run build` · Output directory: `dist`
4. Agrega las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en la configuración del proyecto.
5. Cloudflare entrega una URL HTTPS gratis (ej. `cuartel.pages.dev`) — necesaria para que la PWA se pueda instalar.

**Alternativa:** Vercel o Netlify, mismo procedimiento (ambos tienen tier gratuito equivalente).

## 5. Instalar la app en el celular

Al abrir la URL desde Chrome (Android) o Safari (iPhone), aparece la opción "Agregar a pantalla de inicio" / "Instalar app". Queda como un ícono normal, sin pasar por ninguna tienda de aplicaciones.

## Estructura del proyecto

```
mvp/
├── supabase/schema.sql       # todo el backend en un solo script
├── src/
│   ├── lib/                  # cliente Supabase, auth, catálogos
│   ├── components/           # NavBar, Badge, ProtectedRoute
│   └── pages/                # Login, Home, NuevoLevantamiento, DetalleLevantamiento
├── vite.config.js            # config PWA (manifest, íconos)
└── public/                   # íconos de la app
```

## Próximas etapas

Ver la sección "Roadmap" de `../ARQUITECTURA.md`: ficha de carros con inventario y mantenciones, asistencia y EPP de voluntarios, turnos de cuarteleros, reportes y notificaciones push.
