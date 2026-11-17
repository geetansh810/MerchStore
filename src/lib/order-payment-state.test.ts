import { describe, expect, it } from "vitest";

import { getOrderPaymentState, isUpiOrder } from "./order-payment-state";

describe("getOrderPaymentState", () => {
	it("is paid when isPaid is true", () => {
		expect(getOrderPaymentState({ isPaid: true, chargeStatus: "NONE" })).toBe("paid");
	});

	it("is paid for FULL and OVERCHARGED charge status", () => {
		expect(getOrderPaymentState({ isPaid: null, chargeStatus: "FULL" })).toBe("paid");
		expect(getOrderPaymentState({ isPaid: false, chargeStatus: "OVERCHARGED" })).toBe("paid");
	});

	it("is partially paid for PARTIAL", () => {
		expect(getOrderPaymentState({ isPaid: false, chargeStatus: "PARTIAL" })).toBe("partially_paid");
	});

	it("is pending verification for NONE or isPaid false", () => {
		expect(getOrderPaymentState({ isPaid: false, chargeStatus: "NONE" })).toBe("pending_verification");
		expect(getOrderPaymentState({ isPaid: false, chargeStatus: null })).toBe("pending_verification");
		expect(getOrderPaymentState({ isPaid: null, chargeStatus: "NONE" })).toBe("pending_verification");
	});

	it("is unknown when nothing is known (public order view)", () => {
		expect(getOrderPaymentState({ isPaid: null, chargeStatus: null })).toBe("unknown");
		expect(getOrderPaymentState({})).toBe("unknown");
	});
});

describe("isUpiOrder", () => {
	it("detects the upi_qr payment method", () => {
		expect(isUpiOrder({ paymentMethodKey: "upi_qr" })).toBe(true);
		expect(isUpiOrder({ paymentMethodKey: "stripe" })).toBe(false);
		expect(isUpiOrder({ paymentMethodKey: null })).toBe(false);
		expect(isUpiOrder({})).toBe(false);
	});
});
