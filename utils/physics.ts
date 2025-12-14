import { CarState, TuningState, InputState, Opponent } from '../types';
import { AudioEngine } from '../components/AudioEngine';
import { GameSettings } from '../contexts/GameContext';

export const interpolateTorque = (
	rpm: number,
	curve: { rpm: number; factor: number }[]
): number => {
	const clampedRPM = Math.max(0, rpm);
	for (let i = 0; i < curve.length - 1; i++) {
		const p1 = curve[i];
		const p2 = curve[i + 1];
		if (clampedRPM >= p1.rpm && clampedRPM <= p2.rpm) {
			const t = (clampedRPM - p1.rpm) / (p2.rpm - p1.rpm);
			return p1.factor + t * (p2.factor - p1.factor);
		}
	}
	return curve[curve.length - 1]?.factor || 0.2;
};

export const updateCarPhysics = (
	car: CarState,
	t: TuningState,
	inputs: InputState,
	dt: number,
	isAI: boolean,
	audioEngine: AudioEngine,
	raceStatus: string,
	raceStartTime: number,
	currentGhostRecording?: { current: any[] },
	aiStats?: Opponent,
	frictionMultiplier: number = 1.0,
	settings?: GameSettings
) => {
	const isLocked = raceStatus === 'COUNTDOWN';

	// Initialize State
	if (car.tireTemp === undefined) car.tireTemp = 20; // Cold start
	if (car.engineHealth === undefined) car.engineHealth = 100;

	// --- 0. Engine Damage Logic ---
	if (settings?.engineDamage && !isAI) {
		if (car.engineHealth <= 0) {
			// Blown engine
			car.rpm = 0;
			return; // No physics updates
		}

		// Redline Damage
		if (car.rpm > t.redlineRPM) {
			const overRev = car.rpm - t.redlineRPM;
			// Damage scales with how far over redline
			const damage = (overRev / 1000) * dt * 5;
			car.engineHealth = Math.max(0, car.engineHealth - damage);
		}

		// Money Shift (Instant Kill)
		if (car.rpm > t.redlineRPM * 1.3) {
			car.engineHealth = 0;
			audioEngine.createPop(1.0); // Big bang
		}
	}

	// --- 0.5 Tire Temp Logic ---
	let tempGripMult = 1.0;
	if (settings?.realisticTires && !isAI) {
		// Heating: Burnout (Gas + Brake) or Hard Cornering/Accel
		const isBurnout = inputs.gas && (inputs.brake || isLocked); // Brake isn't in InputState yet? Assuming brake logic exists or using isLocked for start line
		// Actually InputState doesn't have brake? Let's check.
		// It doesn't. But usually 'down' is brake in some games, or space.
		// For now, let's assume burnout is high RPM low speed.

		const slip = Math.abs(
			(car.rpm / 60) *
				t.gearRatios[car.gear] *
				t.finalDriveRatio *
				2 *
				Math.PI *
				0.3 -
				car.velocity
		);

		if (slip > 5 && inputs.gas) {
			// Spinning wheels heats tires
			car.tireTemp = Math.min(120, car.tireTemp + dt * 20);
		} else {
			// Cooling
			car.tireTemp = Math.max(20, car.tireTemp - dt * 2);
		}

		// Grip Curve
		if (car.tireTemp < 40) tempGripMult = 0.8; // Cold
		else if (car.tireTemp > 90) tempGripMult = 0.8; // Overheated
		else tempGripMult = 1.1; // Optimal
	}

	// 1. Shifting Logic
	if (isAI && aiStats && !isLocked) {
		if (car.gear === 0) {
			car.gear = 1;
		} else {
			const shiftThreshold = isAI
				? t.redlineRPM * (0.9 + aiStats.difficulty * 0.08)
				: 0;
			if (car.rpm > shiftThreshold && car.gear < 6) {
				car.gear++;
				car.rpm *= 0.7; // RPM drop simulation
				audioEngine.triggerShift(false);
			}
		}
	} else if (!isAI) {
		// Player Logic
		// Note: shiftDebounce logic needs to be handled outside or passed in as state
		// For now, we assume inputs already handle debounce or we pass a ref-like object if needed.
		// Actually, the original code used a ref for debounce.
		// To keep this pure, we might need to change how inputs are handled or pass the debounce state.
		// Let's simplify: inputs.shiftUp/Down should be true only on the frame of the press.
		// But the original code used a ref to track "held" state.
		// Let's assume the caller handles the "trigger" nature of shift inputs.

		if (inputs.shiftUp) {
			if (car.gear < 6) {
				car.gear++;
				if (car.gear > 1) car.rpm *= 0.65;
				audioEngine.triggerShift(false);
			}
		}
		if (inputs.shiftDown) {
			if (car.gear > 0) {
				car.gear--;
				car.rpm *= 1.4;
				audioEngine.triggerShift(true);
			}
		}
	}

	// 2. Engine Physics
	const gearRatio = t.gearRatios[car.gear] || 0;
	const effectiveRatio = gearRatio * t.finalDriveRatio;
	const wheelRadius = 0.3;

	const wheelCirc = 2 * Math.PI * wheelRadius;

	// Connected RPM is what the engine RPM *would* be if fully engaged to wheels at this speed
	const connectedRPM = (car.velocity / wheelCirc) * 60 * effectiveRatio;

	const torqueCurveFactor = interpolateTorque(car.rpm, t.torqueCurve);
	let engineTorque = isAI || inputs.gas ? t.maxTorque * torqueCurveFactor : 0;

	// Rev Limiter
	if (car.rpm > t.redlineRPM) {
		engineTorque = 0;
		car.rpm = t.redlineRPM - 100;
		if (!isAI || Math.random() > 0.9) audioEngine.triggerLimiter();
	}

	let driveForce = 0;
	let load = 0;

	// Clutch / Coupling Logic
	let clutchEngaged = true;
	if (settings?.manualClutch && !isAI) {
		if (inputs.clutch) clutchEngaged = false;
	}

	if (car.gear > 0 && !isLocked && clutchEngaged) {
		driveForce = (engineTorque * effectiveRatio) / wheelRadius;

		// Smooth Launch / Clutch Slip Logic
		// Check if RPM is significantly higher than wheel speed in 1st gear (Launch)
		const slipThreshold = 500; // RPM delta to consider slipping

		if (car.gear === 1 && car.rpm > connectedRPM + slipThreshold) {
			// Clutch is slipping. The engine is spinning faster than the wheels.
			// We apply a "friction" drag to the RPM to pull it down towards connectedRPM,
			// but we allow gas to keep it somewhat high.

			const clutchFriction = 3.5; // Controls how fast RPM drops to match wheels
			const rpmDrag = (car.rpm - connectedRPM) * dt * clutchFriction;

			// Gas allows you to sustain RPM against the clutch friction
			const rpmBoost =
				isAI || inputs.gas
					? (t.maxTorque / t.flywheelMass) * dt * 0.8
					: 0;

			car.rpm = car.rpm + rpmBoost - rpmDrag;
			load = 1.0;
		} else {
			// Fully coupled - Engine locked to wheels
			const coupling = dt * 10.0;
			car.rpm = car.rpm + (connectedRPM - car.rpm) * coupling;
			load = inputs.gas ? 1.0 : 0.0;
		}
	} else {
		// Neutral / Clutch In
		if (isAI || inputs.gas) {
			car.rpm += (t.maxTorque / t.flywheelMass) * dt * 5;
			load = 0.5; // Revving freely
		} else {
			car.rpm -= 2000 * dt;
			load = 0;
		}
	}

	car.rpm = Math.max(t.idleRPM, car.rpm);

	// Forces
	if (isLocked) {
		car.velocity = 0;
	} else {
		// Traction Limit
		const gravity = 9.81;
		// Base grip is ~1.0. Slick tires might be 1.2. Rain reduces this.
		const maxTractionForce =
			t.mass * gravity * t.tireGrip * frictionMultiplier * tempGripMult;

		// If driveForce exceeds traction, we spin (lose force)
		// Simple model: Cap the force, and maybe spike RPM (already handled by clutch slip logic? No, that's clutch)
		// If wheels spin, effective drive force is REDUCED (kinetic friction < static friction)

		if (driveForce > maxTractionForce) {
			// Wheel spin!
			// Force is capped at kinetic friction (say 0.8 of static)
			driveForce = maxTractionForce * 0.8;

			// We should also spike the RPM to show spin, but RPM is coupled to velocity in 'else' block of clutch logic.
			// To simulate spin, we would need to decouple RPM from Velocity.
			// For now, just capping the force makes the car slower, which is the main gameplay effect.
			// To make it feel like "spin", we could allow RPM to rise faster than velocity implies.
			// But that requires changing the 'coupled' logic.

			// Let's just cap the force for now.
		}

		const dragForce =
			0.5 * 1.225 * car.velocity * car.velocity * t.dragCoefficient * 2.0;
		const rollingRes = 150;
		const brakingForce = inputs.brake ? t.brakingForce : 0;
		const netForce = driveForce - dragForce - rollingRes - brakingForce;
		const accel = netForce / t.mass;

		car.velocity += accel * dt;
		if (car.velocity < 0) car.velocity = 0;

		car.y += car.velocity * dt;
	}

	// Update Audio (during countdown and racing, not in menus)
	if (!isLocked && (raceStatus === 'COUNTDOWN' || raceStatus === 'RACING')) {
		audioEngine.update(car.rpm, load, 0);
	}

	// Ghost Recording
	if (!isAI && raceStatus === 'RACING' && currentGhostRecording) {
		const currentTime = performance.now() - raceStartTime;
		currentGhostRecording.current.push({
			time: currentTime,
			y: car.y,
			velocity: car.velocity,
			rpm: car.rpm,
			gear: car.gear,
		});
	}
};
export const updateCircuitCarPhysics = (
	car: CarState,
	t: TuningState,
	inputs: InputState,
	dt: number,
	isAI: boolean,
	audioEngine: AudioEngine
) => {
	// Initialize 2D props if missing
	if (car.x === undefined) car.x = 0;
	if (car.angle === undefined) car.angle = 0;
	if (car.steerAngle === undefined) car.steerAngle = 0;
	if (car.lateralVelocity === undefined) car.lateralVelocity = 0;

	// --- 1. Steering Logic ---
	const MAX_STEER = Math.PI / 4; // 45 degrees
	const STEER_SPEED = 2.0; // Radians per second
	const CENTER_SPEED = 3.0; // Faster return to center

	let targetSteer = 0;
	if (inputs.steerLeft) targetSteer = -MAX_STEER;
	if (inputs.steerRight) targetSteer = MAX_STEER;

	if (inputs.steerLeft || inputs.steerRight) {
		// Move towards target
		if (car.steerAngle < targetSteer) {
			car.steerAngle = Math.min(
				targetSteer,
				car.steerAngle + STEER_SPEED * dt
			);
		} else {
			car.steerAngle = Math.max(
				targetSteer,
				car.steerAngle - STEER_SPEED * dt
			);
		}
	} else {
		// Return to center
		if (car.steerAngle > 0) {
			car.steerAngle = Math.max(0, car.steerAngle - CENTER_SPEED * dt);
		} else if (car.steerAngle < 0) {
			car.steerAngle = Math.min(0, car.steerAngle + CENTER_SPEED * dt);
		}
	}

	// --- 2. Longitudinal Physics (Engine/Brake) ---
	// Reuse existing logic for RPM/Gear/Velocity (Longitudinal)
	// We can reuse the core of updateCarPhysics but we need to extract it or copy-paste-modify.
	// For now, I will inline a simplified version of the engine physics here to avoid breaking the existing drag race.

	// Shifting
	if (!isAI) {
		if (inputs.shiftUp && car.gear < 6) {
			car.gear++;
			if (car.gear > 1) car.rpm *= 0.65;
			audioEngine.triggerShift(false);
		}
		if (inputs.shiftDown && car.gear > 0) {
			car.gear--;
			car.rpm *= 1.4;
			audioEngine.triggerShift(true);
		}
	} else {
		// Simple AI shifting
		const shiftThreshold = t.redlineRPM * 0.9;
		if (car.rpm > shiftThreshold && car.gear < 6) {
			car.gear++;
			car.rpm *= 0.7;
			audioEngine.triggerShift(false);
		}
	}

	// Engine Forces
	const gearRatio = t.gearRatios[car.gear] || 0;
	const effectiveRatio = gearRatio * t.finalDriveRatio;
	const wheelRadius = 0.3;
	const wheelCirc = 2 * Math.PI * wheelRadius;

	// Connected RPM
	const connectedRPM = (car.velocity / wheelCirc) * 60 * effectiveRatio;
	const torqueCurveFactor = interpolateTorque(car.rpm, t.torqueCurve);
	let engineTorque = inputs.gas || isAI ? t.maxTorque * torqueCurveFactor : 0;

	// Rev Limiter
	if (car.rpm > t.redlineRPM) {
		engineTorque = 0;
		car.rpm = t.redlineRPM - 100;
		if (!isAI && Math.random() > 0.95) audioEngine.triggerLimiter();
	}

	// Clutch/Load
	let driveForce = 0;
	let load = 0;
	if (car.gear > 0) {
		driveForce = (engineTorque * effectiveRatio) / wheelRadius;
		// Simplified clutch for circuit
		const coupling = dt * 10.0;
		car.rpm = car.rpm + (connectedRPM - car.rpm) * coupling;
		load = inputs.gas ? 1.0 : 0.0;
	} else {
		// Neutral
		if (inputs.gas) {
			car.rpm += (t.maxTorque / t.flywheelMass) * dt * 5;
			load = 0.5;
		} else {
			car.rpm -= 2000 * dt;
			load = 0;
		}
	}
	car.rpm = Math.max(t.idleRPM, car.rpm);

	// Longitudinal Forces
	const dragForce =
		0.5 * 1.225 * car.velocity * car.velocity * t.dragCoefficient;
	const rollingRes = 150;
	const netForce = driveForce - dragForce - rollingRes;
	const accel = netForce / t.mass;

	car.velocity += accel * dt;
	if (car.velocity < 0) car.velocity = 0;

	// --- 3. Turning Physics (Bicycle Model) ---
	// L = Wheelbase
	const L = 2.5;

	// If moving, update angle
	if (Math.abs(car.velocity) > 0.1) {
		// Angular velocity = v / R = v * tan(delta) / L
		const angularVelocity = (car.velocity * Math.tan(car.steerAngle)) / L;
		car.angle += angularVelocity * dt;
	}

	// --- 4. Position Update ---
	// Velocity vector in world space
	const vx = car.velocity * Math.sin(car.angle);
	const vy = car.velocity * Math.cos(car.angle);

	car.x += vx * dt;
	car.y += vy * dt;

	// Audio Update
	audioEngine.update(car.rpm, load, 0);
};
