"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	MdCheck,
	MdCheckCircle,
	MdChat,
	MdDoneAll,
	MdMoreVert,
	MdOutlineAndroid,
	MdOutlineInsertDriveFile,
	MdPerson,
	MdSearch,
	MdSend,
	MdShield,
	MdWarningAmber,
} from "react-icons/md";
import { PiPaperclip } from "react-icons/pi";
import { applyUserAction, completeSimulation, createSimulationSession, markAbandoned, recordReceivedMessage } from "@/lib/simulations/engine";
import { calculateSimulationScore } from "@/lib/simulations/scoring";
import { courierApkScenario } from "@/lib/simulations/scenarios/courier-apk";
import { scenarios } from "@/lib/simulations/registry";
import { readSimulationSessions, rebuildChat, writeSimulationSession } from "@/lib/simulations/storage";
import type { ChatMessage, ScenarioMessage, SimulationSession, TechniqueId } from "@/lib/simulations/types";

const scenario = courierApkScenario;
const techniqueNames: Record<TechniqueId, string> = {
	authority_impersonation: "Penyamaran otoritas",
	trust_building: "Membangun kepercayaan",
	urgency: "Tekanan waktu",
	fear_of_loss: "Takut kehilangan",
	social_engineering: "Rekayasa sosial",
	instruction_manipulation: "Manipulasi instruksi",
};

function timeLabel(value: string | Date) {
	return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function PersonAvatar({ size = 42 }: { size?: number }) {
	return <span className="flex shrink-0 items-center justify-center rounded-full bg-[#46504c] text-[#dce5df]" style={{ width: size, height: size }} aria-hidden="true"><MdPerson size={size * 0.64} /></span>;
}

function BubbleTail({ outgoing }: { outgoing: boolean }) {
	return <span aria-hidden="true" className={`absolute top-0 h-0 w-0 border-b-[10px] border-b-transparent ${outgoing ? "-right-2 border-l-[9px] border-l-[#154d37]" : "-left-2 border-r-[9px] border-r-[#242626]"}`} />;
}

function MessageBubble({ message, first }: { message: ChatMessage; first: boolean }) {
	const outgoing = message.from === "me";
	return <div className={`flex ${outgoing ? "justify-end" : "justify-start"} ${first ? "mt-3" : "mt-1"}`}>
		<div className={`relative max-w-[88%] rounded-lg px-3 pb-1.5 pt-1.5 text-[14px] leading-[21px] text-[#e9edef] sm:max-w-[72%] ${outgoing ? "bg-[#154d37]" : "bg-[#242626]"} ${first ? (outgoing ? "rounded-tr-none" : "rounded-tl-none") : ""}`}>
			{first && <BubbleTail outgoing={outgoing} />}
			{message.file && <div className="mb-1 rounded-md bg-black/20 p-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#3a8f5c]"><MdOutlineAndroid size={26} /></span>
					<span className="min-w-0 flex-1"><span className="block truncate text-[14px]">{message.file.name}</span><span className="block text-[12px] text-white/60">{message.file.sizeLabel}</span></span>
					<MdOutlineInsertDriveFile size={23} className="shrink-0 text-white/70" aria-hidden="true" />
				</div>
				<p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-4 text-amber-100">{message.file.note}</p>
			</div>}
			{message.text && <span className="whitespace-pre-wrap break-words">{message.text}</span>}
			<span className="ml-3 inline-flex items-center gap-1 whitespace-nowrap align-bottom text-[10px] leading-none text-white/60">{message.time}{outgoing && <MdDoneAll size={15} aria-label="Terkirim" />}</span>
		</div>
	</div>;
}

function DoodleWallpaper() {
	return <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.055]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, #d0d0d0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, #d0d0d0 1px, transparent 1.5px)", backgroundSize: "38px 38px, 54px 54px" }} />;
}

