import { validateCrc } from "@/lib/qris/crc";
import { decodeQris } from "@/lib/qris/decode";
import { parseQris } from "@/lib/qris/parser";
import { analyzeQris } from "@/lib/qris/analyze";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const payload = body?.payload;

		if (typeof payload !== "string" || !payload.trim()) {
			return NextResponse.json(
				{ success: false, error: "Invalid payload" },
				{ status: 400 },
			);
		}

		if (payload.length > 4096) return NextResponse.json({ success: false, error: "Payload melebihi batas 4096 karakter." }, { status: 400 });
		const parsed = parseQris(payload);
		const decoded = decodeQris(parsed);
		let crc: ReturnType<typeof validateCrc>;
		try { crc = validateCrc(payload); }
		catch { crc = { provided: "Tidak tersedia", calculated: "Tidak tersedia", valid: false }; }

		return NextResponse.json({
			success: true,
			data: {
				...decoded,
				crc,
				findings: analyzeQris(payload, parsed, decoded),
				raw: payload,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Invalid QRIS payload";
		return NextResponse.json({ success: false, error: msg }, { status: 400 });
	}
}
