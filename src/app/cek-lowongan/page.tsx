"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
	FiArrowLeft,
	FiArrowRight,
	FiCheck,
	FiClock,
	FiLock,
	FiPause,
	FiPlay,
	FiRefreshCw,
	FiUploadCloud,
	FiX,
} from "react-icons/fi";
import type { InvestigationReport } from "@/lib/job-investigation/types";
import { preprocessPoster } from "@/lib/job-investigation/browser-image";

type Answer = "ya" | "tidak" | "ragu";
type Stage = "input" | "loading" | "result";

type AnalysisInput = {
	caption: string;
	poster: File | null;
	answers: Record<string, Answer | null>;
};

type Poster = { url: string; name: string; file: File };

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const JEDA_SECONDS = 10 * 60;

const QUESTIONS = [
	{
		id: "bayar",
		text: "Diminta bayar di muka (seragam, pelatihan, biaya admin)?",
	},
	{ id: "pindah", text: "Diajak lanjut ke WhatsApp atau Telegram pribadi?" },
	{ id: "waktu", text: "Ada batas waktu daftar yang mendesak?" },
	{ id: "wawancara", text: "Langsung dinyatakan diterima tanpa wawancara?" },
];

const ANSWER_OPTIONS: { value: Answer; label: string }[] = [
	{ value: "ya", label: "Ya" },
	{ value: "tidak", label: "Tidak" },
	{ value: "ragu", label: "Tidak tahu" },
];

