import test from "node:test";
import assert from "node:assert/strict";
import { investigateJob, OllamaError, getOllamaBaseUrl } from "../src/lib/job-investigation/ollama.ts";
import { toOllamaImage, validatePosterUpload } from "../src/lib/job-investigation/image-adapter.ts";

process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "https://test-tunnel.example.com";
process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3-vl:4b-thinking-q4_K_M";

const report = {
	riskLevel: "high", riskScore: 82, summary: "Poster meminta biaya administrasi.",
	extractedData: {
		companyName: "PT Contoh", position: "Admin", jobDescription: "Tidak tersedia", requirements: "Tidak tersedia",
		location: "Jakarta", workSystem: "Tidak tersedia", salary: "Tidak tersedia", companyAddress: "Tidak tersedia",
		recruitmentEmail: "Tidak tersedia", recruiterPhone: "Tidak tersedia", recruiterName: "Tidak tersedia", website: "Tidak tersedia",
		upfrontPayment: "Rp100.000", applicationLink: "Tidak tersedia", deadline: "Tidak tersedia", additional: "Tidak tersedia",
	},
	visualAnalysis: { summary: "Poster lowongan", extractedText: "PT Contoh mencari Admin. Biaya administrasi Rp100.000", observations: [] },
	findings: [{ kind: "suspicion", indicator: "Biaya di muka", status: "detected", explanation: "Poster meminta biaya administrasi.", evidence: "Biaya administrasi Rp100.000" }],
	factorAssessments: [
		{ category: "company", value: 0, reasoning: "Tidak tersedia.", evidence: "" },
		{ category: "recruiter", value: 0, reasoning: "Tidak tersedia.", evidence: "" },
		{ category: "process", value: 82, reasoning: "Biaya administrasi diminta.", evidence: "Biaya administrasi Rp100.000" },
		{ category: "job", value: 0, reasoning: "Tidak tersedia.", evidence: "" },
		{ category: "poster", value: 0, reasoning: "Desain tidak menjadi bukti.", evidence: "" },
	],
	evidence: [{ target: "upfrontPayment", quote: "Biaya administrasi Rp100.000" }, { target: "Biaya di muka", quote: "Biaya administrasi Rp100.000" }],
	recommendations: ["Jangan membayar sebelum memverifikasi proses."], limitations: [],
};
const input = { caption: "Lowongan admin", observations: {}, poster: { mimeType: "image/png", data: "aW1hZ2U=" } };
const ok = (body = { message: { role: "assistant", content: JSON.stringify(report), thinking: "PRIVATE_REASONING" }, done: true, done_reason: "stop" }) => new Response(JSON.stringify(body), { status: 200 });
function mockFetch(response) {
	const calls = [];
	return { calls, fetcher: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return typeof response === "function" ? response(url, init) : response; } };
}

test("sends poster base64 to local Ollama chat and only returns final structured content", async () => {
	const mock = mockFetch(ok());
	const result = await investigateJob(input, { fetcher: mock.fetcher });
	assert.equal(mock.calls.length, 1);
	assert.equal(mock.calls[0].url, `${getOllamaBaseUrl()}/api/chat`);
	assert.equal(mock.calls[0].body.model, "qwen3-vl:4b-thinking-q4_K_M");
	assert.deepEqual(mock.calls[0].body.messages[0].images, ["aW1hZ2U="]);
	assert.match(mock.calls[0].body.messages[0].content, /<\|im_start\|>system/);
	assert.match(mock.calls[0].body.messages[1].content, /<think>/);
	assert.equal(mock.calls[0].body.stream, false);
	assert.equal(mock.calls[0].body.think, false);
	assert.equal(mock.calls[0].body.raw, true);
	assert.equal(mock.calls[0].body.options.num_ctx, 8_192);
	assert.equal(mock.calls[0].body.options.num_predict, 2_048);
	assert.equal(mock.calls[0].body.options.temperature, 0.1);
	assert.equal(mock.calls[0].body.format, "json");
	assert.equal(mock.calls[0].body.keep_alive, "10m");
	assert.equal(mock.calls[0].body.messages[0].content.includes("Gambar poster terlampir."), true);
	assert.equal(mock.calls[0].body.messages[0].content.includes("/no_think"), true);
	assert.equal("Authorization" in mock.calls[0].init.headers, false);
	assert.equal(result.companyName, "PT Contoh");
	assert.equal(result.riskScore >= 0 && result.riskScore <= 100, true);
	assert.ok(["low", "medium", "high"].includes(result.riskLevel));
	assert.equal(result.riskCategory, "insufficient");
	assert.equal(result.findings[0].evidence, "Biaya administrasi Rp100.000");
	assert.equal(result.extractedData.upfrontPayment, "Rp100.000");
	assert.equal(JSON.stringify(result).includes("PRIVATE_REASONING"), false);
});

