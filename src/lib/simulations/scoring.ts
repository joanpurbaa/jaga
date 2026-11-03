import type { DecisionCategory, DecisionQuality, SimulationScore, SimulationSession } from "./types.ts";

export const DECISION_WEIGHTS: Record<DecisionCategory, number> = {
	identity_verification: 20,
	file_awareness: 30,
	pressure_resistance: 20,
	independent_verification: 20,
	safe_exit: 10,
};

const QUALITY_VALUE: Record<DecisionQuality, number> = { protective: 100, neutral: 50, risky: 0 };

export function calculateSimulationScore(session: SimulationSession): SimulationScore {
	const contributions = session.decisions.flatMap((decision) => decision.scoreContributions);
	const totalWeight = contributions.reduce((sum, item) => sum + DECISION_WEIGHTS[item.category], 0);
	const score = totalWeight === 0 ? 0 : Math.round(contributions.reduce((sum, item) => sum + QUALITY_VALUE[item.quality] * DECISION_WEIGHTS[item.category], 0) / totalWeight);
	return {
		score,
		category: score >= 85 ? "Sangat waspada" : score >= 65 ? "Cukup waspada" : "Perlu lebih berhati-hati",
		protectiveDecisions: session.decisions.filter((decision) => decision.quality === "protective").length,
		riskyDecisions: session.decisions.filter((decision) => decision.quality === "risky").length,
		decisionPointsFaced: session.decisions.length,
		indicatorsRecognized: session.recognizedIndicators.length,
		indicatorsEncountered: session.encounteredIndicators.length,
		riskExposure: session.riskExposure,
		coverage: `${session.decisions.length} dari 5 titik keputusan skenario dicatat. Skor hanya memakai kategori yang benar-benar ditemui.`,
	};
}
