import type { EvidenceKind, ExtractedInformation, FactorName, InvestigationReport, InvestigationSource, RiskFactor } from "./types";

export const RISK_WEIGHTS: Record<FactorName, number> = { company: 25, recruiter: 20, process: 25, job: 20, poster: 10 };
export const SCAM_INDICATORS = ["Biaya di muka", "Transfer ke rekening pribadi", "WhatsApp atau Telegram pribadi", "Gaji tidak realistis", "Persyaratan mudah dengan kompensasi tinggi", "Tidak ada wawancara yang wajar", "Tekanan untuk segera mendaftar atau membayar", "Tautan pendaftaran mencurigakan", "Permintaan data pribadi tidak relevan", "Identitas perusahaan atau perekrut tidak konsisten"] as const;

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function string(value: unknown, fallback = "Tidak tersedia"): string { return typeof value === "string" && value.trim() ? value.trim().slice(0, 2000) : fallback; }
function strings(value: unknown, max = 20): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, max).map((item) => item.slice(0, 1000)) : []; }
function indexes(value: unknown, sourceCount: number, sourceMap: (number | undefined)[]): number[] { return Array.isArray(value) ? [...new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < sourceCount).map((index) => sourceMap[index]).filter((index): index is number => index !== undefined))] : []; }
function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T { return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback; }

function supported(kind: EvidenceKind, evidence: string, sourceIndexes: number[], inputText: string, hasPoster: boolean): boolean {
	if (kind === "source") return sourceIndexes.length > 0;
	if (kind === "poster") return hasPoster && evidence.length > 0;
	if (kind === "caption" || kind === "observation") return evidence.length >= 3 && inputText.toLocaleLowerCase().includes(evidence.toLocaleLowerCase());
	return false;
}

function extractFields(raw: unknown, sourceCandidates: unknown[], sourceMap: (number | undefined)[], inputText: string, hasPoster: boolean): ExtractedInformation {
	const fields = asRecord(raw);
	const names = ["companyAddress", "recruitmentEmail", "recruiterPhone", "recruiterName", "salary", "requirements", "jobDescription", "upfrontPayment", "applicationLink", "deadline", "additional"] as const;
	return Object.fromEntries(names.map((name) => {
		const field = asRecord(fields[name]);
		const value = string(field.value, "Tidak tersedia");
		const evidence = string(field.evidence, "");
		const evidenceKind = enumValue<EvidenceKind>(field.evidenceKind, ["caption", "poster", "observation", "source", "none"], "none");
		const sourceIndexes = indexes(field.sourceIndexes, sourceCandidates.length, sourceMap);
		const isSupported = value !== "Tidak tersedia" && supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster);
		return [name, { value: isSupported ? value : "Tidak tersedia", evidence: isSupported ? evidence : "", evidenceKind: isSupported ? evidenceKind : "none", sourceIndexes: isSupported ? sourceIndexes : [] }];
	})) as ExtractedInformation;
}

