import type { ParsedQris, TLVNode } from "@/types/qris";

const TEMPLATE_TAGS = new Set(["26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "62", "64"]);

function parseLevel(data: string, nested = false): TLVNode[] {
	const nodes: TLVNode[] = [];
	let offset = 0;
	while (offset < data.length) {
		if (offset + 4 > data.length) throw new Error("Struktur TLV terpotong pada header field.");
		const tag = data.slice(offset, offset + 2);
		const lengthText = data.slice(offset + 2, offset + 4);
		if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) throw new Error("Tag atau panjang field TLV tidak valid.");
		const length = Number(lengthText);
		const valueStart = offset + 4;
		const valueEnd = valueStart + length;
		if (valueEnd > data.length) throw new Error(`Panjang field ${tag} melebihi sisa payload.`);
		const value = data.slice(valueStart, valueEnd);
		const node: TLVNode = { tag, length, value };
		if (!nested && TEMPLATE_TAGS.has(tag) && value.length > 0) node.children = parseLevel(value, true);
		nodes.push(node);
		offset = valueEnd;
		if (!nested && tag === "63" && offset !== data.length) throw new Error("Ada data setelah field CRC.");
	}
	return nodes;
}

export function parseQris(payload: string): ParsedQris {
	const trimmed = payload.trim();
	if (!trimmed) throw new Error("Payload QRIS kosong.");
	const root = parseLevel(trimmed);
	const all = root.flatMap(function flatten(node): TLVNode[] { return [node, ...(node.children ?? []).flatMap(flatten)]; });
	const map = new Map<string, TLVNode>();
	for (const node of root) {
		if (map.has(node.tag)) throw new Error(`Field ${node.tag} muncul lebih dari sekali.`);
		map.set(node.tag, node);
	}
	return { root, getTag: (tag) => map.get(tag), getTagValue: (tag) => map.get(tag)?.value, find: (tag) => all.filter((node) => node.tag === tag) };
}

export function getChildValue(parent: TLVNode | undefined, childTag: string): string | undefined {
	return parent?.children?.find((child) => child.tag === childTag)?.value;
}
