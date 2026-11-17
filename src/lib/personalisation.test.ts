import { describe, expect, it } from "vitest";
import {
	DEFAULT_PERSONALISED_NAME_MAX_LENGTH,
	LINE_PERSONALISED_NAME_KEY,
	ORDER_PERSONALISED_LINES_KEY,
	PERSONALISED_NAME_HARD_MAX_LENGTH,
	PERSONALISED_NAME_HTML_PATTERN,
	PERSONALISED_NAME_REGEX,
	buildCheckoutLineInput,
	buildPersonalisedLinesMetadata,
	normalisePersonalisedName,
	resolvePersonalisationConfig,
	validatePersonalisedName,
} from "./personalisation";

describe("resolvePersonalisationConfig", () => {
	it("returns null when personalisation is absent or unknown", () => {
		expect(resolvePersonalisationConfig({})).toBeNull();
		expect(resolvePersonalisationConfig({ personalisation: null })).toBeNull();
		expect(resolvePersonalisationConfig({ personalisation: "" })).toBeNull();
		expect(resolvePersonalisationConfig({ personalisation: "photo" })).toBeNull();
	});

	it("enables the name field, case/whitespace-insensitively", () => {
		expect(resolvePersonalisationConfig({ personalisation: "name" })).toEqual({
			kind: "name",
			maxLength: DEFAULT_PERSONALISED_NAME_MAX_LENGTH,
		});
		expect(resolvePersonalisationConfig({ personalisation: "  NAME " })?.kind).toBe("name");
	});

	it("parses and clamps the max length, falling back to the default for junk", () => {
		expect(resolvePersonalisationConfig({ personalisation: "name", maxLength: "12" })?.maxLength).toBe(12);
		expect(resolvePersonalisationConfig({ personalisation: "name", maxLength: "0" })?.maxLength).toBe(1);
		expect(resolvePersonalisationConfig({ personalisation: "name", maxLength: "500" })?.maxLength).toBe(
			PERSONALISED_NAME_HARD_MAX_LENGTH,
		);
		expect(resolvePersonalisationConfig({ personalisation: "name", maxLength: "abc" })?.maxLength).toBe(
			DEFAULT_PERSONALISED_NAME_MAX_LENGTH,
		);
		expect(resolvePersonalisationConfig({ personalisation: "name", maxLength: null })?.maxLength).toBe(
			DEFAULT_PERSONALISED_NAME_MAX_LENGTH,
		);
	});
});

describe("normalisePersonalisedName", () => {
	it("trims and collapses whitespace", () => {
		expect(normalisePersonalisedName("  Asha   Rao \n")).toBe("Asha Rao");
	});

	it("normalises to NFC", () => {
		expect(normalisePersonalisedName("Café")).toBe("Café");
	});

	it("returns an empty string for non-strings", () => {
		expect(normalisePersonalisedName(null)).toBe("");
		expect(normalisePersonalisedName(undefined)).toBe("");
		expect(normalisePersonalisedName(42)).toBe("");
		expect(normalisePersonalisedName(new File([], "x"))).toBe("");
	});
});

describe("validatePersonalisedName", () => {
	it("accepts typical names and returns the normalised value", () => {
		expect(validatePersonalisedName("A. D'Souza-Rao", 20)).toEqual({ ok: true, value: "A. D'Souza-Rao" });
		expect(validatePersonalisedName("  Asha   Rao ", 20)).toEqual({ ok: true, value: "Asha Rao" });
	});

	it("rejects empty and whitespace-only input as required", () => {
		expect(validatePersonalisedName("", 20)).toEqual({ ok: false, reason: "required" });
		expect(validatePersonalisedName("   ", 20)).toEqual({ ok: false, reason: "required" });
		expect(validatePersonalisedName(null, 20)).toEqual({ ok: false, reason: "required" });
	});

	it("rejects names over the limit", () => {
		expect(validatePersonalisedName("A".repeat(21), 20)).toEqual({ ok: false, reason: "too_long" });
		expect(validatePersonalisedName("A".repeat(20), 20).ok).toBe(true);
	});

	it("rejects digits, emoji, markup and a leading symbol", () => {
		for (const bad of ["Asha 2", "Asha 😀", "<script>", "-Asha", ".Asha", "'Asha"]) {
			expect(validatePersonalisedName(bad, 40)).toEqual({ ok: false, reason: "invalid_chars" });
		}
	});
});

describe("PERSONALISED_NAME_HTML_PATTERN parity", () => {
	const htmlRegex = new RegExp(`^(?:${PERSONALISED_NAME_HTML_PATTERN})$`, "v");
	const samples = [
		"Asha",
		"A. D'Souza-Rao",
		"Mary Ann",
		"Asha2",
		"-Asha",
		"Asha!",
		"<b>",
		"Zoë",
		"",
		" Asha",
	];

	it.each(samples)("agrees with the server regex for %j", (sample) => {
		expect(htmlRegex.test(sample)).toBe(PERSONALISED_NAME_REGEX.test(sample));
	});
});

describe("buildCheckoutLineInput", () => {
	it("omits metadata and forceNewLine without a name", () => {
		const input = buildCheckoutLineInput({ variantId: "v1" });
		expect(input).toEqual({ quantity: 1, variantId: "v1" });
		expect(input).not.toHaveProperty("metadata");
		expect(input).not.toHaveProperty("forceNewLine");
	});

	it("adds metadata and forceNewLine with a name", () => {
		expect(buildCheckoutLineInput({ variantId: "v1", quantity: 2, personalisedName: "Asha" })).toEqual({
			quantity: 2,
			variantId: "v1",
			forceNewLine: true,
			metadata: [{ key: LINE_PERSONALISED_NAME_KEY, value: "Asha" }],
		});
	});
});

describe("buildPersonalisedLinesMetadata", () => {
	const line = (personalisedName: string | null, quantity = 1) => ({
		variantId: "v1",
		sku: "AF70-MUG",
		productName: "Mug",
		quantity,
		personalisedName,
	});

	it("returns nothing when no line is personalised", () => {
		expect(buildPersonalisedLinesMetadata([line(null), line("")])).toEqual([]);
		expect(buildPersonalisedLinesMetadata([])).toEqual([]);
	});

	it("emits one JSON entry with the valid personalised lines only", () => {
		const [entry, ...rest] = buildPersonalisedLinesMetadata([line("Asha", 2), line(null), line("<b>")]);
		expect(rest).toEqual([]);
		expect(entry?.key).toBe(ORDER_PERSONALISED_LINES_KEY);
		expect(JSON.parse(entry!.value)).toEqual([
			{ variantId: "v1", sku: "AF70-MUG", productName: "Mug", name: "Asha", quantity: 2 },
		]);
	});
});
