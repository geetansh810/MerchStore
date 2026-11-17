#!/usr/bin/env node
/**
 * Seed the Anniversary Store catalogue (categories, product types, products, variants,
 * stock, prices, a collection and — optionally — the navbar/footer menus) into Saleor.
 *
 * Idempotent: every step skips work that already exists (matched by slug or SKU), so it can be
 * re-run safely. Data lives in scripts/data/anniversary-catalog.json. PRICES THERE ARE
 * PLACEHOLDERS — confirm them with the client before pointing the channel at real traffic.
 *
 * Usage:
 *   node scripts/seed-anniversary-catalog.mjs                 # dry run (default)
 *   node scripts/seed-anniversary-catalog.mjs --apply
 *     --channel channel-inr    channel slug (default: data.channel)
 *     --token <t>              default: SALEOR_SEED_TOKEN, then SALEOR_APP_TOKEN
 *     --menus                  also replace the navbar + footer menu items (menus are GLOBAL)
 *     --update-prices          re-apply JSON prices to existing variants
 *     --reset-stock            set stock to defaultStock on existing variants
 *     --data <path>            default: scripts/data/anniversary-catalog.json
 *     --delay <ms>             pause between mutations (default 150)
 *
 * Dry run without a token validates the JSON offline and prints the plan as if Saleor were
 * empty. With a token it reads the live state and prints a diff. `--apply` needs a token.
 *
 * Token permissions (Dashboard → Apps → Local app):
 *   MANAGE_PRODUCTS                        products, variants, stock, categories, collections, listings, metadata
 *   MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES    product types, attribute values, attribute assignment
 *   MANAGE_MENUS                           only for --menus
 *   MANAGE_SHIPPING                        optional; read-only check that a zone covers IN
 *
 * The script never changes channel settings. "Allow unpaid orders", default country, warehouse
 * assignment, shipping zones and tax stay manual Dashboard steps. Images are uploaded by hand.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	emptyExistingState,
	formatPlan,
	parseSeedArgs,
	planCatalog,
	productMetadata,
	toEditorJsDescription,
	validateCatalog,
	variantsForProduct,
} from "./lib/anniversary-catalog.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_DATA_PATH = resolve(ROOT, "scripts/data/anniversary-catalog.json");

const REQUIRED_PERMISSIONS = [
	"MANAGE_PRODUCTS",
	"MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
	"MANAGE_MENUS (only for --menus)",
	"MANAGE_SHIPPING (optional, read-only shipping-zone check)",
];

// ---------------------------------------------------------------------------
// Env + HTTP helpers (same shape as scripts/seed-paid-orders.mjs)
// ---------------------------------------------------------------------------

function loadEnvFile(name) {
	const path = resolve(ROOT, name);
	try {
		for (const line of readFileSync(path, "utf8").split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eq = trimmed.indexOf("=");
			if (eq === -1) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!(key in process.env)) process.env[key] = value;
		}
	} catch {
		// optional file
	}
}

function createGqlClient(apiUrl, token) {
	return async function gql(query, variables) {
		const response = await fetch(apiUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify({ query, variables }),
		});
		const json = await response.json();
		if (json.errors?.length) {
			throw new Error(json.errors.map((e) => e.message).join("\n"));
		}
		return json.data;
	};
}

function sleep(ms) {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function assertNoMutationErrors(label, payload) {
	const errors = payload?.errors?.filter(Boolean) ?? [];
	if (errors.length > 0) {
		throw new Error(`${label}: ${errors.map((e) => e.message ?? JSON.stringify(e)).join("; ")}`);
	}
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

const CHANNEL_QUERY = /* GraphQL */ `
	query SeedChannel($slug: String!) {
		channel(slug: $slug) {
			id
			slug
			currencyCode
			warehouses {
				id
				name
			}
		}
	}
`;

const SIZE_ATTRIBUTE_QUERY = /* GraphQL */ `
	query SeedSizeAttribute($slug: String!) {
		attribute(slug: $slug) {
			id
			choices(first: 100) {
				edges {
					node {
						name
					}
				}
			}
		}
	}
`;