export function buildValidatedReport(raw: unknown, sourceCandidates: unknown[], inputText: string, hasPoster: boolean, searchPerformed: boolean): InvestigationReport {
	const data = asRecord(raw);
	const sourceMap: (number | undefined)[] = [];
	const sourceIndexByUrl = new Map<string, number>();
	const sources: InvestigationSource[] = sourceCandidates.flatMap((source, originalIndex) => {
		const web = asRecord(asRecord(source).web);
		const url = typeof web.uri === "string" ? web.uri : "";
		try {
			const parsed = new URL(url);
			if (parsed.protocol !== "https:") return [];
			const existing = sourceIndexByUrl.get(parsed.toString());
			const index = existing ?? sourceIndexByUrl.size;
			sourceMap[originalIndex] = index;
			if (existing === undefined) sourceIndexByUrl.set(parsed.toString(), index);
			return existing === undefined ? [{ title: string(web.title, parsed.hostname), url: parsed.toString(), domain: parsed.hostname }] : [];
		} catch { return []; }
	}).slice(0, 12);
	for (let index = 0; index < sourceMap.length; index++) {
		const mappedIndex = sourceMap[index];
		if (mappedIndex !== undefined && mappedIndex >= sources.length) sourceMap[index] = undefined;
	}
	const allowedCategories: FactorName[] = ["company", "recruiter", "process", "job", "poster"];
	const seenCategories = new Set<FactorName>();
	const factors: RiskFactor[] = (Array.isArray(data.factors) ? data.factors : []).flatMap((item) => {
		const factor = asRecord(item);
		if (typeof factor.category !== "string" || !allowedCategories.includes(factor.category as FactorName)) return [];
		const category = factor.category as FactorName;
		if (seenCategories.has(category)) return [];
		seenCategories.add(category);
		const evidenceKind = enumValue<EvidenceKind>(factor.evidenceKind, ["caption", "poster", "observation", "source", "none"], "none");
		const sourceIndexes = indexes(factor.sourceIndexes, sourceCandidates.length, sourceMap);
		const evidence = string(factor.evidence, "");
		const value = Number.isFinite(factor.value) ? Math.max(0, Math.min(100, Math.round(Number(factor.value)))) : 0;
		return [{ category, weight: RISK_WEIGHTS[category], value: supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster) ? value : 0, evidence: supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster) ? evidence : "", evidenceKind: supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster) ? evidenceKind : "none", sourceIndexes, reasoning: string(factor.reasoning) }];
	});
	const uniqueFactors = allowedCategories.map((category) => factors.find((factor) => factor.category === category) ?? { category, weight: RISK_WEIGHTS[category], value: 0, evidence: "", evidenceKind: "none" as const, sourceIndexes: [], reasoning: "Bukti belum tersedia untuk menilai faktor ini." });
	const evidenceFactors = uniqueFactors.filter((factor) => factor.evidenceKind !== "none");
	const distinctEvidence = new Set(evidenceFactors.map((factor) => factor.evidenceKind === "source" ? `source:${factor.sourceIndexes.join(",")}` : `${factor.evidenceKind}:${factor.evidence.toLocaleLowerCase()}`));
	const evidenceCoverage: InvestigationReport["evidenceCoverage"] = distinctEvidence.size >= 4 && sources.length >= 2 ? "substantial" : distinctEvidence.size >= 2 ? "partial" : "limited";
	const weightTotal = evidenceFactors.reduce((sum, factor) => sum + factor.weight, 0);
	const calculatedRiskScore = evidenceFactors.length >= 3 && distinctEvidence.size >= 3 && weightTotal > 0 ? Math.round(evidenceFactors.reduce((sum, factor) => sum + factor.value * factor.weight, 0) / weightTotal) : null;
	const riskScore = calculatedRiskScore ?? 0;
	const riskLevel: InvestigationReport["riskLevel"] = riskScore < 35 ? "low" : riskScore < 70 ? "medium" : "high";
	const riskCategory: InvestigationReport["riskCategory"] = calculatedRiskScore === null ? "insufficient" : riskScore < 25 ? "low" : riskScore < 50 ? "review" : riskScore < 75 ? "suspicious" : "high";
	const findings = (Array.isArray(data.findings) ? data.findings : []).slice(0, 5).map((item) => {
		const finding = asRecord(item);
		const evidenceKind = enumValue<EvidenceKind>(finding.evidenceKind, ["caption", "poster", "observation", "source", "none"], "none");
		const sourceIndexes = indexes(finding.sourceIndexes, sourceCandidates.length, sourceMap);
		const evidence = string(finding.evidence, "");
		const isSupported = supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster);
		return { indicator: string(finding.indicator), status: isSupported ? enumValue(finding.status, ["detected", "not_detected", "unknown"] as const, "unknown") : "unknown" as const, explanation: string(finding.explanation), evidence: isSupported ? evidence : "Bukti yang dapat dikaitkan tidak tersedia.", evidenceKind: isSupported ? evidenceKind : "none" as const, sourceIndexes };
	});
	const indicatorRecords = Array.isArray(data.indicators) ? data.indicators.map(asRecord) : [];
	const indicators = SCAM_INDICATORS.map((canonicalName) => {
		const indicator = indicatorRecords.find((candidate) => candidate.name === canonicalName);
		if (!indicator) return { name: canonicalName, status: "unknown" as const, explanation: "Model tidak mengembalikan penilaian untuk indikator ini.", evidence: "Tidak ada bukti yang cukup.", evidenceKind: "none" as const, sourceIndexes: [] };
		const evidenceKind = enumValue<EvidenceKind>(indicator.evidenceKind, ["caption", "poster", "observation", "source", "none"], "none");
		const sourceIndexes = indexes(indicator.sourceIndexes, sourceCandidates.length, sourceMap);
		const evidence = string(indicator.evidence, "");
		const isSupported = supported(evidenceKind, evidence, sourceIndexes, inputText, hasPoster);
		return { name: string(indicator.name), status: isSupported ? enumValue(indicator.status, ["detected", "not_detected", "unknown"] as const, "unknown") : "unknown" as const, explanation: string(indicator.explanation), evidence: isSupported ? evidence : "Tidak ada bukti yang cukup.", evidenceKind: isSupported ? evidenceKind : "none" as const, sourceIndexes };
	});
	const poster = data.posterAnalysis && typeof data.posterAnalysis === "object" ? asRecord(data.posterAnalysis) : null;
	const posterAnalysis = hasPoster && poster ? { summary: string(poster.summary), extractedText: string(poster.extractedText, "Tidak terbaca"), observations: (Array.isArray(poster.observations) ? poster.observations : []).slice(0, 10).map((item) => { const observation = asRecord(item); return { indicator: string(observation.indicator), result: string(observation.result), confidence: enumValue(observation.confidence, ["low", "medium", "high"] as const, "low") }; }) } : null;
	const websiteCandidate = string(data.website, "");
	const groundedWebsite = sources.find((source) => source.url === websiteCandidate || (() => { try { return new URL(source.url).hostname === new URL(websiteCandidate).hostname; } catch { return false; } })());
	const website = groundedWebsite?.url ?? "Tidak ditemukan pada sumber yang berhasil dikutip";
	const requestedCompanyStatus = enumValue(data.companyStatus, ["verified", "found_unverified", "not_found", "conflicting", "unknown"] as const, "unknown");
	const companyStatus = !searchPerformed ? "unknown" : requestedCompanyStatus === "verified" && !groundedWebsite ? "found_unverified" : requestedCompanyStatus;
	const extractedData = extractFields(data.extracted, sourceCandidates, sourceMap, inputText, hasPoster);
	const jobExtractedData: InvestigationReport["extractedData"] = {
		companyName: string(data.companyName),
		position: string(data.position),
		jobDescription: extractedData.jobDescription.value,
		requirements: extractedData.requirements.value,
		location: string(data.location),
		workSystem: "Tidak tersedia",
		salary: extractedData.salary.value,
		companyAddress: extractedData.companyAddress.value,
		recruitmentEmail: extractedData.recruitmentEmail.value,
		recruiterPhone: extractedData.recruiterPhone.value,
		recruiterName: extractedData.recruiterName.value,
		website,
		upfrontPayment: extractedData.upfrontPayment.value,
		applicationLink: extractedData.applicationLink.value,
		deadline: extractedData.deadline.value,
		additional: extractedData.additional.value,
	};
	const groundedEvidence = findings.filter((finding) => finding.evidenceKind !== "none").map((finding) => ({ finding: finding.indicator, evidence: finding.evidence, evidenceKind: finding.evidenceKind }));
	return {
		companyName: string(data.companyName), position: string(data.position), location: string(data.location),
		extracted: extractedData, extractedData: jobExtractedData,
		companyStatus,
		companySummary: string(data.companySummary), website, recruiterIdentity: string(data.recruiterIdentity), posterAnalysis, findings, indicators,
		factors: uniqueFactors, confidence: enumValue(data.confidence, ["low", "medium", "high"] as const, "low"), coverageExplanation: string(data.coverageExplanation),
		recommendations: strings(data.recommendations, 10), limitations: strings(data.limitations, 10), sources, riskScore, riskLevel, evidence: groundedEvidence, riskCategory, evidenceCoverage,
	};
}

