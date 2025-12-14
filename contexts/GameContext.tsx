import React, { createContext, useContext } from 'react';
import {
	DailyChallenge,
	GamePhase,
	InventoryItem,
	JunkyardCar,
	Mission,
	ModNode,
	Rival,
	SavedTune,
	TuningState,
} from '../types';

export interface GameContextType {
	phase: GamePhase;
	setPhase: (p: GamePhase) => void;
	money: number;
	setMoney: React.Dispatch<React.SetStateAction<number>>;
	playerTuning: TuningState;
	effectiveTuning: TuningState;
	setPlayerTuning: React.Dispatch<React.SetStateAction<TuningState>>;
	ownedMods: string[];
	setOwnedMods: (mod: ModNode) => void;
	missions: Mission[];
	dailyChallenges: DailyChallenge[];
	onStartMission: (m: Mission) => void;
	onConfirmRace: (opponent: any) => void;
	selectedMission: Mission | null;
	disabledMods: string[];
	setDisabledMods: React.Dispatch<React.SetStateAction<string[]>>;
	modSettings: Record<string, Record<string, number>>;
	setModSettings: (settings: Record<string, Record<string, number>>) => void;
	onLoadTune: (tune: SavedTune) => void;
	weather: { type: 'SUNNY' | 'RAIN'; intensity: number; season: any }; // using any to avoid circular dep with Season type if not imported
	setWeather: (w: {
		type: 'SUNNY' | 'RAIN';
		intensity: number;
		season: any;
	}) => void;
	showToast: (msg: string, type: any) => void; // Using any for toast type to match usage
	dynoHistory: { rpm: number; torque: number; hp: number }[];
	setDynoHistory: React.Dispatch<
		React.SetStateAction<{ rpm: number; torque: number; hp: number }[]>
	>;
	previousDynoHistory: { rpm: number; torque: number; hp: number }[];
	onDynoRunStart: () => void;
	garage: SavedTune[];
	setGarage: React.Dispatch<React.SetStateAction<SavedTune[]>>;
	currentCarIndex: number;
	setCurrentCarIndex: (index: number) => void;
	undergroundLevel: number;
	setUndergroundLevel: (level: number) => void;
	onBuyMods: (mods: ModNode[]) => void;
	junkyardCars: JunkyardCar[];
	onBuyJunkyardCar: (car: JunkyardCar) => void;
	onRefreshJunkyard: () => void;
	onRestoreCar: (index: number) => void;
	onScrapCar: (index: number) => void;
	missionSelectTab: 'CAMPAIGN' | 'UNDERGROUND' | 'DAILY' | 'RIVALS';
	setMissionSelectTab: (
		tab: 'CAMPAIGN' | 'UNDERGROUND' | 'DAILY' | 'RIVALS'
	) => void;
	xp: number;
	level: number;
	defeatedRivals: string[];
	// onChallengeRival: (rival: Rival) => void; // Removed
	userInventory: InventoryItem[];
	setUserInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
	onMerge: (item1: InventoryItem, item2: InventoryItem) => void;
	dealershipCars: JunkyardCar[];
	onBuyDealershipCar: (car: JunkyardCar) => void;
	onRefreshDealership: () => void;
	dailyShopItems: InventoryItem[];
	onBuyShopItem: (item: InventoryItem) => void;
	onRefreshDailyShop: () => void;
	onManualTuningChange: (tuning: Partial<TuningState>) => void;
	settings: GameSettings;
	setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
	saveGame: (
		overrides?: Partial<{
			garage: SavedTune[];
			inventory: any[];
			level: number;
			xp: number;
			money: number;
		}>
	) => Promise<void>;
}

export interface GameSettings {
	particles: boolean;
	manualClutch: boolean;
	realisticTires: boolean;
	engineDamage: boolean;
	shiftLightRPM: number;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
	const context = useContext(GameContext);
	if (!context) {
		throw new Error('useGame must be used within a GameProvider');
	}
	return context;
};

export const GameProvider: React.FC<{
	value: GameContextType;
	children: React.ReactNode;
}> = ({ value, children }) => {
	return (
		<GameContext.Provider value={value}>{children}</GameContext.Provider>
	);
};
