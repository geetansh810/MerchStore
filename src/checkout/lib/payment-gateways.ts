import { type PaymentGatewayFragment } from "@/checkout/graphql";
import { resolvePaymentProvider } from "@/checkout/lib/payment/resolve-provider";
import { type ResolvedPaymentProvider } from "@/checkout/lib/payment/types";

export {
	buildCheckoutGatewayMessages,
	formatGatewayList,
	getTransactionInitializeError,
	getUnsupportedGatewayMessage,
	type CheckoutGatewayMessages,
} from "@/checkout/lib/payment/gateway-messages";

export {
	DUMMY_GATEWAY_IDS,
	DUMMY_PAYMENT_NOT_ALLOWED_MESSAGE,
	findDummyGateway,
	getDummyPaymentGuardError,
	isDummyGateway,
	isDummyPaymentAllowed,
} from "@/checkout/lib/payment/providers/dummy";

export { hasUnsupportedPaymentGateway, isIgnorableGateway } from "@/checkout/lib/payment/integrated-gateways";

type GatewayLike = Pick<PaymentGatewayFragment, "id" | "name">;

export type PaymentGatewayStatus =
	| { kind: "dummy"; gateway: GatewayLike }
	| { kind: "stripe"; gateway: GatewayLike }
	| { kind: "upi_qr" }
	| {
			kind: "upi_qr_misconfigured";
			reason: Extract<ResolvedPaymentProvider, { type: "upi_qr_misconfigured" }>["reason"];
	  }
	| { kind: "none" }
	| { kind: "unsupported" }
	| { kind: "dummy_missing" };

/** Classifies checkout.availablePaymentGateways for UI and pay flow. */
export function resolvePaymentGatewayStatus(
	gateways: ReadonlyArray<GatewayLike> | null | undefined,
): PaymentGatewayStatus {
	const provider = resolvePaymentProvider(gateways);

	switch (provider.type) {
		case "dummy":
			return { kind: "dummy", gateway: provider.gateway };
		case "stripe":
			return { kind: "stripe", gateway: provider.gateway };
		case "upi_qr":
			return { kind: "upi_qr" };
		case "upi_qr_misconfigured":
			return { kind: "upi_qr_misconfigured", reason: provider.reason };
		case "none":
			return { kind: "none" };
		case "unsupported":
			return { kind: "unsupported" };
		case "dummy_missing":
			return { kind: "dummy_missing" };
	}
}
