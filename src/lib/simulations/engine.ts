import type {
	DecisionRecord,
	IntentId,
	ScenarioChoice,
	ScenarioDefinition,
	ScenarioMessage,
	SimulationEvent,
	SimulationSession,
} from "./types.ts";

const EVENT_LIMIT = 250;
const unique = <T,>(items: T[]) => [...new Set(items)];
const iso = (value: string | Date) => new Date(value).toISOString();

function event(session: SimulationSession, type: SimulationEvent["type"], nodeId: string, at: string, details: Partial<SimulationEvent> = {}): SimulationEvent {
	return { id: `${session.id}:event:${session.events.length + 1}`, type, at, nodeId, ...details };
}

export function createSimulationSession(scenario: ScenarioDefinition, startedAt = new Date(), id = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`): SimulationSession {
	const at = iso(startedAt);
	const session: SimulationSession = {
		id, scenarioId: scenario.id, status: "active", startedAt: at, completedAt: null,
		currentNodeId: scenario.startNodeId, visitedNodeIds: [scenario.startNodeId], decisions: [], events: [],
		encounteredIndicators: [], recognizedIndicators: [], riskExposure: 0, finalScore: null, endReason: null,
	};
	session.events.push(event(session, "simulation_started", scenario.startNodeId, at));
	return session;
}

export function recordReceivedMessage(session: SimulationSession, nodeId: string, message: ScenarioMessage, at = new Date()): SimulationSession {
	if (session.status !== "active") return session;
	const received = unique([...(session.encounteredIndicators ?? []), ...(message.indicatorIds ?? [])]);
	const next: SimulationSession = { ...session, encounteredIndicators: received, events: [...session.events] };
	next.events.push(event(next, "message_received", nodeId, iso(at), {
		scenarioMessageId: message.id,
		indicatorIds: message.indicatorIds ?? [],
		technique: message.technique,
	}));
	if (message.file) next.events.push(event(next, "suspicious_file_encountered", nodeId, iso(at), { scenarioMessageId: message.id, indicatorIds: message.indicatorIds ?? [] }));
	return capEvents(next);
}

export function classifyFreeText(text: string): IntentId {
	const value = text.trim().toLocaleLowerCase("id-ID");
	if (!value) return "unrecognized";
	if (/(blokir|lapor|report|akhiri|hentikan|stop|jangan hubungi|tidak mau lanjut|tidak ingin lanjut)/.test(value)) return /blokir|lapor|report/.test(value) ? "reporting" : "ending_conversation";
	if (/(tidak|jangan|menolak|enggan).*(kirim|berikan|bagikan|membagikan|memberi)?.*(otp|kode verifikasi|pin|password|kata sandi|data pribadi)/.test(value)) return "refusing_personal_data";
	if (/(otp|kode verifikasi|pin|password|kata sandi|data pribadi|kirim.*data|bagikan)/.test(value)) return "sharing_personal_data";
	if (/(tidak.*(pasang|install|unduh|download)|jangan.*(pasang|install|buka|unduh)|tolak.*(apk|file|berkas)|hapus.*file)/.test(value)) return "refusing_download";
	if (/(aplikasi resmi|situs resmi|cek sendiri|verifikasi|kanal resmi|saya akan cek)/.test(value)) return "asking_verification";
	if (/(resi|tracking|nomor paket|nomor pengiriman)/.test(value)) return "asking_tracking_number";
	if (/(siapa|identitas|nama kurir|perusahaan mana|bukti.*kurir)/.test(value)) return "asking_identity";
	if (/(butuh waktu|tidak terburu|nanti saya|periksa dulu|tidak buru-buru)/.test(value)) return "resisting_pressure";
	if (/(bingung|tidak paham|kenapa|mengapa|kok)/.test(value)) return "expressing_confusion";
	if (/(baik|oke|ok|percaya|ikuti|silakan|saya kirim)/.test(value)) return "showing_trust";
	return "unrecognized";
}

function intentLabel(intent: IntentId): string {
	const labels: Record<IntentId, string> = {
		asking_identity: "menanyakan identitas", asking_tracking_number: "meminta nomor resi",
		refusing_download: "menolak unduhan", refusing_personal_data: "menolak membagikan data", showing_trust: "menunjukkan kepercayaan",
		expressing_confusion: "menyatakan kebingungan", asking_verification: "memilih verifikasi",
		resisting_pressure: "menahan tekanan", reporting: "memilih melaporkan",
		ending_conversation: "mengakhiri percakapan", sharing_personal_data: "merespons permintaan data",
		unrecognized: "belum dikenali",
	};
	return labels[intent];
}

export type UserAction = { mode: "quick_action"; choiceId: string } | { mode: "free_text"; text: string };
export type DecisionResult = { session: SimulationSession; choice: ScenarioChoice; displayText: string; intent: IntentId; reply: ScenarioMessage; nextMessages: ScenarioMessage[]; nextNodeId: string; completed: boolean };

export function applyUserAction(scenario: ScenarioDefinition, session: SimulationSession, action: UserAction, at = new Date()): DecisionResult | null {
	if (session.status !== "active") return null;
	const node = scenario.nodes[session.currentNodeId];
	if (!node) return null;
	const intent = action.mode === "free_text" ? classifyFreeText(action.text) : node.decision.choices.find((item) => item.id === action.choiceId)?.intents[0] ?? "unrecognized";
	const matchedChoice = action.mode === "quick_action"
		? node.decision.choices.find((item) => item.id === action.choiceId)
		: node.decision.choices.find((item) => item.intents.includes(intent))
			?? node.decision.choices.find((item) => item.keywords?.some((keyword) => action.text.toLocaleLowerCase("id-ID").includes(keyword.toLocaleLowerCase("id-ID"))));
	const choice = matchedChoice ?? node.decision.choices.find((item) => item.id === node.decision.fallbackChoiceId) ?? node.decision.choices[0];
	if (!choice) return null;
	const timestamp = iso(at);
	const displayText = action.mode === "quick_action" ? choice.label : `Respons bebas: ${intentLabel(intent)}`;
	const scoreContributions = [{ category: node.decision.category, quality: choice.quality }, ...(choice.additionalScores ?? [])];
	const decision: DecisionRecord = {
		id: `${session.id}:decision:${session.decisions.length + 1}`, at: timestamp, nodeId: node.id,
		decisionId: node.decision.id, actionId: choice.id, inputMode: action.mode, intent, label: displayText,
		quality: choice.quality, outcome: choice.outcome,
		indicatorIds: unique([...(choice.recognizes ?? []), ...(node.messages.flatMap((message) => message.indicatorIds ?? []))]),
		exposureDelta: choice.exposureDelta, evidence: choice.decisionEvidence, whyItMatters: choice.whyItMatters,
		saferAlternative: choice.saferAlternative, scoreContributions,
	};
	const actionType = action.mode === "quick_action" ? "quick_action_selected" : "free_text_submitted";
	const next: SimulationSession = {
		...session,
		currentNodeId: choice.nextNodeId ?? node.id,
		visitedNodeIds: choice.nextNodeId ? unique([...session.visitedNodeIds, choice.nextNodeId]) : session.visitedNodeIds,
		decisions: [...session.decisions, decision],
		events: [...session.events],
		recognizedIndicators: unique([...session.recognizedIndicators, ...(choice.recognizes ?? [])]),
		riskExposure: Math.max(0, Math.min(100, session.riskExposure + choice.exposureDelta)),
	};
	next.events.push(event(next, actionType, node.id, timestamp, {
		decisionId: node.decision.id, actionId: choice.id, inputMode: action.mode, intent, label: displayText,
		indicatorIds: choice.recognizes ?? [], quality: choice.quality, outcome: choice.outcome,
		exposureDelta: choice.exposureDelta, evidence: choice.decisionEvidence,
		whyItMatters: choice.whyItMatters, saferAlternative: choice.saferAlternative,
		responseId: choice.reply.id,
	}));
	if (node.decision.category === "independent_verification" || intent === "asking_verification") next.events.push(event(next, "verification_attempted", node.id, timestamp, { decisionId: node.decision.id, actionId: choice.id, quality: choice.quality }));
	if (node.decision.category === "pressure_resistance") next.events.push(event(next, "pressure_response", node.id, timestamp, { decisionId: node.decision.id, actionId: choice.id, quality: choice.quality, outcome: choice.outcome }));
	if (choice.nextNodeId === null) next.events.push(event(next, "conversation_ended", node.id, timestamp, { decisionId: node.decision.id, actionId: choice.id, outcome: choice.outcome }));
	const nextNodeId = choice.nextNodeId ?? node.id;
	const baseMessages = choice.nextNodeId ? scenario.nodes[choice.nextNodeId]?.messages ?? [] : [];
	const nextMessages = choice.followUp?.length ? [...choice.followUp, ...baseMessages.slice(choice.followUp.length)] : baseMessages;
	return { session: capEvents(next), choice, displayText, intent, reply: choice.reply, nextMessages, nextNodeId, completed: choice.nextNodeId === null };
}

export function completeSimulation(session: SimulationSession, endReason: SimulationSession["endReason"], at = new Date()): SimulationSession {
	if (session.status !== "active") return session;
	const completedAt = iso(at);
	const complete = { ...session, status: "completed" as const, completedAt, endReason };
	complete.events = [...session.events, event(complete, "simulation_completed", session.currentNodeId, completedAt)];
	return capEvents(complete);
}

export function markAbandoned(session: SimulationSession, at = new Date()): SimulationSession {
	if (session.status !== "active") return session;
	return { ...session, status: "abandoned", completedAt: iso(at) };
}

function capEvents(session: SimulationSession): SimulationSession {
	return session.events.length > EVENT_LIMIT ? { ...session, events: session.events.slice(-EVENT_LIMIT) } : session;
}
