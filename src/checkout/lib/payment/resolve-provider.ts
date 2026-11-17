import {
	findDummyGateway,
	isDummyGateway,
	isDummyPaymentAllowed,
} from "@/checkout/lib/payment/providers/dummy";
import {
	isIgnorableGateway,
	findEnabledIntegratedGateway,
	hasUnsupportedPaymentGateway,
} from "./integrated-gateways";
import { getUpiQrConfig } from "./providers/upi-qr";
import { type PaymentGatewayLike, type ResolvedPaymentProvider } from "./types";

function hasSubstantiveGateway(gateways: ReadonlyArray<PaymentGatewayLike>): boolean {
	return gateways.some((gateway) => !isIgnorableGateway(gateway));
}

/** Picks the payment integration for checkout.availablePaymentGateways. */
export function resolvePaymentProvider(
	gateways: ReadonlyArray<PaymentGatewayLike> | null | undefined,
): ResolvedPaymentProvider {
	// Manual UPI mode is gateway-less: it wins over any gateway Saleor exposes.
	const upi = getUpiQrConfig();
	if (upi.status === "ok") {
		return { type: "upi_qr", submitMode: "server", config: upi.config };
	}
	if (upi.status === "misconfigured") {
		return { type: "upi_qr_misconfigured", reason: upi.reason };
	}

	const list = gateways ?? [];

	const integrated = findEnabledIntegratedGateway(list);
	if (integrated) {
		return {
			type: integrated.definition.type,
			gateway: integrated.gateway,
			submitMode: integrated.definition.submitMode,
		};
	}

	// In production, ignore dummy even if Saleor exposes it on the checkout.
	const dummyGateway = findDummyGateway(list);
	const effectiveList =
		dummyGateway && !isDummyPaymentAllowed() ? list.filter((gateway) => !isDummyGateway(gateway)) : list;

	if (!hasSubstantiveGateway(effectiveList)) {
		return { type: "none" };
	}
	if (hasUnsupportedPaymentGateway(effectiveList)) {
		return { type: "unsupported", gateways: effectiveList };
	}
	return { type: "dummy_missing" };
}

/** Client-driven gateways render their own Pay button (e.g. Stripe Elements). */
export function usesClientPaymentSubmit(provider: ResolvedPaymentProvider): boolean {
	return provider.type === "stripe" || provider.type === "dummy" ? provider.submitMode === "client" : false;
}

/** Whether the checkout Pay button can run for the resolved provider. */
export function canSubmitPayment(provider: ResolvedPaymentProvider): boolean {
	return provider.type === "upi_qr" || (provider.type === "dummy" && provider.submitMode === "server");
}
