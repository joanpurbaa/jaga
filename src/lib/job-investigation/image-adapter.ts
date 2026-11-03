import type { InvestigationInput } from "./types.ts";

type Poster = NonNullable<InvestigationInput["poster"]>;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_POSTER_BYTES = 5 * 1024 * 1024;

export function validatePosterUpload(mimeType: string, size: number, bytes: Uint8Array): string | null {
	if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return "Format poster harus PNG, JPG, atau WebP.";
	if (size > MAX_POSTER_BYTES) return "Ukuran poster maksimal 5 MB.";
	const isPng = mimeType === "image/png" && bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
	const isJpeg = mimeType === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
	const isWebp = mimeType === "image/webp" && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
	return isPng || isJpeg || isWebp ? null : "Isi file tidak sesuai dengan format gambar yang didukung.";
}

export function toOllamaImage(poster: Poster): string {
	if (!ALLOWED_IMAGE_TYPES.has(poster.mimeType) || !poster.data || !/^[A-Za-z0-9+/]+={0,2}$/.test(poster.data)) {
		throw new Error("Data poster tidak valid atau format gambar tidak didukung.");
	}
	return poster.data;
}
