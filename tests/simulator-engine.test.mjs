import test from "node:test";
import assert from "node:assert/strict";
import { applyUserAction, classifyFreeText, completeSimulation, createSimulationSession, recordReceivedMessage } from "../src/lib/simulations/engine.ts";
import { courierApkScenario } from "../src/lib/simulations/scenarios/courier-apk.ts";
import { calculateSimulationScore, DECISION_WEIGHTS } from "../src/lib/simulations/scoring.ts";
import { rebuildChat, validateStoredSession } from "../src/lib/simulations/storage.ts";

const reach = (session, nodeId) => {
	const node = courierApkScenario.nodes[nodeId];
	for (const message of node.messages) session = recordReceivedMessage(session, nodeId, message, "2026-02-01T10:00:00.000Z");
	return session;
};

function choose(session, nodeId, choiceId) {
	const current = reach(session, nodeId);
	const result = applyUserAction(courierApkScenario, current, { mode: "quick_action", choiceId }, "2026-02-01T10:01:00.000Z");
	assert.ok(result, `choice ${choiceId} resolves at ${nodeId}`);
	let next = recordReceivedMessage(result.session, nodeId, result.reply, "2026-02-01T10:01:01.000Z");
	for (const message of result.nextMessages) next = recordReceivedMessage(next, result.nextNodeId, message, "2026-02-01T10:01:02.000Z");
	return { ...result, session: next };
}

test("courier scenario has 5 ordered decision points and a visual-only APK", () => {
	const nodeIds = Object.keys(courierApkScenario.nodes);
	assert.equal(nodeIds.length, 5);
	assert.equal(courierApkScenario.nodes.identity.decision.choices.length >= 4, true);
	assert.equal(courierApkScenario.nodes.file.messages.find((message) => message.file).file.name, "LIHAT_RESI_PAKET.apk");
	assert.match(courierApkScenario.nodes.file.messages.find((message) => message.file).file.note, /tidak ada file APK sungguhan/);
	assert.equal(courierApkScenario.nodes.identity.messages.some((message) => /J&T|JNE|SiCepat|AnterAja/.test(message.text)), false);
});

test("different quick actions branch, track events and produce different exposure", () => {
	let risky = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "risky-session");
	let safe = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "safe-session");
	const riskyResult = choose(risky, "identity", "trust_sender");
	const safeResult = choose(safe, "identity", "ask_tracking");
	assert.equal(riskyResult.session.riskExposure, 18);
	assert.equal(safeResult.session.riskExposure, 0);
	assert.equal(riskyResult.session.currentNodeId, "file");
	assert.equal(safeResult.session.currentNodeId, "file");
	assert.notEqual(riskyResult.nextMessages[0].id, safeResult.nextMessages[0].id);
	assert.ok(safeResult.session.recognizedIndicators.includes("fake_courier"));
	assert.ok(riskyResult.session.events.some((event) => event.type === "quick_action_selected"));
});

test("every scripted choice returns a consequence and a valid next state or explicit ending", () => {
	for (const node of Object.values(courierApkScenario.nodes)) {
		for (const choice of node.decision.choices) {
			const started = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", `${node.id}-${choice.id}`);
			const state = { ...started, currentNodeId: node.id, visitedNodeIds: [...started.visitedNodeIds, node.id] };
			const result = applyUserAction(courierApkScenario, state, { mode: "quick_action", choiceId: choice.id }, "2026-02-01T10:01:00.000Z");
			assert.ok(result, `${node.id}/${choice.id} should resolve`);
			assert.ok(result.reply.text.length > 0, `${node.id}/${choice.id} should have a consequence`);
			assert.equal(result.completed, choice.nextNodeId === null);
			if (choice.nextNodeId) assert.equal(result.session.currentNodeId, choice.nextNodeId);
			else assert.ok(result.session.events.some((event) => event.type === "conversation_ended"));
		}
	}
});

