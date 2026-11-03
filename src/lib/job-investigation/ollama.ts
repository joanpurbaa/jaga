import { SCAM_INDICATORS } from "./score.ts";
import { buildValidatedReport } from "./score.ts";
import { toOllamaImage } from "./image-adapter.ts";
import { validateLocalAnalysis, type LocalAnalysis } from "./response-validator.ts";
import type { EvidenceKind, InvestigationInput, InvestigationReport } from "./types.ts";

type OllamaResponse = {
	message?: { role?: string; content?: string; thinking?: string };
	done?: boolean;
	done_reason?: string;
	eval_count?: number;
	prompt_eval_count?: number;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_duration?: number;
	eval_duration?: number;
	error?: string;
};

const DEFAULT_MODEL = "qwen3-vl:4b-thinking-q4_K_M";
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120_000;
const CONTEXT_LENGTH = Number(process.env.OLLAMA_NUM_CTX) || 8_192;
const MAX_OUTPUT_TOKENS = 2_048;
let inferenceInProgress = false;

export class OllamaError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
		this.name = "OllamaError";
	}
}

type OllamaDependencies = { fetcher?: typeof fetch; signal?: AbortSignal };

export async function investigateJob(input: InvestigationInput, dependencies: OllamaDependencies = {}): Promise<InvestigationReport> {
	const baseUrl = getOllamaBaseUrl();
	if (inferenceInProgress) throw new OllamaError(429, "Analisis lokal sedang memproses permintaan lain. Tunggu sebentar lalu coba lagi.");
	const totalStartedAt = performance.now();
	const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
	const fetcher = dependencies.fetcher ?? fetch;
	const observations = Object.entries(input.observations).map(([key, value]) => `${key}: ${value}`).join("\n") || "Tidak ada observasi";
	const userContent = `Analisis caption, observasi, dan gambar poster terlampir. Ekstrak detail lowongan dan kontak. Daftarkan temuan dengan kutipan bukti yang tampak. Pisahkan fakta dan dugaan. Desain sederhana bukan bukti scam; data kosong bukan indikasi scam. Tanpa verifikasi internet, perusahaan unknown. Nilai lima faktor company/recruiter/process/job/poster. Risk score bukan probabilitas. Batasi ringkasan dan alasan, jangan menyalin seluruh poster. Balas JSON saja sesuai struktur. /no_think\nCAPTION: ${JSON.stringify(input.caption || "Tidak disediakan")}\nOBSERVASI: ${JSON.stringify(observations)}${input.poster ? "\nGambar poster terlampir." : "\nTanpa poster; nyatakan ekstraksi visual tidak tersedia."}`;
	const systemContent = `Kamu menganalisis lowongan kerja Indonesia. Jangan mengarang. Data yang tidak terlihat: "Tidak tersedia". Hanya JSON valid, tanpa reasoning. Struktur: {"riskLevel":"low|medium|high","riskScore":0,"summary":"","extractedData":{"companyName":"","position":"","jobDescription":"","requirements":"","location":"","workSystem":"","salary":"","companyAddress":"","recruitmentEmail":"","recruiterPhone":"","recruiterName":"","website":"","upfrontPayment":"","applicationLink":"","deadline":"","additional":""},"visualAnalysis":{"summary":"","extractedText":"","observations":[{"indicator":"","result":""}]},"findings":[{"kind":"fact|suspicion","indicator":"","status":"detected|not_detected|unknown","explanation":"","evidence":""}],"factorAssessments":[{"category":"company|recruiter|process|job|poster","value":0,"reasoning":"","evidence":""}],"evidence":[{"target":"","quote":""}],"recommendations":[],"limitations":[]}. Isi lima faktor tepat satu kali.`;
	const rawPrompt = `<|im_start|>system\n${systemContent}<|im_end|>\n<|im_start|>user\n${userContent}<|im_end|>\n<|im_start|>assistant\n`;
	const userMessage: { role: "user"; content: string; images?: string[] } = { role: "user", content: rawPrompt };
	if (input.poster) userMessage.images = [toOllamaImage(input.poster)];
	inferenceInProgress = true;
	const controller = new AbortController();
	const abortFromClient = () => controller.abort();
	if (dependencies.signal?.aborted) controller.abort();
	else dependencies.signal?.addEventListener("abort", abortFromClient, { once: true });
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const requestStartedAt = performance.now();
	try {
		const response = await fetcher(`${baseUrl}/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			signal: controller.signal,
			body: JSON.stringify({
				model,
				messages: [
					userMessage,
					{ role: "assistant", content: "<think>\n\n</think>\n\n" },
				],
				raw: true,
				stream: false,
				think: false,
				format: "json",
				keep_alive: "10m",
				options: { num_ctx: CONTEXT_LENGTH, num_predict: MAX_OUTPUT_TOKENS, temperature: 0.1 },
			}),
		});
		const payload = await response.json().catch(() => ({})) as OllamaResponse;
		if (!response.ok) {
			console.warn("Ollama job analysis failed", { model, status: response.status, requestMs: Math.round(performance.now() - requestStartedAt), totalMs: Math.round(performance.now() - totalStartedAt) });
			throw ollamaResponseError(response.status, payload.error, model);
		}
		if (payload.done_reason === "length") {
			console.warn("Ollama response reached token limit", { model, evalCount: payload.eval_count, contentCharacters: payload.message?.content?.length ?? 0, hiddenThinkingCharacters: payload.message?.thinking?.length ?? 0 });
			throw new OllamaError(502, "Analisis lokal terpotong karena batas token. Coba lagi dengan caption yang lebih ringkas.");
		}
		const content = payload.message?.content?.trim();
		if (!content) throw new OllamaError(502, "Ollama tidak memberikan laporan akhir. Reasoning internal tidak ditampilkan.");
		const parseStartedAt = performance.now();
		let parsed: unknown;
		try { parsed = parseReportJson(content); }
		catch { throw new OllamaError(502, "Respons Ollama bukan JSON laporan yang valid. Coba lagi dengan input lebih ringkas."); }
		if (!validateLocalAnalysis(parsed)) throw new OllamaError(502, "Struktur laporan dari model lokal tidak lengkap atau tidak valid.");
		const report = normalizeLocalAnalysis(parsed, input, observations);
		const durationMs = (duration?: number) => typeof duration === "number" ? Math.round(duration / 1_000_000) : undefined;
		console.info("Ollama job analysis complete", {
			model,
			status: response.status,
			imageBytes: input.poster ? Math.round(input.poster.data.length * 3 / 4) : 0,
			requestMs: Math.round(performance.now() - requestStartedAt),
			modelLoadMs: durationMs(payload.load_duration),
			promptEvalMs: durationMs(payload.prompt_eval_duration),
			inferenceMs: durationMs(payload.eval_duration),
		totalModelMs: durationMs(payload.total_duration),
			promptTokens: payload.prompt_eval_count,
			outputTokens: payload.eval_count,
			jsonParseMs: Math.round(performance.now() - parseStartedAt),
			totalMs: Math.round(performance.now() - totalStartedAt),
		});
		return report;
	} catch (error) {
		if (error instanceof OllamaError) throw error;
		if (error instanceof Error && error.name === "AbortError") {
			if (dependencies.signal?.aborted) throw new OllamaError(499, "Analisis dibatalkan oleh pengguna.");
			throw new OllamaError(504, `Analisis Ollama lokal melewati batas waktu ${Math.round(REQUEST_TIMEOUT_MS / 1000)} detik.`);
		}
		console.warn("Ollama job analysis transport error", { model, requestMs: Math.round(performance.now() - requestStartedAt), totalMs: Math.round(performance.now() - totalStartedAt) });
		if (error instanceof TypeError) throw new OllamaError(503, `Layanan Ollama tidak dapat dihubungi melalui tunnel di ${baseUrl}. Pastikan Cloudflare Tunnel dan Ollama aktif.`);
		throw error;
	} finally {
		clearTimeout(timeout);
		dependencies.signal?.removeEventListener("abort", abortFromClient);
		inferenceInProgress = false;
	}
}

function normalizeLocalAnalysis(analysis: LocalAnalysis, input: InvestigationInput, observations: string): InvestigationReport {
	const evidenceKindFor = (quote: string): EvidenceKind => {
		if (!quote) return "none";
		if (input.caption.toLocaleLowerCase().includes(quote.toLocaleLowerCase())) return "caption";
		if (observations.toLocaleLowerCase().includes(quote.toLocaleLowerCase())) return "observation";
		if (input.poster && analysis.visualAnalysis.extractedText.toLocaleLowerCase().includes(quote.toLocaleLowerCase())) return "poster";
		return "none";
	};
	const evidenceFor = (target: string, fallback = "") => analysis.evidence.find((item) => item.target === target)?.quote || fallback;
	const extractedKeys = ["companyAddress", "recruitmentEmail", "recruiterPhone", "recruiterName", "salary", "requirements", "jobDescription", "upfrontPayment", "applicationLink", "deadline", "additional"] as const;
	const extracted = Object.fromEntries(extractedKeys.map((key) => {
		const value = analysis.extractedData[key];
		const evidence = evidenceFor(key);
		return [key, { value, evidence, evidenceKind: evidenceKindFor(evidence), sourceIndexes: [] }];
	}));
	const findings = analysis.findings.map((finding) => ({
		indicator: finding.indicator,
		status: finding.status,
		explanation: `${finding.kind === "fact" ? "Fakta pada input. " : "Indikasi yang perlu diperiksa. "}${finding.explanation}`,
		evidence: finding.evidence,
		evidenceKind: evidenceKindFor(finding.evidence),
		sourceIndexes: [],
	}));
	const evidencedSuspicionQuotes = new Set(analysis.findings
		.filter((finding) => finding.kind === "suspicion" && finding.status === "detected" && evidenceKindFor(finding.evidence) !== "none")
		.map((finding) => finding.evidence));
	const indicators = SCAM_INDICATORS.map((name) => {
		const finding = analysis.findings.find((item) => item.indicator.toLocaleLowerCase() === name.toLocaleLowerCase());
		return { name, status: finding?.status ?? "unknown", explanation: finding?.explanation ?? "Belum ada bukti yang cukup.", evidence: finding?.evidence ?? "", evidenceKind: evidenceKindFor(finding?.evidence ?? ""), sourceIndexes: [] };
	});
	const raw = {
		companyName: analysis.extractedData.companyName,
		position: analysis.extractedData.position,
		location: analysis.extractedData.location,
		extracted,
		companyStatus: "unknown",
		companySummary: analysis.summary,
		website: "Tidak tersedia",
		recruiterIdentity: analysis.extractedData.recruiterName,
		posterAnalysis: { summary: analysis.visualAnalysis.summary, extractedText: analysis.visualAnalysis.extractedText, observations: analysis.visualAnalysis.observations.map((item) => ({ ...item, confidence: "low" })) },
		findings,
		indicators,
		factors: analysis.factorAssessments.map((factor) => {
			const supportedRisk = evidenceKindFor(factor.evidence) !== "none" && evidencedSuspicionQuotes.has(factor.evidence);
			return { category: factor.category, value: supportedRisk ? factor.value : 0, evidence: supportedRisk ? factor.evidence : "", evidenceKind: supportedRisk ? evidenceKindFor(factor.evidence) : "none", sourceIndexes: [], reasoning: factor.reasoning };
		}),
		confidence: "low",
		coverageExplanation: "Penilaian hanya menggunakan teks dan poster yang dikirim; tidak ada verifikasi eksternal.",
		recommendations: analysis.recommendations,
		limitations: [...analysis.limitations, "Perusahaan dan kontak tidak diverifikasi melalui internet."],
	};
	const report = buildValidatedReport(raw, [], `${input.caption}\n${observations}\n${analysis.visualAnalysis.extractedText}`, Boolean(input.poster), false);
	const supportedEvidence = analysis.evidence.filter((item) => item.quote.trim()).map((item) => ({ finding: item.target, evidence: item.quote, evidenceKind: evidenceKindFor(item.quote) }));
	return {
		...report,
		posterAnalysis: input.poster ? report.posterAnalysis : null,
		evidence: supportedEvidence.filter((item) => item.evidenceKind !== "none"),
		extractedData: analysis.extractedData,
	};
}

export function getOllamaBaseUrl(): string {
	const configured = process.env.OLLAMA_BASE_URL?.trim();
	if (!configured) {
		throw new OllamaError(500, "OLLAMA_BASE_URL belum dikonfigurasi pada environment variable.");
	}
	try {
		const url = new URL(configured);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error("Protokol harus http: atau https:");
		}
		if (!url.hostname) {
			throw new Error("Hostname tidak valid");
		}
		return url.toString().replace(/\/+$/, "");
	} catch (error) {
		const detail = error instanceof Error ? error.message : "Format URL tidak valid";
		throw new OllamaError(500, `OLLAMA_BASE_URL tidak valid (${detail}).`);
	}
}

function parseReportJson(content: string): unknown {
	const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	try { return JSON.parse(cleaned); } catch { /* Try JSON embedded in a short wrapper. */ }
	for (let start = content.indexOf("{"); start >= 0; start = content.indexOf("{", start + 1)) {
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let index = start; index < content.length; index++) {
			const char = content[index];
			if (inString) {
				if (escaped) escaped = false;
				else if (char === "\\") escaped = true;
				else if (char === '"') inString = false;
				continue;
			}
			if (char === '"') inString = true;
			else if (char === "{") depth++;
			else if (char === "}" && --depth === 0) {
				try { return JSON.parse(content.slice(start, index + 1)); } catch { break; }
			}
		}
	}
	throw new Error("No valid JSON report found.");
}

function ollamaResponseError(status: number, detail: string | undefined, model: string): OllamaError {
	if (status === 404) return new OllamaError(503, `Model ${model} belum tersedia di Ollama. Jalankan: ollama pull ${model}`);
	if (status === 502) return new OllamaError(502, "Cloudflare Tunnel tidak dapat terhubung ke instance Ollama lokal (502 Bad Gateway). Pastikan Ollama aktif di perangkat lokal.");
	if (status === 504) return new OllamaError(504, "Koneksi ke Ollama melalui Cloudflare Tunnel mengalami batas waktu (504 Gateway Timeout).");
	if (status === 403) return new OllamaError(502, "Akses ke Ollama melalui Cloudflare Tunnel ditolak (403 Forbidden). Pastikan konfigurasi tunnel mengizinkan host.");
	if (status === 530) return new OllamaError(502, "Cloudflare Tunnel tidak aktif atau host tunnel tidak ditemukan (530).");
	if (status === 400 || status === 422) return new OllamaError(422, `Ollama menolak permintaan atau gambar${detail ? `: ${detail.slice(0, 240)}` : ". Periksa format gambar dan model."}`);
	if (status >= 500) return new OllamaError(502, `Ollama gagal memproses gambar atau menghasilkan laporan${detail ? `: ${detail.slice(0, 240)}` : ". Pastikan model vision tersedia dan coba lagi."}`);
	return new OllamaError(502, `Layanan Ollama mengembalikan HTTP ${status}${detail ? `: ${detail.slice(0, 240)}` : "."}`);
}
