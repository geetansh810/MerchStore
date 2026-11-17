import { describe, expect, it } from "vitest";

import { billingCityCountry, sanitizeOrderForClient } from "./sanitize";

const order = {
	id: "T3JkZXI6MQ==",
	number: "1042",
	userEmail: "ada@shop.example",
	shippingAddress: { streetAddress1: "1 Main", city: "Paris" },
	billingAddress: { city: "Lyon", country: { country: "France" } },
	deliveryMethod: { name: "DHL" },
	voucher: { code: "SAVE10" },
	fulfillments: [{ trackingNumber: "1Z999" }],
	isPaid: true,
	chargeStatus: "FULLY_CHARGED",
	authorizeStatus: "FULLY_AUTHORIZED",
	totalBalance: { amount: 0, currency: "EUR" },
	totalCaptured: { amount: 10, currency: "EUR" },
	upiTransactionId: "123456789012",
	paymentMethodKey: "upi_qr",
	total: { gross: { amount: 10, currency: "EUR" } },
};

describe("sanitizeOrderForClient", () => {
	it("strips PII on the public view and keeps totals", () => {
		const publicOrder = sanitizeOrderForClient(order, "public");
		expect(publicOrder.userEmail).toBeNull();
		expect(publicOrder.shippingAddress).toBeNull();
		expect(publicOrder.billingAddress).toBeNull();
		expect(publicOrder.deliveryMethod).toBeNull();
		expect(publicOrder.voucher).toBeNull();
		expect(publicOrder.fulfillments).toEqual([]);
		expect(publicOrder.isPaid).toBeNull();
		expect(publicOrder.chargeStatus).toBeNull();
		expect(publicOrder.totalCaptured).toBeNull();
		expect(publicOrder.upiTransactionId).toBeNull();
		expect(publicOrder.paymentMethodKey).toBeNull();
		expect(publicOrder.total).toEqual(order.total);
		expect(publicOrder.number).toBe("1042");
	});

	it("keeps addresses when verified but drops the voucher code", () => {
		const verified = sanitizeOrderForClient(order, "verified");
		expect(verified.userEmail).toBe("ada@shop.example");
		expect(verified.shippingAddress).toEqual(order.shippingAddress);
		expect(verified.voucher).toBeNull();
		expect(verified.upiTransactionId).toBe("123456789012");
		expect(verified.paymentMethodKey).toBe("upi_qr");
	});
});

describe("sanitizeOrderForClient personalised names", () => {
	const withLines = {
		...order,
		lines: [
			{ id: "l1", quantity: 1, personalisedName: "Asha" },
			{ id: "l2", quantity: 2, personalisedName: null },
		],
	};

	it("nulls line personalisedName on the public view", () => {
		const publicOrder = sanitizeOrderForClient(withLines, "public");
		expect(publicOrder.lines.map((line) => line.personalisedName)).toEqual([null, null]);
		expect(publicOrder.lines.map((line) => line.quantity)).toEqual([1, 2]);
	});

	it("keeps line personalisedName when verified", () => {
		const verified = sanitizeOrderForClient(withLines, "verified");
		expect(verified.lines[0]?.personalisedName).toBe("Asha");
	});

	it("does not add a lines key when the order has none", () => {
		expect("lines" in sanitizeOrderForClient(order, "public")).toBe(false);
	});
});

describe("billingCityCountry", () => {
	it("joins city and country", () => {
		expect(billingCityCountry({ city: "Lyon", country: { country: "France" } })).toBe("Lyon, France");
	});
});
