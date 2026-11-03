"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	FiAlertTriangle,
	FiArrowLeft,
	FiArrowRight,
	FiCheck,
	FiCheckCircle,
	FiChevronDown,
	FiClipboard,
	FiShield,
	FiTrash2,
} from "react-icons/fi";
import {
	ACTION_STEPS,
	buildActionPlan,
	buildGuardianWarning,
	buildIncidentSummary,
	INCIDENTS,
	OFFICIAL_SOURCES,
	urgencyLabel,
	type IncidentId,
	type IncidentWhen,
	type Urgency,
} from "@/lib/act/plan";
import {
	clearActPlan,
	emptyActPlan,
	getBrowserStorage,
	readActPlan,
	writeActPlan,
	type ActPlanState,
} from "@/lib/act/storage";

const WHEN_OPTIONS: { value: IncidentWhen; label: string; hint: string }[] = [
	{ value: "recent", label: "Baru saja", hint: "dalam 1 jam terakhir" },
	{ value: "today", label: "Hari ini", hint: "lebih dari 1 jam tapi hari ini" },
	{ value: "older", label: "Lebih dari sehari lalu", hint: "kemarin atau lebih lama" },
];

const URGENCY_COLOR: Record<Urgency, string> = {
	now: "text-red-700 bg-red-50 border-red-200",
	hour: "text-amber-800 bg-amber-50 border-amber-200",
	today: "text-slate-700 bg-slate-50 border-slate-200",
	week: "text-slate-600 bg-slate-50 border-slate-100",
};

const URGENCY_BADGE: Record<Urgency, string> = {
	now: "bg-red-100 text-red-800",
	hour: "bg-amber-100 text-amber-800",
	today: "bg-slate-200 text-slate-700",
	week: "bg-slate-100 text-slate-600",
};

function useCopyToClipboard() {
	const [copied, setCopied] = useState(false);
	const copy = useCallback((text: string) => {
		navigator.clipboard.writeText(text).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		}).catch(() => {
			// Fallback for older browsers
			const el = document.createElement("textarea");
			el.value = text;
			document.body.appendChild(el);
			el.select();
			document.execCommand("copy");
			document.body.removeChild(el);
			setCopied(true);
			setTimeout(() => setCopied(false), 2500);
		});
	}, []);
	return { copied, copy };
}

function ProgressBar({ done, total }: { done: number; total: number }) {
	if (total === 0) return null;
	const pct = Math.round((done / total) * 100);
	return (
		<div className="flex items-center gap-3">
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label={`${done} dari ${total} langkah selesai`}>
				<div className="h-full rounded-full bg-emerald-500 transition-all duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
			</div>
			<p className="shrink-0 text-sm font-semibold text-slate-700">{done} dari {total} selesai</p>
		</div>
	);
}

