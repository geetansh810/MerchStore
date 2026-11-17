# merchstore

A modern, high-performance e-commerce storefront for commemorative merchandise and personalized gifts, built with **Next.js 16**, **React 19**, and **Saleor 3.23+**.

---

## Overview

**merchstore** is an enterprise-grade headless storefront engineered for commemorative campaigns and custom merchandise. Built on Next.js 16 App Router with Partial Prerendering (PPR) and Cache Components, it pairs lightning-fast static shells with reactive dynamic islands for product variant selection, cart management, and seamless multi-step checkout.

### Key Highlights

- 🎖️ **Anniversary Campaign Showcase**: Tailored homepage hero and curated collections celebrating milestones with commemorative apparel, drinkware, and collectibles.
- ✍️ **Product Personalisation**: Custom callsign, rank, and name engraving support on product pages, carried reliably through cart line metadata to order confirmation.
- 💳 **Flexible Payment Gateways**: Modular payment registry supporting **UPI QR** (instant dynamic QR generation with reference tracking) and **Stripe** (with test/live mode configuration).
- ⚡ **Next.js 16 & Server-First**: App Router, React 19 Server Components, Server Actions for mutations, and Cache Components (`"use cache"`, named `cacheLife` profiles) for optimal performance.
- 🌍 **International & Multi-Channel**: URL routing by `/{locale}/{channel}/`, multi-currency support, regional catalog caching, and translatable product handles.
- 🎨 **Design System Tokens**: Fully customizable OKLCH color palette and typography tokens defined in `src/styles/brand.css`.
- 🛡️ **BFF Auth & Security**: Backend-for-Frontend session handling without leaking Saleor tokens or payment secret keys to client browsers.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Components, PPR)
- **UI & State**: [React 19](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/)
- **Backend / Commerce**: [Saleor 3.23+](https://saleor.io/) via GraphQL
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) (strict mode) & GraphQL Codegen
- **Testing**: [Vitest](https://vitest.dev/) for unit tests, [Playwright](https://playwright.dev/) for end-to-end tests
- **Package Manager**: [pnpm](https://pnpm.io/)

---

## Quick Start

### 1. Prerequisites

- **Node.js**: `24.x` (or `>= 20.9.0`)
- **pnpm**: `>= 9.4.0`
- **Saleor**: Instance running Saleor 3.23 or newer (Cloud or self-hosted)

### 2. Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd storefront
pnpm install
```

### 3. Environment Configuration

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Key environment variables in `.env`:

```env
# Saleor GraphQL endpoint
NEXT_PUBLIC_SALEOR_API_URL=https://your-instance.saleor.cloud/graphql/

# Default channel slug (from Saleor Dashboard -> Configuration -> Channels)
NEXT_PUBLIC_DEFAULT_CHANNEL=default-channel

# Channel allowlist (comma-separated for multi-channel support)
STOREFRONT_CHANNELS=default-channel

# Default & supported locales
NEXT_PUBLIC_DEFAULT_LOCALE=en
NEXT_PUBLIC_STOREFRONT_LOCALES=en,pl,de,fr,fi,nb

# Payment gateway options
ALLOW_DUMMY_PAYMENT=true
NEXT_PUBLIC_ALLOW_DUMMY_PAYMENT=true
NEXT_PUBLIC_ENABLE_STRIPE_PAYMENTS=false
```

### 4. (Optional) Seed the Merchandise Catalog

Seed the celebratory anniversary catalog (categories, attributes, products, and prices) into your Saleor instance:

```bash
pnpm catalog:seed
```

### 5. Run Development Server

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the storefront.

---

## Project Structure

```
├── config/                  # Saleor storefront content models and configuration
├── messages/                # next-intl translations for code-owned UI strings
├── public/                  # Static assets (favicons, manifest, placeholders)
├── scripts/                 # Utility scripts (catalog seeding, token linting, locks)
│   ├── data/                # Seed data for anniversary merchandise
│   └── seed-anniversary-catalog.mjs
├── src/
│   ├── app/                 # Next.js App Router (pages, layouts, route handlers)
│   │   ├── (checkout)/      # Checkout flow routes (/checkout, /order/[number])
│   │   └── (storefront)/    # Browse routes (/[locale]/[channel]/...)
│   ├── checkout/            # Checkout UI, steps, payment providers (UPI QR, Stripe)
│   ├── config/              # Centralized configuration
│   │   ├── brand.ts         # Brand identity, site name, SEO metadata
│   │   ├── campaign.ts      # Campaign parameters (honoree, milestone years, slug)
│   │   └── locale.ts        # Supported locales and channel mapping
│   ├── graphql/             # Storefront GraphQL queries & mutations
│   ├── gql/                 # Generated GraphQL types (do not edit manually)
│   ├── lib/                 # Core utilities & cached data layer
│   │   ├── catalog/         # Product, category, and collection fetchers
│   │   ├── personalisation.ts # Personalised line item validation and helpers
│   │   └── saleor/          # Saleor client and caching kernel
│   ├── styles/
│   │   └── brand.css        # Theme design tokens & CSS custom properties
│   └── ui/
│       ├── components/      # UI components (cart, navigation, PDP, PLP)
│       └── sections/        # Major page sections (anniversary hero, tile grids)
```

---

## Development & Verification

### Available Scripts

| Command                 | Description                                                           |
| ----------------------- | --------------------------------------------------------------------- |
| `pnpm dev`              | Starts the Next.js development server on `localhost:3000`             |
| `pnpm build`            | Builds the production application with PPR validation                 |
| `pnpm start`            | Starts the production server                                          |
| `pnpm run verify`       | Full quality gate: token linter, typecheck, ESLint, and test suite    |
| `pnpm run verify:quick` | Fast feedback loop: design token checks + TypeScript typecheck        |
| `pnpm run generate:all` | Regenerates all GraphQL types for storefront and checkout             |
| `pnpm catalog:seed`     | Populates the Saleor backend with the anniversary merchandise catalog |
| `pnpm test:run`         | Executes the Vitest test suite                                        |

---

## Customization

### Campaign & Milestone Details

Update the honoree, anniversary milestone year, or collection slug in [`src/config/campaign.ts`](src/config/campaign.ts):

```ts
export const anniversaryCampaign = {
	honoree: "Air Force",
	years: 70,
	collectionSlug: "70th-anniversary",
} as const;
```

### Brand & SEO Information

Customize site titles, copyright holders, social links, and metadata in [`src/config/brand.ts`](src/config/brand.ts):

```ts
export const brandConfig = {
	siteName: "Anniversary Store",
	copyrightHolder: "Anniversary Store",
	// ...
};
```

### Theme & Styling

Adjust brand colors, radii, and fonts via the OKLCH CSS variables in [`src/styles/brand.css`](src/styles/brand.css).

---

## License

This project is licensed under the [FSL-1.1-ALv2](./LICENSE) license.
