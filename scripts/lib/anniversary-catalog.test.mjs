import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ADULT_SIZES,
	KIDS_SIZES,
	buildVariantSku,
	emptyExistingState,
	formatPlan,
	parseSeedArgs,
	planCatalog,
	productMetadata,
	toEditorJsDescription,
	validateCatalog,
	variantsForProduct,
} from "./anniversary-catalog.mjs";

const dataPath = resolve(import.meta.dirname, "../data/anniversary-catalog.json");
const load = () => JSON.parse(readFileSync(dataPath, "utf8"));

/** Existing state where every item in the catalog is already present and listed. */
function fullExistingState(data, { price, stockQty } = {}) {
	const existing = emptyExistingState();
	for (const v of [...data.attributes.size.adultValues, ...data.attributes.size.kidsValues])
		existing.sizeValues.add(v);
	for (const t of data.productTypes) existing.productTypes.set(t.slug, `type-${t.slug}`);
	for (const c of data.categories) existing.categories.set(c.slug, `cat-${c.slug}`);
	for (const p of data.products) {
		existing.products.set(p.slug, {
			id: `prod-${p.slug}`,
			listedInChannel: true,
			metadata: new Map(productMetadata(p).map(({ key, value }) => [key, value])),
			variants: variantsForProduct(data, p).map((v) => ({
				id: `var-${v.sku}`,
				sku: v.sku,
				price: price ?? p.price,
				stockQty: stockQty ?? data.defaultStock,
			})),
		});
	}
	existing.collection = {
		id: "col-1",
		listed: true,
		productIds: new Set(data.products.filter((p) => p.featured).map((p) => `prod-${p.slug}`)),
	};
	return existing;
}

describe("catalog data file", () => {
	const data = load();

	it("validates", () => {
		expect(validateCatalog(data)).toEqual({ ok: true, errors: [] });
	});

	it("has 22 products with unique slugs and SKUs", () => {
		expect(data.products).toHaveLength(22);
		expect(new Set(data.products.map((p) => p.slug)).size).toBe(22);
		const skus = data.products.flatMap((p) => variantsForProduct(data, p).map((v) => v.sku));
		expect(new Set(skus).size).toBe(skus.length);
	});

	it("features at least one product in every category", () => {
		for (const category of data.categories) {
			expect(data.products.some((p) => p.featured && p.category === category.slug)).toBe(true);
		}
	});

	it("flags placeholder prices and uses the configured size sets", () => {
		expect(data.pricesArePlaceholders).toBe(true);
		expect(data.attributes.size.adultValues).toEqual(ADULT_SIZES);
		expect(data.attributes.size.kidsValues).toEqual(KIDS_SIZES);
	});

	it("personalises exactly the mug, flask and diary", () => {
		expect(
			data.products
				.filter((p) => p.personalisation)
				.map((p) => p.slug)
				.sort(),
		).toEqual(["anniversary-coffee-flask", "anniversary-coffee-mug", "anniversary-diary"]);
	});

	it("never mentions an official emblem or insignia", () => {
		expect(JSON.stringify(data).toLowerCase()).not.toMatch(/roundel|insignia|emblem/);
	});
});

describe("validateCatalog", () => {
	const mutate = (fn) => {
		const data = load();
		fn(data);
		return validateCatalog(data);
	};
	const expectError = (result, pattern) => {
		expect(result.ok).toBe(false);
		expect(result.errors.some((e) => pattern.test(e))).toBe(true);
	};

	it("rejects duplicate product slugs and SKU stems", () => {
		expectError(
			mutate((d) => (d.products[1].slug = d.products[0].slug)),
			/duplicate product slug/,
		);
		expectError(
			mutate((d) => (d.products[1].skuStem = d.products[0].skuStem)),
			/duplicate skuStem/,
		);
	});

	it("rejects unknown category and product type references", () => {
		expectError(
			mutate((d) => (d.products[0].category = "nope")),
			/unknown category/,
		);
		expectError(
			mutate((d) => (d.products[0].productType = "nope")),
			/unknown productType/,
		);
	});

	it("requires sizes for variant types and forbids them for simple types", () => {
		expectError(
			mutate((d) => (d.products[1].sizes = [])),
			/sizes must be non-empty/,
		);
		expectError(
			mutate((d) => (d.products[0].sizes = ["M"])),
			/sizes must be empty/,
		);
		expectError(
			mutate((d) => (d.products[1].sizes = ["XXXL"])),
			/not a configured size/,
		);
	});

	it("rejects bad prices and currency", () => {
		expectError(
			mutate((d) => (d.products[0].price = 0)),
			/price must be/,
		);
		expectError(
			mutate((d) => (d.products[0].price = Number.NaN)),
			/price must be/,
		);
		expectError(
			mutate((d) => (d.currency = "USD")),
			/currency/,
		);
	});

	it("restricts personalisation to the personalised type and bounds maxLength", () => {
		expectError(
			mutate((d) => (d.products[0].personalisation = { type: "name", maxLength: 20 })),
			/only allowed on productType/,
		);
		const personalised = (d) => d.products.find((p) => p.personalisation);
		expectError(
			mutate((d) => (personalised(d).personalisation.maxLength = 0)),
			/maxLength/,
		);
		expectError(
			mutate((d) => (personalised(d).personalisation.maxLength = 41)),
			/maxLength/,
		);
		expectError(
			mutate((d) => delete personalised(d).personalisation),
			/requires a personalisation block/,
		);
	});

	it("validates the collection slug and featured count", () => {
		expectError(
			mutate((d) => (d.collection.slug = "Bad Slug")),
			/collection\.slug/,
		);
		expectError(
			mutate((d) => d.products.forEach((p) => (p.featured = false))),
			/featured/,
		);
	});
});

