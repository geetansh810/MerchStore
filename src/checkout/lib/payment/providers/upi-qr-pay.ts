import { getCheckoutTransport } from "@/checkout/lib/checkout-transport";
import { type CheckoutGatewayMessages } from "@/checkout/lib/payment/gateway-messages";
import { formatCheckoutCompleteError } from "../format-checkout-complete-error";
import { type PaymentContext, type PaymentResult, type UpiQrPaymentProvider } from "../types";
import {
	UPI_CURRENCY,
	isUnpaidOrdersDisabledError,
	isUpiTransactionIdBlocking,
	validateUpiTransactionId,
} from "./upi-qr";

/** Maps a blocking UTR validation to the field error copy. */
function getTransactionIdErrorMessage(
	reason: "characters" | "length" | "required",
	messages: CheckoutGatewayMessages,
): string {
	return reason === "required" ? messages.upiTransactionIdRequired : messages.upiTransactionIdInvalid;
}

/**
 * Validates the manual-payment form input. Returns field errors or null when the input is fine.
 * Runs before any network call so the shopper gets inline feedback.
 */
export function validateUpiPaymentInput(
	provider: UpiQrPaymentProvider,
	input: { upiTransactionId?: string },
	messages: CheckoutGatewayMessages,
): Record<string, string> | null {
	const validation = validateUpiTransactionId(input.upiTransactionId, {
		required: provider.config.requireTransactionId,
	});
	if (isUpiTransactionIdBlocking(validation)) {
		return { upiTransactionId: getTransactionIdErrorMessage(validation.reason, messages) };
	}
	return null;
}

/**
 * UPI QR: no gateway transaction — the order is created unpaid with the UPI details attached as
 * metadata, and the merchant marks it paid after checking the bank statement.
 */
export async function executeUpiQrPayment(
	context: PaymentContext,
	provider: UpiQrPaymentProvider,
	messages: CheckoutGatewayMessages,
): Promise<PaymentResult> {
	if (context.currency && context.currency !== UPI_CURRENCY) {
		return { ok: false, error: messages.upiCurrencyUnsupported, errorKey: "payment" };
	}

	const validation = validateUpiTransactionId(context.upiTransactionId, {
		required: provider.config.requireTransactionId,
	});
	if (isUpiTransactionIdBlocking(validation)) {
		const error = getTransactionIdErrorMessage(validation.reason, messages);
		return { ok: false, error, fieldErrors: { upiTransactionId: error } };
	}
	const transactionId =
		validation.status === "valid" || validation.status === "unusual" ? validation.value : null;

	const result = await getCheckoutTransport().completeCheckout(context.checkoutId, {
		manualPayment: { method: "upi_qr", transactionId },
	});

	if (!result.ok) {
		console.error("[UPI] checkoutComplete failed", result);
		return {
			ok: false,
			error: isUnpaidOrdersDisabledError(result)
				? messages.upiUnpaidOrdersDisabled
				: formatCheckoutCompleteError(result.error),
			errorKey: "payment",
		};
	}

	return { ok: true, orderId: result.orderId, orderViewToken: result.orderViewToken };
}
