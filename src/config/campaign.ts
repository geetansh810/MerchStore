/**
 * Anniversary campaign — one-line edits for the whole storefront.
 *
 * No Saleor data lives here. Brand copy (`brand.ts`), homepage content (`defaults.ts`) and the
 * hero all derive from these values. The honoree string must appear ONLY in this file.
 */
export const anniversaryCampaign = {
	/** Who is celebrating — keep generic until the client confirms the unit/squadron. */
	honoree: "Air Force",
	years: 70,
	/** Must match scripts/data/anniversary-catalog.json → collection.slug */
	collectionSlug: "70th-anniversary",
} as const;

/** 1 → "1st", 2 → "2nd", 11 → "11th", 21 → "21st", 70 → "70th", 111 → "111th". */
export function formatOrdinal(n: number): string {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
	switch (n % 10) {
		case 1:
			return `${n}st`;
		case 2:
			return `${n}nd`;
		case 3:
			return `${n}rd`;
		default:
			return `${n}th`;
	}
}

/** e.g. "70th Anniversary" */
export const anniversaryLabel = `${formatOrdinal(anniversaryCampaign.years)} Anniversary`;
