import { type CheckoutGatewayMessages, getUnsupportedGatewayMessage } from "@/checkout/lib/payment-gateways";
import { completeCheckoutOrder } from "./complete-order";
import { executeDummyPayment } from "./providers/dummy-pay";
import { executeUpiQrPayment, validateUpiPaymentInput } from "./providers/upi-qr-pay";
import { type PaymentContext, type PaymentResult, type ResolvedPaymentProvider } from "./types";

/**
 * Runs the Saleor transaction flow for the resolved provider.
 * Add new providers here (e.g. Stripe) — each implements initialize → client SDK → process → complete.
 */
export async function executePayment(
	provider: ResolvedPaymentProvider,
	context: PaymentContext,
	messages: CheckoutGatewayMessages,
): Promise<PaymentResult> {
	if (context.amount === 0) {
		return completeCheckoutOrder(context.checkoutId);
	}

	switch (provider.type) {
		case "dummy":
			return executeDummyPayment(context, provider.gateway.id, messages);
		case "upi_qr":
			return executeUpiQrPayment(context, provider, messages);
		case "upi_qr_misconfigured":
			return { ok: false, error: messages.upiMisconfiguredBody, errorKey: "payment" };
		case "stripe":
			return {
				ok: false,
				error: messages.stripeUseCardForm,
				errorKey: "payment",
			};
		case "none":
			return {
				ok: false,
				error: messages.noGatewayConfigured,
				errorKey: "payment",
			};
		case "unsupported":
			return {
				ok: false,
				error: getUnsupportedGatewayMessage(provider.gateways, messages),
				errorKey: "payment",
			};
		case "dummy_missing":
			return { ok: false, error: messages.dummyMissingBody, errorKey: "payment" };
	}
}

/**
 * Synchronous pre-flight check of provider-specific form input (before any network call).
 * Returns field errors, or null when the input is acceptable.
 */
export function validatePaymentInput(
	provider: ResolvedPaymentProvider,
	input: { upiTransactionId?: string },
	messages: CheckoutGatewayMessages,
): Record<string, string> | null {
	if (provider.type === "upi_qr") {
		return validateUpiPaymentInput(provider, input, messages);
	}
	return null;
}
