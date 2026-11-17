import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { anniversaryCampaign, anniversaryLabel, formatOrdinal } from "./campaign";

describe("formatOrdinal", () => {
	it.each([
		[1, "1st"],
		[2, "2nd"],
		[3, "3rd"],
		[4, "4th"],
		[10, "10th"],
		[11, "11th"],
		[12, "12th"],
		[13, "13th"],
		[21, "21st"],
		[22, "22nd"],
		[70, "70th"],
		[101, "101st"],
		[111, "111th"],
	])("formats %i as %s", (n, expected) => {
		expect(formatOrdinal(n)).toBe(expected);
	});
});

describe("anniversary campaign", () => {
	it("derives the label from the years", () => {
		expect(anniversaryLabel).toBe("70th Anniversary");
	});

	it("keeps the collection slug in sync with the catalog seed data", () => {
		const data = JSON.parse(
			readFileSync(join(process.cwd(), "scripts/data/anniversary-catalog.json"), "utf8"),
		) as { collection: { slug: string } };
		expect(anniversaryCampaign.collectionSlug).toBe(data.collection.slug);
	});
});
