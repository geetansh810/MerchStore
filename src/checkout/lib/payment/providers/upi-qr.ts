/**
 * UPI QR manual payment — no payment gateway.
 *
 * The storefront shows a UPI QR for the exact INR total; the order is created UNPAID via
 * `checkoutComplete` and the merchant verifies the payment in their bank statement.
 *
 * Isomorphic on purpose (used by client UI, the payment layer and the checkout server action).
 * Every env read must be a literal `process.env.NEXT_PUBLIC_*` so Next inlines it.
 */

export const UPI_QR_PAYMENT_MODE = "upi_qr";
export const UPI_CURRENCY = "INR";

/** Order metadata keys written by `checkoutComplete(metadata:)` and read back via `metafield(key:)`. */
export const UPI_METADATA_KEYS = {
	method: "payment_method",
	transactionId: "upi_transaction_id",
	reference: "upi_payment_reference",
	payeeVpa: "upi_payee_vpa",
} as const;

/** Stored as the transaction id when the customer did not enter a UTR. */
export const UPI_TRANSACTION_ID_NOT_PROVIDED = "not_provided";

export type UpiQrConfig = {
	vpa: string;
	payeeName: string;
	staticQrImagePath: string | null;
	requireTransactionId: boolean;
};

export type UpiQrConfigResult =
	| { status: "disabled" }
	| { status: "ok"; config: UpiQrConfig }
	| { status: "misconfigured"; reason: "vpa_missing" | "vpa_invalid" | "payee_name_missing" };

export function isUpiQrPaymentEnabled(): boolean {
	return process.env.NEXT_PUBLIC_PAYMENT_MODE === UPI_QR_PAYMENT_MODE;
}

const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

export function isValidUpiVpa(vpa: string): boolean {
	return UPI_VPA_PATTERN.test(vpa);
}

export function getUpiQrConfig(): UpiQrConfigResult {
	if (!isUpiQrPaymentEnabled()) {
		return { status: "disabled" };
	}

	const vpa = process.env.NEXT_PUBLIC_UPI_VPA?.trim() ?? "";
	if (!vpa) {
		return { status: "misconfigured", reason: "vpa_missing" };
	}
	if (!isValidUpiVpa(vpa)) {
		return { status: "misconfigured", reason: "vpa_invalid" };
	}

	const payeeName = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME?.trim() ?? "";
	if (!payeeName) {
		return { status: "misconfigured", reason: "payee_name_missing" };
	}

	const rawImagePath = process.env.NEXT_PUBLIC_UPI_QR_IMAGE_PATH?.trim() ?? "";
	const staticQrImagePath =
		rawImagePath.startsWith("/") && !rawImagePath.startsWith("//") ? rawImagePath : null;

	const requireTransactionId =
		process.env.NEXT_PUBLIC_UPI_REQUIRE_TRANSACTION_ID?.trim().toLowerCase() === "true";

	return { status: "ok", config: { vpa, payeeName, staticQrImagePath, requireTransactionId } };
}

/** `"1499.00"` — UPI apps expect a plain decimal with at most two fraction digits. */
export function formatUpiAmount(amount: number): string | null {
	if (!Number.isFinite(amount) || amount <= 0) {
		return null;
	}
	return amount.toFixed(2);
}

/**
 * Short, deterministic payment reference derived from the checkout id so the shopper's UPI
 * note can be matched to the order in the bank statement.
 */
export function buildUpiPaymentReference(checkoutId: string): string {
	try {
		const decoded = atob(checkoutId);
		const uuid = decoded.split(":")[1]?.replace(/-/g, "") ?? "";
		const head = uuid.slice(0, 10);
		if (/^[0-9a-fA-F]{10}$/.test(head)) {
			return `ORD${head.toUpperCase()}`;
		}
	} catch {
		// not base64 — fall through
	}
	const alnum = checkoutId.replace(/[^a-zA-Z0-9]/g, "");
	return `ORD${alnum.slice(-10).toUpperCase()}`;
}

export function buildUpiTransactionNote(reference: string): string {
	return `Order ${reference}`;
}

function encodeUpiParam(value: string): string {
	return encodeURIComponent(value).replace(/%40/g, "@");
}

/** `upi://pay?...` deep link / QR payload. Built by hand — URLSearchParams encodes spaces as `+`. */
export function buildUpiPaymentUri(input: {
	vpa: string;
	payeeName: string;
	amount: number;
	note: string;
}): string | null {
	const amount = formatUpiAmount(input.amount);
	if (!amount || !isValidUpiVpa(input.vpa)) {
		return null;
	}
	return (
		`upi://pay?pa=${encodeUpiParam(input.vpa)}` +
		`&pn=${encodeUpiParam(input.payeeName)}` +
		`&am=${amount}` +
		`&cu=${UPI_CURRENCY}` +
		`&tn=${encodeUpiParam(input.note)}`
	);
}

export type UpiTransactionIdValidation =
	| { status: "empty" }
	| { status: "valid"; value: string }
	| { status: "unusual"; value: string }
	| { status: "invalid"; reason: "characters" | "length" | "required" };

export function normalizeUpiTransactionId(raw: string | null | undefined): string {
	return (raw ?? "").replace(/[\s-]/g, "").toUpperCase();
}

export function validateUpiTransactionId(
	raw: string | null | undefined,
	options: { required?: boolean } = {},
): UpiTransactionIdValidation {
	const value = normalizeUpiTransactionId(raw);

	if (!value) {
		return options.required ? { status: "invalid", reason: "required" } : { status: "empty" };
	}
	if (!/^[A-Z0-9]+$/.test(value)) {
		return { status: "invalid", reason: "characters" };
	}
	if (value.length < 6 || value.length > 35) {
		return { status: "invalid", reason: "length" };
	}
	if (/^\d{12}$/.test(value)) {
		return { status: "valid", value };
	}
	return { status: "unusual", value };
}

export function isUpiTransactionIdBlocking(
	validation: UpiTransactionIdValidation,
): validation is Extract<UpiTransactionIdValidation, { status: "invalid" }> {
	return validation.status === "invalid";
}

export function buildUpiOrderMetadata(input: {
	checkoutId: string;
	transactionId: string | null;
	vpa: string;
}): Array<{ key: string; value: string }> {
	return [
		{ key: UPI_METADATA_KEYS.method, value: UPI_QR_PAYMENT_MODE },
		{ key: UPI_METADATA_KEYS.transactionId, value: input.transactionId || UPI_TRANSACTION_ID_NOT_PROVIDED },
		{ key: UPI_METADATA_KEYS.reference, value: buildUpiPaymentReference(input.checkoutId) },
		{ key: UPI_METADATA_KEYS.payeeVpa, value: input.vpa },
	];
}

/** Saleor rejects `checkoutComplete` with this code when the channel disallows unpaid orders. */
export function isUnpaidOrdersDisabledError(result: {
	fieldErrors?: ReadonlyArray<{ code?: string | null }>;
}): boolean {
	return result.fieldErrors?.some((error) => error.code === "CHECKOUT_NOT_FULLY_PAID") ?? false;
}
