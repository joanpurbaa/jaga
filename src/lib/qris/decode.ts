import type { DecodedQris, ParsedQris, TLVNode } from "@/types/qris";
import { COUNTRY_MAP, CURRENCY_MAP, MCC_MAP, POINT_OF_INITIATION_MAP } from "./mapping";

export function decodeQris(parsed: ParsedQris): Omit<DecodedQris, "crc" | "raw"> {
	const get = (tag: string) => parsed.getTagValue(tag);
	let account: TLVNode | undefined;
	for (let tag = 26; tag <= 51; tag++) {
		const candidate = parsed.getTag(String(tag).padStart(2, "0"));
		if (candidate) { account = candidate; break; }
	}
	const gui = account?.children?.find((child) => child.tag === "00")?.value;
	const mcc = get("52");
	const currencyCode = get("53");
	const amount = get("54");
	const additional = parsed.getTag("62");
	const poi = get("01");
	return {
		merchantName: get("59")?.trim(), merchantCity: get("60")?.trim(), postalCode: get("61")?.trim(),
		country: get("58") ? COUNTRY_MAP[get("58")!] ?? get("58") : undefined,
		acquirerGui: gui, acquirer: undefined,
		merchantIdentifier1: account?.children?.find((child) => child.tag === "01")?.value,
		merchantIdentifier2: account?.children?.find((child) => child.tag === "02")?.value,
		merchantType: account?.children?.find((child) => child.tag === "03")?.value,
		qrisNetworkGui: parsed.getTag("51")?.children?.find((child) => child.tag === "00")?.value,
		qrisNetworkId: parsed.getTag("51")?.children?.find((child) => child.tag === "01" || child.tag === "02")?.value,
		mcc, mccDescription: mcc ? MCC_MAP[mcc] : undefined,
		terminalLabel: additional?.children?.find((child) => child.tag === "07")?.value,
		qrisType: poi ? POINT_OF_INITIATION_MAP[poi] : undefined, pointOfInitiation: poi,
		currency: currencyCode ? CURRENCY_MAP[currencyCode] ?? currencyCode : undefined,
		currencyCode, amount,
	};
}
