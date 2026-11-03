import { type IncidentWhen, type IncidentId, validateIncidentIds } from "./plan.ts";

export const ACT_STORAGE_KEY = "jaga.terlanjur.plan.v1";
export type ActPlanState = { incidentIds: IncidentId[]; when: IncidentWhen; completedStepIds: string[] };
export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type LoadPlanResult = { state: ActPlanState; available: boolean; hadSavedPlan: boolean };

export const emptyActPlan = (): ActPlanState => ({ incidentIds: [], when: "recent", completedStepIds: [] });
const validWhen = (value: unknown): value is IncidentWhen => value === "recent" || value === "today" || value === "older";
const knownStepIds = new Set([
	"stop-payment", "secure-accounts", "recover-whatsapp", "pause-suspected-app", "stop-extra-fees",
	"recover-social-account", "warn-contacts", "scan-and-remove-app", "report-financial-scam",
	"alert-identity-leak", "preserve-evidence", "identity-monitoring", "report-platform", "police-report",
]);

function parseState(value: unknown): ActPlanState | null {
	if (!value || typeof value !== "object") return null;
	const item = value as Record<string, unknown>;
	if (item.version !== 1 || !validWhen(item.when)) return null;
	return {
		incidentIds: validateIncidentIds(item.incidentIds),
		when: item.when,
		completedStepIds: Array.isArray(item.completedStepIds)
			? [...new Set(item.completedStepIds.filter((id): id is string => typeof id === "string" && knownStepIds.has(id)))]
			: [],
	};
}

export function readActPlan(storage: StoragePort | null): LoadPlanResult {
	if (!storage) return { state: emptyActPlan(), available: false, hadSavedPlan: false };
	let raw: string | null = null;
	try {
		raw = storage.getItem(ACT_STORAGE_KEY);
	} catch {
		return { state: emptyActPlan(), available: false, hadSavedPlan: false };
	}
	if (raw === null) return { state: emptyActPlan(), available: true, hadSavedPlan: false };
	try {
		const parsed = parseState(JSON.parse(raw) as unknown);
		if (parsed) return { state: parsed, available: true, hadSavedPlan: parsed.incidentIds.length > 0 };
		storage.removeItem(ACT_STORAGE_KEY);
		return { state: emptyActPlan(), available: true, hadSavedPlan: false };
	} catch {
		try { storage.removeItem(ACT_STORAGE_KEY); } catch { /* ignore */ }
		return { state: emptyActPlan(), available: true, hadSavedPlan: false };
	}
}

export function writeActPlan(storage: StoragePort | null, state: ActPlanState): boolean {
	if (!storage) return false;
	try {
		const incidentIds = validateIncidentIds(state.incidentIds);
		const saved: ActPlanState = {
			incidentIds,
			when: validWhen(state.when) ? state.when : "recent",
			completedStepIds: [...new Set(state.completedStepIds.filter((id) => knownStepIds.has(id)))],
		};
		storage.setItem(ACT_STORAGE_KEY, JSON.stringify({ version: 1, ...saved }));
		return true;
	} catch {
		return false;
	}
}

export function clearActPlan(storage: StoragePort | null): boolean {
	if (!storage) return false;
	try {
		storage.removeItem(ACT_STORAGE_KEY);
		return true;
	} catch {
		return false;
	}
}

export function getBrowserStorage(): StoragePort | null {
	try { return typeof window === "undefined" ? null : window.localStorage; }
	catch { return null; }
}
