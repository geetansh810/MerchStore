import type { CheckoutLineInput } from "@/gql/graphql";

/**
 * Personalised-name products (mugs, flasks, diaries).
 *
 * - Product metadata `personalisation = "name"` turns the name field on; optional
 *   `personalisation_max_length` caps it (default 20, hard cap 40).
 * - The customer's text is stored on the checkout line as public metadata `personalised_name`,
 *   which Saleor copies to the order line on `checkoutComplete`.
 *
 * Pure module — used by the PDP buy-box island and the `addVariantToCart` server action, which
 * must re-validate because exported server actions are callable from any client.
 */

/** Product metadata key; value `"name"` enables the field. */
export const PRODUCT_PERSONALISATION_KEY = "personalisation";
export const PRODUCT_PERSONALISATION_MAX_LENGTH_KEY = "personalisation_max_length";
/** Checkout/order line metadata key holding the customer's text. */
export const LINE_PERSONALISED_NAME_KEY = "personalised_name";
export const DEFAULT_PERSONALISED_NAME_MAX_LENGTH = 20;
export const PERSONALISED_NAME_HARD_MAX_LENGTH = 40;

/** Latin letters first, then letters, spaces, full stops, apostrophes and hyphens. */
export const PERSONALISED_NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;
/** Same rule for the `pattern` attribute (the `v` flag needs the hyphen escaped). */
export const PERSONALISED_NAME_HTML_PATTERN = "[A-Za-z][A-Za-z .'\\-]*";

export type PersonalisationConfig = { kind: "name"; maxLength: number };

export function resolvePersonalisationConfig(input: {
	personalisation?: string | null;
	maxLength?: string | null;
}): PersonalisationConfig | null {
	if (input.personalisation?.trim().toLowerCase() !== "name") {
		return null;
	}
	const parsed = Number.parseInt(input.maxLength?.trim() ?? "", 10);
	const maxLength = Number.isFinite(parsed)
		? Math.min(Math.max(parsed, 1), PERSONALISED_NAME_HARD_MAX_LENGTH)
		: DEFAULT_PERSONALISED_NAME_MAX_LENGTH;
	return { kind: "name", maxLength };
}

/** String → NFC → trim → collapse whitespace runs. Non-strings become "". */
export function normalisePersonalisedName(raw: unknown): string {
	if (typeof raw !== "string") {
		return "";
	}
	return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

export type PersonalisedNameResult =
	| { ok: true; value: string }
	| { ok: false; reason: "required" | "too_long" | "invalid_chars" };

export function validatePersonalisedName(raw: unknown, maxLength: number): PersonalisedNameResult {
	const value = normalisePersonalisedName(raw);
	if (value === "") {
		return { ok: false, reason: "required" };
	}
	if (value.length > maxLength) {
		return { ok: false, reason: "too_long" };
	}
	if (!PERSONALISED_NAME_REGEX.test(value)) {
		return { ok: false, reason: "invalid_chars" };
	}
	return { ok: true, value };
}

/**
 * A personalised line always gets its own checkout line (`forceNewLine`) so two mugs with
 * different names never merge.
 */
export function buildCheckoutLineInput(input: {
	variantId: string;
	quantity?: number;
	personalisedName?: string | null;
}): CheckoutLineInput {
	const base: CheckoutLineInput = { quantity: input.quantity ?? 1, variantId: input.variantId };
	if (!input.personalisedName) {
		return base;
	}
	return {
		...base,
		forceNewLine: true,
		metadata: [{ key: LINE_PERSONALISED_NAME_KEY, value: input.personalisedName }],
	};
}

/** Order metadata key: JSON array of every personalised line, for the merchant's fulfilment view. */
export const ORDER_PERSONALISED_LINES_KEY = "personalised_lines";

export type PersonalisedLineSummary = {
	variantId: string | null;
	sku: string | null;
	productName: string | null;
	quantity: number;
	personalisedName: string | null;
};

/**
 * Build the order-level `personalised_lines` metadata entry. Empty array when no line carries
 * a name. Names are re-validated so only well-formed text is ever copied onto the order.
 */
export function buildPersonalisedLinesMetadata(
	lines: readonly PersonalisedLineSummary[],
): { key: string; value: string }[] {
	const personalised = lines.flatMap((line) => {
		const result = validatePersonalisedName(line.personalisedName, PERSONALISED_NAME_HARD_MAX_LENGTH);
		if (!result.ok) return [];
		return [
			{
				variantId: line.variantId,
				sku: line.sku,
				productName: line.productName,
				name: result.value,
				quantity: line.quantity,
			},
		];
	});

	return personalised.length > 0
		? [{ key: ORDER_PERSONALISED_LINES_KEY, value: JSON.stringify(personalised) }]
		: [];
}
