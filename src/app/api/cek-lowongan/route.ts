import { NextRequest, NextResponse } from "next/server";
import { investigateJob, OllamaError } from "@/lib/job-investigation/ollama";
import { validatePosterUpload } from "@/lib/job-investigation/image-adapter";
import type { InvestigationInput } from "@/lib/job-investigation/types";

export const maxDuration = 130;

const MAX_CAPTION_LENGTH = 15_000;
const ALLOWED_ANSWERS = new Set(["ya", "tidak", "ragu"]);
const ALLOWED_OBSERVATIONS = new Set(["bayar", "pindah", "waktu", "wawancara"]);

export async function POST(request: NextRequest) {
	const startedAt = performance.now();
	try {
		if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
			return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 415 });
		}
		const form = await request.formData();
		if (form.get("consent") !== "true") return NextResponse.json({ error: "Persetujuan analisis AI diperlukan." }, { status: 400 });
		const caption = form.get("caption");
		if (typeof caption !== "string" || caption.length > MAX_CAPTION_LENGTH) return NextResponse.json({ error: "Teks lowongan terlalu panjang (maksimal 15.000 karakter)." }, { status: 400 });
		const file = form.get("poster");
		let poster: InvestigationInput["poster"];
		let imagePreparationMs = 0;
		if (file instanceof File && file.size > 0) {
			const imageStartedAt = performance.now();
			const bytes = Buffer.from(await file.arrayBuffer());
			const validationError = validatePosterUpload(file.type, file.size, bytes);
			if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
			poster = { mimeType: file.type as NonNullable<InvestigationInput["poster"]>["mimeType"], data: bytes.toString("base64") };
			imagePreparationMs = Math.round(performance.now() - imageStartedAt);
			console.info("Job investigation upload ready", { imageBytes: bytes.length, imagePreparationMs });
		}
		if (!caption.trim() && !poster) return NextResponse.json({ error: "Masukkan teks lowongan atau unggah poster." }, { status: 400 });
		const rawObservations = form.get("observations");
		let parsedObservations: unknown = {};
		if (typeof rawObservations === "string") {
			try { parsedObservations = JSON.parse(rawObservations); }
			catch { return NextResponse.json({ error: "Format observasi tidak valid." }, { status: 400 }); }
		}
		const observations: InvestigationInput["observations"] = {};
		if (parsedObservations && typeof parsedObservations === "object" && !Array.isArray(parsedObservations)) {
			for (const [key, value] of Object.entries(parsedObservations)) if (ALLOWED_OBSERVATIONS.has(key) && ALLOWED_ANSWERS.has(String(value))) observations[key] = value as "ya" | "tidak" | "ragu";
		}
		const report = await investigateJob({ caption: caption.trim(), observations, poster }, { signal: request.signal });
		console.info("Job investigation request complete", { totalMs: Math.round(performance.now() - startedAt), imagePreparationMs, status: 200 });
		return NextResponse.json({ success: true, report }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Analisis gagal dijalankan.";
		const status = error instanceof OllamaError ? error.status : 502;
		console.warn("Job investigation request failed", { status, totalMs: Math.round(performance.now() - startedAt), errorCode: error instanceof OllamaError ? error.status : "unexpected" });
		const headers = new Headers({ "Cache-Control": "no-store" });
		return NextResponse.json({ success: false, error: message }, { status, headers });
	}
}