test("rejects concurrent heavy inference and releases its slot after completion", async () => {
	let resolveRequest;
	const firstMock = mockFetch(() => new Promise((resolve) => { resolveRequest = resolve; }));
	const firstRequest = investigateJob(input, { fetcher: firstMock.fetcher });
	await new Promise((resolve) => setImmediate(resolve));
	const secondMock = mockFetch(ok());
	await assert.rejects(investigateJob(input, { fetcher: secondMock.fetcher }), (error) => error instanceof OllamaError && error.status === 429);
	assert.equal(secondMock.calls.length, 0);
	resolveRequest(ok());
	await firstRequest;
	await investigateJob(input, { fetcher: secondMock.fetcher });
	assert.equal(secondMock.calls.length, 1);
});

test("uses OLLAMA_BASE_URL and OLLAMA_MODEL from env and rejects if missing or invalid without fallback to localhost", async () => {
	const initialUrl = process.env.OLLAMA_BASE_URL;
	const initialModel = process.env.OLLAMA_MODEL;

	process.env.OLLAMA_BASE_URL = "https://custom-tunnel.example.com/";
	process.env.OLLAMA_MODEL = "qwen3-vl:4b-thinking-q4_K_M";
	const mock = mockFetch(ok());
	await investigateJob({ caption: "teks", observations: {} }, { fetcher: mock.fetcher });
	assert.equal(mock.calls[0].url, "https://custom-tunnel.example.com/api/chat");

	// Missing env: must reject and NOT fallback to localhost
	delete process.env.OLLAMA_BASE_URL;
	await assert.rejects(
		investigateJob({ caption: "teks", observations: {} }, { fetcher: mock.fetcher }),
		(error) => error instanceof OllamaError && error.status === 500 && /belum dikonfigurasi/.test(error.message)
	);

	// Invalid protocol: must reject
	process.env.OLLAMA_BASE_URL = "ftp://invalid-protocol.com";
	await assert.rejects(
		investigateJob({ caption: "teks", observations: {} }, { fetcher: mock.fetcher }),
		(error) => error instanceof OllamaError && error.status === 500 && /tidak valid/.test(error.message)
	);

	// Restore
	process.env.OLLAMA_BASE_URL = initialUrl;
	process.env.OLLAMA_MODEL = initialModel;
});

test("maps Ollama inactive, tunnel error, missing model, timeout, invalid JSON, and malformed schema to useful errors", async () => {
	const offline = mockFetch(() => { throw new TypeError("fetch failed"); });
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: offline.fetcher }), (error) => error instanceof OllamaError && error.status === 503 && /tunnel/i.test(error.message));
	const tunnel502 = mockFetch(new Response(JSON.stringify({ error: "bad gateway" }), { status: 502 }));
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: tunnel502.fetcher }), (error) => error instanceof OllamaError && error.status === 502 && /Cloudflare Tunnel/i.test(error.message));
	const tunnel403 = mockFetch(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: tunnel403.fetcher }), (error) => error instanceof OllamaError && error.status === 502 && /Cloudflare Tunnel/i.test(error.message));
	const missing = mockFetch(new Response(JSON.stringify({ error: "model not found" }), { status: 404 }));
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: missing.fetcher }), /ollama pull qwen3-vl:4b-thinking-q4_K_M/);
	const timeout = mockFetch(() => { const error = new Error("aborted"); error.name = "AbortError"; throw error; });
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: timeout.fetcher }), (error) => error instanceof OllamaError && error.status === 504);
	const invalidJson = mockFetch(ok({ message: { content: "not json" }, done: true }));
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: invalidJson.fetcher }), /bukan JSON laporan/);
	const invalidSchema = mockFetch(ok({ message: { content: JSON.stringify({ companyName: "incomplete" }) }, done: true }));
	await assert.rejects(investigateJob({ caption: "teks", observations: {} }, { fetcher: invalidSchema.fetcher }), /tidak lengkap atau tidak valid/);
});

test("does not accept model risk scores unsupported by explicit grounded suspicious evidence", async () => {
	const unsupported = structuredClone(report);
	unsupported.riskLevel = "high";
	unsupported.riskScore = 99;
	unsupported.findings = [{ kind: "fact", indicator: "Informasi tidak ditemukan", status: "unknown", explanation: "Gaji tidak tersedia.", evidence: "" }];
	unsupported.factorAssessments = unsupported.factorAssessments.map((factor) => ({ ...factor, value: 99, evidence: "" }));
	const mock = mockFetch(ok({ message: { content: JSON.stringify(unsupported) }, done: true }));
	const result = await investigateJob({ caption: "Gaji tidak disebutkan", observations: {} }, { fetcher: mock.fetcher });
	assert.equal(result.riskScore, 0);
	assert.equal(result.riskLevel, "low");
	assert.equal(result.riskCategory, "insufficient");
});

test("image adapter passes raw base64 and rejects unsupported or malformed image data", () => {
	assert.equal(toOllamaImage(input.poster), "aW1hZ2U=");
	assert.throws(() => toOllamaImage({ mimeType: "image/png", data: "not base64!" }));
	assert.throws(() => toOllamaImage({ mimeType: "image/gif", data: "aW1hZ2U=" }));
	assert.match(validatePosterUpload("image/png", 4, new Uint8Array([1, 2, 3])), /tidak sesuai/);
	assert.match(validatePosterUpload("image/gif", 4, new Uint8Array([1, 2, 3])), /Format poster/);
	assert.match(validatePosterUpload("image/png", 6 * 1024 * 1024, new Uint8Array()), /5 MB/);
});
