import { getScenario } from "./registry.ts";
import type { ChatMessage, DecisionQuality, IntentId, RiskIndicatorId, ScenarioDefinition, SimulationEvent, SimulationSession, TechniqueId } from "./types.ts";

const STORAGE_KEY = "jaga.scam-simulator.sessions.v1";
const MAX_SESSIONS = 10;
const qualities = ["protective", "neutral", "risky"] as const;
const categories = ["identity_verification", "file_awareness", "pressure_resistance", "independent_verification", "safe_exit"] as const;
const intents = ["asking_identity", "asking_tracking_number", "refusing_download", "refusing_personal_data", "showing_trust", "expressing_confusion", "asking_verification", "resisting_pressure", "reporting", "ending_conversation", "sharing_personal_data", "unrecognized"] as const;
const eventTypes = ["simulation_started", "message_received", "suspicious_file_encountered", "quick_action_selected", "free_text_submitted", "verification_attempted", "pressure_response", "conversation_ended", "simulation_completed"] as const;
const indicators: RiskIndicatorId[] = ["unknown_sender", "fake_courier", "apk_file", "time_pressure", "unofficial_channel", "personal_data"];
const techniques: TechniqueId[] = ["authority_impersonation", "trust_building", "urgency", "fear_of_loss", "social_engineering", "instruction_manipulation"];
const stringValue = (value: unknown, max = 300) => typeof value === "string" ? value.slice(0, max) : "";
const isIn = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === "string" && allowed.includes(value as T);
const isIsoDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const safeIndicators = (value: unknown): RiskIndicatorId[] => Array.isArray(value) ? [...new Set(value.filter((id): id is RiskIndicatorId => isIn(id, indicators)))].slice(0, indicators.length) : [];

function parseDecision(value: unknown, scenario: ScenarioDefinition) {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	if (!isIsoDate(item.at) || !isIn(item.quality, qualities) || !isIn(item.intent, intents) || !isIn(item.inputMode, ["quick_action", "free_text"] as const)) return null;
	const node = scenario.nodes[stringValue(item.nodeId)];
	const choice = node?.decision.choices.find((candidate) => candidate.id === item.actionId);
	if (!node || !choice) return null;
	const contributions = Array.isArray(item.scoreContributions) ? item.scoreContributions.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const part = entry as Record<string, unknown>;
		return isIn(part.category, categories) && isIn(part.quality, qualities) ? [{ category: part.category, quality: part.quality }] : [];
	}) : [];
	return {
		id: stringValue(item.id, 120), at: item.at, nodeId: node.id, decisionId: node.decision.id, actionId: choice.id,
		inputMode: item.inputMode, intent: item.intent, label: stringValue(item.label, 180), quality: item.quality,
		outcome: isIn(item.outcome, ["reduced_exposure", "no_change", "increased_exposure"] as const) ? item.outcome : choice.outcome,
		indicatorIds: safeIndicators(item.indicatorIds), exposureDelta: Number.isFinite(item.exposureDelta) ? Math.max(-100, Math.min(100, Number(item.exposureDelta))) : choice.exposureDelta,
		evidence: stringValue(item.evidence, 500), whyItMatters: stringValue(item.whyItMatters, 500), saferAlternative: stringValue(item.saferAlternative, 500),
		scoreContributions: contributions.length ? contributions : [{ category: node.decision.category, quality: item.quality }],
	};
}

function parseEvent(value: unknown, scenario: ScenarioDefinition): SimulationEvent | null {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	if (!isIn(item.type, eventTypes) || !isIsoDate(item.at)) return null;
	const node = scenario.nodes[stringValue(item.nodeId)];
	if (!node) return null;
	const event: SimulationEvent = { id: stringValue(item.id, 120), type: item.type, at: item.at, nodeId: node.id };
	if (typeof item.scenarioMessageId === "string") event.scenarioMessageId = stringValue(item.scenarioMessageId, 120);
	if (typeof item.decisionId === "string") event.decisionId = stringValue(item.decisionId, 120);
	if (typeof item.actionId === "string") event.actionId = stringValue(item.actionId, 120);
	if (isIn(item.inputMode, ["quick_action", "free_text"] as const)) event.inputMode = item.inputMode;
	if (isIn(item.intent, intents)) event.intent = item.intent as IntentId;
	if (typeof item.label === "string") event.label = stringValue(item.label, 180);
	event.indicatorIds = safeIndicators(item.indicatorIds);
	if (isIn(item.technique, techniques)) event.technique = item.technique;
	if (isIn(item.quality, qualities)) event.quality = item.quality as DecisionQuality;
	if (isIn(item.outcome, ["reduced_exposure", "no_change", "increased_exposure"] as const)) event.outcome = item.outcome;
	if (Number.isFinite(item.exposureDelta)) event.exposureDelta = Math.max(-100, Math.min(100, Number(item.exposureDelta)));
	for (const key of ["evidence", "whyItMatters", "saferAlternative", "responseId"] as const) if (typeof item[key] === "string") event[key] = stringValue(item[key], 500);
	return event;
}

