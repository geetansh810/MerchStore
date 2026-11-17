import { brandConfig } from "@/config/brand";
import { anniversaryCampaign, anniversaryLabel } from "@/config/campaign";
import { STOREFRONT_CONTENT_VERSION, type StorefrontContent } from "@/lib/content/types";

/**
 * Code fallback for all storefront marketing copy.
 * Saleor PageType overrides merge on top when CONTENT_PROVIDER=saleor.
 *
 * English SoT for editorial copy — export to Configurator seed: pnpm content:export-seed
 */
export const defaultStorefrontContent = {
	version: STOREFRONT_CONTENT_VERSION,
	// Single source of truth for channel-wide facts. Copy references these via
	// `{freeShippingThreshold}` / `{returnsWindowDays}` tokens instead of baking the
	// numbers into strings, so the cart math, announcement, and trust labels never drift.
	policies: {
		shipping: {
			// No free-shipping promise until the client confirms one.
			freeShippingThreshold: null,
		},
		returns: {
			// Placeholder — confirm with the client.
			windowDays: 7,
		},
	},
	chrome: {
		announcementBar: {
			id: "af70-launch",
			message: `Celebrating ${anniversaryCampaign.years} years of the ${anniversaryCampaign.honoree} — personalised mugs, flasks & diaries`,
			href: `/collections/${anniversaryCampaign.collectionSlug}`,
			linkLabel: "Shop now",
			dismissible: true,
		},
		nav: {
			allProductsLabel: "All",
			viewAllLabel: "View all {label}",
		},
	},
	surfaces: {
		homepage: {
			hero: {
				eyebrow: `${anniversaryCampaign.honoree} · ${anniversaryCampaign.years} Years`,
				heading: `Happy ${anniversaryLabel}`,
				subheading: `Celebrating ${anniversaryCampaign.years} years of the ${anniversaryCampaign.honoree} — commemorative gifts & merchandise.`,
				primaryCtaLabel: "Shop the collection",
			},
			featuredCollection: {
				heading: `The ${anniversaryLabel} Collection`,
				collectionSlug: anniversaryCampaign.collectionSlug,
				// 12 > the 11 featured seed items, so the category tiles (derived from these products) cover every category.
				limit: 12,
			},
			categories: {
				heading: "Shop by category",
				eyebrow: "Gifts & keepsakes",
			},
			photoCredits: [],
			brandStory: {
				heading: "Seventy years of service",
				paragraphs: [
					"Seven decades of dedication, discipline and pride. This collection brings that milestone home, with commemorative pieces made to be worn, gifted and kept.",
					"Commemorative pieces for the anniversary — and our mugs, coffee flasks and diaries can be personalised with a name of your choice.",
				],
			},
			values: {
				heading: "Made for the occasion",
				columns: [
					{
						title: "Commemorative designs",
						text: `Designed to mark the ${anniversaryLabel.toLowerCase()}.`,
					},
					{
						title: "Personalised gifts",
						text: "Add a name to mugs, coffee flasks and diaries.",
					},
					{
						title: "Delivered across India",
						text: "Shipping charges and delivery options are shown at checkout.",
					},
				],
				columnsDesktop: 3,
			},
			editorial: {
				heading: "From the shop",
				paragraphs: ["Commemorative gifts and keepsakes for every member of the family."],
				imagePosition: "right",
				ctaLabel: "Explore collections",
				image: null,
				imageAlt: "",
			},
		},
		products: {
			title: "All Gifts",
			description: brandConfig.description,
		},
		cart: {
			empty: {
				title: "Your bag is empty",
				body: "Looks like you haven't added anything to your bag yet.",
				ctaLabel: "Start Shopping",
			},
			trust: {
				freeShippingPrefix: "Free delivery over",
				returnsLabel: "{returnsWindowDays}-day returns",
			},
			drawer: {
				title: "Your Bag",
				addForFreeShipping: "Add {amount} more for free shipping",
				freeShippingQualified: "You qualify for free shipping!",
			},
		},
		checkout: {
			emptyCart: {
				title: "Your cart is empty",
				body: "Looks like you haven't added anything to your cart yet.",
				startShoppingLabel: "Start Shopping",
				goBackLabel: "Go back",
			},
			emptySession: {
				title: "Your cart is empty",
				message: "Add items from the store, then return here to complete your purchase.",
			},
			marketingOptInLabel: "Email me with news and offers",
			trust: {
				secureCheckout: "Secure checkout",
				stripeProcessor: "Payments processed by Stripe",
			},
		},
	},
} satisfies StorefrontContent;
