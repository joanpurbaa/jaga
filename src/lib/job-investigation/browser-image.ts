export type PosterPreprocessResult = {
	file: File;
	width: number;
	height: number;
	originalBytes: number;
	durationMs: number;
	processed: boolean;
};

const MAX_DIMENSION = 1_600;
const COMPRESS_ABOVE_BYTES = 1_000_000;

export async function preprocessPoster(file: File): Promise<PosterPreprocessResult> {
	const startedAt = performance.now();
	try {
		const bitmap = await createImageBitmap(file);
		try {
			const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
			const width = Math.max(1, Math.round(bitmap.width * scale));
			const height = Math.max(1, Math.round(bitmap.height * scale));
			const needsResize = scale < 1;
			const needsCompression = file.size > COMPRESS_ABOVE_BYTES;
			if (!needsResize && !needsCompression) {
				return { file, width, height, originalBytes: file.size, durationMs: performance.now() - startedAt, processed: false };
			}

			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext("2d", { alpha: false });
			if (!context) throw new Error("Canvas tidak tersedia");
			context.fillStyle = "#ffffff";
			context.fillRect(0, 0, width, height);
			context.drawImage(bitmap, 0, 0, width, height);
			const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.92));
			if (!blob || (!needsResize && blob.size >= file.size)) {
				return { file, width: bitmap.width, height: bitmap.height, originalBytes: file.size, durationMs: performance.now() - startedAt, processed: false };
			}
			const mimeType = blob.type === "image/webp" ? "image/webp" : "image/png";
			const extension = mimeType === "image/webp" ? "webp" : "png";
			const output = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: mimeType, lastModified: file.lastModified });
			return { file: output, width, height, originalBytes: file.size, durationMs: performance.now() - startedAt, processed: true };
		} finally {
			bitmap.close();
		}
	} catch {
		return { file, width: 0, height: 0, originalBytes: file.size, durationMs: performance.now() - startedAt, processed: false };
	}
}
