import { anniversaryCampaign, anniversaryLabel } from "./campaign";

/**
 * Brand Configuration
 *
 * Centralized branding settings for the storefront.
 * Update these values when customizing for a new store.
 *
 * @example
 * ```tsx
 * import { brandConfig } from "@/config/brand";
 *
 * <title>{brandConfig.siteName}</title>
 * <Suspense><CopyrightText /></Suspense> // never `new Date()` during render (sync IO under Cache Components)
 * ```
 */

export const brandConfig = {
	/** Site name used in titles, metadata, and headers */
	siteName: "Anniversary Store",

	/** Legal entity name for copyright notices */
	copyrightHolder: "Anniversary Store",

	/** Organization name for structured data (JSON-LD) */
	organizationName: "Anniversary Store",

	/** Default brand name for products without a brand */
	defaultBrand: "Anniversary Store",

	/** Tagline/description for the store */
	tagline: `Commemorative gifts & merchandise for the ${anniversaryLabel} of the ${anniversaryCampaign.honoree}.`,

	/** Homepage meta description */
	description: `Celebrate ${anniversaryCampaign.years} years of the ${anniversaryCampaign.honoree} with commemorative apparel, barware, collectibles and personalised gifts.`,

	/** Logo aria-label for accessibility */
	logoAriaLabel: "Anniversary Store",

	/** Title template - %s will be replaced with page title */
	titleTemplate: "%s | Anniversary Store",

	/** Social media handles */
	social: {
		/** Twitter/X handle (without @) - set to null to disable */
		twitter: null as string | null,
		/** Instagram handle (without @) - set to null to disable */
		instagram: null as string | null,
		/** Facebook page URL - set to null to disable */
		facebook: null as string | null,
	},
} as const;

/**
 * Helper to format page title using brand template.
 */
export function formatPageTitle(title: string): string {
	return brandConfig.titleTemplate.replace("%s", title);
}

/**
 * Get copyright text with specified year.
 * Render through `CopyrightText` inside `<Suspense>`: it calls `io()` before reading the clock.
 */
export function getCopyrightText(year: number = new Date().getFullYear()): string {
	return `© ${year} ${brandConfig.copyrightHolder}. All rights reserved.`;
}