test("free text uses deterministic intent matching and unknown text follows a fallback", () => {
	assert.equal(classifyFreeText("Saya akan cek melalui aplikasi resmi"), "asking_verification");
	assert.equal(classifyFreeText("Saya tidak akan install APK"), "refusing_download");
	assert.equal(classifyFreeText("Saya tidak akan mengirim OTP"), "refusing_personal_data");
	assert.equal(classifyFreeText("Saya tidak mau lanjut, saya akan cek sendiri"), "ending_conversation");
	assert.equal(classifyFreeText("jawaban yang tidak dikenal xyz"), "unrecognized");
	const started = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "free-session");
	const matched = applyUserAction(courierApkScenario, started, { mode: "free_text", text: "Saya akan cek melalui aplikasi resmi" }, "2026-02-01T10:01:00.000Z");
	assert.equal(matched.choice.id, "verify_now");
	assert.equal(matched.intent, "asking_verification");
	const fallback = applyUserAction(courierApkScenario, started, { mode: "free_text", text: "jawaban yang tidak dikenal xyz" }, "2026-02-01T10:01:00.000Z");
	assert.equal(fallback.choice.id, "ask_identity");
	assert.equal(fallback.session.decisions[0].label, "Respons bebas: belum dikenali");
	assert.equal(JSON.stringify(fallback.session).includes("jawaban yang tidak dikenal xyz"), false);
});

test("scoring normalizes only categories encountered and safe exits improve their weighted score", () => {
	let session = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "score-session");
	session = choose(session, "identity", "ask_tracking").session;
	const earlyExit = choose(session, "file", "report_file");
	session = earlyExit.session;
	const evaluated = calculateSimulationScore(session);
	assert.equal(evaluated.decisionPointsFaced, 2);
	assert.equal(evaluated.score > 0, true);
	assert.deepEqual(DECISION_WEIGHTS, { identity_verification: 20, file_awareness: 30, pressure_resistance: 20, independent_verification: 20, safe_exit: 10 });
	const completed = completeSimulation(session, earlyExit.choice.endReason, "2026-02-01T10:02:00.000Z");
	assert.equal(completed.status, "completed");
	assert.equal(completed.events.at(-1).type, "simulation_completed");
});

test("risk-heavy full path reaches an actual end and creates timeline from recorded decisions", () => {
	let session = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "full-risk-session");
	let result = choose(session, "identity", "trust_sender"); session = result.session;
	result = choose(session, "file", "install_file"); session = result.session;
	assert.ok(session.events.some((event) => event.type === "suspicious_file_encountered"));
	result = choose(session, "pressure", "comply_pressure"); session = result.session;
	result = choose(session, "verification", "share_data"); session = result.session;
	result = choose(session, "exit", "continue_chat"); session = result.session;
	assert.equal(result.completed, true);
	assert.equal(session.decisions.length, 5);
	assert.equal(calculateSimulationScore(session).riskyDecisions, 5);
	const finished = completeSimulation(session, result.choice.endReason, "2026-02-01T10:10:00.000Z");
	const chat = rebuildChat(finished, courierApkScenario);
	assert.equal(chat.some((message) => message.file?.name === "LIHAT_RESI_PAKET.apk"), true);
	assert.equal(chat.filter((message) => message.from === "me").length, 5);
	assert.equal(chat.some((message) => message.text?.includes("Tinggal ikuti arahan saya selanjutnya")), true);
});

test("local session validation rejects unknown scenarios and sanitizes stored data", () => {
	const session = createSimulationSession(courierApkScenario, "2026-02-01T10:00:00.000Z", "stored-session");
	const valid = validateStoredSession(session);
	assert.equal(valid.status, "active");
	assert.equal(validateStoredSession({ ...session, scenarioId: "unknown" }), null);
	assert.equal(validateStoredSession({ ...session, currentNodeId: "<script>" }), null);
});