function StepItem({
	step,
	checked,
	onToggle,
}: {
	step: (typeof ACTION_STEPS)[number];
	checked: boolean;
	onToggle: () => void;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className={`rounded-2xl border p-4 transition-colors ${checked ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
			<div className="flex items-start gap-3">
				<button
					type="button"
					onClick={onToggle}
					aria-pressed={checked}
					aria-label={`${checked ? "Tandai belum selesai" : "Tandai selesai"}: ${step.title}`}
					className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white hover:border-slate-500"}`}
				>
					{checked && <FiCheck size={13} />}
				</button>
				<div className="min-w-0 flex-1">
					<p className={`font-semibold leading-5 ${checked ? "text-slate-400 line-through" : "text-slate-900"}`}>{step.title}</p>
					<p className="mt-1.5 text-sm leading-5 text-slate-600">{step.description}</p>
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						aria-expanded={open}
						className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
					>
						Kenapa ini penting
						<FiChevronDown size={13} className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
					</button>
					{open && (
						<div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700 ring-1 ring-slate-100">
							<p>{step.why}</p>
							{step.channelInstruction && (
								<p className="mt-2 font-semibold text-slate-800">{step.channelInstruction}</p>
							)}
							{step.sourceIds.length > 0 && (
								<ul className="mt-2 space-y-1">
									{step.sourceIds.map((sid) => {
										const src = OFFICIAL_SOURCES[sid];
										return (
											<li key={sid}>
												<a
													href={src.url}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center gap-1 text-slate-600 underline underline-offset-2 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
												>
													{src.name}
													<FiArrowRight size={11} aria-hidden="true" />
												</a>
												<span className="ml-1 text-slate-400">(diverifikasi {src.verifiedAt})</span>
											</li>
										);
									})}
								</ul>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default function TerlanjurPage() {
	const [state, setState] = useState<ActPlanState>(emptyActPlan);
	const [showResults, setShowResults] = useState(false);
	const [storageAvailable, setStorageAvailable] = useState(true);
	const resultsRef = useRef<HTMLDivElement>(null);
	const { copied: summaryCopied, copy: copySummary } = useCopyToClipboard();
	const { copied: warningCopied, copy: copyWarning } = useCopyToClipboard();

	const isHydratedRef = useRef(false);

	// Load from localStorage on mount
	useEffect(() => {
		let live = true;
		queueMicrotask(() => {
			if (!live) return;
			const storage = getBrowserStorage();
			const result = readActPlan(storage);
			setStorageAvailable(result.available);
			if (result.hadSavedPlan) {
				setState(result.state);
				setShowResults(true);
			}
			isHydratedRef.current = true;
		});
		return () => {
			live = false;
		};
	}, []);

	// Persist state on every change after hydration
	useEffect(() => {
		if (!isHydratedRef.current) return;
		const storage = getBrowserStorage();
		writeActPlan(storage, state);
	}, [state]);

	const toggleIncident = (id: IncidentId) => {
		setState((prev) => {
			const set = new Set(prev.incidentIds);
			if (set.has(id)) set.delete(id);
			else set.add(id);
			return { ...prev, incidentIds: [...set] };
		});
	};

	const toggleStep = (stepId: string) => {
		setState((prev) => {
			const set = new Set(prev.completedStepIds);
			if (set.has(stepId)) set.delete(stepId);
			else set.add(stepId);
			return { ...prev, completedStepIds: [...set] };
		});
	};

	const handleShowResults = () => {
		if (state.incidentIds.length === 0) return;
		setShowResults(true);
		setTimeout(() => {
			resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
			resultsRef.current?.focus();
		}, 100);
	};

	const handleClear = () => {
		const storage = getBrowserStorage();
		clearActPlan(storage);
		setState(emptyActPlan());
		setShowResults(false);
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	const plan = buildActionPlan(state.incidentIds);
	const urgencyGroups = (["now", "hour", "today", "week"] as Urgency[]).map((urgency) => ({
		urgency,
		steps: plan.filter((s) => s.urgency === urgency),
	})).filter((g) => g.steps.length > 0);

	const completedCount = plan.filter((s) => state.completedStepIds.includes(s.id)).length;

	const whenLabel = WHEN_OPTIONS.find((o) => o.value === state.when)?.label ?? "Baru saja";
	const openingByWhen = {
		recent: "Kamu baru saja mengalami ini. Langkah di bawah disusun berdasarkan urgensi — mulai dari yang paling mendesak.",
		today: "Masih ada langkah yang bisa diambil hari ini. Lakukan sesuai urutan untuk hasil yang lebih baik.",
		older: "Meski sudah berlalu, masih ada tindakan yang berguna. Tidak ada kata terlambat untuk mengamankan akun dan mendokumentasikan kejadian.",
	}[state.when];

	const evidenceList = [
		"Tangkapan layar percakapan lengkap dengan profil pelaku (nama, foto, nomor)",
		"Bukti transfer atau pembayaran (struk, tangkapan layar notifikasi)",
		"Nomor rekening, nama, atau akun tujuan transaksi",
		"Tautan atau nama file yang dibuka/dipasang",
		"Waktu dan tanggal kejadian (catat secara detail)",
		"Sumber tawaran (nama platform, nama iklan, nama grup)",
		"Nomor laporan dari bank atau platform (jika sudah melapor)",
	];

	// Suppress unused variable warning — URGENCY_BADGE is referenced in JSX below
	void URGENCY_BADGE;

	return (
		<main className="min-h-screen bg-gray-100 px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
			<div className="mx-auto max-w-4xl">
				{/* Header */}
				<header className="animate-fade-up motion-reduce:animate-none">
					<Link
						href="/"
						className="group inline-flex items-center gap-2 rounded-full py-1 pr-3 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
					>
						<FiArrowLeft size={16} className="transition-transform group-hover:-translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
						Kembali ke beranda
					</Link>
					<div className="mt-8 max-w-3xl">
						<p className="text-sm font-semibold text-amber-700">Jaga · Bertindak</p>
						<h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
							Sudah terlanjur?{" "}
							<span className="text-amber-600">Tenang, mulai dari sini.</span>
						</h1>
						<p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
							Banyak orang pernah mengalami ini. Yang penting sekarang adalah langkah berikutnya, bukan menyalahkan diri.
							Pilih apa yang sudah terjadi dan kami bantu menyusun langkah yang perlu diambil.
						</p>
						<p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-800">
							<FiShield size={15} aria-hidden="true" />
							Tidak ada data pribadi yang diminta. Pilihan tersimpan di browser kamu saja.
						</p>
					</div>
				</header>

				{/* Selection form */}
				<section aria-labelledby="pilih-kejadian-title" className="mt-10 animate-fade-up motion-reduce:animate-none" style={{ animationDelay: "100ms" }}>
					<h2 id="pilih-kejadian-title" className="text-xl font-bold tracking-tight text-slate-900">
						1. Pilih apa yang sudah terjadi
					</h2>
					<p className="mt-1 text-sm text-slate-500">Boleh lebih dari satu.</p>
					<div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="Pilih kejadian yang dialami">
						{INCIDENTS.map((incident) => {
							const selected = state.incidentIds.includes(incident.id);
							return (
								<button
									key={incident.id}
									type="button"
									onClick={() => toggleIncident(incident.id)}
									aria-pressed={selected}
									className={`flex min-h-[3.5rem] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
										selected
											? "border-slate-900 bg-slate-900 text-white"
											: "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-50"
									}`}
								>
									<span className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-white bg-white" : "border-slate-300"}`} aria-hidden="true">
										{selected && <FiCheck size={12} className="text-slate-900" />}
									</span>
									{incident.label}
								</button>
							);
						})}
					</div>
					{state.incidentIds.length === 0 && (
						<p className="mt-3 text-sm text-slate-500" role="status">Pilih setidaknya satu kejadian untuk melanjutkan.</p>
					)}
				</section>

				{/* When selector */}
				<section aria-labelledby="kapan-title" className="mt-8 animate-fade-up motion-reduce:animate-none" style={{ animationDelay: "150ms" }}>
					<h2 id="kapan-title" className="text-xl font-bold tracking-tight text-slate-900">2. Kapan kejadiannya?</h2>
					<div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Kapan kejadian terjadi">
						{WHEN_OPTIONS.map((opt) => (
							<button
								key={opt.value}
								type="button"
								role="radio"
								aria-checked={state.when === opt.value}
								onClick={() => setState((prev) => ({ ...prev, when: opt.value }))}
								className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
									state.when === opt.value
										? "border-slate-900 bg-slate-900 text-white"
										: "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
								}`}
							>
								{opt.label}
								<span className="ml-1.5 font-normal text-current/70">({opt.hint})</span>
							</button>
						))}
					</div>
				</section>

				{/* CTA button */}
				<div className="mt-8 animate-fade-up motion-reduce:animate-none" style={{ animationDelay: "200ms" }}>
					<button
						type="button"
						onClick={handleShowResults}
						disabled={state.incidentIds.length === 0}
						className="group inline-flex h-12 items-center gap-3 rounded-full bg-slate-900 px-7 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
					>
						Tampilkan langkahnya
						<FiArrowRight className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
					</button>
					{!storageAvailable && (
						<p className="mt-2 text-xs text-amber-700">localStorage tidak tersedia; kemajuan tidak akan tersimpan di sesi ini.</p>
					)}
				</div>

				{/* Results */}
				{showResults && state.incidentIds.length > 0 && (
					<div
						ref={resultsRef}
						tabIndex={-1}
						aria-label="Rencana langkah tindakan"
						className="mt-12 animate-fade-up space-y-6 motion-reduce:animate-none focus:outline-none"
					>
						{/* Opening by timing */}
						<section className="rounded-3xl bg-slate-900 p-6 text-white sm:p-8">
							<p className="text-sm font-semibold text-amber-300">Langkah untuk: {whenLabel}</p>
							<h2 className="mt-2 text-2xl font-bold sm:text-3xl">Rencana langkahmu</h2>
							<p className="mt-3 text-sm leading-6 text-white/80">{openingByWhen}</p>
							<div className="mt-5">
								<ProgressBar done={completedCount} total={plan.length} />
							</div>
						</section>

						{/* Steps by urgency group */}
						{urgencyGroups.map(({ urgency, steps }) => (
							<section key={urgency} aria-labelledby={`urgency-${urgency}`}>
								<div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-bold ${URGENCY_COLOR[urgency]}`}>
									<span className={`flex size-2 rounded-full ${urgency === "now" ? "bg-red-500" : urgency === "hour" ? "bg-amber-500" : "bg-slate-400"}`} aria-hidden="true" />
									<span id={`urgency-${urgency}`}>{urgencyLabel(urgency)}</span>
								</div>
								<div className="space-y-3">
									{steps.map((step) => (
										<StepItem
											key={step.id}
											step={step}
											checked={state.completedStepIds.includes(step.id)}
											onToggle={() => toggleStep(step.id)}
										/>
									))}
								</div>
							</section>
						))}

						{/* Evidence collection */}
						<section aria-labelledby="evidence-title" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
							<h2 id="evidence-title" className="flex items-center gap-2 text-xl font-bold text-slate-900">
								<FiClipboard className="shrink-0 text-slate-500" aria-hidden="true" />
								Siapkan bukti
							</h2>
							<p className="mt-2 text-sm leading-5 text-slate-600">
								Simpan dan foto hal-hal ini sebelum percakapan atau akun berubah. Semuanya tetap di perangkatmu — tidak ada yang diunggah ke Jaga.
							</p>
							<ul className="mt-4 space-y-2">
								{evidenceList.map((item) => (
									<li key={item} className="flex items-start gap-2.5 text-sm leading-5 text-slate-700">
										<FiCheckCircle className="mt-0.5 shrink-0 text-slate-400" size={16} aria-hidden="true" />
										{item}
									</li>
								))}
							</ul>
						</section>

						{/* Summary copy */}
						<section aria-labelledby="summary-title" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
							<h2 id="summary-title" className="text-xl font-bold text-slate-900">Salin ringkasan kejadian</h2>
							<p className="mt-2 text-sm leading-5 text-slate-600">
								Aplikasi menyusun kerangka laporan berdasarkan pilihanmu. Bagian <code className="rounded bg-slate-100 px-1 text-xs">[isi sendiri]</code> harus kamu isi dengan data aktual sebelum melaporkan — aplikasi tidak meminta kamu mengetiknya di sini.
							</p>
							<button
								type="button"
								onClick={() => copySummary(buildIncidentSummary(state.incidentIds, state.when, state.completedStepIds))}
								className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-900 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
							>
								{summaryCopied ? <FiCheck aria-hidden="true" /> : <FiClipboard aria-hidden="true" />}
								{summaryCopied ? "Tersalin!" : "Salin ringkasan"}
							</button>
						</section>

						{/* Guardian warning */}
						<section aria-labelledby="guardian-title" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
							<h2 id="guardian-title" className="flex items-center gap-2 text-xl font-bold text-slate-900">
								<FiAlertTriangle className="shrink-0 text-amber-700" aria-hidden="true" />
								Beri tahu orang lain
							</h2>
							<p className="mt-2 text-sm leading-5 text-slate-700">
								{state.incidentIds.includes("account-taken")
									? "Akun yang diambil alih dapat dipakai untuk menghubungi kontak-kontakmu. Kabari keluarga dan teman lewat telepon, bertemu langsung, atau akun lain yang masih kamu kuasai."
									: "Jika ada anggota keluarga atau teman yang mungkin menerima tawaran serupa, beri tahu mereka agar tidak tertipu juga."}
							</p>
							<button
								type="button"
								onClick={() => copyWarning(buildGuardianWarning(state.incidentIds))}
								className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-800/30 bg-white px-5 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
							>
								{warningCopied ? <FiCheck aria-hidden="true" /> : <FiClipboard aria-hidden="true" />}
								{warningCopied ? "Tersalin!" : "Salin teks peringatan"}
							</button>
						</section>

						{/* Fraud site / recovery scam warning */}
						<section aria-labelledby="scam-warning-title" className="rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8">
							<h2 id="scam-warning-title" className="flex items-center gap-2 text-xl font-bold text-slate-900">
								<FiAlertTriangle className="shrink-0 text-red-700" aria-hidden="true" />
								Waspadai penipuan lanjutan
							</h2>
							<ul className="mt-3 space-y-3 text-sm leading-5 text-slate-700">
								<li className="flex gap-2">
									<FiAlertTriangle className="mt-0.5 shrink-0 text-red-600" size={15} aria-hidden="true" />
									<span>
										<strong>Situs palsu mengatasnamakan IASC:</strong> OJK memperingatkan adanya situs tiruan. Pastikan alamat pelaporan resmi adalah{" "}
										<a href="https://iasc.ojk.go.id" target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-slate-900">
											iasc.ojk.go.id
										</a>{" "}
										— ketik langsung, jangan klik tautan dari pesan.
									</span>
								</li>
								<li className="flex gap-2">
									<FiAlertTriangle className="mt-0.5 shrink-0 text-red-600" size={15} aria-hidden="true" />
									<span>
										<strong>Jasa pemulihan dana palsu:</strong> OJK memperingatkan modus yang meminta biaya pemulihan dengan janji uang pasti kembali. Jangan membayar siapa pun yang menjanjikan itu.
									</span>
								</li>
							</ul>
						</section>

						{/* Footer links */}
						<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
							<h2 className="text-lg font-bold text-slate-900">Langkah selanjutnya</h2>
							<div className="mt-4 flex flex-col gap-3 sm:flex-row">
								<Link
									href="/simulasi"
									className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
								>
									Latihan agar tidak terulang
									<FiArrowRight aria-hidden="true" />
								</Link>
								<Link
									href="/batasan"
									className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
								>
									Batasan &amp; privasi
								</Link>
							</div>
							<p className="mt-4 text-xs leading-5 text-slate-500">
								Panduan ini bukan nasihat hukum atau keuangan profesional. Kanal resmi dapat berubah; selalu verifikasi dari situs resminya.
							</p>
						</section>

						{/* Clear data */}
						<div className="flex justify-end border-t border-slate-200 pt-4">
							<button
								type="button"
								onClick={handleClear}
								className="inline-flex items-center gap-2 rounded-full border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
							>
								<FiTrash2 size={15} aria-hidden="true" />
								Hapus data saya
							</button>
						</div>
					</div>
				)}
			</div>
		</main>
	);
}
