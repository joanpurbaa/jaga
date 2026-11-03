export type MerchantComparison = "match" | "different" | "unknown";

export function compareMerchant(expected: string, actual?: string): MerchantComparison {
	if (!expected.trim() || !actual?.trim()) return "unknown";
	return expected.trim().normalize("NFKC").toLocaleLowerCase("id-ID") === actual.trim().normalize("NFKC").toLocaleLowerCase("id-ID") ? "match" : "different";
}
