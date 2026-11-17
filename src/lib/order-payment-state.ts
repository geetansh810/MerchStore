/**
 * Customer-facing payment state of an order, derived from `isPaid` + `chargeStatus`
 * (not the legacy `paymentStatus`). Manual payments (UPI QR) create UNPAID orders that the
 * merchant marks as paid after verifying the bank statement.
 *
 * Pure helper: no `@/gql` or `@/ui` imports so it is safe in client and server code.
 */
export type OrderPaymentState = "paid" | "partially_paid" | "pending_verification" | "unknown";

/** Matches the `payment_method` order metadata written at checkout (see UPI_METADATA_KEYS). */
const UPI_PAYMENT_METHOD = "upi_qr";

export function getOrderPaymentState(order: {
	isPaid?: boolean | null;
	chargeStatus?: string | null;
}): OrderPaymentState {
	const { isPaid, chargeStatus } = order;
	const charge = chargeStatus ?? null;

	if (isPaid === true || charge === "FULL" || charge === "OVERCHARGED") {
		return "paid";
	}
	if (charge === "PARTIAL") {
		return "partially_paid";
	}
	if (charge === "NONE" || isPaid === false) {
		return "pending_verification";
	}
	return "unknown";
}

export function isUpiOrder(order: { paymentMethodKey?: string | null }): boolean {
	return order.paymentMethodKey === UPI_PAYMENT_METHOD;
}