function formatClock(total: number) {
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function Stepper({ stage }: { stage: Stage }) {
	const steps = [
		{ key: "input", label: "Isi data" },
		{ key: "loading", label: "Dianalisis" },
		{ key: "result", label: "Hasil" },
	] as const;
	const current = steps.findIndex((s) => s.key === stage);
	return (
		<ol className="flex items-center gap-2 text-sm font-semibold">
			{steps.map((step, i) => (
				<li key={step.key} className="flex items-center gap-2">
					<span
						className={`flex h-7 items-center gap-2 rounded-full px-3 transition-colors duration-300 ${
							i === current
								? "bg-slate-900 text-white"
								: i < current
									? "bg-slate-900/10 text-slate-700"
									: "bg-transparent text-slate-400"
						}`}>
						{i < current ? <FiCheck size={14} /> : <span>{i + 1}</span>}
						{step.label}
					</span>
					{i < steps.length - 1 && <span className="h-px w-4 bg-slate-300 sm:w-8" />}
				</li>
			))}
		</ol>
	);
}

function AnswerRow({
	text,
	value,
	onChange,
}: {
	text: string;
	value: Answer | null;
	onChange: (next: Answer) => void;
}) {
	return (
		<div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-[15px] leading-snug text-slate-800 sm:max-w-[55%]">
				{text}
			</p>
			<div className="flex shrink-0 gap-1.5">
				{ANSWER_OPTIONS.map((opt) => (
					<button
						key={opt.value}
						type="button"
						aria-pressed={value === opt.value}
						onClick={() => onChange(opt.value)}
						className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
							value === opt.value
								? "border-slate-900 bg-slate-900 text-white"
								: "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
						}`}>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}

function JedaTimer() {
	const [remaining, setRemaining] = useState(JEDA_SECONDS);
	const [running, setRunning] = useState(false);

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			setRemaining((r) => (r <= 1 ? 0 : r - 1));
		}, 1000);
		return () => clearInterval(id);
	}, [running]);

	const finished = remaining === 0;
	const active = running && !finished;
	const progress = ((JEDA_SECONDS - remaining) / JEDA_SECONDS) * 100;

	return (
		<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
			<div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
				<FiClock size={16} />
				Jeda 10 menit
			</div>
			<p className="mt-3 text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums">
				{formatClock(remaining)}
			</p>
			<div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
				<div
					className="h-full rounded-full bg-slate-900 transition-[width] duration-1000 ease-linear"
					style={{ width: `${progress}%` }}
				/>
			</div>
			<p
				className="mt-4 text-[15px] leading-snug text-slate-700"
				aria-live="polite">
				{finished
					? "Jeda selesai. Kalau masih ragu, tanyakan ke orang yang kamu percaya sebelum melangkah."
					: active
						? "Jangan bayar dan jangan kirim data apa pun selama jeda ini."
						: "Mulai jeda sebelum membalas pesan mereka. Orang yang menipu butuh kamu buru-buru."}
			</p>
			<div className="mt-5 flex gap-2">
				<button
					type="button"
					disabled={finished}
					onClick={() => setRunning((r) => !r)}
					className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
					{active ? <FiPause size={16} /> : <FiPlay size={16} />}
					{active
						? "Jeda sebentar"
						: remaining < JEDA_SECONDS
							? "Lanjutkan"
							: "Mulai jeda"}
				</button>
				{remaining < JEDA_SECONDS && (
					<button
						type="button"
						onClick={() => {
							setRunning(false);
							setRemaining(JEDA_SECONDS);
						}}
						className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
						aria-label="Atur ulang jeda">
						<FiRefreshCw size={16} />
					</button>
				)}
			</div>
		</section>
	);
}

function VerificationList({ items }: { items: string[] }) {
	const [done, setDone] = useState<Set<number>>(new Set());
	const toggle = (i: number) =>
		setDone((prev) => {
			const next = new Set(prev);
			if (next.has(i)) next.delete(i);
			else next.add(i);
			return next;
		});

	return (
		<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
			<div className="flex items-baseline justify-between gap-3">
				<h3 className="text-lg font-bold text-slate-900">
					Cara memastikan sendiri
				</h3>
				<span className="text-sm text-slate-500">
					{done.size} dari {items.length}
				</span>
			</div>
			<ul className="mt-4 space-y-1">
				{items.map((item, i) => {
					const checked = done.has(i);
					return (
						<li key={item}>
							<label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 transition-colors hover:bg-slate-50">
								<input
									type="checkbox"
									checked={checked}
									onChange={() => toggle(i)}
									className="peer sr-only"
								/>
								<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-white transition-colors peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-slate-900">
									{checked && <FiCheck size={13} />}
								</span>
								<span
									className={`text-[15px] leading-snug transition-colors ${
										checked ? "text-slate-400 line-through" : "text-slate-700"
									}`}>
									{item}
								</span>
							</label>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function InputStage({
	onSubmit,
	error,
}: {
	onSubmit: (input: AnalysisInput) => void;
	error: string | null;
}) {
	const [caption, setCaption] = useState("");
	const [poster, setPoster] = useState<Poster | null>(null);
	const [answers, setAnswers] = useState<Record<string, Answer | null>>({});
	const [consent, setConsent] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [fileError, setFileError] = useState<string | null>(null);
	const urlRef = useRef<string | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(
		() => () => {
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		},
		[],
	);

	const clearPoster = () => {
		if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		urlRef.current = null;
		setPoster(null);
		if (fileRef.current) fileRef.current.value = "";
	};

	const acceptFile = async (file: File | undefined) => {
		if (!file) return;
		if (!ACCEPTED_TYPES.includes(file.type)) {
			setFileError("Format harus PNG, JPG, atau WebP.");
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			setFileError("Ukuran gambar maksimal 5 MB.");
			return;
		}
		setFileError(null);
		clearPoster();
		const processed = await preprocessPoster(file);
		console.info("Job poster preprocessing", {
			durationMs: Math.round(processed.durationMs),
			originalBytes: processed.originalBytes,
			outputBytes: processed.file.size,
			width: processed.width,
			height: processed.height,
			processed: processed.processed,
		});
		if (processed.file.size > MAX_FILE_SIZE) {
			setFileError("Ukuran poster setelah diproses melebihi 5 MB.");
			return;
		}
		const url = URL.createObjectURL(processed.file);
		urlRef.current = url;
		setPoster({ url, name: processed.file.name, file: processed.file });
	};

	const hasInput = caption.trim().length > 0 || poster !== null;
	const canSubmit = hasInput && consent;

	return (
		<div className="grid gap-5 lg:grid-cols-12">
			<div className="space-y-5 lg:col-span-7">
				<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
					<h2 className="text-xl font-bold text-slate-900">
						Poster atau teks lowongan
					</h2>
					<p className="mt-1 text-[15px] text-slate-500">
						Unggah poster untuk dianalisis oleh model vision lokal, tempel caption,
						atau kirim keduanya.
					</p>
					<div className="mt-6">
						{poster ? (
							<div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
								<div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl">
									<Image
										src={poster.url}
										alt="Pratinjau poster lowongan"
										fill
										unoptimized
										className="object-cover"
									/>
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-[15px] font-semibold text-slate-900">
										{poster.name}
									</p>
									<p className="text-sm text-slate-500">{`${(poster.file.size / 1024).toFixed(0)} KB`}</p>
								</div>
								<button
									type="button"
									onClick={clearPoster}
									aria-label="Hapus poster"
									className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-slate-900">
									<FiX size={18} />
								</button>
							</div>
						) : (
							<label
								onDragOver={(e) => {
									e.preventDefault();
									setDragging(true);
								}}
								onDragLeave={() => setDragging(false)}
								onDrop={(e) => {
									e.preventDefault();
									setDragging(false);
									acceptFile(e.dataTransfer.files[0]);
								}}
								className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-slate-900 ${dragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 hover:border-slate-500"}`}>
								<input
									ref={fileRef}
									type="file"
									accept={ACCEPTED_TYPES.join(",")}
									className="sr-only"
									onChange={(e) => acceptFile(e.target.files?.[0])}
								/>
								<span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
									<FiUploadCloud size={22} />
								</span>
								<span className="text-[15px] font-semibold text-slate-900">
									Tarik gambar ke sini atau pilih dari galeri
								</span>
								<span className="text-sm text-slate-500">
									PNG, JPG, WebP. Maksimal 5 MB.
								</span>
							</label>
						)}
						{fileError && (
							<p role="alert" className="mt-2 text-sm font-medium text-red-600">
								{fileError}
							</p>
						)}
					</div>
					<div className="mt-6">
						<label
							htmlFor="caption"
							className="text-[15px] font-semibold text-slate-900">
							Caption atau isi pesan
						</label>
						<textarea
							id="caption"
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							rows={5}
							placeholder="Tempel teks lowongan dari Instagram, WhatsApp, atau Facebook"
							className="mt-2 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-[15px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
						/>
					</div>
				</section>

				<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
					<h2 className="text-xl font-bold text-slate-900">
						Yang kamu amati sendiri
					</h2>
					<p className="mt-1 text-[15px] text-slate-500">
						Opsional. Jawaban ini menjadi konteks tambahan untuk pemeriksaan.
					</p>
					<div className="mt-3 divide-y divide-slate-100">
						{QUESTIONS.map((q) => (
							<AnswerRow
								key={q.id}
								text={q.text}
								value={answers[q.id] ?? null}
								onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
							/>
						))}
					</div>
				</section>
			</div>

			<aside className="lg:col-span-5">
				<div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8 lg:sticky lg:top-8">
					<div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
						<FiLock size={16} />
						Sebelum dikirim
					</div>
					<h2 className="mt-3 text-2xl font-extrabold leading-tight">
						Teks dan gambar dianalisis secara lokal dengan Ollama
					</h2>
					<ul className="mt-4 space-y-2 text-[15px] leading-snug text-white/75">
						<li className="flex gap-2">
							<FiCheck className="mt-0.5 shrink-0 text-amber-300" size={16} />
							Caption, jawaban, dan poster dikirim ke Ollama lokal di mesin yang
							menjalankan aplikasi.
						</li>
						<li className="flex gap-2">
							<FiCheck className="mt-0.5 shrink-0 text-amber-300" size={16} />
							Aplikasi Jaga tidak menyimpan isi yang kamu kirim setelah analisis.
						</li>
						<li className="flex gap-2">
							<FiCheck className="mt-0.5 shrink-0 text-amber-300" size={16} />
							AI bisa keliru, hasilnya bukan vonis.
						</li>
					</ul>

					<label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/10 p-4 transition-colors hover:bg-white/15">
						<input
							type="checkbox"
							checked={consent}
							onChange={(e) => setConsent(e.target.checked)}
							className="peer sr-only"
						/>
						<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/50 text-slate-900 transition-colors peer-checked:border-amber-300 peer-checked:bg-amber-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-amber-300">
							{consent && <FiCheck size={13} />}
						</span>
						<span className="text-[15px] leading-snug">
							Saya setuju caption, jawaban, dan poster untuk diproses.
						</span>
					</label>

					{error && (
						<p
							role="alert"
							className="mt-4 rounded-xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
							{error}
						</p>
					)}

					<button
						type="button"
						disabled={!canSubmit}
						onClick={() =>
							onSubmit({
								caption,
								poster: poster?.file ?? null,
								answers,
							})
						}
						className="group mt-5 flex h-13 w-full items-center justify-between rounded-full bg-white px-6 text-[15px] font-bold text-slate-900 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/40">
						Analisis lowongan
						<FiArrowRight
							size={18}
							className="transition-transform duration-300 group-enabled:group-hover:translate-x-1 motion-reduce:transition-none"
						/>
					</button>
					{!hasInput && (
						<p className="mt-3 text-center text-sm text-white/50">
							Isi caption atau unggah poster dulu.
						</p>
					)}
				</div>
			</aside>
		</div>
	);
}

