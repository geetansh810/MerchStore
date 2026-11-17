import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildUpiOrderMetadata,
	buildUpiPaymentReference,
	buildUpiPaymentUri,
	buildUpiTransactionNote,
	formatUpiAmount,
	getUpiQrConfig,
	isUnpaidOrdersDisabledError,
	isUpiQrPaymentEnabled,
	isUpiTransactionIdBlocking,
	isValidUpiVpa,
	normalizeUpiTransactionId,
	validateUpiTransactionId,
} from "./upi-qr";

describe("buildUpiPaymentUri", () => {
	it("builds the exact URI with percent-encoded spaces and a literal @", () => {
		expect(
			buildUpiPaymentUri({ vpa: "shop@okicici", payeeName: "My Shop", amount: 1499, note: "Order ORDABC" }),
		).toBe("upi://pay?pa=shop@okicici&pn=My%20Shop&am=1499.00&cu=INR&tn=Order%20ORDABC");
	});

	it("escapes & in the payee name", () => {
		const uri = buildUpiPaymentUri({ vpa: "shop@okicici", payeeName: "A & B", amount: 10, note: "n" });
		expect(uri).toContain("pn=A%20%26%20B");
	});

	it("returns null for invalid amounts and VPAs", () => {
		const base = { vpa: "shop@okicici", payeeName: "S", note: "n" };
		expect(buildUpiPaymentUri({ ...base, amount: 0 })).toBeNull();
		expect(buildUpiPaymentUri({ ...base, amount: -5 })).toBeNull();
		expect(buildUpiPaymentUri({ ...base, amount: Number.NaN })).toBeNull();
		expect(buildUpiPaymentUri({ ...base, vpa: "not-a-vpa", amount: 10 })).toBeNull();
	});
});

describe("formatUpiAmount", () => {
	it("formats with two decimals", () => {
		expect(formatUpiAmount(12.5)).toBe("12.50");
		expect(formatUpiAmount(0)).toBeNull();
		expect(formatUpiAmount(Infinity)).toBeNull();
	});
});

describe("isValidUpiVpa", () => {
	it("accepts typical VPAs", () => {
		expect(isValidUpiVpa("shop@okicici")).toBe(true);
		expect(isValidUpiVpa("my.shop-1_x@ybl")).toBe(true);
		expect(isValidUpiVpa("9876543210@paytm")).toBe(true);
	});

	it("rejects malformed VPAs", () => {
		expect(isValidUpiVpa("")).toBe(false);
		expect(isValidUpiVpa("shop")).toBe(false);
		expect(isValidUpiVpa("@okicici")).toBe(false);
		expect(isValidUpiVpa("a@okicici")).toBe(false);
		expect(isValidUpiVpa("shop@1bank")).toBe(false);
		expect(isValidUpiVpa("sh op@okicici")).toBe(false);
	});
});

describe("buildUpiPaymentReference", () => {
	it("derives ORD + first 10 hex chars of the checkout uuid", () => {
		const id = btoa("Checkout:1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");
		expect(buildUpiPaymentReference(id)).toBe("ORD1A2B3C4D5E");
		expect(buildUpiPaymentReference(id)).toBe(buildUpiPaymentReference(id));
	});

	it("falls back to the last alphanumeric chars for non-base64 ids", () => {
		expect(buildUpiPaymentReference("checkout-id-abc123xyz!")).toBe("ORDDABC123XYZ");
	});

	it("builds the transaction note", () => {
		expect(buildUpiTransactionNote("ORDABC")).toBe("Order ORDABC");
	});
});