describe("helpers", () => {
	it("buildVariantSku", () => {
		expect(buildVariantSku("AF70", "TSHIRT", "M")).toBe("AF70-TSHIRT-M");
		expect(buildVariantSku("AF70", "KTSHIRT", "2-3Y")).toBe("AF70-KTSHIRT-2-3Y");
		expect(buildVariantSku("AF70", "CAP")).toBe("AF70-CAP");
	});

	it("toEditorJsDescription round-trips to a single paragraph", () => {
		const parsed = JSON.parse(toEditorJsDescription("Hello"));
		expect(parsed.blocks).toHaveLength(1);
		expect(parsed.blocks[0]).toMatchObject({ type: "paragraph", data: { text: "Hello" } });
	});

	it("productMetadata only for personalised products", () => {
		const data = load();
		expect(productMetadata(data.products[0])).toEqual([]);
		expect(productMetadata(data.products.find((p) => p.slug === "anniversary-coffee-mug"))).toEqual([
			{ key: "personalisation", value: "name" },
			{ key: "personalisation_max_length", value: "20" },
		]);
	});
});

describe("parseSeedArgs", () => {
	it("defaults to a dry run", () => {
		const options = parseSeedArgs([], {});
		expect(options).toMatchObject({
			apply: false,
			menus: false,
			updatePrices: false,
			resetStock: false,
			delayMs: 150,
		});
		expect(options.token).toBeNull();
	});

	it("parses flags and values", () => {
		const options = parseSeedArgs(
			[
				"--apply",
				"--menus",
				"--update-prices",
				"--reset-stock",
				"--channel",
				"c",
				"--data",
				"x.json",
				"--delay",
				"5",
			],
			{},
		);
		expect(options).toMatchObject({
			apply: true,
			menus: true,
			updatePrices: true,
			resetStock: true,
			channel: "c",
			dataPath: "x.json",
			delayMs: 5,
		});
	});

	it("prefers --token, then SALEOR_SEED_TOKEN, then SALEOR_APP_TOKEN", () => {
		const env = { SALEOR_SEED_TOKEN: "seed", SALEOR_APP_TOKEN: "app" };
		expect(parseSeedArgs(["--token", "cli"], env).token).toBe("cli");
		expect(parseSeedArgs([], env).token).toBe("seed");
		expect(parseSeedArgs([], { SALEOR_APP_TOKEN: "app" }).token).toBe("app");
	});

	it("rejects unknown flags and missing values", () => {
		expect(() => parseSeedArgs(["--wat"], {})).toThrow(/Unknown argument/);
		expect(() => parseSeedArgs(["--channel"], {})).toThrow(/requires a value/);
	});
});

describe("planCatalog", () => {
	const data = load();

	it("creates everything against an empty Saleor", () => {
		const plan = planCatalog(data, emptyExistingState());
		const count = (kind) => plan.filter((a) => a.kind === kind).length;
		expect(count("createAttributeValue")).toBe(ADULT_SIZES.length + KIDS_SIZES.length);
		expect(count("createProductType")).toBe(4);
		expect(count("createCategory")).toBe(5);
		expect(count("createProduct")).toBe(22);
		expect(count("createVariants")).toBe(22);
		expect(count("listProduct")).toBe(22);
		expect(count("createCollection")).toBe(1);
		expect(count("addToCollection")).toBe(1);
		expect(count("replaceMenu")).toBe(0);
	});

	it("is empty when everything already exists", () => {
		expect(planCatalog(data, fullExistingState(data))).toEqual([]);
	});

	it("adds only the missing pieces", () => {
		const existing = fullExistingState(data);
		existing.products.get("anniversary-t-shirt").variants.pop();
		existing.products.get("anniversary-cap").listedInChannel = false;
		existing.products.get("anniversary-coffee-mug").metadata = new Map();
		const kinds = planCatalog(data, existing).map((a) => `${a.kind}:${a.slug}`);
		expect(kinds.sort()).toEqual([
			"createVariants:anniversary-t-shirt",
			"listProduct:anniversary-cap",
			"updateMetadata:anniversary-coffee-mug",
		]);
	});

	it("only plans price and stock updates when asked", () => {
		const existing = fullExistingState(data, { price: 1, stockQty: 3 });
		expect(planCatalog(data, existing)).toEqual([]);
		const plan = planCatalog(data, existing, { updatePrices: true, resetStock: true });
		expect(plan.filter((a) => a.kind === "updatePrice")).toHaveLength(22);
		expect(plan.filter((a) => a.kind === "setStock")).toHaveLength(22);
	});

	it("plans both menus with --menus", () => {
		const plan = planCatalog(data, fullExistingState(data), { menus: true });
		expect(plan.map((a) => `${a.kind}:${a.slug}`)).toEqual(["replaceMenu:navbar", "replaceMenu:footer"]);
	});

	it("formatPlan summarises actions", () => {
		expect(formatPlan([])).toMatch(/Nothing to do/);
		expect(formatPlan(planCatalog(data, emptyExistingState()))).toMatch(/createProduct \(22\)/);
	});
});
