import test from "node:test";
import assert from "node:assert/strict";
import { buildValidatedReport, RISK_WEIGHTS } from "../src/lib/job-investigation/score.ts";

function report(factors) {
	return {
		companyName: "Contoh PT", position: "Admin", location: "Jakarta", extracted: {},
		companyStatus: "verified", companySummary: "Ditemukan.", website: "https://company.example/", recruiterIdentity: "HR",
		posterAnalysis: null, findings: [], indicators: [], factors, confidence: "high", coverageExplanation: "cukup",
		recommendations: [], limitations: [],
	};
}

function factor(category, evidenceKind = "caption", evidence = "minta transfer") {
	return { category, value: 80, evidence, evidenceKind, sourceIndexes: [], reasoning: "Kutipan dari caption." };
}

test("risk score uses documented fixed weights and is hidden when evidence is sparse", () => {
	const input = "Lowongan ini minta transfer sebelum wawancara.";
	const enough = buildValidatedReport(report([factor("company", "caption", "Lowongan ini"), factor("process", "caption", "minta transfer"), factor("job", "caption", "sebelum wawancara")]), [], input, false, true);
	assert.equal(enough.riskScore, 80);
	assert.equal(enough.riskCategory, "high");
	assert.equal(RISK_WEIGHTS.company, 25);
	const sparse = buildValidatedReport(report([factor("process")]), [], input, false, true);
	assert.equal(sparse.riskScore, 0);
	assert.equal(sparse.riskLevel, "low");
	assert.equal(sparse.riskCategory, "insufficient");
	const repeated = buildValidatedReport(report([factor("company"), factor("process"), factor("job")]), [], input, false, true);
	assert.equal(repeated.riskScore, 0);
});

test("unmatched AI quotations and fake citation indexes do not become evidence", () => {
	const invalid = factor("process", "caption", "minta biaya palsu yang tidak ada");
	invalid.sourceIndexes = [7];
	const output = buildValidatedReport(report([invalid]), [{ web: { uri: "javascript:alert(1)", title: "No" } }], "Caption lowongan asli", false, true);
	assert.equal(output.riskScore, 0);
	assert.equal(output.factors[0].evidenceKind, "none");
	assert.equal(output.sources.length, 0);
});

test("unsearched company status stays unknown and only grounded HTTPS sources are exposed", () => {
	const output = buildValidatedReport(report([]), [
		{ web: { uri: "https://example.com/company", title: "Company" } },
		{ web: { uri: "http://insecure.example", title: "Insecure" } },
	], "", false, false);
	assert.equal(output.companyStatus, "unknown");
	assert.equal(output.sources.length, 1);
	assert.equal(output.riskScore, 0);
});
