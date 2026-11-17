import { type PaymentGatewayFragment } from "@/checkout/graphql";
import { type UpiQrConfig, type UpiQrConfigResult } from "./providers/upi-qr";

export type PaymentGatewayLike = Pick<PaymentGatewayFragment, "id" | "name">;

export type PaymentSubmitMode = "client" | "server";

/** Result of a payment attempt after billing has been updated. */
export type PaymentResult =
	| { ok: true; orderId: string; orderViewToken: string }
	| {
			ok: false;
			error: string;
			/** Which error bucket in the payment step form state */
			errorKey?: "payment" | "billing";
			fieldErrors?: Record<string, string>;
	  };

export type PaymentContext = {
	checkoutId: string;
	/** Live gross total from Saleor — required so authorization matches checkoutComplete. */
	amount: number;
	/** ISO currency of the live total — manual providers (UPI) only accept INR. */
	currency?: string;
	/** Raw UPI transaction ID / UTR typed by the shopper (validated again server-side). */
	upiTransactionId?: string;
};

type IntegratedPaymentProvider =
	| { type: "stripe"; gateway: PaymentGatewayLike; submitMode: PaymentSubmitMode }
	| { type: "dummy"; gateway: PaymentGatewayLike; submitMode: PaymentSubmitMode };

/** Gateway-less manual payment: QR shown, order created unpaid, merchant verifies later. */
export type UpiQrPaymentProvider = { type: "upi_qr"; submitMode: "server"; config: UpiQrConfig };

type UpiQrMisconfiguredReason = Extract<UpiQrConfigResult, { status: "misconfigured" }>["reason"];

/** Which payment integration handles the current checkout. */
export type ResolvedPaymentProvider =
	| IntegratedPaymentProvider
	| UpiQrPaymentProvider
	| { type: "upi_qr_misconfigured"; reason: UpiQrMisconfiguredReason }
	| { type: "none" }
	| { type: "unsupported"; gateways: ReadonlyArray<PaymentGatewayLike> }
	| { type: "dummy_missing" };

export type TransactionInitializePayload =
	| {
			errors?: ReadonlyArray<{ message?: string | null }> | null;
			transactionEvent?: { type?: string | null; message?: string | null } | null;
			transaction?: { id?: string | null } | null;
			data?: unknown;
	  }
	| null
	| undefined;

export function isIntegratedPaymentProvider(
	provider: ResolvedPaymentProvider,
): provider is IntegratedPaymentProvider {
	return provider.type === "stripe" || provider.type === "dummy";
}

export function isManualPaymentProvider(provider: ResolvedPaymentProvider): provider is UpiQrPaymentProvider {
	return provider.type === "upi_qr";
}
