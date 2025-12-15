export type GamePhase =
	| 'MENU'
	| 'GARAGE'
	| 'MAP'
	| 'MISSION_SELECT'
	// | 'VERSUS' // Removed
	| 'RACE'
	| 'RESULTS'
	| 'JUNKYARD'
	| 'DEALERSHIP'
	| 'SHOP'
	| 'AUCTION'
	| 'ONLINE_RACE'
	| 'TEST_TRACK';

export type RaceStatus = 'IDLE' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

export type SkillBranch = 'MECHANIC' | 'DRIVER' | 'TYCOON';

export interface SkillNode {
	id: string;
	name: string;
	description: string;
	cost: number;
	branch: SkillBranch;
	parentId: string | null;
	x: number;
	y: number;
	stats: {
		repairCostMultiplier?: number;
		salvageYieldMultiplier?: number;
		shiftWindowMultiplier?: number;
		reactionTimeBonus?: number;
		racePayoutMultiplier?: number;
		marketFeeMultiplier?: number;
		xpGainMultiplier?: number;
	};
}

export interface InputState {
	gas: boolean;
	shiftUp: boolean;
	shiftDown: boolean;
	clutch: boolean; // New Manual Clutch
	brake: boolean;
	purge: boolean; // Nitrous Purge
	steerLeft?: boolean;
	steerRight?: boolean;
}

// Replaces the old linear levels
export interface ModNode {
	id: string;
	name: string;
	description: string;
	cost: number;
	type:
		| 'ENGINE'
		| 'TURBO'
		| 'WEIGHT'
		| 'TIRES'
		| 'TRANSMISSION'
		| 'NITROUS'
		| 'FUEL'
		| 'COOLING'
		| 'AERO'
		| 'SUSPENSION'
		| 'VISUAL'
		| 'PAINT'
		| 'BRAKES'
		| 'INTERIOR'
		| 'ELECTRONICS';

	// Tree Logic
	parentId: string | null;
	conflictsWith: string[]; // IDs of mods that cannot be active with this one

	// Effects
	stats: Partial<TuningState>;

	// UI Layout (Grid Coordinates)
	x: number;
	y: number;

	// New Tuning System
	tuningOptions?: TuningOption[];
	soundProfile?: string; // e.g., 'muffler_sport'
	isSpecial?: boolean; // If true, only visible if owned or parent is owned
	rarity?: 'COMMON' | 'RARE' | 'LEGENDARY' | 'EXOTIC';
}

export interface TuningOption {
	id: string; // e.g., 'boost_pressure'
	name: string;
	min: number;
	max: number;
	step: number;
	defaultValue: number;
	unit?: string;
	statAffected?: keyof TuningState; // Which stat this modifies directly (optional)
}

export type ModSettings = Record<string, Record<string, number>>; // modId -> { settingId: value }

export type ItemRarity =
	| 'COMMON'
	| 'UNCOMMON'
	| 'RARE'
	| 'EPIC'
	| 'LEGENDARY'
	| 'EXOTIC';

export type ModType =
	| 'ENGINE'
	| 'TURBO'
	| 'WEIGHT'
	| 'TIRES'
	| 'TRANSMISSION'
	| 'NITROUS'
	| 'FUEL'
	| 'COOLING'
	| 'AERO'
	| 'SUSPENSION'
	| 'VISUAL'
	| 'PAINT'
	| 'BRAKES'
	| 'INTERIOR'
	| 'ELECTRONICS';

export interface DailyReward {
	day: number;
	type: 'MONEY' | 'XP' | 'ITEM' | 'CRATE';
	amount?: number;
	itemId?: string;
	itemRarity?: ItemRarity;
	crateType?: 'BASIC' | 'PREMIUM' | 'ELITE';
}

export interface LoginStreak {
	currentStreak: number;
	lastLoginDate: string; // ISO date string
	longestStreak: number;
	totalLogins: number;
	rewardsClaimed: number[];
}

export interface InventoryItem {
	instanceId: string; // Unique UUID
	baseId: string; // Ref to definition (e.g. 'turbo_t3')
	name: string;
	description: string;
	type: ModType;
	rarity: ItemRarity;
	condition: number; // 0-100
	stats: Partial<TuningState>;
	value: number; // Estimated market value
	icon?: string; // Optional icon override
	equipped?: boolean;
	category?: string; // Specific category (e.g. "Intake", "Turbo")
	parentCategory?: string; // Broad category (e.g. "Engine")
	spriteIndex?: number;
	isSpecial?: boolean;
	specialName?: string;
	masteryGiven?: boolean;
}

