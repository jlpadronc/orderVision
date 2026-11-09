# Ekita OrderVision — Sistema Multi-Tenant de Captura de Pedidos con Visión Artificial (PWA)

Aplicación web progresiva (**PWA Mobile-First**) modular y **Multi-Tenant** diseñada para tiendas de importación y compras por encargo (como **Ekita Market**, enfocada en catálogos de **Shein**, Amazon, Temu y tiendas internacionales para Venezuela y Latinoamérica).

---

## 1. Arquitectura y Stack Tecnológico

- **Frontend (Mobile-First PWA):** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React y primitivas HTML nativas accesibles (`<dialog>`, `<fieldset>`, barra inferior tipo dock y drawers móviles).
- **Backend / API:** Next.js Route Handlers con validación estricta vía **Zod** y aislamiento por `tenantId` en el Middleware (`middleware.ts`) y la capa de repositorios (`lib/repositories/multiTenantRepository.ts`).
- **Base de Datos y ORM:** **SQLite** local (`prisma/dev.db`) con **Prisma ORM** (`prisma/schema.prisma`) e inicialización multi-tenant (`prisma/seed.ts`), lista para correr sin instalar servidores de base de datos externos (y fácilmente migrable a PostgreSQL cambiando `provider = "postgresql"`).
- **Motor de Visión / OCR Multimodal:** Google Gemini API (`gemini-2.5-flash`) con **Structured Outputs** (`responseMimeType: "application/json"` y `productExtractionSchema`) en `lib/services/visionExtractor.ts`.
- **Almacenamiento de Archivos:** Servicio desacoplado (`lib/services/storage.ts`) compatible con S3, Supabase Storage, Cloudinary y fallback Data URL local para recortes de productos y comprobantes de pago.

---

## 2. Estructura del Proyecto

```text
├── app/
│   ├── api/
│   │   ├── customers/route.ts          # GET / POST clientes aislados por tenantId
│   │   ├── extract/route.ts            # POST /api/extract (Visión Gemini 2.5 Flash)
│   │   ├── orders/route.ts             # GET / POST órdenes con seña del 50%
│   │   ├── orders/[id]/verify/route.ts # PATCH cotejo físico y POST liquidación 50% final
│   │   ├── settings/route.ts           # GET / PUT / POST configuración Multi-Tenant
│   │   └── upload/route.ts             # POST carga de comprobantes y capturas
│   ├── orders/
│   │   ├── new/page.tsx                # Vista A+B: Armado rápido de carrito + Drawer 50%
│   │   └── [id]/verify/page.tsx        # Vista C: Cotejo físico de mercancía en almacén
│   ├── settings/page.tsx               # Vista D: Configuración de tienda, tasas y cuentas
│   └── page.tsx                        # Dashboard móvil de pedidos por Tenant
├── components/
│   ├── layout/                         # MobileHeader (selector Tenant) y BottomNavDock
│   ├── orders/                         # SmartCartBuilder, DepositPaymentDrawer, WarehouseVerifyChecklist
│   └── settings/                       # TenantSettingsForm
├── lib/
│   ├── prisma.ts                       # Singleton PrismaClient
│   ├── tenantContext.ts                # Resolución de Tenant activo por cookie/header
│   ├── repositories/                   # Repositorio Multi-Tenant con aislamiento estricto
│   ├── services/
│   │   ├── visionExtractor.ts          # Motor Gemini 2.5 Flash Structured Outputs
│   │   └── storage.ts                  # Conector S3 / Supabase / Local Data URL
│   └── validations/schemas.ts          # Esquemas Zod para todas las entidades
└── prisma/
    ├── schema.prisma                   # Modelo relacional Multi-Tenant
    └── seed.ts                         # Seed para "Ekita Shop" y "Caracas Trend Box"
```

---

## 3. Pasos para Levantar en Local

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Base de datos SQLite temporal (Ya pre-creada y poblada)
La base de datos SQLite ya está inicializada en `prisma/dev.db` con datos de prueba para la mini demo. Si deseas regenerarla o reiniciar los datos de prueba en cualquier momento:
```bash
npx prisma db push
npm run db:seed
```

### Paso 4: Iniciar servidor de desarrollo
```bash
npm run dev
```
Abre [http://localhost:3002](http://localhost:3002) desde tu navegador o inspector móvil.

---

## 4. Despliegue en Vercel o Railway

### Opción A: Despliegue en Vercel + Supabase / Neon PostgreSQL
1. Conecta el repositorio en **Vercel**.
2. En **Environment Variables**, define:
   - `DATABASE_URL` (cadena de conexión PostgreSQL con pooling).
   - `GEMINI_API_KEY` (Google AI Studio API Key con acceso a `gemini-2.5-flash`).
   - `STORAGE_PROVIDER`, `STORAGE_PUBLIC_URL`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`.
3. Configura el **Build Command** en Vercel como:
   ```bash
   npx prisma generate && next build
   ```
4. Ejecuta el seed inicial contra la base de datos remota:
   ```bash
   npx prisma db push && npm run db:seed
   ```

### Opción B: Despliegue Todo-en-Uno en Railway
1. Crea un nuevo proyecto en **Railway** y añade un servicio **PostgreSQL**.
2. Añade el repositorio de la aplicación Next.js y vincula la variable `${{Postgres.DATABASE_URL}}`.
3. Agrega la variable `GEMINI_API_KEY` en la pestaña **Variables**.
4. Railway detectará automáticamente `package.json`, ejecutará `npm run build` y levantará el servidor con `npm run start`.

