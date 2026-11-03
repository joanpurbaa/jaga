export type CompanyVerificationInput = { companyName: string; website?: string; email?: string };
export type CompanyVerificationResult = {
	status: "verified" | "not_found" | "unverified" | "inconsistent";
	evidence: { title: string; url: string; excerpt: string }[];
};

export interface CompanyVerificationService {
	verify(input: CompanyVerificationInput): Promise<CompanyVerificationResult>;
}

// No external search provider is configured. Keep this explicit so the report
// cannot imply online verification until a real source-backed adapter is added.
export const companyVerificationUnavailable: CompanyVerificationService = {
	async verify() { return { status: "unverified", evidence: [] }; },
};