export function validateStoredSession(value: unknown): SimulationSession | null {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	const scenarioId = stringValue(item.scenarioId, 80);
	const scenario = getScenario(scenarioId);
	if (!scenario || typeof item.id !== "string" || item.id.length > 120 || !isIsoDate(item.startedAt)) return null;
	if (!isIn(item.status, ["active", "completed", "abandoned"] as const)) return null;
	const currentNodeId = stringValue(item.currentNodeId, 80);
	if (!scenario.nodes[currentNodeId]) return null;
	const visitedNodeIds = Array.isArray(item.visitedNodeIds) ? item.visitedNodeIds.filter((id): id is string => typeof id === "string" && Boolean(scenario.nodes[id])).slice(0, 10) : [];
	const decisions = Array.isArray(item.decisions) ? item.decisions.slice(0, 12).map((decision) => parseDecision(decision, scenario)).filter((decision): decision is NonNullable<typeof decision> => decision !== null) : [];
	const events = Array.isArray(item.events) ? item.events.slice(-250).map((entry) => parseEvent(entry, scenario)).filter((entry): entry is SimulationEvent => entry !== null) : [];
	return {
		id: item.id, scenarioId, status: item.status,
		startedAt: item.startedAt, completedAt: isIsoDate(item.completedAt) ? item.completedAt : null,
		currentNodeId, visitedNodeIds,
		decisions: decisions as SimulationSession["decisions"], events,
		encounteredIndicators: safeIndicators(item.encounteredIndicators), recognizedIndicators: safeIndicators(item.recognizedIndicators),
		riskExposure: Number.isFinite(item.riskExposure) ? Math.max(0, Math.min(100, Number(item.riskExposure))) : 0,
		finalScore: Number.isInteger(item.finalScore) && Number(item.finalScore) >= 0 && Number(item.finalScore) <= 100 ? Number(item.finalScore) : null,
		endReason: isIn(item.endReason, ["protected_exit", "continued_exposure"] as const) ? item.endReason : null,
	};
}

export function readSimulationSessions(): SimulationSession[] {
	try {
		const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(raw) ? raw.map(validateStoredSession).filter((item): item is SimulationSession => item !== null).slice(0, MAX_SESSIONS) : [];
	} catch { return []; }
}

export function writeSimulationSession(session: SimulationSession): SimulationSession[] {
	const history = readSimulationSessions().filter((item) => item.id !== session.id);
	const next = [session, ...history].slice(0, MAX_SESSIONS);
	try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Storage may be disabled or full. */ }
	return next;
}

function localTime(iso: string): string {
	return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function rebuildChat(session: SimulationSession, scenario: ScenarioDefinition): ChatMessage[] {
	const messages: ChatMessage[] = [];
	for (const entry of session.events) {
		if (entry.type === "quick_action_selected" || entry.type === "free_text_submitted") {
			messages.push({ id: entry.id, from: "me", time: localTime(entry.at), text: entry.label ?? "Respons tercatat" });
			continue;
		}
		if (entry.type !== "message_received" || !entry.scenarioMessageId) continue;
		const inNode = scenario.nodes[entry.nodeId]?.messages.find((message) => message.id === entry.scenarioMessageId);
		const reply = Object.values(scenario.nodes).flatMap((node) => node.decision.choices).flatMap((choice) => [choice.reply, ...(choice.followUp ?? [])]).find((message) => message.id === entry.scenarioMessageId);
		const source = inNode ?? reply;
		if (!source) continue;
		messages.push({ id: entry.id, from: "them", time: localTime(entry.at), text: source.text, file: source.file });
	}
	return messages;
}
