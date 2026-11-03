export type IntentId =
	| "asking_identity"
	| "asking_tracking_number"
	| "refusing_download"
	| "refusing_personal_data"
	| "showing_trust"
	| "expressing_confusion"
	| "asking_verification"
	| "resisting_pressure"
	| "reporting"
	| "ending_conversation"
	| "sharing_personal_data"
	| "unrecognized";

export type RiskIndicatorId = "unknown_sender" | "fake_courier" | "apk_file" | "time_pressure" | "unofficial_channel" | "personal_data";
export type TechniqueId = "authority_impersonation" | "trust_building" | "urgency" | "fear_of_loss" | "social_engineering" | "instruction_manipulation";
export type DecisionCategory = "identity_verification" | "file_awareness" | "pressure_resistance" | "independent_verification" | "safe_exit";
export type DecisionQuality = "protective" | "neutral" | "risky";
export type DecisionOutcome = "reduced_exposure" | "no_change" | "increased_exposure";
export type InputMode = "quick_action" | "free_text";

export type ScenarioMessage = {
	id: string;
	text: string;
	file?: { name: string; sizeLabel: string; note: string };
	indicatorIds?: RiskIndicatorId[];
	technique?: TechniqueId;
};

export type ScenarioChoice = {
	id: string;
	label: string;
	intents: IntentId[];
	keywords?: string[];
	quality: DecisionQuality;
	outcome: DecisionOutcome;
	exposureDelta: number;
	recognizes?: RiskIndicatorId[];
	reply: ScenarioMessage;
	decisionEvidence: string;
	whyItMatters: string;
	saferAlternative: string;
	followUp?: ScenarioMessage[];
	nextNodeId: string | null;
	additionalScores?: { category: DecisionCategory; quality: DecisionQuality }[];
	endReason?: "protected_exit" | "continued_exposure";
};

export type DecisionPoint = {
	id: string;
	question: string;
	category: DecisionCategory;
	choices: ScenarioChoice[];
	fallbackChoiceId: string;
};

export type ScenarioNode = {
	id: string;
	messages: ScenarioMessage[];
	decision: DecisionPoint;
};

export type RiskIndicator = {
	id: RiskIndicatorId;
	name: string;
	description: string;
	whyItMatters: string;
};

export type ScenarioDefinition = {
	id: string;
	title: string;
	description: string;
	difficulty: "mudah" | "sedang" | "menantang";
	estimatedMinutes: number;
	contactName: string;
	context: string;
	startNodeId: string;
	nodes: Record<string, ScenarioNode>;
	indicators: RiskIndicator[];
	playbook: string[];
};

export type ChatMessage = {
	id: string;
	from: "me" | "them";
	time: string;
	text?: string;
	file?: NonNullable<ScenarioMessage["file"]>;
};

export type SimulationEventType =
	| "simulation_started"
	| "message_received"
	| "suspicious_file_encountered"
	| "quick_action_selected"
	| "free_text_submitted"
	| "verification_attempted"
	| "pressure_response"
	| "conversation_ended"
	| "simulation_completed";

export type SimulationEvent = {
	id: string;
	type: SimulationEventType;
	at: string;
	nodeId: string;
	scenarioMessageId?: string;
	decisionId?: string;
	actionId?: string;
	inputMode?: InputMode;
	intent?: IntentId;
	label?: string;
	indicatorIds?: RiskIndicatorId[];
	technique?: TechniqueId;
	quality?: DecisionQuality;
	outcome?: DecisionOutcome;
	exposureDelta?: number;
	evidence?: string;
	whyItMatters?: string;
	saferAlternative?: string;
	responseId?: string;
};

export type ScoreContribution = { category: DecisionCategory; quality: DecisionQuality };

export type DecisionRecord = {
	id: string;
	at: string;
	nodeId: string;
	decisionId: string;
	actionId: string;
	inputMode: InputMode;
	intent: IntentId;
	label: string;
	quality: DecisionQuality;
	outcome: DecisionOutcome;
	indicatorIds: RiskIndicatorId[];
	exposureDelta: number;
	evidence: string;
	whyItMatters: string;
	saferAlternative: string;
	scoreContributions: ScoreContribution[];
};

export type SimulationSession = {
	id: string;
	scenarioId: string;
	status: "active" | "completed" | "abandoned";
	startedAt: string;
	completedAt: string | null;
	currentNodeId: string;
	visitedNodeIds: string[];
	decisions: DecisionRecord[];
	events: SimulationEvent[];
	encounteredIndicators: RiskIndicatorId[];
	recognizedIndicators: RiskIndicatorId[];
	riskExposure: number;
	finalScore: number | null;
	endReason: "protected_exit" | "continued_exposure" | null;
};

export type SimulationScore = {
	score: number;
	category: "Sangat waspada" | "Cukup waspada" | "Perlu lebih berhati-hati";
	protectiveDecisions: number;
	riskyDecisions: number;
	decisionPointsFaced: number;
	indicatorsRecognized: number;
	indicatorsEncountered: number;
	riskExposure: number;
	coverage: string;
};
