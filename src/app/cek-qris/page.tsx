"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiArrowRight,
  FiCamera,
  FiCheckCircle,
  FiLock,
  FiRefreshCw,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { BrowserQRCodeReader } from "@zxing/browser";
import { analyzeQris } from "@/lib/qris/analyze";
import { compareMerchant } from "@/lib/qris/compare";
import { validateCrc } from "@/lib/qris/crc";
import { decodeQris } from "@/lib/qris/decode";
import { parseQris } from "@/lib/qris/parser";
import type { QrisFinding } from "@/types/qris";

type Stage = "input" | "loading" | "result";

type DecodedData = {
  merchantName?: string;
  merchantCity?: string;
  postalCode?: string;
  country?: string;
  acquirer?: string;
  acquirerGui?: string;
  merchantIdentifier1?: string;
  merchantIdentifier2?: string;
  merchantType?: string;
  qrisNetworkGui?: string;
  qrisNetworkId?: string;
  mcc?: string;
  mccDescription?: string;
  terminalLabel?: string;
  qrisType?: string;
  currency?: string;
  amount?: string;
  currencyCode?: string;
  findings: QrisFinding[];
  crc: {
    provided: string;
    calculated: string;
    valid: boolean;
  };
};



const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];

function ScanFrame({ children, active }: { children: React.ReactNode; active: boolean }) {
  const corner = "absolute h-9 w-9 border-amber-300";
  return (
    <div className="relative mx-auto aspect-square w-full max-w-72">
      <span className={`${corner} top-0 left-0 rounded-tl-2xl border-t-4 border-l-4`} />
      <span className={`${corner} top-0 right-0 rounded-tr-2xl border-t-4 border-r-4`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-2xl border-r-4 border-b-4`} />
      <div className="absolute inset-4 overflow-hidden rounded-xl bg-white/5">
        {children}
        {active && (
          <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-[scan_1.4s_ease-in-out_infinite] bg-amber-300 shadow-[0_0_12px_2px_rgba(252,211,77,0.7)] motion-reduce:hidden" />
        )}
      </div>
    </div>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const steps = [
    { key: "input", label: "Pindai" },
    { key: "loading", label: "Dibaca" },
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
                : "text-slate-400"
            }`}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="h-px w-4 bg-slate-300 sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <dt className="text-sm text-slate-500 sm:w-44 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 sm:flex-1 sm:text-right">
        <span className="text-[15px] font-semibold wrap-break-word text-slate-900">{value}</span>
      </dd>
    </div>
  );
}