export interface Crate {
	id: string;
	name: string;
	description: string;
	price: number;
	dropRates: {
		COMMON: number;
		UNCOMMON: number;
		RARE: number;
		EPIC: number;
		LEGENDARY: number;
	};
}

export type Rarity = ItemRarity | 'EXOTIC'; // Backwards compatibility if needed, or just alias

export interface SavedTune {
	id: string;
	name: string;
	date: number;
	ownedMods: string[];
	disabledMods: string[];
	modSettings: ModSettings;
	manualTuning: Partial<TuningState>;
	condition?: number; // 0-1 (1 = perfect, 0 = wrecked)
	originalPrice?: number; // Market value when fully restored
	rarity?: Rarity;
	rarityMultiplier?: number;
	dynoHistory?: { rpm: number; torque: number; hp: number }[];
	installedItems?: InventoryItem[];
	masteryXP?: number;
	masteryLevel?: number;
}

export interface JunkyardCar extends SavedTune {
	price: number;
}

export interface JunkyardItem extends InventoryItem {
	price: number;
}

export interface TuningState {
	// Engine
	maxTorque: number; // Nm
	torqueCurve: { rpm: number; factor: number }[];
	redlineRPM: number;
	flywheelMass: number;
	idleRPM: number;
	compressionRatio: number; // For audio simulation

	// Audio
	cylinders: number;
	exhaustOpenness: number;
	backfireAggression: number;
	turboIntensity: number;

	// Transmission
	finalDriveRatio: number;
	gearRatios: Record<number, number>;

	// Physics
	mass: number;
	dragCoefficient: number;
	tireGrip: number;
	brakingForce: number;

	// Visuals
	color: string;
	name?: string; // Car nickname
}

export interface CarState {
	y: number; // Distance in meters
	velocity: number; // m/s
	rpm: number;
	gear: number; // 0: N, 1-6: Forward
	finished: boolean;
	finishTime: number;

	// Circuit Mode (Optional)
	x?: number;
	angle?: number;
	steerAngle?: number;
	lateralVelocity?: number;
	tireTemp?: number; // 0-100, 50 is optimal
	engineHealth?: number; // 0-100
}

export interface GhostFrame {
	time: number;
	y: number;
	velocity: number;
	rpm: number;
	gear: number;
}

export interface Rival extends Opponent {
	id: string;
	rank: number; // 1 is highest (Boss), 10 is lowest
	unlockRequirements: {
		level?: number;
		previousRivalId?: string;
	};
	rewards: {
		money: number;
		car?: JunkyardCar; // Unique car reward
	};
	bio: string;
	status: 'LOCKED' | 'AVAILABLE' | 'DEFEATED';
}

export interface Opponent {
	name: string;
	difficulty: number;
	color: string;
	tuning: TuningState;
}
export interface Mission {
	id: number | string;
	name: string;
	description: string;
	payout: number;
	difficulty:
		| 'EASY'
		| 'MEDIUM'
		| 'HARD'
		| 'EXTREME'
		| 'IMPOSSIBLE'
		| 'BOSS'
		| 'UNDERGROUND';
	distance: number; // meters
	opponent: Opponent;
	bestTime?: number; // Persisted best time
	bestGhost?: GhostFrame[]; // Recorded ghost data
	rewardCar?: SavedTune; // Car awarded for winning
	xpReward?: number;
}

export interface DailyChallenge extends Mission {
	expiresAt: number;
	completed: boolean;
}

export type ToastType =
	| 'ENGINE'
	| 'TIRES'
	| 'WEIGHT'
	| 'TRANSMISSION'
	| 'TURBO'
	| 'NITROUS'
	| 'FUEL'
	| 'COOLING'
	| 'AERO'
	| 'SUSPENSION'
	| 'MONEY'
	| 'UNLOCK'
	| 'INFO'
	| 'WARNING'
	| 'PAINT'
	| 'ECU'
	| 'ERROR'
	| 'SUCCESS';

export type Season = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';

export interface WeatherState {
	type: 'SUNNY' | 'RAIN';
	intensity: number; // 0-1
	season: Season;
}

export interface AuctionListing {
	id: string;
	sellerId: string;
	item: InventoryItem;
	price: number;
	listedAt: number;
	status: 'ACTIVE' | 'SOLD' | 'EXPIRED';
}

export interface SeasonPassReward {
	tier: number; // 1-50
	requiredXP: number;
	freeReward: DailyReward;
	premiumReward?: DailyReward;
}

export interface UserSeasonProgress {
	seasonId: string;
	xp: number; // Season XP distinct from Player XP?
	claimedFreeTiers: number[];
	claimedPremiumTiers: number[];
	isPremium: boolean;
}