function messageFor(scenarioId: string, nodeId: string, messageId: string): ScenarioMessage | undefined {
	const selected = scenarios[scenarioId];
	if (!selected) return undefined;
	return selected.nodes[nodeId]?.messages.find((item) => item.id === messageId)
		?? Object.values(selected.nodes).flatMap((node) => node.decision.choices).flatMap((choice) => [choice.reply, ...(choice.followUp ?? [])]).find((item) => item.id === messageId);
}

function pendingIncoming(session: SimulationSession): { message: ScenarioMessage; nodeId: string }[] {
	const selected = scenarios[session.scenarioId];
	if (!selected) return [];
	const decisionIndex = session.events.findLastIndex((entry) => entry.type === "quick_action_selected" || entry.type === "free_text_submitted");
	let expected: { message: ScenarioMessage; nodeId: string }[];
	let receivedEvents = session.events;
	if (decisionIndex < 0) {
		expected = selected.nodes[session.currentNodeId].messages.map((message) => ({ message, nodeId: session.currentNodeId }));
	} else {
		const decisionEvent = session.events[decisionIndex];
		const node = selected.nodes[decisionEvent.nodeId];
		const choice = node?.decision.choices.find((candidate) => candidate.id === decisionEvent.actionId);
		if (!node || !choice) return [];
		const nextNodeId = choice.nextNodeId ?? node.id;
		const nodeMessages = choice.nextNodeId ? selected.nodes[choice.nextNodeId]?.messages ?? [] : [];
		const branchMessages = choice.followUp?.length ? [...choice.followUp, ...nodeMessages.slice(choice.followUp.length)] : nodeMessages;
		expected = [{ message: choice.reply, nodeId: node.id }, ...branchMessages.map((message) => ({ message, nodeId: nextNodeId }))];
		receivedEvents = session.events.slice(decisionIndex + 1);
	}
	const received = new Set(receivedEvents.filter((entry) => entry.type === "message_received").map((entry) => entry.scenarioMessageId));
	return expected.filter((item) => !received.has(item.message.id));
}

type MessageDelivery = (messages: { message: ScenarioMessage; nodeId: string }[], currentFlow: number, done: () => void) => void;

