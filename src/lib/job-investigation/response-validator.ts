import { z } from "zod";

const text = z.string();
const extractedData = z.object({
	companyName: text, position: text, jobDescription: text, requirements: text,
	location: text, workSystem: text, salary: text, companyAddress: text,
	recruitmentEmail: text, recruiterPhone: text, recruiterName: text,
	website: text, upfrontPayment: text, applicationLink: text, deadline: text, additional: text,
});

export const localAnalysisSchema = z.object({
	riskLevel: z.enum(["low", "medium", "high"]),
	riskScore: z.number().int().min(0).max(100),
	summary: text,
	extractedData,
	visualAnalysis: z.object({ summary: text, extractedText: text, observations: z.array(z.object({ indicator: text, result: text })).max(6) }),
	findings: z.array(z.object({ kind: z.enum(["fact", "suspicion"]), indicator: text, status: z.enum(["detected", "not_detected", "unknown"]), explanation: text, evidence: text })).max(8),
	factorAssessments: z.array(z.object({ category: z.enum(["company", "recruiter", "process", "job", "poster"]), value: z.number().int().min(0).max(100), reasoning: text, evidence: text })).length(5),
	evidence: z.array(z.object({ target: text, quote: text })).max(16),
	recommendations: z.array(text).max(8),
	limitations: z.array(text).max(8),
});

export type LocalAnalysis = z.infer<typeof localAnalysisSchema>;
export const localAnalysisJsonSchema = z.toJSONSchema(localAnalysisSchema);

export function validateLocalAnalysis(value: unknown): value is LocalAnalysis {
	return localAnalysisSchema.safeParse(value).success;
}