function LoadingStage({ onCancel }: { onCancel: () => void }) {
	return (
		<div role="status" aria-live="polite" className="space-y-5">
			<div className="rounded-3xl bg-slate-900 p-8 text-white">
				<p className="text-sm font-semibold text-amber-300">Sedang dibaca</p>
				<p className="mt-2 text-2xl font-extrabold">
					Menganalisis poster dan teks lowongan
				</p>
				<p className="mt-2 text-[15px] text-white/70">
					Poster dan caption dianalisis oleh model lokal Ollama. Biarkan halaman ini
					tetap terbuka sampai laporan selesai.
				</p>
				<button
					type="button"
					onClick={onCancel}
					className="mt-4 rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
					Batalkan analisis
				</button>
				<div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/15">
					<div className="h-full w-1/3 animate-pulse rounded-full bg-amber-300 motion-reduce:animate-none" />
				</div>
			</div>
			<div className="grid gap-5 lg:grid-cols-12">
				<div className="space-y-4 lg:col-span-7">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className="animate-pulse space-y-3 rounded-3xl bg-white p-6 ring-1 ring-slate-200 motion-reduce:animate-none"
							style={{ animationDelay: `${i * 150}ms` }}>
							<div className="h-4 w-2/3 rounded bg-slate-200" />
							<div className="h-3 w-full rounded bg-slate-100" />
							<div className="h-3 w-4/5 rounded bg-slate-100" />
						</div>
					))}
				</div>
				<div className="space-y-4 lg:col-span-5">
					{[0, 1].map((i) => (
						<div
							key={i}
							className="animate-pulse space-y-3 rounded-3xl bg-white p-6 ring-1 ring-slate-200 motion-reduce:animate-none"
							style={{ animationDelay: `${i * 150}ms` }}>
							<div className="h-4 w-1/2 rounded bg-slate-200" />
							<div className="h-3 w-full rounded bg-slate-100" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function ResultStage({
	result,
	onReset,
}: {
	result: InvestigationReport;
	onReset: () => void;
}) {
	const scoreLabel =
		result.riskCategory === "insufficient"
			? "Bukti belum cukup"
			: result.riskLevel === "high"
				? "Indikasi risiko tinggi"
				: result.riskLevel === "medium"
					? "Perlu diperiksa"
					: "Indikasi risiko rendah";
	const statusLabel = {
		verified: "Terverifikasi oleh sumber yang ditemukan",
		found_unverified: "Ditemukan, belum terverifikasi",
		not_found: "Tidak ditemukan pada pencarian ini",
		conflicting: "Informasi bertentangan",
		unknown: "Belum diketahui",
	}[result.companyStatus];
	const findingStatus = (status: string) =>
		status === "detected"
			? "Terdeteksi"
			: status === "not_detected"
				? "Tidak terdeteksi pada input yang tersedia"
				: "Tidak diketahui";
	return (
		<div className="animate-fade-up space-y-5">
			<section className="rounded-3xl bg-slate-900 p-7 text-white shadow-xl sm:p-10">
				<p className="text-sm font-semibold text-amber-300">
					Ringkasan investigasi
				</p>
				<h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">{scoreLabel}</h2>
				<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<p className="text-xs text-white/60">Perusahaan</p>
						<p className="mt-1 font-semibold">{result.companyName}</p>
					</div>
					<div>
						<p className="text-xs text-white/60">Posisi</p>
						<p className="mt-1 font-semibold">{result.position}</p>
					</div>
					<div>
						<p className="text-xs text-white/60">Risk score</p>
						<p className="mt-1 font-semibold">{`${result.riskScore}/100 — ${scoreLabel}`}</p>
					</div>
					<div>
						<p className="text-xs text-white/60">Status bukti</p>
						<p className="mt-1 font-semibold capitalize">
							{result.riskCategory === "insufficient"
								? "Belum cukup bukti"
								: "Ada bukti terkait"}{" "}
							/{" "}
							{result.evidenceCoverage === "substantial"
								? "substansial"
								: result.evidenceCoverage === "partial"
									? "parsial"
									: "terbatas"}
						</p>
					</div>
				</div>
				<p className="mt-4 text-sm leading-relaxed text-white/75">
					{result.coverageExplanation}
				</p>
			</section>

			<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
				<h3 className="text-xl font-bold text-slate-900">Company verification</h3>
				<dl className="mt-4 grid gap-4 sm:grid-cols-2">
					<div>
						<dt className="text-sm text-slate-500">Status perusahaan</dt>
						<dd className="mt-1 font-semibold text-slate-900">{statusLabel}</dd>
					</div>
					<div>
						<dt className="text-sm text-slate-500">Website yang didukung sumber</dt>
						<dd className="mt-1 break-all font-semibold">
							{result.website !==
							"Tidak ditemukan pada sumber yang berhasil dikutip" ? (
								<a
									href={result.website}
									target="_blank"
									rel="noreferrer"
									className="underline">
									{result.website}
								</a>
							) : (
								result.website
							)}
						</dd>
					</div>
					<div>
						<dt className="text-sm text-slate-500">Lokasi lowongan</dt>
						<dd className="mt-1 font-semibold">{result.location}</dd>
					</div>
					<div>
						<dt className="text-sm text-slate-500">Identitas perekrut</dt>
						<dd className="mt-1 font-semibold">{result.recruiterIdentity}</dd>
					</div>
				</dl>
				<p className="mt-4 text-[15px] leading-relaxed text-slate-700">
					{result.companySummary}
				</p>
				<p className="mt-2 text-xs text-slate-500">
					Ringkasan dan status adalah sintesis AI. Tinjau tautan sumber sebelum
					menganggapnya terverifikasi.
				</p>
				<p className="mt-4 text-xs text-slate-500">
					Rincian berikut adalah ekstraksi AI. Setiap nilai harus merujuk pada
					cuplikan teks atau sumber. Informasi tanpa bukti ditandai “Tidak tersedia”.
				</p>
				<dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
					{(
						[
							["Alamat perusahaan", result.extracted.companyAddress],
							["Email rekrutmen", result.extracted.recruitmentEmail],
							["Telepon / WhatsApp", result.extracted.recruiterPhone],
							["Nama perekrut", result.extracted.recruiterName],
							["Gaji", result.extracted.salary],
							["Persyaratan", result.extracted.requirements],
							["Deskripsi pekerjaan", result.extracted.jobDescription],
							["Biaya di muka", result.extracted.upfrontPayment],
							["Tautan pendaftaran", result.extracted.applicationLink],
							["Batas waktu", result.extracted.deadline],
							["Informasi tambahan", result.extracted.additional],
						] as const
					).map(([label, field]) => (
						<div key={label}>
							<dt className="text-sm text-slate-500">{label}</dt>
							<dd className="mt-1 wrap-break-word text-sm font-medium text-slate-800">
								{field.value}
							</dd>
							{field.evidence && (
								<p className="mt-1 text-xs text-slate-500">
									Bukti ({field.evidenceKind}): {field.evidence}
								</p>
							)}
							{field.sourceIndexes.map(
								(sourceIndex) =>
									result.sources[sourceIndex] && (
										<a
											key={sourceIndex}
											href={result.sources[sourceIndex].url}
											target="_blank"
											rel="noreferrer"
											className="mt-1 mr-2 inline-block text-xs underline">
											{result.sources[sourceIndex].title}
										</a>
									),
							)}
						</div>
					))}
				</dl>
			</section>

			<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
				<h3 className="text-xl font-bold text-slate-900">Temuan utama</h3>
				{result.findings.length ? (
					<ul className="mt-4 divide-y divide-slate-100">
						{result.findings.map((finding, index) => (
							<li key={`${finding.indicator}-${index}`} className="py-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<h4 className="font-semibold text-slate-900">{finding.indicator}</h4>
									<span
										className={`rounded-full px-3 py-1 text-xs font-bold ${finding.status === "detected" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
										{findingStatus(finding.status)}
									</span>
								</div>
								<p className="mt-2 text-sm leading-relaxed text-slate-700">
									{finding.explanation}
								</p>
								{finding.evidence && (
									<p className="mt-2 border-l-2 border-amber-300 pl-3 text-sm text-slate-600">
										Bukti ({finding.evidenceKind}): {finding.evidence}
									</p>
								)}
								{finding.sourceIndexes.map(
									(sourceIndex) =>
										result.sources[sourceIndex] && (
											<a
												key={sourceIndex}
												href={result.sources[sourceIndex].url}
												target="_blank"
												rel="noreferrer"
												className="mt-2 mr-3 inline-block text-sm font-semibold text-slate-700 underline">
												Sumber: {result.sources[sourceIndex].title}
											</a>
										),
								)}
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-sm text-slate-600">
						Tidak ada temuan yang dapat dikaitkan dengan bukti.
					</p>
				)}
			</section>

			{result.posterAnalysis && (
				<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
					<h3 className="text-xl font-bold text-slate-900">Analisis poster</h3>
					<p className="mt-2 text-sm leading-relaxed text-slate-700">
						{result.posterAnalysis.summary}
					</p>
					<h4 className="mt-4 text-sm font-bold text-slate-800">
						Teks yang terbaca
					</h4>
					<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
						{result.posterAnalysis.extractedText}
					</pre>
					<ul className="mt-4 space-y-3">
						{result.posterAnalysis.observations.map((item, i) => (
							<li key={`${item.indicator}-${i}`} className="text-sm">
								<strong>{item.indicator}</strong> — {item.result}{" "}
								<span className="text-slate-500">(keyakinan {item.confidence})</span>
							</li>
						))}
					</ul>
					<p className="mt-3 text-xs text-slate-500">
						Penilaian visual adalah pengamatan AI pada gambar, bukan bukti keaslian
						atau pemalsuan.
					</p>
				</section>
			)}

			<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
				<h3 className="text-xl font-bold text-slate-900">
					Indikator risiko yang diperiksa
				</h3>
				<ul className="mt-4 divide-y divide-slate-100">
					{result.indicators.map((indicator, index) => (
						<li key={`${indicator.name}-${index}`} className="py-3">
							<div className="flex items-center justify-between gap-3">
								<strong className="text-sm text-slate-900">{indicator.name}</strong>
								<span className="text-xs font-bold text-slate-600">
									{findingStatus(indicator.status)}
								</span>
							</div>
							<p className="mt-1 text-sm text-slate-600">{indicator.explanation}</p>
							{indicator.evidence && (
								<p className="mt-1 text-xs text-slate-500">
									Bukti ({indicator.evidenceKind}): {indicator.evidence}
								</p>
							)}
							{indicator.sourceIndexes.map(
								(sourceIndex) =>
									result.sources[sourceIndex] && (
										<a
											key={sourceIndex}
											href={result.sources[sourceIndex].url}
											target="_blank"
											rel="noreferrer"
											className="mt-2 mr-3 inline-block text-sm underline">
											Sumber: {result.sources[sourceIndex].title}
										</a>
									),
							)}
						</li>
					))}
				</ul>
			</section>

			<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
				<h3 className="text-xl font-bold text-slate-900">Metodologi skor risiko</h3>
				<p className="mt-2 text-sm text-slate-600">
					Bobot heuristik yang transparan: perusahaan 25%, perekrut 20%, proses 25%,
					kewajaran lowongan 20%, poster 10%. Model vision menganalisis poster bila
					dilampirkan; faktor poster tetap belum dinilai jika bukti visual tidak
					cukup. Nilai faktor 0–100 adalah penilaian model atas bukti yang ditautkan.
					Skor memakai rata-rata berbobot faktor yang didukung bukti berbeda; skor
					disembunyikan bila kurang dari tiga faktor dan tiga bukti berbeda tersedia.
					Metode ini belum dikalibrasi pada dataset hasil rekrutmen dan bukan
					probabilitas penipuan.
				</p>
				<div className="mt-4 divide-y divide-slate-100">
					{result.factors.map((factor) => (
						<div
							key={factor.category}
							className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
							<span className="text-sm font-semibold capitalize text-slate-800">
								{factor.category} · bobot {factor.weight}%
							</span>
							<span className="text-sm text-slate-600">
								{factor.evidenceKind === "none"
									? "Belum dinilai dari bukti"
									: `Indikasi ${factor.value}/100 — ${factor.reasoning}`}
								{factor.sourceIndexes.map(
									(sourceIndex) =>
										result.sources[sourceIndex] && (
											<a
												key={sourceIndex}
												href={result.sources[sourceIndex].url}
												target="_blank"
												rel="noreferrer"
												className="ml-2 underline">
												{result.sources[sourceIndex].title}
											</a>
										),
								)}
							</span>
						</div>
					))}
				</div>
			</section>

			<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
				<h3 className="text-xl font-bold text-slate-900">Sumber yang digunakan</h3>
				{result.sources.length ? (
					<ul className="mt-4 space-y-3">
						{result.sources.map((source, index) => (
							<li key={`${source.url}-${index}`}>
								<a
									href={source.url}
									target="_blank"
									rel="noreferrer"
									className="font-semibold text-slate-900 underline">
									{source.title}
								</a>
								<p className="mt-1 break-all text-xs text-slate-500">{source.domain}</p>
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-sm text-slate-600">
						Pencarian internet eksternal belum dikonfigurasi. Status perusahaan dan
						jejak online tetap “Belum diketahui”.
					</p>
				)}
			</section>

			<div className="grid gap-5 lg:grid-cols-12">
				<div className="space-y-5 lg:col-span-5">
					<JedaTimer />
					<section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
						<h3 className="text-lg font-bold text-slate-900">Rekomendasi tindakan</h3>
						<ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
							{result.recommendations.map((item, index) => (
								<li key={`${item}-${index}`}>{item}</li>
							))}
						</ul>
					</section>
				</div>
				<div className="space-y-5 lg:col-span-7">
					<VerificationList items={result.recommendations} />
					<section className="rounded-3xl bg-slate-50 p-6 text-sm leading-relaxed text-slate-600 ring-1 ring-slate-200">
						<h3 className="font-bold text-slate-900">Catatan dan keterbatasan</h3>
						<p className="mt-2">
							Analisis ini menunjukkan indikasi risiko, bukan keputusan hukum atau
							jaminan bahwa perusahaan melakukan penipuan. Tidak ditemukan di internet
							bukan bukti perusahaan fiktif. Risk score dihitung dari temuan yang
							memiliki bukti; cakupan bukti ditampilkan terpisah.
						</p>
						<ul className="mt-3 list-disc space-y-1 pl-5">
							{result.limitations.map((item, index) => (
								<li key={`${item}-${index}`}>{item}</li>
							))}
						</ul>
						<p className="mt-3">
							Status perusahaan: {statusLabel}. Risk score dan cakupan bukti adalah hal
							yang berbeda.
						</p>
						<button
							type="button"
							onClick={onReset}
							className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 font-bold text-white">
							<FiRefreshCw size={16} />
							Cek lowongan lain
						</button>
						<Link
							href="/terlanjur"
							className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-amber-50 hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
							Terlanjur klik? Lihat langkahnya <FiArrowRight />
						</Link>
					</section>
				</div>
			</div>
		</div>
	);
}

export default function CekLowongan() {
	const [stage, setStage] = useState<Stage>("input");
	const [result, setResult] = useState<InvestigationReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [formKey, setFormKey] = useState(0);
	const requestController = useRef<AbortController | null>(null);
	const userCancelled = useRef(false);

	useEffect(() => () => requestController.current?.abort(), []);

	const handleSubmit = async (input: AnalysisInput) => {
		if (requestController.current) return;
		setError(null);
		setResult(null);
		setStage("loading");
		const controller = new AbortController();
		requestController.current = controller;
		userCancelled.current = false;
		try {
			const form = new FormData();
			form.set("caption", input.caption.trim());
			form.set("consent", "true");
			form.set(
				"observations",
				JSON.stringify(
					Object.fromEntries(
						Object.entries(input.answers).filter(
							(entry): entry is [string, Answer] => entry[1] !== null,
						),
					),
				),
			);
			if (input.poster) form.set("poster", input.poster);
			const timeout = setTimeout(() => controller.abort(), 125_000);
			let response: Response;
			try {
				response = await fetch("/api/cek-lowongan", {
					method: "POST",
					body: form,
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timeout);
			}
			const payload = (await response.json()) as {
				success?: boolean;
				report?: InvestigationReport;
				error?: string;
			};
			if (!response.ok || !payload.success || !payload.report)
				throw new Error(payload.error || "Laporan investigasi tidak dapat dibaca.");
			setResult(payload.report);
			setStage("result");
		} catch (error) {
			setError(
				userCancelled.current
					? "Analisis dibatalkan."
					: error instanceof Error && error.name === "AbortError"
						? "Analisis melewati batas waktu. Coba lagi."
						: error instanceof Error
							? error.message
							: "Analisis gagal dijalankan. Coba lagi sebentar lagi.",
			);
			setStage("input");
		} finally {
			if (requestController.current === controller)
				requestController.current = null;
		}
	};

	const handleCancel = () => {
		userCancelled.current = true;
		requestController.current?.abort();
	};

	const handleReset = () => {
		setResult(null);
		setError(null);
		setFormKey((k) => k + 1);
		setStage("input");
	};

	return (
		<main className="min-h-screen w-full bg-gray-100 px-5 py-8 sm:px-10 lg:px-20 lg:py-12">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<Link
						href="/"
						className="group inline-flex items-center gap-2 rounded-full py-1 pr-3 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
						<FiArrowLeft
							size={16}
							className="transition-transform duration-300 group-hover:-translate-x-1 motion-reduce:transition-none"
						/>
						Kembali ke beranda
					</Link>
					<Stepper stage={stage} />
				</div>

				<header className="mt-8 mb-8 max-w-3xl">
					<h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
						Cek lowongan
					</h1>
					<p className="mt-3 text-lg leading-relaxed text-slate-600">
						Lihat bagian lowongan yang janggal sebelum kamu mendaftar, lengkap dengan
						cara memastikannya sendiri.
					</p>
				</header>

				{stage === "input" && (
					<InputStage key={formKey} onSubmit={handleSubmit} error={error} />
				)}
				{stage === "loading" && <LoadingStage onCancel={handleCancel} />}
				{stage === "result" && result && (
					<ResultStage result={result} onReset={handleReset} />
				)}
			</div>
		</main>
	);
}
