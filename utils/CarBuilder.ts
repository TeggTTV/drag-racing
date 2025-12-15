import {
	TuningState,
	ModNode,
	SavedTune,
	InventoryItem,
	ItemSet,
} from '../types';
import { BASE_TUNING, MOD_TREE, ITEM_SETS } from '../constants';

export class CarBuilder {
	/**
	 * Calculates the final tuning state by applying mods to the base tuning.
	 * @param baseTuning The starting tuning state (usually BASE_TUNING or a car's stock tune)
	 * @param ownedModIds List of mod IDs that are installed
	 * @param disabledModIds List of mod IDs that are owned but disabled
	 * @param modSettings Settings for specific mods
	 * @param installedItems List of inventory items installed on the car
	 * @returns The final calculated TuningState
	 */
	static calculateTuning(
		baseTuning: TuningState,
		ownedModIds: string[],
		disabledModIds: string[] = [],
		modSettings: Record<string, Record<string, number>> = {},
		installedItems: InventoryItem[] = [],
		masteryLevel: number = 0
	): TuningState {
		// Start with a deep copy of the base tuning to avoid mutating the original
		let finalTuning: TuningState = JSON.parse(JSON.stringify(baseTuning));

		// LEGACY MOD SYSTEM - DISABLED
		// // Filter out disabled mods
		// const activeModIds = ownedModIds.filter(
		// 	(id) => !disabledModIds.includes(id)
		// );

		// // Find the ModNode objects for the active IDs
		// const activeMods = MOD_TREE.filter((mod) =>
		// 	activeModIds.includes(mod.id)
		// );

		// // Apply each mod
		// activeMods.forEach((mod) => {
		// 	finalTuning = this.applyMod(finalTuning, mod, modSettings[mod.id]);
		// });

		// Apply installed items
		installedItems.forEach((item) => {
			finalTuning = this.applyItemStats(finalTuning, item);
		});

		// Apply Mastery Perks
		if (masteryLevel > 0) {
			// +1% Torque and Grip per 10 levels
			const perkMultiplier = 1 + Math.floor(masteryLevel / 10) * 0.01;
			finalTuning.maxTorque *= perkMultiplier;
			finalTuning.tireGrip *= perkMultiplier;
		}

		// Apply Set Bonuses
		const activeSets = this.getActiveSets(installedItems);
		activeSets.forEach((set) => {
			// Apply additive bonusStats first
			if (set.bonusStats) {
				if (set.bonusStats.maxTorque)
					finalTuning.maxTorque += set.bonusStats.maxTorque;
				if (set.bonusStats.tireGrip)
					finalTuning.tireGrip += set.bonusStats.tireGrip;
				if (set.bonusStats.brakingForce)
					finalTuning.brakingForce += set.bonusStats.brakingForce;
				if (set.bonusStats.mass)
					finalTuning.mass += set.bonusStats.mass;
				if (set.bonusStats.dragCoefficient)
					finalTuning.dragCoefficient +=
						set.bonusStats.dragCoefficient;
				if (set.bonusStats.turboIntensity)
					finalTuning.turboIntensity += set.bonusStats.turboIntensity;
				if (set.bonusStats.redlineRPM)
					finalTuning.redlineRPM += set.bonusStats.redlineRPM;
				if (set.bonusStats.flywheelMass)
					finalTuning.flywheelMass += set.bonusStats.flywheelMass;
			}

			// Apply multiplicative bonusMultipliers after all additive bonuses
			if (set.bonusMultipliers) {
				if (set.bonusMultipliers.maxTorque)
					finalTuning.maxTorque *= set.bonusMultipliers.maxTorque;
				if (set.bonusMultipliers.tireGrip)
					finalTuning.tireGrip *= set.bonusMultipliers.tireGrip;
				if (set.bonusMultipliers.brakingForce)
					finalTuning.brakingForce *=
						set.bonusMultipliers.brakingForce;
				// xpGain multiplier is handled separately in race results
			}
		});

		return finalTuning;
	}

	/**
	 * Determines which item sets are currently active based on installed items.
	 * @param installedItems List of items currently installed on the car
	 * @returns Array of active ItemSet objects
	 */
	static getActiveSets(installedItems: InventoryItem[]): ItemSet[] {
		const installedBaseIds = installedItems.map((item) => item.baseId);

		return ITEM_SETS.filter((set: ItemSet) => {
			// Check if all required items are installed
			return set.requiredItemIds.every((requiredId) =>
				installedBaseIds.includes(requiredId)
			);
		});
	}