const PRODUCT_TYPES_QUERY = /* GraphQL */ `
	query SeedProductTypes($slugs: [String!]) {
		productTypes(first: 100, filter: { slugs: $slugs }) {
			edges {
				node {
					id
					slug
				}
			}
		}
	}
`;

const PRODUCT_FIELDS = /* GraphQL */ `
	id
	metadata {
		key
		value
	}
	channelListings {
		channel {
			slug
		}
		isPublished
		visibleInListings
		isAvailableForPurchase
	}
	variants {
		id
		sku
		stocks {
			quantity
		}
		channelListings {
			channel {
				slug
			}
			price {
				amount
			}
		}
	}
`;

/** Slugs are validated by validateCatalog (/^[a-z0-9-]+$/), so inlining them in aliases is safe. */
function aliasedLookup(prefix, field, slugs, selection) {
	return slugs.map((slug, i) => `${prefix}${i}: ${field}(slug: "${slug}") { ${selection} }`).join("\n");
}

async function readExistingState(gql, data, channelSlug) {
	const existing = emptyExistingState();

	const sizeAttribute = (await gql(SIZE_ATTRIBUTE_QUERY, { slug: data.attributes.size.slug })).attribute;
	if (sizeAttribute) {
		existing.sizeAttributeId = sizeAttribute.id;
		for (const edge of sizeAttribute.choices.edges) existing.sizeValues.add(edge.node.name);
	}

	const typeSlugs = data.productTypes.map((t) => t.slug);
	const types = (await gql(PRODUCT_TYPES_QUERY, { slugs: typeSlugs })).productTypes.edges;
	for (const { node } of types) existing.productTypes.set(node.slug, node.id);

	const categorySlugs = data.categories.map((c) => c.slug);
	const categoryData = await gql(
		`query SeedCategories { ${aliasedLookup("c", "category", categorySlugs, "id slug")} }`,
	);
	categorySlugs.forEach((slug, i) => {
		const node = categoryData[`c${i}`];
		if (node) existing.categories.set(slug, node.id);
	});

	const productSlugs = data.products.map((p) => p.slug);
	const productData = await gql(
		`query SeedProducts { ${aliasedLookup("p", "product", productSlugs, PRODUCT_FIELDS)} }`,
	);
	productSlugs.forEach((slug, i) => {
		const node = productData[`p${i}`];
		if (!node) return;
		const listing = node.channelListings?.find((l) => l.channel.slug === channelSlug);
		existing.products.set(slug, {
			id: node.id,
			listedInChannel: Boolean(
				listing?.isPublished && listing.visibleInListings && listing.isAvailableForPurchase,
			),
			metadata: new Map((node.metadata ?? []).map(({ key, value }) => [key, value])),
			variants: node.variants.map((variant) => ({
				id: variant.id,
				sku: variant.sku,
				stockQty: variant.stocks?.[0]?.quantity,
				price: variant.channelListings?.find((l) => l.channel.slug === channelSlug)?.price?.amount,
			})),
		});
	});

	const collectionData = await gql(
		`query SeedCollection($slug: String!, $channel: String) {
			collection(slug: $slug, channel: $channel) {
				id
				channelListings { channel { slug } isPublished }
				products(first: 100) { edges { node { id } } }
			}
		}`,
		{ slug: data.collection.slug, channel: channelSlug },
	);
	if (collectionData.collection) {
		const node = collectionData.collection;
		existing.collection = {
			id: node.id,
			listed: Boolean(node.channelListings?.some((l) => l.channel.slug === channelSlug && l.isPublished)),
			productIds: new Set(node.products.edges.map((edge) => edge.node.id)),
		};
	}

	return existing;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const M = {
	attributeValueCreate: /* GraphQL */ `
		mutation ($attribute: ID!, $name: String!) {
			attributeValueCreate(attribute: $attribute, input: { name: $name }) {
				errors {
					message
				}
			}
		}
	`,
	productTypeCreate: /* GraphQL */ `
		mutation ($input: ProductTypeInput!) {
			productTypeCreate(input: $input) {
				productType {
					id
				}
				errors {
					message
				}
			}
		}
	`,
	productAttributeAssign: /* GraphQL */ `
		mutation ($productTypeId: ID!, $operations: [ProductAttributeAssignInput!]!) {
			productAttributeAssign(productTypeId: $productTypeId, operations: $operations) {
				errors {
					message
				}
			}
		}
	`,
	categoryCreate: /* GraphQL */ `
		mutation ($input: CategoryInput!) {
			categoryCreate(input: $input) {
				category {
					id
				}
				errors {
					message
				}
			}
		}
	`,
	productCreate: /* GraphQL */ `
		mutation ($input: ProductCreateInput!) {
			productCreate(input: $input) {
				product {
					id
				}
				errors {
					message
				}
			}
		}
	`,
	updateMetadata: /* GraphQL */ `
		mutation ($id: ID!, $input: [MetadataInput!]!) {
			updateMetadata(id: $id, input: $input) {
				errors {
					message
				}
			}
		}
	`,
	variantBulkCreate: /* GraphQL */ `
		mutation ($product: ID!, $variants: [ProductVariantBulkCreateInput!]!) {
			productVariantBulkCreate(product: $product, variants: $variants) {
				errors {
					message
				}
			}
		}
	`,
	productChannelListingUpdate: /* GraphQL */ `
		mutation ($id: ID!, $input: ProductChannelListingUpdateInput!) {
			productChannelListingUpdate(id: $id, input: $input) {
				errors {
					message
				}
			}
		}
	`,
	variantChannelListingUpdate: /* GraphQL */ `
		mutation ($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
			productVariantChannelListingUpdate(id: $id, input: $input) {
				errors {
					message
				}
			}
		}
	`,
	variantStocksUpdate: /* GraphQL */ `
		mutation ($variantId: ID!, $stocks: [StockInput!]!) {
			productVariantStocksUpdate(variantId: $variantId, stocks: $stocks) {
				errors {
					message
				}
			}
		}
	`,
	collectionCreate: /* GraphQL */ `
		mutation ($input: CollectionCreateInput!) {
			collectionCreate(input: $input) {
				collection {
					id
				}
				errors {
					message
				}
			}
		}
	`,
	collectionChannelListingUpdate: /* GraphQL */ `
		mutation ($id: ID!, $input: CollectionChannelListingUpdateInput!) {
			collectionChannelListingUpdate(id: $id, input: $input) {
				errors {
					message
				}
			}
		}
	`,
	collectionAddProducts: /* GraphQL */ `
		mutation ($collectionId: ID!, $products: [ID!]!) {
			collectionAddProducts(collectionId: $collectionId, products: $products) {
				errors {
					message
				}
			}
		}
	`,
	menuItemDelete: /* GraphQL */ `
		mutation ($id: ID!) {
			menuItemDelete(id: $id) {
				errors {
					message
				}
			}
		}
	`,
	menuItemCreate: /* GraphQL */ `
		mutation ($input: MenuItemCreateInput!) {
			menuItemCreate(input: $input) {
				menuItem {
					id
				}
				errors {
					message
				}
			}
		}
	`,
};

const MENUS_QUERY = /* GraphQL */ `
	query SeedMenus {
		menus(first: 20, filter: { slug: ["navbar", "footer"] }) {
			edges {
				node {
					id
					slug
					items {
						id
					}
				}
			}
		}
	}
`;

const SHIPPING_ZONES_QUERY = /* GraphQL */ `
	query SeedShippingZones($channel: String!) {
		shippingZones(first: 50, channel: $channel) {
			edges {
				node {
					name
					countries {
						code
					}
				}
			}
		}
	}
`;

async function applyCatalog({ gql, data, options, channel, existing }) {
	const counts = { created: 0, updated: 0, skipped: 0 };
	const delay = () => sleep(options.delayMs);

	/** Run one mutation, log it, count it, then pause so a hosted instance isn't hammered. */
	async function step(label, kind, mutation, variables, pick) {
		const result = await gql(mutation, variables);
		const payload = Object.values(result)[0];
		assertNoMutationErrors(label, payload);
		counts[kind] += 1;
		console.log(`  ${kind === "created" ? "+" : "~"} ${label}`);
		await delay();
		return pick ? pick(payload) : payload;
	}

	const warehouse = channel.warehouses[0];
	if (channel.warehouses.length > 1) {
		console.warn(
			`Channel has ${channel.warehouses.length} warehouses (${channel.warehouses.map((w) => w.name).join(", ")}); using "${warehouse.name}".`,
		);
	}

	// 1. Size attribute values
	const sizeAttributeId = existing.sizeAttributeId;
	if (!sizeAttributeId) {
		throw new Error(
			`Attribute "${data.attributes.size.slug}" does not exist — create it in Dashboard first.`,
		);
	}
	const wantedSizes = [...new Set([...data.attributes.size.adultValues, ...data.attributes.size.kidsValues])];
	for (const value of wantedSizes) {
		if (existing.sizeValues.has(value)) {
			counts.skipped += 1;
			continue;
		}
		await step(`size value ${value}`, "created", M.attributeValueCreate, {
			attribute: sizeAttributeId,
			name: value,
		});
		existing.sizeValues.add(value);
	}

	// 2. Product types
	for (const type of data.productTypes) {
		if (existing.productTypes.has(type.slug)) {
			counts.skipped += 1;
			continue;
		}
		const id = await step(
			`product type ${type.slug}`,
			"created",
			M.productTypeCreate,
			{
				input: {
					name: type.name,
					slug: type.slug,
					hasVariants: type.hasVariants,
					isShippingRequired: true,
					kind: "NORMAL",
				},
			},
			(payload) => payload.productType.id,
		);
		existing.productTypes.set(type.slug, id);
		if (type.hasVariants) {
			await step(`assign ${type.variantAttribute} to ${type.slug}`, "updated", M.productAttributeAssign, {
				productTypeId: id,
				operations: [{ id: sizeAttributeId, type: "VARIANT", variantSelection: true }],
			});
		}
	}

	// 3. Categories
	for (const category of data.categories) {
		if (existing.categories.has(category.slug)) {
			counts.skipped += 1;
			continue;
		}
		const id = await step(
			`category ${category.slug}`,
			"created",
			M.categoryCreate,
			{
				input: {
					name: category.name,
					slug: category.slug,
					description: toEditorJsDescription(category.description ?? category.name),
				},
			},
			(payload) => payload.category.id,
		);
		existing.categories.set(category.slug, id);
	}

	// 4. Products
	const listingInput = {
		updateChannels: [
			{ channelId: channel.id, isPublished: true, visibleInListings: true, isAvailableForPurchase: true },
		],
	};
	const variantInput = (product, variant) => ({
		name: variant.name,
		sku: variant.sku,
		attributes: variant.size ? [{ id: sizeAttributeId, dropdown: { value: variant.size } }] : [],
		trackInventory: true,
		stocks: [{ warehouse: warehouse.id, quantity: data.defaultStock }],
		channelListings: [{ channelId: channel.id, price: product.price }],
	});

	for (const product of data.products) {
		let found = existing.products.get(product.slug);
		const variants = variantsForProduct(data, product);

		if (!found) {
			const id = await step(
				`product ${product.slug}`,
				"created",
				M.productCreate,
				{
					input: {
						productType: existing.productTypes.get(product.productType),
						category: existing.categories.get(product.category),
						name: product.name,
						slug: product.slug,
						description: toEditorJsDescription(product.description ?? product.name),
						metadata: productMetadata(product),
						chargeTaxes: true,
					},
				},
				(payload) => payload.product.id,
			);
			found = { id, listedInChannel: false, metadata: new Map(), variants: [] };
			existing.products.set(product.slug, found);
		} else {
			const have = found.metadata ?? new Map();
			const metadata = productMetadata(product).filter(({ key, value }) => have.get(key) !== value);
			if (metadata.length > 0) {
				await step(`metadata ${product.slug}`, "updated", M.updateMetadata, {
					id: found.id,
					input: metadata,
				});
			} else {
				counts.skipped += 1;
			}
		}

		// Saleor rejects variant channel prices until the product itself is listed in the channel.
		if (!found.listedInChannel) {
			await step(`list ${product.slug} in ${channel.slug}`, "updated", M.productChannelListingUpdate, {
				id: found.id,
				input: listingInput,
			});
		}

		const missing = variants.filter((variant) => !found.variants.some((v) => v.sku === variant.sku));
		if (missing.length > 0) {
			await step(
				`variants ${product.slug} (${missing.map((v) => v.sku).join(", ")})`,
				"created",
				M.variantBulkCreate,
				{
					product: found.id,
					variants: missing.map((variant) => variantInput(product, variant)),
				},
			);
		}

		if (options.updatePrices) {
			for (const variant of found.variants) {
				if (variant.price === product.price) continue;
				await step(`price ${variant.sku} → ${product.price}`, "updated", M.variantChannelListingUpdate, {
					id: variant.id,
					input: [{ channelId: channel.id, price: product.price }],
				});
			}
		}
		if (options.resetStock) {
			for (const variant of found.variants) {
				if (variant.stockQty === data.defaultStock) continue;
				await step(`stock ${variant.sku} → ${data.defaultStock}`, "updated", M.variantStocksUpdate, {
					variantId: variant.id,
					stocks: [{ warehouse: warehouse.id, quantity: data.defaultStock }],
				});
			}
		}
	}

	// 5. Collection
	let collection = existing.collection;
	if (!collection) {
		const id = await step(
			`collection ${data.collection.slug}`,
			"created",
			M.collectionCreate,
			{
				input: {
					name: data.collection.name,
					slug: data.collection.slug,
					description: toEditorJsDescription(data.collection.description ?? data.collection.name),
					isPublished: true,
				},
			},
			(payload) => payload.collection.id,
		);
		collection = { id, listed: false, productIds: new Set() };
	}
	if (!collection.listed) {
		await step(`list collection in ${channel.slug}`, "updated", M.collectionChannelListingUpdate, {
			id: collection.id,
			input: { addChannels: [{ channelId: channel.id, isPublished: true }] },
		});
	}
	const featuredIds = data.products
		.filter((product) => product.featured)
		.map((product) => existing.products.get(product.slug)?.id)
		.filter((id) => id && !collection.productIds.has(id));
	if (featuredIds.length > 0) {
		await step(
			`add ${featuredIds.length} featured product(s) to collection`,
			"updated",
			M.collectionAddProducts,
			{
				collectionId: collection.id,
				products: featuredIds,
			},
		);
	}

	// 6. Menus
	if (options.menus) {
		await applyMenus({ gql, data, existing, collection, step });
	}

	return counts;
}

async function applyMenus({ gql, data, existing, collection, step }) {
	console.warn(
		"WARNING: menus are global in Saleor — replacing navbar/footer changes navigation for EVERY channel.",
	);
	const menus = new Map((await gql(MENUS_QUERY)).menus.edges.map(({ node }) => [node.slug, node]));

	for (const slug of ["navbar", "footer"]) {
		const menu = menus.get(slug);
		if (!menu) {
			console.warn(`Menu "${slug}" not found — skipping.`);
			continue;
		}
		for (const item of menu.items) {
			await step(`delete ${slug} item ${item.id}`, "updated", M.menuItemDelete, { id: item.id });
		}

		const create = (name, extra) =>
			step(
				`${slug} item "${name}"`,
				"created",
				M.menuItemCreate,
				{ input: { menu: menu.id, name, ...extra } },
				(payload) => payload.menuItem.id,
			);

		if (slug === "navbar") {
			for (const category of data.categories) {
				await create(category.name, { category: existing.categories.get(category.slug) });
			}
			await create(data.collection.name, { collection: collection.id });
		} else {
			const shop = await create("Shop", {});
			for (const category of data.categories) {
				await create(category.name, { parent: shop, category: existing.categories.get(category.slug) });
			}
			const collections = await create("Collections", {});
			await create(data.collection.name, { parent: collections, collection: collection.id });
		}
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printHelp() {
	console.log(
		readFileSync(import.meta.filename, "utf8")
			.split("\n")
			.slice(1, 33)
			.map((line) => line.replace(/^ \* ?/, "").replace(/^\/\*\*$/, ""))
			.join("\n"),
	);
}

async function main() {
	loadEnvFile(".env.local");

	const options = parseSeedArgs(process.argv.slice(2), process.env);
	if (options.help) {
		printHelp();
		return;
	}

	const dataPath = options.dataPath ? resolve(process.cwd(), options.dataPath) : DEFAULT_DATA_PATH;
	const data = JSON.parse(readFileSync(dataPath, "utf8"));
	const validation = validateCatalog(data);
	if (!validation.ok) {
		console.error(`Catalog data is invalid (${dataPath}):`);
		for (const error of validation.errors) console.error(`  - ${error}`);
		process.exit(1);
	}

	const channelSlug = options.channel ?? data.channel;
	const planOptions = {
		menus: options.menus,
		updatePrices: options.updatePrices,
		resetStock: options.resetStock,
	};
	console.log(
		`Anniversary catalog: ${data.products.length} products, ${data.categories.length} categories, channel "${channelSlug}" (${options.apply ? "APPLY" : "dry run"})`,
	);
	if (data.pricesArePlaceholders) {
		console.warn("PLACEHOLDER PRICES — confirm with client before going live.");
	}

	if (!options.token) {
		if (options.apply) {
			console.error(
				[
					"--apply needs an app token, and none was found.",
					"Set SALEOR_SEED_TOKEN in .env.local (or pass --token) for an app with these permissions:",
					...REQUIRED_PERMISSIONS.map((p) => `  - ${p}`),
				].join("\n"),
			);
			process.exit(1);
		}
		console.log(
			"\nNo token (SALEOR_SEED_TOKEN / SALEOR_APP_TOKEN): offline dry run — plan assumes an EMPTY Saleor.\n",
		);
		console.log(formatPlan(planCatalog(data, emptyExistingState(), planOptions)));
		console.log("\nData is valid. Add a token to diff against the live instance.");
		return;
	}

	const apiUrl = process.env.NEXT_PUBLIC_SALEOR_API_URL;
	if (!apiUrl) {
		console.error("NEXT_PUBLIC_SALEOR_API_URL is not set (checked the environment and .env.local).");
		process.exit(1);
	}
	const gql = createGqlClient(apiUrl, options.token);

	const channel = (await gql(CHANNEL_QUERY, { slug: channelSlug })).channel;
	if (!channel) {
		console.error(`Channel "${channelSlug}" not found (or the token cannot read it).`);
		process.exit(1);
	}
	const channelProblems = [];
	if (channel.currencyCode !== "INR")
		channelProblems.push(`channel currency is ${channel.currencyCode}, expected INR`);
	if (channel.warehouses.length === 0) {
		channelProblems.push(
			`channel "${channelSlug}" has no warehouse — assign one in Dashboard → Configuration → Channels first`,
		);
	}
	if (channelProblems.length > 0) {
		for (const problem of channelProblems)
			console.error(`${options.apply ? "ABORT" : "WARNING"}: ${problem}`);
		if (options.apply) process.exit(1);
	}

	const existing = await readExistingState(gql, data, channelSlug);
	const plan = planCatalog(data, existing, planOptions);
	console.log(`\n${formatPlan(plan)}\n`);

	try {
		const zones = (await gql(SHIPPING_ZONES_QUERY, { channel: channelSlug })).shippingZones.edges;
		if (!zones.some(({ node }) => node.countries.some((country) => country.code === "IN"))) {
			console.warn(
				`WARNING: no shipping zone for ${channelSlug} covers IN — checkout will fail until one exists.`,
			);
		}
	} catch (error) {
		console.warn(`Skipped shipping-zone check (${error.message.split("\n")[0]}).`);
	}

	if (!options.apply) {
		console.log("Dry run only. Re-run with --apply to write these changes.");
		return;
	}

	const counts = await applyCatalog({ gql, data, options, channel, existing });
	console.log(`\nDone. created ${counts.created}, updated ${counts.updated}, skipped ${counts.skipped}.`);
	if (data.pricesArePlaceholders) console.warn("PLACEHOLDER PRICES — confirm with client.");
	console.log(
		"No images were uploaded: add product photos in Saleor Dashboard (the storefront shows a placeholder).",
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
