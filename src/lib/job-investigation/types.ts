export type InvestigationInput = {
	caption: string;
	observations: Record<string, "ya" | "tidak" | "ragu">;
	poster?: { mimeType: "image/png" | "image/jpeg" | "image/webp"; data: string };
};

export type InvestigationSource = { title: string; url: string; domain: string };
export type FactorName = "company" | "recruiter" | "process" | "job" | "poster";
export type EvidenceKind = "caption" | "poster" | "observation" | "source" | "none";
export type ExtractedValue = { value: string; evidence: string; evidenceKind: EvidenceKind; sourceIndexes: number[] };
export type ExtractedInformation = Record<"companyAddress" | "recruitmentEmail" | "recruiterPhone" | "recruiterName" | "salary" | "requirements" | "jobDescription" | "upfrontPayment" | "applicationLink" | "deadline" | "additional", ExtractedValue>;
export type JobExtractedData = Record<"companyName" | "position" | "jobDescription" | "requirements" | "location" | "workSystem" | "salary" | "companyAddress" | "recruitmentEmail" | "recruiterPhone" | "recruiterName" | "website" | "upfrontPayment" | "applicationLink" | "deadline" | "additional", string>;
export type RiskFactor = { category: FactorName; weight: number; value: number; evidence: string; evidenceKind: EvidenceKind; sourceIndexes: number[]; reasoning: string };
export type ReportEvidence = { finding: string; evidence: string; evidenceKind: EvidenceKind };
export type InvestigationReport = {
	companyName: string;
	position: string;
	location: string;
	extracted: ExtractedInformation;
	companyStatus: "verified" | "found_unverified" | "not_found" | "conflicting" | "unknown";
	companySummary: string;
	website: string;
	recruiterIdentity: string;
	posterAnalysis: { summary: string; observations: { indicator: string; result: string; confidence: "low" | "medium" | "high" }[]; extractedText: string } | null;
	findings: { indicator: string; status: "detected" | "not_detected" | "unknown"; explanation: string; evidence: string; evidenceKind: EvidenceKind; sourceIndexes: number[] }[];
	indicators: { name: string; status: "detected" | "not_detected" | "unknown"; explanation: string; evidence: string; evidenceKind: EvidenceKind; sourceIndexes: number[] }[];
	factors: RiskFactor[];
	confidence: "low" | "medium" | "high";
	coverageExplanation: string;
	recommendations: string[];
	limitations: string[];
	sources: InvestigationSource[];
	riskScore: number;
	riskLevel: "low" | "medium" | "high";
	evidence: ReportEvidence[];
	extractedData: JobExtractedData;
	riskCategory: "low" | "review" | "suspicious" | "high" | "insufficient";
	evidenceCoverage: "limited" | "partial" | "substantial";
};
