import "server-only";

import {
	CheckoutCommerceContextDocument,
	type CheckoutCommerceContextQuery,
	type CheckoutCommerceContextQueryVariables,
} from "@/checkout/graphql/generated/operations";
import { toTypedDocument } from "@/checkout/lib/server/to-typed-document";
import { buildPersonalisedLinesMetadata } from "@/lib/personalisation";
import { liveQuery } from "@/lib/saleor";

const READ_TIMEOUT_MS = 1_500;

const checkoutLinesDocument = toTypedDocument<
	CheckoutCommerceContextQuery,
	CheckoutCommerceContextQueryVariables
>(CheckoutCommerceContextDocument);

/**
 * Order-level copy of the personalised names: one readable `personalised_lines` JSON field in
 * the Dashboard order metadata, independent of whether line metadata is copied onto order lines.
 * Best-effort — never throws, and returns `[]` when nothing is personalised or the read fails,
 * so completing the order never waits on it.
 */
export async function readPersonalisedLinesOrderMetadata(
	checkoutId: string,
): Promise<{ key: string; value: string }[]> {
	if (!checkoutId) return [];

	try {
		const result = await liveQuery(checkoutLinesDocument, {
			variables: { id: checkoutId },
			maxRetries: 0,
			timeoutMs: READ_TIMEOUT_MS,
		});
		if (!result.ok || !result.data.checkout) return [];

		return buildPersonalisedLinesMetadata(
			result.data.checkout.lines.map((line) => ({
				variantId: line.variant?.id ?? null,
				sku: line.variant?.sku ?? null,
				productName: line.variant?.product?.name ?? null,
				quantity: line.quantity,
				personalisedName: line.personalisedName ?? null,
			})),
		);
	} catch (error) {
		console.warn("[personalisation] order-level copy skipped", error);
		return [];
	}
}
