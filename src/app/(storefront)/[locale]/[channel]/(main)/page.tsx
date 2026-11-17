import { Suspense } from "react";
import { brandConfig } from "@/config/brand";
import { anniversaryCampaign } from "@/config/campaign";
import { resolveLocaleFromSlug } from "@/config/locale";
import { getFeaturedProducts } from "@/lib/catalog/get-featured-products";
import { resolveChannelCurrency } from "@/lib/channels/resolve-channel-currency";
import { buildPolicyLabelValues } from "@/lib/content";
import { formatContentLabel } from "@/lib/content/format-label";
import { getStorefrontContent } from "@/lib/content/server";
import { buildSaleorSrcSet } from "@/lib/images";
import { pickTranslatedSlug } from "@/lib/saleor-translations";
import { AnniversaryHero } from "@/ui/sections/anniversary-hero/anniversary-hero";
import { CategoryTileGrid, type CategoryTile } from "@/ui/sections/category-tile-grid/category-tile-grid";
import { FeaturedCollectionSection } from "@/ui/sections/featured-collection-section/featured-collection-section";
import { MulticolumnSection } from "@/ui/sections/multicolumn-section/multicolumn-section";
import { RichTextBlock } from "@/ui/sections/rich-text-block/rich-text-block";

export const metadata = {
	description: brandConfig.description,
};

// Prefetch: default (auto). With global `partialPrefetching`, viewport links already get the
// homepage App Shell. No link uses `prefetch={true}` to "/".

type FeaturedProduct = Awaited<ReturnType<typeof getFeaturedProducts>>[number];
type HomeParams = Promise<{ locale: string; channel: string }>;

/** Aliased rungs must stay in sync with CATALOG_CARD_RUNGS in src/lib/images.ts. */
function productThumbnailSrcSet(product: FeaturedProduct) {
	return buildSaleorSrcSet([
		{ width: 256, url: product.thumbnail256?.url },
		{ width: 512, url: product.thumbnail512?.url },
		{ width: 1024, url: product.thumbnail?.url },
	]);
}

function categoryBackgroundSrcSet(category: NonNullable<FeaturedProduct["category"]>) {
	return buildSaleorSrcSet([
		{ width: 256, url: category.backgroundImage256?.url },
		{ width: 512, url: category.backgroundImage512?.url },
		{ width: 1024, url: category.backgroundImage?.url },
	]);
}

/**
 * Derive shop-by-category tiles from the catalog: one tile per category. Prefer the
 * category's own background image (merchandised lifestyle art); fall back to a
 * representative product thumbnail when the category has no image set.
 */
function buildCategoryTiles(products: readonly FeaturedProduct[], max = 3): CategoryTile[] {
	const seen = new Set<string>();
	const tiles: CategoryTile[] = [];
	for (const product of products) {
		const category = product.category;
		if (!category?.slug || seen.has(category.slug)) continue;
		seen.add(category.slug);
		const categoryName = category.translation?.name || category.name;
		const background = category.backgroundImage;
		const image = background?.url ?? product.thumbnail?.url ?? null;
		const imageAlt = background?.alt || product.thumbnail?.alt || categoryName;
		tiles.push({
			title: categoryName,
			href: `/categories/${pickTranslatedSlug(category)}`,
			image,
			imageSrcSet: background?.url ? categoryBackgroundSrcSet(category) : productThumbnailSrcSet(product),
			imageAlt,
		});
		if (tiles.length >= max) break;
	}
	return tiles;
}

/** Fold-height placeholder so client-nav App Shells keep layout while URL data resolves. */
function HomePageFallback() {
	return (
		<div aria-hidden="true">
			<div className="min-h-[calc(100svh-var(--chrome-offset))] bg-primary">
				<div className="container-content flex h-full min-h-[calc(100svh-var(--chrome-offset))] flex-col justify-end pb-16 pt-24">
					<div className="h-3 w-24 animate-pulse rounded bg-primary-foreground/10" />
					<div className="mt-4 h-10 w-2/3 max-w-xl animate-pulse rounded bg-primary-foreground/10" />
					<div className="mt-3 h-4 w-1/2 max-w-md animate-pulse rounded bg-primary-foreground/10" />
					<div className="mt-8 h-11 w-36 animate-pulse rounded bg-primary-foreground/10" />
				</div>
			</div>
		</div>
	);
}

/**
 * Homepage body — awaits `params` + cached catalog/content. Wrapped by the page's
 * Suspense so Partial Prefetching can share one App Shell across locale/channel URLs.
 * Direct loads still prerender full HTML per `generateStaticParams` (Suspense resolves
 * at build time); client navigations show {@link HomePageFallback} until the cached
 * body streams in.
 */
async function HomePageContent({ params }: { params: HomeParams }) {
	const { locale, channel } = await params;
	const content = await getStorefrontContent(channel, locale);
	const { hero, featuredCollection, categories, brandStory, values } = content.surfaces.homepage;

	// Source real product imagery from the same cached collection the featured
	// section uses (deduped by "use cache" key).
	const products = await getFeaturedProducts(
		channel,
		locale,
		featuredCollection.limit,
		featuredCollection.collectionSlug,
	);
	const categoryTiles = buildCategoryTiles(products, 6);

	const currency = await resolveChannelCurrency(channel);
	const policyValues = buildPolicyLabelValues(content.policies, {
		currency,
		locale: resolveLocaleFromSlug(locale).bcp47,
	});
	const valueColumns = values.columns.map((column) => ({
		...column,
		text: formatContentLabel(column.text, policyValues),
	}));

	return (
		<>
			<AnniversaryHero
				eyebrow={hero.eyebrow}
				heading={hero.heading}
				subheading={hero.subheading}
				numeral={String(anniversaryCampaign.years)}
				numeralCaption="Years"
				primaryCta={{
					label: hero.primaryCtaLabel,
					href: `/collections/${featuredCollection.collectionSlug}`,
				}}
				secondaryCta={{ label: "Browse all", href: "/products" }}
			/>

			{categoryTiles.length >= 2 ? (
				<CategoryTileGrid
					eyebrow={categories.eyebrow}
					heading={categories.heading}
					tiles={categoryTiles}
					columns={categoryTiles.length >= 3 ? 3 : 2}
					imageFit="cover"
					tone="muted"
				/>
			) : null}

			{/* Cached collection — resolves with the rest of the body inside Suspense. */}
			<FeaturedCollectionSection
				locale={locale}
				channel={channel}
				heading={featuredCollection.heading}
				collectionSlug={featuredCollection.collectionSlug}
				limit={featuredCollection.limit}
			/>

			<MulticolumnSection
				heading={values.heading}
				columns={valueColumns}
				columnsDesktop={values.columnsDesktop}
				tone="muted"
			/>

			<RichTextBlock
				heading={brandStory.heading}
				paragraphs={brandStory.paragraphs}
				align="center"
				width="narrow"
				tone="inverse"
			/>
		</>
	);
}

/**
 * Sync page shell — `params` are URL data and must stay behind Suspense for a shared
 * instant App Shell (Next.js 16.3 Partial Prefetching).
 */
export default function Page({ params }: { params: HomeParams }) {
	return (
		<Suspense fallback={<HomePageFallback />}>
			<HomePageContent params={params} />
		</Suspense>
	);
}