describe("getUpiQrConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	function enable(extra: Record<string, string> = {}) {
		vi.stubEnv("NEXT_PUBLIC_PAYMENT_MODE", "upi_qr");
		vi.stubEnv("NEXT_PUBLIC_UPI_VPA", "shop@okicici");
		vi.stubEnv("NEXT_PUBLIC_UPI_PAYEE_NAME", "My Shop");
		for (const [key, value] of Object.entries(extra)) {
			vi.stubEnv(key, value);
		}
	}

	it("is disabled when the mode is unset", () => {
		expect(isUpiQrPaymentEnabled()).toBe(false);
		expect(getUpiQrConfig()).toEqual({ status: "disabled" });
	});

	it("returns the config when fully set", () => {
		enable();
		expect(getUpiQrConfig()).toEqual({
			status: "ok",
			config: {
				vpa: "shop@okicici",
				payeeName: "My Shop",
				staticQrImagePath: null,
				requireTransactionId: false,
			},
		});
	});

	it("is misconfigured for a missing or invalid VPA or payee name", () => {
		enable({ NEXT_PUBLIC_UPI_VPA: "" });
		expect(getUpiQrConfig()).toEqual({ status: "misconfigured", reason: "vpa_missing" });
		enable({ NEXT_PUBLIC_UPI_VPA: "nope" });
		expect(getUpiQrConfig()).toEqual({ status: "misconfigured", reason: "vpa_invalid" });
		enable({ NEXT_PUBLIC_UPI_PAYEE_NAME: " " });
		expect(getUpiQrConfig()).toEqual({ status: "misconfigured", reason: "payee_name_missing" });
	});

	it("keeps only same-origin static QR paths", () => {
		enable({ NEXT_PUBLIC_UPI_QR_IMAGE_PATH: "/payments/upi-qr.png" });
		expect(getUpiQrConfig()).toMatchObject({ config: { staticQrImagePath: "/payments/upi-qr.png" } });
		enable({ NEXT_PUBLIC_UPI_QR_IMAGE_PATH: "https://evil.example/qr.png" });
		expect(getUpiQrConfig()).toMatchObject({ config: { staticQrImagePath: null } });
		enable({ NEXT_PUBLIC_UPI_QR_IMAGE_PATH: "//evil.example/qr.png" });
		expect(getUpiQrConfig()).toMatchObject({ config: { staticQrImagePath: null } });
	});

	it("parses the require-transaction-id flag", () => {
		enable({ NEXT_PUBLIC_UPI_REQUIRE_TRANSACTION_ID: "true" });
		expect(getUpiQrConfig()).toMatchObject({ config: { requireTransactionId: true } });
		enable({ NEXT_PUBLIC_UPI_REQUIRE_TRANSACTION_ID: "false" });
		expect(getUpiQrConfig()).toMatchObject({ config: { requireTransactionId: false } });
	});
});

describe("validateUpiTransactionId", () => {
	it("treats blank input as empty", () => {
		expect(validateUpiTransactionId("")).toEqual({ status: "empty" });
		expect(validateUpiTransactionId("  ")).toEqual({ status: "empty" });
		expect(validateUpiTransactionId(undefined)).toEqual({ status: "empty" });
	});

	it("accepts a 12-digit UTR", () => {
		expect(validateUpiTransactionId("123456789012")).toEqual({ status: "valid", value: "123456789012" });
	});

	it("normalizes spaces and hyphens and uppercases", () => {
		expect(validateUpiTransactionId("1234 5678-9012")).toEqual({ status: "valid", value: "123456789012" });
		expect(normalizeUpiTransactionId(" ab-12 cd ")).toBe("AB12CD");
	});

	it("flags unusual alphanumeric ids without blocking", () => {
		const result = validateUpiTransactionId("T2311201234567890");
		expect(result).toEqual({ status: "unusual", value: "T2311201234567890" });
		expect(isUpiTransactionIdBlocking(result)).toBe(false);
	});

	it("blocks bad characters and bad lengths", () => {
		expect(validateUpiTransactionId("abc$12")).toEqual({ status: "invalid", reason: "characters" });
		expect(validateUpiTransactionId("A".repeat(40))).toEqual({ status: "invalid", reason: "length" });
		expect(validateUpiTransactionId("12")).toEqual({ status: "invalid", reason: "length" });
		expect(isUpiTransactionIdBlocking(validateUpiTransactionId("12"))).toBe(true);
	});

	it("requires a value when configured", () => {
		expect(validateUpiTransactionId("", { required: true })).toEqual({
			status: "invalid",
			reason: "required",
		});
	});
});

describe("buildUpiOrderMetadata", () => {
	const checkoutId = btoa("Checkout:1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");

	it("includes the transaction id", () => {
		expect(buildUpiOrderMetadata({ checkoutId, transactionId: "123456789012", vpa: "shop@okicici" })).toEqual(
			[
				{ key: "payment_method", value: "upi_qr" },
				{ key: "upi_transaction_id", value: "123456789012" },
				{ key: "upi_payment_reference", value: "ORD1A2B3C4D5E" },
				{ key: "upi_payee_vpa", value: "shop@okicici" },
			],
		);
	});

	it("uses not_provided when no UTR was entered", () => {
		const metadata = buildUpiOrderMetadata({ checkoutId, transactionId: null, vpa: "shop@okicici" });
		expect(metadata.find((entry) => entry.key === "upi_transaction_id")?.value).toBe("not_provided");
	});
});

describe("isUnpaidOrdersDisabledError", () => {
	it("detects CHECKOUT_NOT_FULLY_PAID", () => {
		expect(isUnpaidOrdersDisabledError({ fieldErrors: [{ code: "CHECKOUT_NOT_FULLY_PAID" }] })).toBe(true);
		expect(isUnpaidOrdersDisabledError({ fieldErrors: [{ code: "INVALID" }] })).toBe(false);
		expect(isUnpaidOrdersDisabledError({})).toBe(false);
	});
});
