import { TuningState, CarState, InputState } from '../types';
import { AudioEngine } from '../components/AudioEngine';
import { updateCarPhysics } from './physics';

// Mock audio engine for simulation (doesn't actually play sounds)
class MockAudioEngine extends AudioEngine {
	constructor() {
		super();
	}

	update() {}
	triggerShift() {}
	triggerLimiter() {}
	setMasterVolume() {}
	cleanup() {}
}

const mockAudio = new MockAudioEngine();

/**
 * Simulates car performance to calculate 0-60 mph time
 */
export const simulate0to60 = (tuning: TuningState): number => {
	const targetSpeed = 60 * 0.44704; // 60 mph to m/s
	const dt = 1 / 60; // 60 FPS simulation
	const maxTime = 30; // Max 30 seconds

	// Initialize car state
	const car: CarState = {
		y: 0,
		velocity: 0,
		rpm: tuning.idleRPM,
		gear: 0,
		finished: false,
		finishTime: 0,
	};

	// Full throttle input
	const inputs: InputState = {
		gas: true,
		shiftUp: false,
		shiftDown: false,
		clutch: false,
		brake: false,
		purge: false,
	};

	let time = 0;
	let lastGear = 0;

	// Start in first gear
	car.gear = 1;

	while (time < maxTime) {
		// Auto-shift logic
		const shiftUpRPM = tuning.redlineRPM * 0.95;
		const shiftDownRPM = tuning.redlineRPM * 0.4;

		if (car.rpm >= shiftUpRPM && car.gear < 6) {
			inputs.shiftUp = true;
			lastGear = car.gear;
		} else {
			inputs.shiftUp = false;
		}

		// Run physics update
		updateCarPhysics(
			car,
			tuning,
			inputs,
			dt,
			true, // isAI
			mockAudio,
			'RACING',
			0,
			undefined,
			{ name: 'Sim', difficulty: 0.8, color: '#000', tuning }
		);

		time += dt;

		// Check if we've reached 60 mph
		if (car.velocity >= targetSpeed) {
			return time;
		}
	}

	return maxTime; // Failed to reach 60 mph
};

/**
 * Simulates car performance to calculate quarter mile time
 */
export const simulateQuarterMile = (tuning: TuningState): number => {
	const targetDistance = 402.336; // 1/4 mile in meters
	const dt = 1 / 60; // 60 FPS simulation
	const maxTime = 60; // Max 60 seconds

	// Initialize car state
	const car: CarState = {
		y: 0,
		velocity: 0,
		rpm: tuning.idleRPM,
		gear: 0,
		finished: false,
		finishTime: 0,
	};

	// Full throttle input
	const inputs: InputState = {
		gas: true,
		shiftUp: false,
		shiftDown: false,
		clutch: false,
		brake: false,
		purge: false,
	};

	let time = 0;

	// Start in first gear
	car.gear = 1;

	while (time < maxTime) {
		// Auto-shift logic
		const shiftUpRPM = tuning.redlineRPM * 0.95;

		if (car.rpm >= shiftUpRPM && car.gear < 6) {
			inputs.shiftUp = true;
		} else {
			inputs.shiftUp = false;
		}

		// Run physics update
		updateCarPhysics(
			car,
			tuning,
			inputs,
			dt,
			true, // isAI
			mockAudio,
			'RACING',
			0,
			undefined,
			{ name: 'Sim', difficulty: 0.8, color: '#000', tuning }
		);

		time += dt;

		// Check if we've reached quarter mile
		if (car.y >= targetDistance) {
			return time;
		}
	}

	return maxTime; // Failed to reach quarter mile
};

/**
 * Simulates car performance to find top speed
 */
export const simulateTopSpeed = (tuning: TuningState): number => {
	const dt = 1 / 60; // 60 FPS simulation
	const maxTime = 120; // Max 2 minutes
	const velocityThreshold = 0.01; // m/s - consider stable when velocity change is below this

	// Initialize car state
	const car: CarState = {
		y: 0,
		velocity: 0,
		rpm: tuning.idleRPM,
		gear: 0,
		finished: false,
		finishTime: 0,
	};

	// Full throttle input
	const inputs: InputState = {
		gas: true,
		shiftUp: false,
		shiftDown: false,
		clutch: false,
		brake: false,
		purge: false,
	};

	let time = 0;
	let lastVelocity = 0;
	let stableCount = 0;
	const stableFramesRequired = 60; // 1 second of stable velocity

	// Start in first gear
	car.gear = 1;

	while (time < maxTime) {
		// Auto-shift logic - shift to top gear
		const shiftUpRPM = tuning.redlineRPM * 0.95;

		if (car.rpm >= shiftUpRPM && car.gear < 6) {
			inputs.shiftUp = true;
		} else {
			inputs.shiftUp = false;
		}

		// Run physics update
		updateCarPhysics(
			car,
			tuning,
			inputs,
			dt,
			true, // isAI
			mockAudio,
			'RACING',
			0,
			undefined,
			{ name: 'Sim', difficulty: 0.8, color: '#000', tuning }
		);

		time += dt;

		// Check if velocity has stabilized (top speed reached)
		const velocityChange = Math.abs(car.velocity - lastVelocity);
		if (velocityChange < velocityThreshold) {
			stableCount++;
			if (stableCount >= stableFramesRequired) {
				// Convert m/s to mph
				return car.velocity * 2.237;
			}
		} else {
			stableCount = 0;
		}

		lastVelocity = car.velocity;
	}

	// Return current velocity if we hit max time
	return car.velocity * 2.237; // m/s to mph
};