async function readQrFromImage(file: File): Promise<string> {
  const reader = new BrowserQRCodeReader();
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const res = await reader.decodeFromImageElement(img);
    const text = res.getText();
    if (!text) throw new Error("QR not found");
    return text;
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

function InputStage({ onSubmit }: { onSubmit: (payload: string) => void }) {
  const [image, setImage] = useState<{ url: string; name: string; file: File } | null>(null);
  const [rawText, setRawText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const urlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const clearImage = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileError("Format harus PNG, JPG, JPEG, atau WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("Ukuran gambar maksimal 5 MB.");
      return;
    }
    setFileError(null);
    clearImage();
    setRawText("");
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setImage({ url, name: file.name, file });
  };

  const hasInput = image !== null || rawText.trim().length > 0;

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8 lg:col-span-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <FiLock size={16} />
          Dibaca di perangkatmu
        </div>
        <h2 className="mt-3 text-2xl leading-tight font-extrabold">Baca isi QRIS</h2>
        <div className="mt-8">
          <ScanFrame active={hasInput}>
            {image ? (
              <Image src={image.url} alt="Pratinjau QR" fill unoptimized className="object-contain" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-white/60">
                <FiCamera size={28} />
                <p className="text-sm">Foto atau unggah QRIS</p>
              </div>
            )}
          </ScanFrame>
        </div>
        <p className="mt-6 text-[15px] leading-relaxed text-white/70">
          Gambar dan payload QRIS diproses di perangkatmu. Payload tidak diunggah.
        </p>
      </section>

      <div className="space-y-5 lg:col-span-7">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900">Foto atau tangkapan layar QR</h2>
          <p className="mt-1 text-[15px] text-slate-500">PNG, JPG, JPEG, WebP. Maksimal 5 MB.</p>
          <div className="mt-5">
            {image ? (
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="min-w-0 flex-1 px-2">
                  <p className="truncate text-[15px] font-semibold text-slate-900">{image.name}</p>
                  <p className="text-sm text-slate-500">{(image.file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" onClick={clearImage} aria-label="Hapus gambar" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200">
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
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition-colors ${
                  dragging ? "border-slate-900 bg-slate-100" : "border-slate-300 bg-slate-50 hover:border-slate-500"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
                  <FiCamera size={22} />
                </span>
                <span className="text-[15px] font-semibold text-slate-900">Ambil foto atau pilih gambar QR</span>
                <span className="text-sm text-slate-500">PNG, JPG, JPEG, WebP. Maksimal 5 MB.</span>
              </label>
            )}
            {fileError && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                {fileError}
              </p>
            )}
          </div>

          {/* <div className="mt-6">
            <label htmlFor="raw" className="text-[15px] font-semibold text-slate-900">
              Atau tempel raw QRIS payload
            </label>
            <textarea
              id="raw"
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (e.target.value) clearImage();
              }}
              rows={4}
              placeholder="000201010211..."
              className="mt-2 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
            />
          </div> */}

          <button
            type="button"
            disabled={!hasInput}
            onClick={async () => {
              if (image) {
                try {
                  const payload = await readQrFromImage(image.file);
                  onSubmit(payload);
                } catch {
                  setFileError("QR tidak ditemukan pada gambar.");
                }
                return;
              }
              if (rawText.trim()) {
                onSubmit(rawText.trim());
              }
            }}
            className="group mt-6 flex h-13 w-full items-center justify-between rounded-full bg-slate-900 px-6 text-[15px] font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Baca QRIS
            <FiArrowRight size={18} className="transition-transform duration-300 group-enabled:group-hover:translate-x-1" />
          </button>
        </section>
      </div>
    </div>
  );
}

function LoadingStage() {
  return (
    <div role="status" aria-live="polite" className="grid gap-5 lg:grid-cols-12">
      <div className="rounded-3xl bg-slate-900 p-8 text-white lg:col-span-5">
        <p className="text-sm font-semibold text-amber-300">Sedang dibaca</p>
        <p className="mt-2 text-2xl font-extrabold">Memproses payload QRIS</p>
      </div>
      <div className="space-y-4 lg:col-span-7">
        {[0, 1, 2].map((i) => (
          <div key={i} className="animate-pulse space-y-3 rounded-3xl bg-white p-6 ring-1 ring-slate-200" />
        ))}
      </div>
    </div>
  );
}

function ResultStage({ data, rawPayload, onReset }: { data: DecodedData; rawPayload: string; onReset: () => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const [expectedName, setExpectedName] = useState("");
  const comparison = compareMerchant(expectedName, data.merchantName);
  const hasInvalid = data.findings.some((finding) => finding.status === "invalid");
  const hasWarning = data.findings.some((finding) => finding.status === "warning");
  const overview = hasInvalid ? "Ditemukan kesalahan teknis yang perlu diperiksa." : hasWarning ? "Terdapat informasi yang perlu diperiksa." : data.findings.every((finding) => finding.status === "valid" || finding.status === "unknown") ? "Tidak ditemukan anomali teknis pada pemeriksaan yang tersedia." : "Informasi tidak cukup untuk menilai.";
  const statusStyle = { valid: "text-emerald-700", warning: "text-amber-700", invalid: "text-red-700", unknown: "text-slate-500" };

  return (
    <div className="animate-fade-up space-y-5">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-slate-500">01 — Security Overview</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-900">{overview}</h3>
        <p className="mt-2 text-sm text-slate-600">Hasil ini memeriksa format dan konsistensi payload. CRC valid tidak membuktikan merchant aman atau resmi.</p>
        <ul className="mt-5 space-y-3">
          {data.findings.map((finding) => <li key={finding.title} className="border-t border-slate-100 pt-3"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-900">{finding.title}</strong><span className={`text-xs font-bold uppercase ${statusStyle[finding.status]}`}>{finding.status === "valid" ? "Valid" : finding.status === "warning" ? "Perhatian" : finding.status === "invalid" ? "Invalid" : "Belum diketahui"}</span></div><p className="mt-1 text-sm text-slate-600">{finding.explanation}</p><p className="mt-1 text-xs text-slate-500">Dasar: {finding.basis} Batasan: {finding.limitation}</p></li>)}
        </ul>
        <p className="mt-4 text-sm font-semibold text-slate-900">Tindakan: cocokkan nama penerima pada aplikasi pembayaran sebelum mengonfirmasi transaksi.</p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-slate-500">02 — Merchant Intelligence</p>
        <dl className="mt-3 divide-y divide-slate-100">
          <DetailRow label="Nama merchant" value={data.merchantName} />
          <DetailRow label="Kota" value={data.merchantCity} />
          <DetailRow label="Kode pos" value={data.postalCode} />
          <DetailRow label="Negara" value={data.country} />
          <DetailRow label="Kategori usaha (MCC)" value={data.mcc ? (data.mccDescription ? `${data.mcc} (${data.mccDescription})` : data.mcc) : null} />
        </dl>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-slate-500">03 — Payment Intelligence</p><h3 className="mt-2 text-xl font-bold text-slate-900">Informasi pembayaran</h3>
        <dl className="mt-3 divide-y divide-slate-100">
          <DetailRow label="Acquirer / PJP" value={data.acquirer || "Belum terverifikasi"} />
          <DetailRow label="Acquirer GUI" value={data.acquirerGui} />
          <DetailRow label="Merchant Identifier 1" value={data.merchantIdentifier1} />
          <DetailRow label="Merchant Identifier 2" value={data.merchantIdentifier2} />
          <DetailRow label="Merchant Type" value={data.merchantType} />
          <DetailRow label="QRIS Network GUI" value={data.qrisNetworkGui} />
          <DetailRow label="QRIS Network ID" value={data.qrisNetworkId} />
          <DetailRow label="Terminal Label" value={data.terminalLabel} />
          <DetailRow label="QRIS Type" value={data.qrisType} />
          <DetailRow label="Currency" value={data.currency ? `${data.currency} (${data.currencyCode})` : data.currencyCode} />
          <DetailRow label="Transaction amount" value={data.amount ? `${data.amount} ${data.currency ?? ""}` : "Tidak tersedia"} />
        </dl>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-slate-500">07 — Integrity Validation</p><h3 className="mt-2 text-xl font-bold text-slate-900">Validasi integritas</h3>
        <dl className="mt-3 divide-y divide-slate-100">
          <DetailRow label="CRC16 (provided)" value={data.crc.provided} />
          <DetailRow label="CRC16 (calculated)" value={data.crc.calculated} />
          <DetailRow
            label="CRC Validation"
            value={
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${data.crc.valid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                {data.crc.valid ? <FiCheckCircle size={16} /> : <FiXCircle size={16} />}
                {data.crc.valid ? "Valid" : "Invalid"}
              </span>
            }
          />
        </dl>
        <p className="mt-4 text-sm text-slate-500">CRC valid bukan jaminan merchant aman atau resmi.</p>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <p className="text-sm font-semibold text-slate-500">05 — QRIS Comparison</p><h3 className="mt-2 text-xl font-bold text-slate-900">Bandingkan nama toko</h3>
        <label htmlFor="expected-merchant" className="mt-4 block text-sm font-medium text-slate-700">Nama toko yang seharusnya menerima pembayaran</label>
        <input id="expected-merchant" value={expectedName} onChange={(event) => setExpectedName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-slate-900 focus:outline-none" placeholder="Masukkan nama toko" />
        <p className="mt-3 text-sm text-slate-700">{comparison === "match" ? "Nama cocok dengan data QRIS." : comparison === "different" ? "Nama berbeda. Konfirmasikan kepada kasir sebelum membayar; perbedaan bukan bukti penipuan." : "Informasi tidak cukup untuk membandingkan nama."}</p>
      </section>

      <section className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200 sm:p-8"><p className="text-sm font-semibold text-slate-500">06 — Community Intelligence</p><h3 className="mt-2 text-xl font-bold text-slate-900">Belum tersedia</h3><p className="mt-2 text-sm text-slate-600">Project belum memiliki database laporan komunitas atau proses moderasi. Tidak ada laporan atau hitungan yang ditampilkan.</p></section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8"><p className="text-sm font-semibold text-slate-500">04 — Anomaly Detection</p><h3 className="mt-2 text-xl font-bold text-slate-900">Pemeriksaan teknis</h3><dl className="mt-3 divide-y divide-slate-100"><DetailRow label="Struktur TLV" value="Valid — berhasil diparse tanpa field terpotong" /><DetailRow label="Identitas merchant" value={data.merchantName || "Tidak tersedia"} /><DetailRow label="Kategori MCC" value={data.mccDescription || (data.mcc ? "Belum terverifikasi" : "Tidak tersedia")} /><DetailRow label="Reputasi merchant" value="Belum terverifikasi" /></dl></section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Raw Data Transparency</h3>
          <button type="button" onClick={() => setShowRaw((s) => !s)} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            {showRaw ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        {showRaw && (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Original QRIS Payload</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-xs break-all">{rawPayload}</pre>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <FiAlertTriangle size={18} className="text-slate-500" />
          <h3 className="text-lg font-bold text-slate-900">Catatan</h3>
        </div>
        <p className="mt-2 text-[15px] text-slate-700">Identitas merchant berhasil dibaca, tetapi belum diverifikasi terhadap database resmi.</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onReset} className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-[15px] font-bold text-white hover:bg-slate-700">
          <FiRefreshCw size={18} />
          Scan ulang
        </button>
        <Link href="/terlanjur" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-amber-50 hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          Terlanjur bayar? Lihat langkahnya <FiArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}

export default function CekQris() {
  const [stage, setStage] = useState<Stage>("input");
  const [data, setData] = useState<DecodedData | null>(null);
  const [rawPayload, setRawPayload] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (payload: string) => {
    setError(null);
    setData(null);
    setRawPayload("");
    setStage("loading");
    try {
      const parsed = parseQris(payload);
      const decoded = decodeQris(parsed);
      let crc: DecodedData["crc"];
      try { crc = validateCrc(payload); }
      catch { crc = { provided: "Tidak tersedia", calculated: "Tidak tersedia", valid: false }; }
      setData({ ...decoded, crc, findings: analyzeQris(payload, parsed, decoded) });
      setRawPayload(payload);
      setStage("result");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "QR tidak valid atau tidak terbaca.";
      setError(msg === "QR not found" ? "QR tidak ditemukan pada gambar." : msg);
      setStage("input");
    }
  };

  const handleReset = () => {
    setData(null);
    setRawPayload("");
    setError(null);
    setStage("input");
  };

  return (
    <main className="min-h-screen w-full bg-gray-100 px-5 py-8 sm:px-10 lg:px-20 lg:py-12">
      <style>{`@keyframes scan{0%{transform:translateY(0)}50%{transform:translateY(calc(100% - 2px))}100%{transform:translateY(0)}}`}</style>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="group inline-flex items-center gap-2 rounded-full py-1 pr-3 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900">
            <FiArrowLeft size={16} className="transition-transform duration-300 group-hover:-translate-x-1" />
            Kembali ke beranda
          </Link>
          <Stepper stage={stage} />
        </div>

        <header className="mt-8 mb-8 max-w-3xl">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Cek QRIS</h1>
          <p className="mt-3 text-lg leading-relaxed text-slate-600">Decoder QRIS berbasis data aktual.</p>
        </header>

        {error && stage === "input" && (
          <p role="alert" className="mb-5 rounded-2xl bg-red-50 px-5 py-4 text-[15px] font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        )}

        {stage === "input" && <InputStage onSubmit={handleSubmit} />}
        {stage === "loading" && <LoadingStage />}
        {stage === "result" && data && <ResultStage data={data} rawPayload={rawPayload} onReset={handleReset} />}
      </div>
    </main>
  );
}
