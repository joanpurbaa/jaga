import type { ScenarioDefinition } from "./types.ts";
import { courierApkScenario } from "./scenarios/courier-apk.ts";

export const scenarios: Record<string, ScenarioDefinition> = {
	[courierApkScenario.id]: courierApkScenario,
};

export function getScenario(id: string): ScenarioDefinition | null {
	return scenarios[id] ?? null;
}
