/**
 * Pure helpers for scripts/seed-anniversary-catalog.mjs — no network, no filesystem.
 * Everything here is unit-tested in anniversary-catalog.test.mjs.
 */

export const KIDS_SIZES = ["2-3Y", "3-4Y", "5-6Y", "7-8Y", "9-10Y", "11-12Y"];
export const ADULT_SIZES = ["S", "M", "L", "XL", "XXL"];

/** The only product type allowed to carry a `personalisation` block. */
export const PERSONALISED_PRODUCT_TYPE = "anniversary-personalised-gift";
/** Product metadata keys read by the storefront PDP (src/lib/personalisation.ts). */
export const PERSONALISATION_KEY = "personalisation";
export const PERSONALISATION_MAX_LENGTH_KEY = "personalisation_max_length";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

/**
 * @param {string[]} argv process.argv.slice(2)
 * @param {Record<string, string | undefined>} env
 */
export function parseSeedArgs(argv, env = {}) {
	const options = {
		apply: false,
		channel: null,
		token: null,
		menus: false,
		updatePrices: false,
		resetStock: false,
		dataPath: null,
		delayMs: 150,
		help: false,
	};

	const takeValue = (flag, index) => {
		const value = argv[index + 1];
		if (value === undefined || value.startsWith("--")) {
			throw new Error(`${flag} requires a value`);
		}
		return value;
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--apply":
				options.apply = true;
				break;
			case "--menus":
				options.menus = true;
				break;
			case "--update-prices":
				options.updatePrices = true;
				break;
			case "--reset-stock":
				options.resetStock = true;
				break;
			case "--help":
			case "-h":
				options.help = true;
				break;
			case "--channel":
				options.channel = takeValue(arg, i++);
				break;
			case "--token":
				options.token = takeValue(arg, i++);
				break;
			case "--data":
				options.dataPath = takeValue(arg, i++);
				break;
			case "--delay": {
				const parsed = Number.parseInt(takeValue(arg, i++), 10);
				if (!Number.isFinite(parsed) || parsed < 0) throw new Error("--delay must be a non-negative integer");
				options.delayMs = parsed;
				break;
			}
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	if (!options.token) {
		options.token = env.SALEOR_SEED_TOKEN || env.SALEOR_APP_TOKEN || null;
	}
	return options;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** @param {any} data @returns {{ ok: boolean, errors: string[] }} */
export function validateCatalog(data) {
	const errors = [];
	const err = (message) => errors.push(message);

	if (!data || typeof data !== "object") {
		return { ok: false, errors: ["Catalog data must be an object"] };
	}
	if (data.currency !== "INR") err(`currency must be "INR" (got ${JSON.stringify(data.currency)})`);
	if (typeof data.channel !== "string" || !data.channel) err("channel is required");
	if (typeof data.skuPrefix !== "string" || !/^[A-Z0-9]+$/.test(data.skuPrefix)) {
		err("skuPrefix must be upper-case alphanumeric");
	}
	if (!Number.isInteger(data.defaultStock) || data.defaultStock < 0)
		err("defaultStock must be an integer >= 0");

	const sizeCfg = data.attributes?.size;
	const sizeValues = new Set([...(sizeCfg?.adultValues ?? []), ...(sizeCfg?.kidsValues ?? [])]);
	if (!sizeCfg?.slug) err("attributes.size.slug is required");

	const types = new Map();
	for (const type of data.productTypes ?? []) {
		if (!SLUG_RE.test(type.slug ?? "")) err(`productType has an invalid slug: ${JSON.stringify(type.slug)}`);
		if (types.has(type.slug)) err(`duplicate productType slug: ${type.slug}`);
		types.set(type.slug, type);
	}

	const categories = new Set();
	for (const category of data.categories ?? []) {
		if (!SLUG_RE.test(category.slug ?? ""))
			err(`category has an invalid slug: ${JSON.stringify(category.slug)}`);
		if (categories.has(category.slug)) err(`duplicate category slug: ${category.slug}`);
		categories.add(category.slug);
	}

	if (!SLUG_RE.test(data.collection?.slug ?? "")) {
		err("collection.slug must match /^[a-z0-9-]+$/");
	}

	const slugs = new Set();
	const stems = new Set();
	let featured = 0;
	for (const product of data.products ?? []) {
		const label = product.slug ?? "(no slug)";
		if (!SLUG_RE.test(product.slug ?? ""))
			err(`product has an invalid slug: ${JSON.stringify(product.slug)}`);
		if (slugs.has(product.slug)) err(`duplicate product slug: ${product.slug}`);
		slugs.add(product.slug);
		if (!/^[A-Z0-9]+$/.test(product.skuStem ?? "")) err(`${label}: skuStem must be upper-case alphanumeric`);
		if (stems.has(product.skuStem)) err(`duplicate skuStem: ${product.skuStem}`);
		stems.add(product.skuStem);
		if (!product.name) err(`${label}: name is required`);
		if (!categories.has(product.category)) err(`${label}: unknown category "${product.category}"`);

		const type = types.get(product.productType);
		if (!type) {
			err(`${label}: unknown productType "${product.productType}"`);
		} else if (type.hasVariants) {
			if (!Array.isArray(product.sizes) || product.sizes.length === 0) {
				err(`${label}: productType "${type.slug}" has variants, so sizes must be non-empty`);
			} else {
				for (const size of product.sizes) {
					if (!sizeValues.has(size)) err(`${label}: size "${size}" is not a configured size value`);
				}
				if (new Set(product.sizes).size !== product.sizes.length) err(`${label}: duplicate sizes`);
			}
		} else if (product.sizes && product.sizes.length > 0) {
			err(`${label}: productType "${type.slug}" has no variants, so sizes must be empty`);
		}

		if (typeof product.price !== "number" || !Number.isFinite(product.price) || product.price <= 0) {
			err(`${label}: price must be a finite number > 0`);
		}
		if (product.featured) featured += 1;

		if (product.personalisation) {
			if (product.productType !== PERSONALISED_PRODUCT_TYPE) {
				err(`${label}: personalisation is only allowed on productType "${PERSONALISED_PRODUCT_TYPE}"`);
			}
			const { type: kind, maxLength } = product.personalisation;
			if (kind !== "name") err(`${label}: personalisation.type must be "name"`);
			if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 40) {
				err(`${label}: personalisation.maxLength must be an integer between 1 and 40`);
			}
		} else if (product.productType === PERSONALISED_PRODUCT_TYPE) {
			err(`${label}: productType "${PERSONALISED_PRODUCT_TYPE}" requires a personalisation block`);
		}
	}
	if (featured < 1) err("at least one product must be featured");

	return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Small builders
// ---------------------------------------------------------------------------

/** AF70 + TSHIRT + "M" → "AF70-TSHIRT-M"; "2-3Y" stays "2-3Y". */
export function buildVariantSku(prefix, stem, size) {
	const parts = [prefix, stem];
	if (size) parts.push(String(size).trim().toUpperCase().replace(/\s+/g, "-"));
	return parts.join("-");
}

/** Saleor descriptions are Editor.js JSON strings. */
export function toEditorJsDescription(text) {
	return JSON.stringify({
		time: 0,
		blocks: [{ id: "p1", type: "paragraph", data: { text } }],
		version: "2.24.3",
	});
}

/** Product metadata consumed by the storefront PDP. Empty for non-personalised products. */
export function productMetadata(product) {
	if (!product.personalisation) return [];
	return [
		{ key: PERSONALISATION_KEY, value: product.personalisation.type },
		{ key: PERSONALISATION_MAX_LENGTH_KEY, value: String(product.personalisation.maxLength) },
	];
}

/** Variant rows for a product: one per size, or a single default variant. */
export function variantsForProduct(data, product) {
	const sizes = product.sizes?.length ? product.sizes : [null];
	return sizes.map((size) => ({
		size,
		name: size ?? product.name,
		sku: buildVariantSku(data.skuPrefix, product.skuStem, size),
	}));
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/** Existing-state shape for a Saleor with none of our data (also used for the offline dry run). */
export function emptyExistingState() {
	return {
		sizeValues: new Set(),
		productTypes: new Map(),
		categories: new Map(),
		collection: null,
		products: new Map(),
		menus: new Map(),
	};
}

/**
 * Diff the catalog JSON against what already exists in Saleor.
 *
 * existing = {
 *   sizeValues: Set<string>,
 *   productTypes: Map<slug, id>,
 *   categories: Map<slug, id>,
 *   collection: { id, listed: boolean, productIds: Set<string> } | null,
 *   products: Map<slug, { id, listedInChannel: boolean, metadata?: Map<string,string>,
 *                         variants: { id, sku, stockQty?: number, price?: number }[] }>,
 * }
 *
 * @returns {{ kind: string, slug: string, detail: string }[]}
 */
export function planCatalog(data, existing, options = {}) {
	const actions = [];
	const add = (kind, slug, detail = "") => actions.push({ kind, slug, detail });

	const wanted = [...data.attributes.size.adultValues, ...data.attributes.size.kidsValues];
	for (const value of [...new Set(wanted)]) {
		if (!existing.sizeValues.has(value))
			add("createAttributeValue", `size:${value}`, `size value "${value}"`);
	}

	for (const type of data.productTypes) {
		if (!existing.productTypes.has(type.slug)) {
			add(
				"createProductType",
				type.slug,
				type.hasVariants
					? `${type.name} (variants by ${type.variantAttribute})`
					: `${type.name} (no variants)`,
			);
		}
	}

	for (const category of data.categories) {
		if (!existing.categories.has(category.slug)) add("createCategory", category.slug, category.name);
	}

	for (const product of data.products) {
		const variants = variantsForProduct(data, product);
		const found = existing.products.get(product.slug);

		if (!found) {
			add("createProduct", product.slug, `${product.name} → ${product.category}`);
			add(
				"createVariants",
				product.slug,
				`${variants.length} variant(s) @ ${data.currency} ${product.price}, stock ${data.defaultStock}`,
			);
			add("listProduct", product.slug, `publish in ${data.channel}`);
			continue;
		}

		const wantedMetadata = productMetadata(product);
		const have = found.metadata ?? new Map();
		if (wantedMetadata.some(({ key, value }) => have.get(key) !== value)) {
			add(
				"updateMetadata",
				product.slug,
				wantedMetadata.map(({ key, value }) => `${key}=${value}`).join(", "),
			);
		}

		const missing = variants.filter((variant) => !found.variants.some((v) => v.sku === variant.sku));
		if (missing.length > 0) {
			add(
				"createVariants",
				product.slug,
				`${missing.length} missing variant(s): ${missing.map((v) => v.sku).join(", ")}`,
			);
		}
		if (!found.listedInChannel) add("listProduct", product.slug, `publish in ${data.channel}`);

		if (options.updatePrices) {
			const stale = found.variants.filter((v) => v.price !== product.price);
			if (stale.length > 0)
				add("updatePrice", product.slug, `${stale.length} variant(s) → ${data.currency} ${product.price}`);
		}
		if (options.resetStock) {
			const stale = found.variants.filter((v) => v.stockQty !== data.defaultStock);
			if (stale.length > 0)
				add("setStock", product.slug, `${stale.length} variant(s) → ${data.defaultStock}`);
		}
	}

	const collection = existing.collection;
	if (!collection) {
		add("createCollection", data.collection.slug, data.collection.name);
	}
	if (!collection || !collection.listed) {
		add("listCollection", data.collection.slug, `publish in ${data.channel}`);
	}
	const featured = data.products.filter((product) => product.featured);
	const toAdd = featured.filter((product) => {
		if (!collection) return true;
		const id = existing.products.get(product.slug)?.id;
		return !id || !collection.productIds.has(id);
	});
	if (toAdd.length > 0) {
		add(
			"addToCollection",
			data.collection.slug,
			`${toAdd.length} featured product(s): ${toAdd.map((p) => p.slug).join(", ")}`,
		);
	}

	if (options.menus) {
		add("replaceMenu", "navbar", `${data.categories.length} categories + ${data.collection.name}`);
		add("replaceMenu", "footer", `Shop (${data.categories.length}) + Collections (1)`);
	}

	return actions;
}

/** Group actions by kind into a readable summary. */
export function formatPlan(actions) {
	if (actions.length === 0) return "Nothing to do — Saleor already matches the catalog data.";

	const byKind = new Map();
	for (const action of actions) {
		if (!byKind.has(action.kind)) byKind.set(action.kind, []);
		byKind.get(action.kind).push(action);
	}

	const lines = [];
	for (const [kind, group] of byKind) {
		lines.push(`${kind} (${group.length})`);
		for (const action of group) {
			lines.push(`  - ${action.slug}${action.detail ? `: ${action.detail}` : ""}`);
		}
	}
	lines.push("", `Total: ${actions.length} action(s) across ${byKind.size} kind(s)`);
	return lines.join("\n");
}