	/**
	 * Applies a single mod's stats to the tuning state.
	 * @param currentTuning The current state of the car
	 * @param mod The mod to apply
	 * @param settings Optional settings for this mod
	 * @returns A new TuningState with the mod applied
	 */
	private static applyMod(
		currentTuning: TuningState,
		mod: ModNode,
		settings?: Record<string, number>
	): TuningState {
		const newTuning = { ...currentTuning };

		if (!mod.stats) return newTuning;

		// Apply numeric stats (additive)
		if (mod.stats.maxTorque) newTuning.maxTorque += mod.stats.maxTorque;
		if (mod.stats.mass) newTuning.mass += mod.stats.mass;
		if (mod.stats.dragCoefficient)
			newTuning.dragCoefficient += mod.stats.dragCoefficient;
		if (mod.stats.tireGrip) newTuning.tireGrip += mod.stats.tireGrip;
		if (mod.stats.brakingForce)
			newTuning.brakingForce += mod.stats.brakingForce;
		if (mod.stats.turboIntensity)
			newTuning.turboIntensity += mod.stats.turboIntensity;
		if (mod.stats.exhaustOpenness)
			newTuning.exhaustOpenness += mod.stats.exhaustOpenness;
		if (mod.stats.backfireAggression)
			newTuning.backfireAggression += mod.stats.backfireAggression;

		// Apply replacements (these override the base value)
		if (mod.stats.cylinders) newTuning.cylinders = mod.stats.cylinders;
		if (mod.stats.redlineRPM) newTuning.redlineRPM = mod.stats.redlineRPM;
		if (mod.stats.idleRPM) newTuning.idleRPM = mod.stats.idleRPM;
		if (mod.stats.finalDriveRatio)
			newTuning.finalDriveRatio = mod.stats.finalDriveRatio;

		// Apply complex objects (Arrays/Objects) - usually replacements
		if (mod.stats.gearRatios) {
			newTuning.gearRatios = { ...mod.stats.gearRatios };
		}
		if (mod.stats.torqueCurve) {
			newTuning.torqueCurve = [...mod.stats.torqueCurve];
		}

		// Apply Tuning Options (Settings)
		if (mod.tuningOptions && settings) {
			mod.tuningOptions.forEach((option) => {
				const userValue = settings[option.id];
				if (userValue !== undefined) {
					if (option.statAffected) {
						// Direct stat modification (replacement)
						// Note: This assumes the setting REPLACES the stat.
						// If it should be additive, we'd need more logic.
						// For now, let's assume replacement for things like 'finalDriveRatio'
						// but maybe we need to check the type.
						(newTuning as any)[option.statAffected] = userValue;
					} else if (option.id === 'boost_pressure') {
						const deltaBar = userValue - option.defaultValue;
						newTuning.maxTorque += deltaBar * 100;
						newTuning.turboIntensity = Math.min(
							1.0,
							newTuning.turboIntensity + deltaBar * 0.2
						);
					} else if (option.id === 'tire_pressure') {
						// Tire Pressure Logic: Lower = More Grip, More Drag
						// Default 30 PSI.
						const deltaPsi = 30 - userValue; // Positive if under-inflated
						newTuning.tireGrip += deltaPsi * 0.01;
						newTuning.dragCoefficient += deltaPsi * 0.002;
					}
				}
			});
		}

		return newTuning;
	}

	/**
	 * Estimates the value of a car based on its mods and condition.
	 */
	static getCarValue(
		baseValue: number,
		condition: number,
		ownedModIds: string[]
	): number {
		let modValue = 0;
		const ownedMods = MOD_TREE.filter((mod) =>
			ownedModIds.includes(mod.id)
		);
		ownedMods.forEach((mod) => {
			modValue += mod.cost * 0.7; // 70% return on parts
		});

		return Math.floor((baseValue + modValue) * condition);
	}

	static applyItemStats(
		tuning: TuningState,
		item: InventoryItem
	): TuningState {
		const newTuning = { ...tuning };
		if (!item.stats) return newTuning;
		const stats = item.stats;

		// Condition Logic:
		// Condition goes from 0.0 to 1.0.
		// Stats should degrade linearly or exponentially?
		// Let's say at 0 condition, the part is ineffective (provides 0 benefit), or even worse?
		// For simplicity: Effective Stat = Stat * Condition.
		// NOTE: Some stats like 'mass' should NOT decrease with condition (a broken engine weighs the same).
		// We only scale performance gains.

		const normalizeCondition = (c: number) => (c > 1.0 ? c / 100 : c); // Handle both 0-100 and 0-1 (legacy safety)
		const rawCondition =
			item.condition !== undefined ? item.condition : 100;
		const condition = Math.max(0.1, normalizeCondition(rawCondition));
		// console.log(`[CarBuilder] ${item.name} | Raw: ${rawCondition} | Norm: ${condition}`);

		// Numeric stats (additive) - SCALED BY CONDITION
		if (stats.maxTorque) {
			// console.log(
			// 	`Adding Torque: ${stats.maxTorque} * ${condition} = ${
			// 		stats.maxTorque * condition
			// 	}`
			// );
			newTuning.maxTorque += stats.maxTorque * condition;
		}
		if (stats.tireGrip) newTuning.tireGrip += stats.tireGrip * condition;
		if (stats.brakingForce)
			newTuning.brakingForce += stats.brakingForce * condition;
		if (stats.turboIntensity)
			newTuning.turboIntensity += stats.turboIntensity * condition;

		// Mass is constant regardless of condition
		if (stats.mass) newTuning.mass += stats.mass;

		// Aero drag might get WORSE with bad condition? (Dent/Loose parts)
		// For now, let's assume it scales the BENEFIT (negative drag is good).
		// If mod gives -0.05 drag, at 50% condition it gives -0.025.
		if (stats.dragCoefficient)
			newTuning.dragCoefficient += stats.dragCoefficient * condition;

		if (stats.exhaustOpenness)
			newTuning.exhaustOpenness += stats.exhaustOpenness; // Sound probably stays? Or maybe quieter?
		if (stats.backfireAggression)
			newTuning.backfireAggression += stats.backfireAggression;
		if (stats.flywheelMass) newTuning.flywheelMass += stats.flywheelMass; // Mass constant

		// Replacements - These are tricky. A broken 6-speed is still a 6-speed?
		// Or maybe we don't scale replacements, only additive bonuses.
		// Generally replacements define the architecture, condition affects the output.
		// So we leave replacements alone.
		if (stats.cylinders) newTuning.cylinders = stats.cylinders;
		if (stats.redlineRPM) newTuning.redlineRPM += stats.redlineRPM;
		if (stats.idleRPM) newTuning.idleRPM += stats.idleRPM;
		if (stats.finalDriveRatio !== undefined)
			newTuning.finalDriveRatio += stats.finalDriveRatio;
		if (stats.gearRatios) newTuning.gearRatios = { ...stats.gearRatios };

		return newTuning;
	}
}