function StatusTag({ quality }: { quality: "protective" | "neutral" | "risky" }) {
	const labels = { protective: "Protektif", neutral: "Netral", risky: "Berisiko" };
	const styles = { protective: "bg-emerald-100 text-emerald-900", neutral: "bg-amber-100 text-amber-950", risky: "bg-rose-100 text-rose-900" };
	return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[quality]}`}>{labels[quality]}</span>;
}

function Debrief({ session, onRetry }: { session: SimulationSession; onRetry: () => void }) {
	const score = calculateSimulationScore(session);
	const encountered = scenario.indicators.filter((item) => session.encounteredIndicators.includes(item.id));
	const techniques = session.events.flatMap((entry) => {
		if (entry.type !== "message_received") return [];
		const message = entry.scenarioMessageId ? messageFor(session.scenarioId, entry.nodeId, entry.scenarioMessageId) : undefined;
		return message?.technique ? [{ id: `${entry.id}:${message.technique}`, technique: message.technique, quote: message.text }] : [];
	});
	const uniqueTechniques = techniques.filter((item, index) => techniques.findIndex((other) => other.technique === item.technique) === index);
	const exposureLabel = score.riskExposure < 20 ? "Rendah" : score.riskExposure < 55 ? "Sedang" : "Tinggi";
	const identityDecision = session.decisions.find((decision) => decision.nodeId === "identity");
	const fileDecision = session.decisions.find((decision) => decision.nodeId === "file");
	const pressureDecision = session.decisions.find((decision) => decision.nodeId === "pressure");
	const verificationDecision = session.decisions.find((decision) => decision.nodeId === "verification");
	const behaviorSignals = [
		["Kepercayaan sebelum verifikasi", identityDecision ? identityDecision.quality === "risky" ? "Mengikuti klaim sebelum memeriksa identitas." : identityDecision.quality === "protective" ? "Memilih langkah pemeriksaan sebelum mengikuti instruksi." : "Meminta keterangan, tetapi identitas tetap perlu dicek di luar chat." : "Titik ini tidak ditemui."],
		["Respons terhadap tekanan waktu", pressureDecision ? pressureDecision.quality === "risky" ? "Pilihan mengikuti tenggat yang diberikan pengirim." : pressureDecision.quality === "protective" ? "Pilihan menahan tekanan dan mengutamakan verifikasi." : "Pilihan meminta waktu, tetapi verifikasi independen tetap diperlukan." : "Titik ini tidak ditemui."],
		["Kesadaran terhadap APK", fileDecision ? session.recognizedIndicators.includes("apk_file") ? "Pilihan menunjukkan pengenalan risiko APK." : "Pilihan belum menunjukkan penolakan atau pemeriksaan APK." : "Titik ini tidak ditemui."],
		["Verifikasi independen", verificationDecision ? verificationDecision.quality === "protective" ? "Memilih kanal yang dibuka sendiri atau menolak permintaan data." : verificationDecision.quality === "neutral" ? "Meminta bukti kepada pengirim yang sama." : "Mengikuti permintaan data dari chat." : "Titik ini tidak ditemui."],
		["Mengikuti instruksi tanpa verifikasi", session.decisions.some((decision) => decision.quality === "risky") ? "Ada pilihan berisiko sebelum klaim diperiksa." : "Tidak tercatat pilihan berisiko mengikuti instruksi."],
		["Menghentikan percakapan", session.endReason === "protected_exit" ? "Simulasi diakhiri dengan tindakan protektif." : "Simulasi berakhir setelah paparan berlanjut."],
	];
	return <div className="h-full overflow-y-auto bg-[#f5f5f2] px-4 py-5 text-slate-900 sm:px-7 sm:py-7">
		<div className="mx-auto max-w-4xl space-y-5">
			<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
				<p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Analisis Perilaku Kamu</p>
				<h2 className="mt-2 text-3xl font-bold tracking-tight">{score.category}</h2>
				<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Skor ini merangkum pilihan yang kamu ambil di dalam skenario, bukan pengukuran psikologis atau prediksi pasti perilakumu di dunia nyata.</p>
				<div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
					{[
						["Skor keputusan", `${score.score}/100`], ["Protektif", String(score.protectiveDecisions)], ["Berisiko", String(score.riskyDecisions)],
						["Titik keputusan", `${score.decisionPointsFaced}/5`], ["Red flags dikenali", `${score.indicatorsRecognized}/${score.indicatorsEncountered}`], ["Paparan simulasi", exposureLabel],
					].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}
				</div>
				<p className="mt-3 text-xs text-slate-500">Paparan risiko adalah indikator simulasi berdasarkan konsekuensi pilihan, bukan ukuran risiko perangkat nyata. {score.coverage}</p>
			</section>

			<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
				<h3 className="text-lg font-bold">Pola keputusan yang tercatat</h3>
				<p className="mt-1 text-xs leading-5 text-slate-500">Ringkasan deterministik dari pilihan dalam skenario ini saja; bukan penilaian sifat atau kebiasaanmu di luar simulasi.</p>
				<dl className="mt-3 divide-y divide-slate-100">{behaviorSignals.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[220px_1fr]"><dt className="text-sm font-semibold text-slate-800">{label}</dt><dd className="text-sm leading-5 text-slate-600">{value}</dd></div>)}</dl>
			</section>

			<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
				<div className="flex items-center gap-2"><MdCheckCircle className="text-emerald-700" /><h3 className="text-lg font-bold">Decision timeline</h3></div>
				{session.decisions.length ? <ol className="mt-4 space-y-4 border-l border-slate-200 pl-4">{session.decisions.map((decision, index) => <li key={decision.id} className="relative rounded-xl bg-slate-50 p-4">
					<span className="absolute -left-[22px] top-5 h-3 w-3 rounded-full border-2 border-white bg-emerald-700 ring-1 ring-slate-300" />
					<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keputusan {index + 1} · {timeLabel(decision.at)}</p><StatusTag quality={decision.quality} /></div>
					<p className="mt-2 font-semibold">{decision.label}</p>
					<p className="mt-2 text-sm leading-5 text-slate-700"><strong>Bukti percakapan:</strong> “{decision.evidence}”</p>
					<p className="mt-2 text-sm leading-5 text-slate-600">{decision.whyItMatters}</p>
					<p className="mt-2 text-sm leading-5 text-emerald-900"><strong>Langkah lebih aman:</strong> {decision.saferAlternative}</p>
				</li>)}</ol> : <p className="mt-3 text-sm text-slate-600">Belum ada keputusan yang tercatat.</p>}
			</section>

			<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
				<h3 className="text-lg font-bold">Red flags yang kamu temui</h3>
				{encountered.length ? <div className="mt-4 divide-y divide-slate-100">{encountered.map((indicator) => <div key={indicator.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
					<div><p className="font-semibold">{indicator.name}</p><p className="mt-1 text-sm text-slate-600">{indicator.description} {indicator.whyItMatters}</p></div>
					<span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${session.recognizedIndicators.includes(indicator.id) ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"}`}>{session.recognizedIndicators.includes(indicator.id) ? "Dikenali dari pilihan" : "Belum tampak dikenali"}</span>
				</div>)}</div> : <p className="mt-3 text-sm text-slate-600">Tidak ada red flag yang sempat muncul di jalur simulasi ini.</p>}
				<p className="mt-2 text-xs text-slate-500">“Belum tampak dikenali” berarti pilihanmu tidak secara eksplisit menunjukkan pengenalan indikator; itu bukan kesimpulan tentang kemampuanmu di luar simulasi.</p>
			</section>

			<section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
				<h3 className="text-lg font-bold">Teknik manipulasi dalam percakapan</h3>
				{uniqueTechniques.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{uniqueTechniques.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 p-4"><p className="font-semibold">{techniqueNames[item.technique]}</p><blockquote className="mt-2 border-l-2 border-amber-400 pl-3 text-sm italic text-slate-700">“{item.quote}”</blockquote><p className="mt-2 text-xs leading-5 text-slate-500">Teknik ini dapat mendorong seseorang bertindak sebelum sempat memeriksa sumber dan risikonya.</p></div>)}</div> : <p className="mt-3 text-sm text-slate-600">Tidak ada teknik yang tercatat pada jalur ini.</p>}
			</section>

			<section className="rounded-2xl bg-[#16382e] p-5 text-white sm:p-7">
				<h3 className="text-lg font-bold">Personal Safety Playbook</h3>
				<ol className="mt-4 grid gap-x-7 gap-y-3 sm:grid-cols-2">{scenario.playbook.map((tip, index) => <li key={tip} className="flex gap-3 text-sm leading-5 text-white/85"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">{index + 1}</span>{tip}</li>)}</ol>
				<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-5"><p className="max-w-xl text-xs leading-5 text-white/60">Skenario dan seluruh identitasnya fiktif. Pilihan yang kamu ambil tersimpan secara lokal pada perangkat ini.</p><button type="button" onClick={onRetry} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-emerald-100">Coba ulang dari awal</button><Link href="/terlanjur" className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white/90 transition-colors hover:bg-white/20">Sudah terlanjur? Lihat langkahnya</Link></div>
			</section>
		</div>
	</div>;
}

export default function Simulasi() {
	const [session, setSession] = useState<SimulationSession | null>(null);
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [typing, setTyping] = useState(false);
	const [busy, setBusy] = useState(false);
	const [history, setHistory] = useState<SimulationSession[]>([]);
	const [lastRun, setLastRun] = useState<SimulationSession | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const sessionRef = useRef<SimulationSession | null>(null);
	const deliveryRef = useRef<MessageDelivery | null>(null);
	const actionInProgress = useRef(false);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const flowId = useRef(0);

	const commitSession = useCallback((next: SimulationSession) => {
		sessionRef.current = next;
		setSession(next);
		setHistory(writeSimulationSession(next));
	}, []);

	useEffect(() => {
		let live = true;
		queueMicrotask(() => {
			if (!live) return;
			const stored = readSimulationSessions();
			setHistory(stored);
			const active = stored.find((item) => item.status === "active");
			if (active) {
				const selectedScenario = scenarios[active.scenarioId];
				if (selectedScenario) {
					sessionRef.current = active;
					setSession(active);
					setChatMessages(rebuildChat(active, selectedScenario));
					const pending = pendingIncoming(active);
					const lastAction = [...active.events].reverse().find((entry) => entry.type === "quick_action_selected" || entry.type === "free_text_submitted");
					const lastNode = lastAction ? selectedScenario.nodes[lastAction.nodeId] : undefined;
					const lastChoice = lastNode?.decision.choices.find((choice) => choice.id === lastAction?.actionId);
					const finishRestore = () => {
						const current = sessionRef.current;
						if (lastChoice?.nextNodeId === null && current?.status === "active") {
							const score = calculateSimulationScore(current).score;
							const completed = { ...completeSimulation(current, lastChoice.endReason ?? "continued_exposure"), finalScore: score };
							commitSession(completed);
							setLastRun(completed);
						}
					};
					if (pending.length) {
						flowId.current += 1;
						setBusy(true);
						deliveryRef.current?.(pending, flowId.current, finishRestore);
					} else {
						setBusy(false);
						finishRestore();
					}
				}
			} else setLastRun(stored.find((item) => item.status === "completed") ?? null);
		});
		return () => { live = false; };
		}, [commitSession]);

	useEffect(() => {
		const element = scrollRef.current;
		if (element) element.scrollTop = element.scrollHeight;
	}, [chatMessages, typing, session?.status]);

	useEffect(() => {
		if (session?.status === "active" && !busy) inputRef.current?.focus();
	}, [session?.status, busy]);

	useEffect(() => () => {
		flowId.current += 1;
		timers.current.forEach(clearTimeout);
	}, [commitSession]);

	const schedule = useCallback((callback: () => void, delay: number, currentFlow: number) => {
		const timer = setTimeout(() => {
			timers.current = timers.current.filter((item) => item !== timer);
			if (flowId.current === currentFlow) callback();
		}, delay);
		timers.current.push(timer);
	}, []);

	const deliverMessages = useCallback((messages: { message: ScenarioMessage; nodeId: string }[], currentFlow: number, done: () => void) => {
		setBusy(true);
		let index = 0;
		const deliverNext = () => {
			if (flowId.current !== currentFlow) return;
			if (index >= messages.length) {
				setTyping(false);
				setBusy(false);
				actionInProgress.current = false;
				done();
				return;
			}
			const item = messages[index++];
			const { message, nodeId } = item;
			setTyping(true);
			schedule(() => {
				setTyping(false);
				setChatMessages((current) => [...current, { id: `${currentFlow}:bot:${nodeId}:${message.id}:${index}`, from: "them", time: timeLabel(new Date()), text: message.text, file: message.file }]);
				const currentSession = sessionRef.current;
				if (currentSession) commitSession(recordReceivedMessage(currentSession, nodeId, message));
				if (index < messages.length) {
					setTyping(true);
					schedule(deliverNext, 420, currentFlow);
				} else {
					setBusy(false);
					actionInProgress.current = false;
					done();
				}
			}, 520, currentFlow);
		};
		deliverNext();
	}, [commitSession, schedule]);

	useEffect(() => {
		deliveryRef.current = deliverMessages;
	}, [deliverMessages]);

	const begin = () => {
		timers.current.forEach(clearTimeout);
		timers.current = [];
		actionInProgress.current = false;
		flowId.current += 1;
		const currentFlow = flowId.current;
		if (sessionRef.current?.status === "active") {
			const abandoned = markAbandoned(sessionRef.current);
			setHistory(writeSimulationSession(abandoned));
		}
		const next = createSimulationSession(scenario);
		commitSession(next);
		setChatMessages([]);
		setDraft("");
		setBusy(true);
		setTyping(false);
		deliverMessages(scenario.nodes[scenario.startNodeId].messages.map((message) => ({ message, nodeId: scenario.startNodeId })), currentFlow, () => {});
	};

	const submitAction = (action: { mode: "quick_action"; choiceId: string } | { mode: "free_text"; text: string }, visibleText: string) => {
		const current = sessionRef.current;
		if (!current || current.status !== "active" || busy || actionInProgress.current) return;
		const result = applyUserAction(scenario, current, action);
		if (!result) return;
		actionInProgress.current = true;
		flowId.current += 1;
		const currentFlow = flowId.current;
		setBusy(true);
		setTyping(false);
		setChatMessages((items) => [...items, { id: `${currentFlow}:user`, from: "me", time: timeLabel(new Date()), text: visibleText }]);
		setDraft("");
		commitSession(result.session);
		const sequence = [
			{ message: result.reply, nodeId: current.currentNodeId },
			...result.nextMessages.map((message) => ({ message, nodeId: result.nextNodeId })),
		];
		deliverMessages(sequence, currentFlow, () => {
			const afterReply = sessionRef.current;
			if (result.completed && afterReply) {
				const score = calculateSimulationScore(afterReply).score;
				commitSession({ ...completeSimulation(afterReply, result.choice.endReason ?? "continued_exposure"), finalScore: score });
				setLastRun(sessionRef.current);
			}
		});
	};

	const sendFreeText = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const text = draft.trim();
		if (!text) return;
		submitAction({ mode: "free_text", text }, text);
	};

	const restart = () => {
		if (session?.status === "completed") setLastRun(session);
		begin();
	};

	const activeNode = session?.status === "active" ? scenario.nodes[session.currentNodeId] : null;
	const canChoose = Boolean(activeNode && !busy && !typing);
	const showHome = !session;

	return <main className="flex h-full min-h-0 w-full bg-[#161717] text-[#e9edef]">
		<nav aria-label="Navigasi simulasi" className="hidden h-full w-16 shrink-0 flex-col items-center border-r border-[#2a2d2d] py-3 md:flex">
			<div className="flex flex-col items-center gap-2"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#242626] text-emerald-300"><MdShield size={23} /></span><span className="my-2 h-px w-9 bg-[#2a2d2d]" /><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1e3a2d] text-emerald-300"><MdChat size={23} /></span></div>
			<div className="mt-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#343b38] text-[#d0d0d0]"><MdPerson size={22} /></div>
		</nav>

		<aside className="hidden h-full w-[34%] min-w-[300px] max-w-[430px] shrink-0 flex-col border-r border-[#2a2d2d] md:flex">
			<div className="flex items-center justify-between px-6 pb-3 pt-5"><h1 className="text-2xl font-bold tracking-tight">Simulator</h1><MdMoreVert size={23} className="text-[#a5a5a5]" /></div>
			<div className="px-5 pb-4"><div className="flex h-10 items-center gap-3 rounded-full bg-[#242626] px-4 text-[#a5a5a5]"><MdSearch size={20} /><span className="text-sm">Cari simulasi</span></div></div>
			<p className="px-6 pb-2 text-xs font-semibold uppercase tracking-wider text-[#8b9490]">Simulasi tersedia</p>
			<button type="button" onClick={() => session ? restart() : begin()} className={`flex min-h-[82px] items-center gap-3 px-5 text-left transition-colors hover:bg-[#202222] ${session ? "bg-[#242626]" : ""}`}>
				<PersonAvatar size={46} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-[15px] font-semibold">{scenario.title}</span><span className="text-[11px] text-emerald-400">{scenario.estimatedMinutes} mnt</span></span><span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#a5a5a5]">{scenario.description}</span></span>
			</button>
			<div className="mt-auto border-t border-[#2a2d2d] px-5 py-4 text-xs leading-5 text-[#8e9692]">Skenario edukasi deterministik. Tidak ada AI eksternal atau file berbahaya.</div>
		</aside>

		<section className="relative flex min-w-0 flex-1 flex-col">
			<header className="relative z-20 flex min-h-[66px] shrink-0 items-center justify-between gap-3 border-b border-[#2a2d2d] bg-[#161717] px-3 py-2 sm:px-5">
				<div className="flex min-w-0 items-center gap-3"><PersonAvatar size={40} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold sm:text-base">{showHome ? "Scam Awareness Simulator" : scenario.contactName}</h2><p className="truncate text-xs text-[#a5a5a5]">{showHome ? "Experience before it happens" : "Identitas fiktif · kontak tidak dikenal"}</p></div></div>
				<div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1.5 text-[10px] font-bold tracking-[0.12em] text-amber-200 sm:px-3 sm:text-xs"><MdWarningAmber size={15} />MODE SIMULASI</span>{session && <button type="button" onClick={restart} className="rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">{session.status === "completed" ? "Ulangi" : "Mulai ulang"}</button>}</div>
			</header>
			<div role="note" className="relative z-10 flex shrink-0 items-start gap-2 border-b border-amber-200/10 bg-[#25251e] px-4 py-2 text-[11px] leading-4 text-amber-100/85 sm:px-5"><MdWarningAmber className="mt-0.5 shrink-0" size={15} /><span>Seluruh nama, pesan, nomor, dan lampiran adalah fiktif. APK hanya visual dan tidak dapat diunduh atau dijalankan.</span></div>

			{showHome ? <div className="flex-1 overflow-y-auto bg-[#1c1e1e] px-5 py-8 sm:px-10 sm:py-12"><div className="mx-auto max-w-2xl">
				<p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Experience before it happens</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Latih keputusan sebelum menghadapi penipuan sungguhan.</h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#aeb5b1]">Jalani percakapan bercabang dengan pelaku fiktif. Setiap pilihan mengubah respons, paparan risiko, dan bahan evaluasi setelah simulasi.</p>
				<div className="mt-7 rounded-2xl border border-white/10 bg-[#242626] p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">{scenario.difficulty}</span><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">{scenario.estimatedMinutes} menit</span><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">5 titik keputusan</span></div><h2 className="mt-4 text-xl font-bold">{scenario.title}</h2><p className="mt-2 text-sm leading-6 text-[#aeb5b1]">{scenario.context}</p><ul className="mt-4 grid gap-2 text-sm text-white/80 sm:grid-cols-2"><li className="flex gap-2"><MdCheck className="mt-0.5 text-emerald-300" />Chat bercabang berdasarkan responsmu</li><li className="flex gap-2"><MdCheck className="mt-0.5 text-emerald-300" />Bisa pilih aksi atau mengetik bebas</li><li className="flex gap-2"><MdCheck className="mt-0.5 text-emerald-300" />Evaluasi berdasar keputusan aktual</li><li className="flex gap-2"><MdCheck className="mt-0.5 text-emerald-300" />Progress tersimpan di perangkat ini</li></ul><button type="button" onClick={begin} className="mt-6 rounded-full bg-[#21c063] px-6 py-3 text-sm font-bold text-[#0b141a] transition-colors hover:bg-[#46d77f]">Mulai simulasi <span aria-hidden="true">→</span></button></div>
				{lastRun && <p className="mt-4 text-xs text-[#9ca5a0]">Simulasi terakhir selesai dengan skor {lastRun.finalScore ?? calculateSimulationScore(lastRun).score}/100. Kamu bisa mengulang dari awal.</p>}
				{history.length > 0 && <p className="mt-2 text-[11px] text-[#79817d]">{history.length} sesi simulasi tersimpan secara lokal.</p>}
				<p className="mt-6 text-xs leading-5 text-[#7f8984]">Pilihanmu disimpan secara lokal untuk menampilkan riwayat dan debrief. Teks bebas tidak disimpan. Hasil ini adalah materi edukasi, bukan penilaian psikologis.</p>
			</div></div> : session?.status === "completed" ? <Debrief session={session} onRetry={restart} /> : <>
				<div className="relative min-h-0 flex-1 overflow-hidden bg-[#1c1e1e]"><DoodleWallpaper /><div ref={scrollRef} className="absolute inset-0 overflow-y-auto px-3 pb-5 pt-3 sm:px-8 sm:pt-5">
					<div className="mx-auto mb-3 flex w-fit max-w-[95%] items-start gap-2 rounded-lg bg-[#25251e] px-3 py-2 text-center text-[11px] leading-4 text-amber-100 sm:max-w-[82%] sm:text-xs"><MdShield size={15} className="mt-0.5 shrink-0" /><span>{scenario.context} MODE SIMULASI aktif. Pilihanmu tidak menghubungi siapa pun.</span></div>
					<div className="my-3 flex justify-center"><span className="rounded-lg bg-[#242626] px-3 py-1 text-xs text-[#a5a5a5]">{new Date(session.startedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
					{chatMessages.map((message, index) => <MessageBubble key={message.id} message={message} first={index === 0 || chatMessages[index - 1].from !== message.from} />)}
					{typing && <div className="mt-3 flex justify-start"><div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-[#242626] px-4 py-3" role="status" aria-label="Kurir sedang mengetik">{[0, 1, 2].map((item) => <span key={item} className="h-2 w-2 animate-bounce rounded-full bg-[#a5a5a5]" style={{ animationDelay: `${item * 130}ms` }} />)}</div></div>}
				</div></div>
				<div className="relative z-10 shrink-0 border-t border-[#2a2d2d] bg-[#161717] px-3 pb-3 pt-2 sm:px-5">
					{canChoose && activeNode && <><p className="mx-auto mb-2 max-w-5xl text-xs font-medium text-white/75">{activeNode.decision.question}</p><div className="mx-auto mb-2 flex max-w-5xl gap-2 overflow-x-auto pb-1" aria-label="Pilihan respons">{activeNode.decision.choices.map((choice) => <button key={choice.id} type="button" onClick={() => submitAction({ mode: "quick_action", choiceId: choice.id }, choice.label)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:text-[13px] ${choice.quality === "risky" ? "border-rose-300/30 bg-rose-300/5 text-rose-100 hover:bg-rose-300/15" : choice.quality === "protective" ? "border-emerald-300/30 bg-emerald-300/5 text-emerald-100 hover:bg-emerald-300/15" : "border-white/15 bg-white/5 text-white/85 hover:bg-white/10"}`}>{choice.label}</button>)}</div></>}
					{busy && <p className="mx-auto mb-2 max-w-5xl text-xs text-[#a5a5a5]" role="status">{typing ? `${scenario.contactName} sedang mengetik…` : "Memuat percakapan simulasi…"}</p>}
					<form onSubmit={sendFreeText} className="mx-auto flex h-[50px] max-w-5xl items-center gap-3 rounded-full bg-[#242626] px-4 sm:gap-4 sm:px-5"><PiPaperclip size={22} className="shrink-0 text-[#8e9692]" aria-hidden="true" /><input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!canChoose} placeholder={canChoose ? "Ketik responsmu sendiri…" : "Tunggu pesan berikutnya…"} className="h-full min-w-0 flex-1 bg-transparent text-sm text-[#e9edef] placeholder:text-[#8e9692] focus:outline-none disabled:opacity-60" /><button type="submit" disabled={!canChoose || !draft.trim()} aria-label="Kirim respons" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#21c063] text-[#0b141a] disabled:bg-white/10 disabled:text-white/30"><MdSend size={20} /></button></form>
					{canChoose && <p className="mx-auto mt-2 max-w-5xl text-[10px] text-[#79817d]">Pesan bebas diproses dengan pencocokan kata sederhana. Teks yang kamu ketik tidak disimpan di riwayat.</p>}
				</div>
			</>}
		</section>
	</main>;
}
