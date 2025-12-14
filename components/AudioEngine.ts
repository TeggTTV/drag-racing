export class AudioEngine {
	public ctx: AudioContext | null = null;
	public analyser: AnalyserNode | null = null;
	private masterGain: GainNode | null = null;
	private engineGain: GainNode | null = null; // New gain for engine sounds only
	private panner: StereoPannerNode | null = null;

	// Synthesis Nodes
	private mainOsc: OscillatorNode | null = null;
	private subOsc: OscillatorNode | null = null;
	private harmonicsOsc: OscillatorNode | null = null;

	private engineBus: GainNode | null = null;

	// LFOs
	private textureLfo: OscillatorNode | null = null;
	private textureGain: GainNode | null = null;

	private idleLfo: OscillatorNode | null = null;
	private idleGain: GainNode | null = null;

	// Noise
	private noiseNode: AudioBufferSourceNode | null = null;
	private noiseGain: GainNode | null = null;
	private noiseFilter: BiquadFilterNode | null = null;

	// Drift
	private driftOsc: OscillatorNode | null = null;
	private driftGain: GainNode | null = null;
	private driftFilter: BiquadFilterNode | null = null;

	// Turbo / Supercharger
	private turboOsc: OscillatorNode | null = null;
	private turboGain: GainNode | null = null;

	// Exhaust Chain
	private distortion: WaveShaperNode | null = null;
	private mufflerFilter: BiquadFilterNode | null = null;
	private highShelf: BiquadFilterNode | null = null;

	// Buffer Cache
	private buffers: Record<string, AudioBuffer> = {};

	private isInitialized = false;

	// Config
	private currentCylinders = 6;
	private exhaustOpenness = 0.1;
	private backfireAggression = 0.3;
	private turboIntensity = 0.0;

	private lastDistortionAmount: number = -1;
	private lastNoise: number = 0;

	private masterVolume: number = 0.5; // Global volume

	constructor() {}

	async init() {
		if (this.isInitialized) return;

		const AudioContext =
			window.AudioContext || (window as any).webkitAudioContext;
		this.ctx = new AudioContext();

		// Master Output (Global Volume)
		this.masterGain = this.ctx.createGain();
		this.masterGain.gain.value = this.masterVolume;

		// Spatial Panner
		this.panner = this.ctx.createStereoPanner();
		this.masterGain.connect(this.panner);

		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 2048;
		this.analyser.smoothingTimeConstant = 0.6;
		this.panner.connect(this.analyser);
		this.analyser.connect(this.ctx.destination);

		// Engine Output (Car Sounds Volume)
		this.engineGain = this.ctx.createGain();
		this.engineGain.gain.value = 0; // Start silent!
		this.engineGain.connect(this.masterGain);

		this.engineBus = this.ctx.createGain();

		// Exhaust Chain
		this.distortion = this.ctx.createWaveShaper();
		this.distortion.oversample = '4x';

		this.mufflerFilter = this.ctx.createBiquadFilter();
		this.mufflerFilter.type = 'lowpass';

		this.highShelf = this.ctx.createBiquadFilter();
		this.highShelf.type = 'highshelf';
		this.highShelf.frequency.value = 4000;
		this.highShelf.gain.value = 0;

		this.engineBus.connect(this.distortion);
		this.distortion.connect(this.mufflerFilter);
		this.mufflerFilter.connect(this.highShelf);
		this.highShelf.connect(this.engineGain); // Connect to Engine Gain instead of Master

		// Oscillators
		this.mainOsc = this.ctx.createOscillator();
		this.mainOsc.type = 'sawtooth';
		const mainGain = this.ctx.createGain();
		mainGain.gain.value = 0.35;
		this.mainOsc.connect(mainGain);
		mainGain.connect(this.engineBus);

		this.subOsc = this.ctx.createOscillator();
		this.subOsc.type = 'sine';
		const subGain = this.ctx.createGain();
		subGain.gain.value = 0.3;
		this.subOsc.connect(subGain);
		subGain.connect(this.engineBus);

		this.harmonicsOsc = this.ctx.createOscillator();
		this.harmonicsOsc.type = 'square';
		const harmoGain = this.ctx.createGain();
		harmoGain.gain.value = 0.1;
		this.harmonicsOsc.connect(harmoGain);
		harmoGain.connect(this.engineBus);

		// Modulators
		this.textureLfo = this.ctx.createOscillator();
		this.textureLfo.type = 'sine';
		this.textureGain = this.ctx.createGain();
		this.textureLfo.connect(this.textureGain);
		this.textureGain.connect(this.mainOsc.frequency);

		this.idleLfo = this.ctx.createOscillator();
		this.idleLfo.type = 'sine';
		this.idleLfo.frequency.value = 6;
		this.idleGain = this.ctx.createGain();
		this.idleGain.gain.value = 0;
		this.idleLfo.connect(this.idleGain);
		this.idleGain.connect(this.engineBus.gain);

		// Noise - Intake/Mechanical
		const bufferSize = this.ctx.sampleRate * 2;
		const buffer = this.ctx.createBuffer(
			1,
			bufferSize,
			this.ctx.sampleRate
		);
		const data = buffer.getChannelData(0);
		let b0 = 0,
			b1 = 0,
			b2 = 0,
			b3 = 0,
			b4 = 0,
			b5 = 0,
			b6 = 0;
		for (let i = 0; i < bufferSize; i++) {
			const white = Math.random() * 2 - 1;
			b0 = 0.99886 * b0 + white * 0.0555179;
			b1 = 0.99332 * b1 + white * 0.0750759;
			b2 = 0.969 * b2 + white * 0.153852;
			b3 = 0.8665 * b3 + white * 0.3104856;
			b4 = 0.55 * b4 + white * 0.5329522;
			b5 = -0.7616 * b5 - white * 0.016898;
			data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
			data[i] *= 0.11;
			b6 = white * 0.115926;
		}
		this.noiseNode = this.ctx.createBufferSource();
		this.noiseNode.buffer = buffer;
		this.noiseNode.loop = true;

		this.noiseGain = this.ctx.createGain();
		this.noiseFilter = this.ctx.createBiquadFilter();
		this.noiseFilter.type = 'bandpass';
		this.noiseFilter.Q.value = 0.6;

		this.noiseNode.connect(this.noiseFilter);
		this.noiseFilter.connect(this.noiseGain);
		this.noiseGain.connect(this.engineBus);

		// Drift
		this.driftOsc = this.ctx.createOscillator();
		this.driftOsc.type = 'sawtooth';
		this.driftFilter = this.ctx.createBiquadFilter();
		this.driftFilter.type = 'bandpass';
		this.driftFilter.Q.value = 3;
		this.driftGain = this.ctx.createGain();
		this.driftGain.gain.value = 0;

		this.driftOsc.connect(this.driftFilter);
		this.driftFilter.connect(this.driftGain);
		this.driftGain.connect(this.engineGain); // Connect to Engine Gain

		// Turbo Oscillator
		this.turboOsc = this.ctx.createOscillator();
		this.turboOsc.type = 'sine';
		this.turboGain = this.ctx.createGain();
		this.turboGain.gain.value = 0;
		this.turboOsc.connect(this.turboGain);
		this.turboGain.connect(this.engineGain); // Connect to Engine Gain

		this.mainOsc.start();
		this.subOsc.start();
		this.harmonicsOsc.start();
		this.textureLfo.start();
		this.idleLfo.start();
		this.noiseNode.start();
		this.driftOsc.start();
		this.turboOsc.start();

		// Pre-generate buffers
		this.generateBuffers();

		this.isInitialized = true;
		if (this.ctx.state === 'suspended') await this.ctx.resume();
	}

	private generateBuffers() {
		if (!this.ctx) return;

		// 1. Pop / Backfire Buffer
		const popDuration = 0.15;
		const popBuffer = this.ctx.createBuffer(
			1,
			this.ctx.sampleRate * popDuration,
			this.ctx.sampleRate
		);
		const popData = popBuffer.getChannelData(0);
		let lastNoise = 0;
		for (let i = 0; i < popBuffer.length; i++) {
			const white = Math.random() * 2 - 1;
			lastNoise = (lastNoise + 0.1 * white) / 1.1;
			popData[i] = lastNoise * 5.0;
			if (popData[i] > 1) popData[i] = 1;
			if (popData[i] < -1) popData[i] = -1;
		}
		this.buffers['pop'] = popBuffer;

		// 2. Shift Noise Buffer (Long enough for both up/down shift variations)
		const shiftDuration = 0.4;
		const shiftBuffer = this.ctx.createBuffer(
			1,
			this.ctx.sampleRate * shiftDuration,
			this.ctx.sampleRate
		);
		const shiftData = shiftBuffer.getChannelData(0);
		for (let i = 0; i < shiftBuffer.length; i++) {
			shiftData[i] = Math.random() * 2 - 1;
		}
		this.buffers['shift'] = shiftBuffer;
	}

	setConfiguration(
		cylinders: number,
		exhaustOpenness: number,
		backfireAggression: number,
		turboIntensity: number
	) {
		this.currentCylinders = cylinders;
		this.exhaustOpenness = exhaustOpenness;
		this.backfireAggression = backfireAggression;
		this.turboIntensity = turboIntensity;

		const drive = 50 + this.exhaustOpenness * 400;
		if (
			this.distortion &&
			Math.abs(drive - this.lastDistortionAmount) > 1
		) {
			this.distortion.curve = this.makeDistortionCurve(drive);
			this.lastDistortionAmount = drive;
		}
	}

	setVolume(volume: number) {
		this.masterVolume = volume;
		if (this.masterGain && this.ctx) {
			this.masterGain.gain.setTargetAtTime(
				volume,
				this.ctx.currentTime,
				0.1
			);
		}
	}

	startEngine(tuning: any) {
		this.setConfiguration(
			tuning.cylinders,
			tuning.exhaustOpenness,
			tuning.backfireAggression,
			tuning.turboIntensity
		);
		this.setVolume(0.5); // Default volume
		this.start();
	}

	// Engine Start/Stop
	start() {
		if (this.engineGain && this.ctx) {
			this.engineGain.gain.setTargetAtTime(
				1.0,
				this.ctx.currentTime,
				0.1
			);
		}
	}

	stop() {
		if (this.engineGain && this.ctx) {
			this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
		}
	}

	// New Spatial Audio System
	setSpatial(
		distanceMeters: number,
		relativeVelocityMS: number,
		panX: number
	) {
		if (
			!this.ctx ||
			!this.masterGain ||
			!this.panner ||
			!this.mufflerFilter
		)
			return;
		const now = this.ctx.currentTime;

		// 1. Distance Attenuation (Inverse law-ish)
		// Cap distance impact so it doesn't vanish instantly, but fades nicely over 200m
		const attenuation = 1 / (1 + Math.abs(distanceMeters) / 30);
		const finalVol = this.masterVolume * attenuation;
		this.masterGain.gain.setTargetAtTime(finalVol, now, 0.1);

		// 2. High Frequency Rolloff (Air absorption)
		// As cars get further, they sound duller
		const distFactor = Math.min(Math.abs(distanceMeters) / 300, 1);
		const lowpassFreq = 20000 - distFactor * 19000;
		// We don't set this here because update() sets muffler frequency based on RPM.
		// Instead, we will store a spatial modifier to apply in update()

		// 3. Doppler Effect (Pitch Shift)
		// If moving towards listener (negative relative velocity), pitch up. Away, pitch down.
		// Speed of sound approx 343 m/s
		const speedOfSound = 343;
		const dopplerFactor =
			speedOfSound / (speedOfSound + relativeVelocityMS);
		// We will apply this dopplerFactor to the base frequency in update()
		this.dopplerFactor = dopplerFactor;

		// 4. Panning
		this.panner.pan.setTargetAtTime(panX, now, 0.1);
	}

	private dopplerFactor: number = 1.0;

	update(rpm: number, load: number, driftIntensity: number = 0) {
		if (!this.ctx || !this.isInitialized) return;
		const now = this.ctx.currentTime;

		// Apply Doppler to RPM for pitch calculation
		const dopplerRPM = rpm * this.dopplerFactor;
		const rps = Math.max(dopplerRPM / 60, 10);
		const fundamental = rps * (this.currentCylinders / 2);

		let subRatio = 0.5;
		let harmRatio = 2.0;
		let fmDepth = 0.3;

		if (this.currentCylinders === 4) {
			subRatio = 0.5;
			harmRatio = 1.5;
			if (this.subOsc) this.subOsc.type = 'square';
			fmDepth = 0.2;
		} else if (this.currentCylinders === 6) {
			subRatio = 0.5;
			harmRatio = 2.0;
			if (this.subOsc) this.subOsc.type = 'sine';
			fmDepth = 0.35;
		} else if (this.currentCylinders === 8) {
			subRatio = 0.5;
			harmRatio = 4.0;
			if (this.subOsc) this.subOsc.type = 'sawtooth';
			fmDepth = 0.6;
		} else if (this.currentCylinders >= 10) {
			subRatio = 1.0;
			harmRatio = 1.5;
			if (this.subOsc) this.subOsc.type = 'triangle';
			fmDepth = 0.2;
		}

		this.mainOsc?.frequency.setTargetAtTime(fundamental, now, 0.02);
		this.subOsc?.frequency.setTargetAtTime(
			fundamental * subRatio,
			now,
			0.02
		);
		this.harmonicsOsc?.frequency.setTargetAtTime(
			fundamental * harmRatio,
			now,
			0.02
		);

		if (this.mainOsc) {
			const jitter = (Math.random() * 15 - 7.5) * (load + 0.1);
			this.mainOsc.detune.setTargetAtTime(jitter, now, 0.05);
		}

		const textureFreq = fundamental * 0.5;
		this.textureLfo?.frequency.setTargetAtTime(textureFreq, now, 0.1);
		const modIndex = fundamental * fmDepth * (0.1 + load * 0.5);
		this.textureGain?.gain.setTargetAtTime(modIndex, now, 0.05);

		if (rpm < 1100 && this.currentCylinders > 4) {
			const lopeAmount =
				(1 - rpm / 1100) * (this.exhaustOpenness * 0.5 + 0.1);
			this.idleGain?.gain.setTargetAtTime(lopeAmount, now, 0.1);
			this.idleLfo?.frequency.setValueAtTime(5 + Math.random() * 2, now);
		} else {
			this.idleGain?.gain.setTargetAtTime(0, now, 0.5);
		}

		if (this.mufflerFilter && this.highShelf) {
			const minCutoff = 600 + this.exhaustOpenness * 400;
			const maxCutoff = 8000 + this.exhaustOpenness * 12000;
			let cutoff = minCutoff + (rpm / 9000) * (maxCutoff - minCutoff);

			// Apply "Distance Filter" implicitly via lowpass if far away (simplification)
			if (this.dopplerFactor < 0.8 || this.dopplerFactor > 1.2) {
				// If high velocity difference or far, dampen highs
				cutoff *= 0.8;
			}

			this.mufflerFilter.frequency.setTargetAtTime(cutoff, now, 0.1);
			const airGain = -20 + this.exhaustOpenness * 30;
			this.highShelf.gain.setTargetAtTime(airGain, now, 0.1);
		}

		if (this.noiseFilter && this.noiseGain) {
			const noiseFreq = 400 + rpm * 1.5;
			this.noiseFilter.frequency.setTargetAtTime(noiseFreq, now, 0.1);
			const noiseVol = load * 0.5 + rpm * 0.00002;
			this.noiseGain.gain.setTargetAtTime(noiseVol, now, 0.1);
		}

		if (this.turboOsc && this.turboGain) {
			if (this.turboIntensity > 0.01) {
				const turboFreq = 1000 + rpm * 6.5;
				this.turboOsc.frequency.setTargetAtTime(turboFreq, now, 0.1);
				const loadFactor = Math.max(load, 0.2);
				const rpmFactor = rpm / 9000;
				const turboVol =
					this.turboIntensity *
					(rpmFactor * 0.6 + loadFactor * 0.4) *
					0.3;
				this.turboGain.gain.setTargetAtTime(turboVol, now, 0.1);
			} else {
				this.turboGain.gain.setTargetAtTime(0, now, 0.2);
			}
		}

		if (rpm > 3500 && load < 0.1) {
			const chance = this.backfireAggression * 0.1;
			if (Math.random() < chance) {
				const popVol = 0.2 + this.exhaustOpenness * 0.4;
				this.createPop(popVol);
			}
		}

		if (driftIntensity > 0.05) {
			const speedWobble = Math.sin(now * 25) * 150;
			const screechFreq = 700 + driftIntensity * 600 + speedWobble;
			this.driftFilter?.frequency.setTargetAtTime(screechFreq, now, 0.05);
			const q = 3 + Math.sin(now * 10);
			this.driftFilter?.Q.setTargetAtTime(q, now, 0.1);
			const driftVol = Math.min(driftIntensity * 0.6, 0.5);
			this.driftGain?.gain.setTargetAtTime(driftVol, now, 0.05);
		} else {
			this.driftGain?.gain.setTargetAtTime(0, now, 0.1);
		}
	}

	triggerBackfire() {
		if (!this.ctx || !this.engineGain) return; // Use engineGain
		const vol = 0.8 + this.exhaustOpenness * 0.5;
		this.createPop(vol);
	}

	triggerLimiter() {
		if (!this.ctx || !this.engineBus) return;
		const now = this.ctx.currentTime;
		this.engineBus.gain.setValueAtTime(0, now);
		this.engineBus.gain.linearRampToValueAtTime(1, now + 0.08);
		this.createPop(0.5);
	}

	triggerShift(isDownshift: boolean) {
		if (!this.ctx || !this.engineGain) return; // Use engineGain
		const freq = isDownshift ? 100 : 180;
		this.createNoiseBurst(0.06, 0.4, freq);
		if (isDownshift) {
			this.createBark();
			if (this.exhaustOpenness > 0.3) {
				setTimeout(() => {
					this.createPop(0.3);
				}, 80);
			}
		}
	}

	private createBark() {
		if (!this.ctx || !this.engineBus) return;
		const now = this.ctx.currentTime;
		const barkOsc = this.ctx.createOscillator();
		barkOsc.type = 'sawtooth';
		barkOsc.frequency.setValueAtTime(250, now);
		barkOsc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
		const barkGain = this.ctx.createGain();
		barkGain.gain.setValueAtTime(0.4, now);
		barkGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
		barkOsc.connect(barkGain);
		barkGain.connect(this.engineBus);
		barkOsc.start();
		barkOsc.stop(now + 0.2);
	}

	public createPop(volume: number) {
		if (!this.ctx || !this.engineGain || !this.buffers['pop']) return;

		const source = this.ctx.createBufferSource();
		source.buffer = this.buffers['pop'];

		const filter = this.ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = 300 + Math.random() * 800;
		filter.Q.value = 2;

		const gain = this.ctx.createGain();
		const finalVol = volume * (0.8 + Math.random() * 0.4);
		gain.gain.setValueAtTime(finalVol, this.ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(
			0.01,
			this.ctx.currentTime + source.buffer.duration * 0.8
		);

		source.connect(filter);
		filter.connect(gain);
		if (this.distortion) gain.connect(this.distortion);
		else gain.connect(this.engineGain);

		source.start();
	}

	private createNoiseBurst(
		duration: number,
		peakVolume: number,
		filterFreq: number
	) {
		if (!this.ctx || !this.engineGain || !this.buffers['shift']) return;

		const source = this.ctx.createBufferSource();
		source.buffer = this.buffers['shift'];

		// If requested duration is longer than buffer, we just play buffer (it's short burst anyway)
		// Or we could loop? No, bursts are short.

		const noiseGain = this.ctx.createGain();
		noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);
		noiseGain.gain.linearRampToValueAtTime(
			peakVolume,
			this.ctx.currentTime + 0.005
		);
		noiseGain.gain.exponentialRampToValueAtTime(
			0.001,
			this.ctx.currentTime + duration
		);

		const noiseFilter = this.ctx.createBiquadFilter();
		noiseFilter.type = 'lowpass';
		noiseFilter.frequency.value = filterFreq;

		source.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(this.engineGain);

		source.start();
		// Stop slightly after duration to ensure cleanup
		setTimeout(() => {
			source.stop();
			source.disconnect();
			noiseGain.disconnect();
			noiseFilter.disconnect();
		}, duration * 1000 + 200);
	}

	private makeDistortionCurve(amount: number) {
		const k = amount;
		const n_samples = 44100;
		const curve = new Float32Array(n_samples);
		const deg = Math.PI / 180;
		for (let i = 0; i < n_samples; ++i) {
			const x = (i * 2) / n_samples - 1;
			curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
		}
		return curve;
	}

	// UI Sounds
	async playUISound(
		type:
			| 'click'
			| 'hover'
			| 'confirm'
			| 'back'
			| 'error'
			| 'purchase'
			| 'upgrade'
			| 'unequip'
			| 'ui_click'
			| 'ui_select'
			| 'cash'
	) {
		// console.log(`[AudioEngine] playUISound called: ${type}`);

		if (!this.isInitialized) {
			// console.log('[AudioEngine] Not initialized, initializing now...');
			await this.init();
		}

		if (!this.ctx || !this.masterGain) {
			// console.error(
			// 	'[AudioEngine] Context or MasterGain missing after init!'
			// );
			return;
		}

		// console.log(
		// 	`[AudioEngine] Context State: ${this.ctx.state}, BaseVolume: ${this.masterVolume}, MasterGain: ${this.masterGain.gain.value}`
		// );

		// Ensure context is running (it might be suspended if created but not resumed)
		if (this.ctx.state === 'suspended') {
			// console.log('[AudioEngine] Context suspended, resuming...');
			await this.ctx.resume();
			// console.log(
			// 	`[AudioEngine] Context State after resume: ${this.ctx.state}`
			// );
		}

		if (type === 'hover') return; // Disabled hover sounds

		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();

		osc.connect(gain);
		gain.connect(this.masterGain);

		// console.log(
		// 	`[AudioEngine] Generating sound for ${type} at time ${now}`
		// );

		switch (type) {
			case 'click':
			case 'ui_click':
				osc.type = 'sine';
				osc.frequency.setValueAtTime(600, now);
				osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
				osc.start(now);
				osc.stop(now + 0.1);
				break;

			case 'confirm':
			case 'ui_select':
				osc.type = 'sine';
				osc.frequency.setValueAtTime(400, now);
				osc.frequency.linearRampToValueAtTime(800, now + 0.1);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.linearRampToValueAtTime(0, now + 0.2);
				osc.start(now);
				osc.stop(now + 0.2);
				break;

			case 'back':
				osc.type = 'sine';
				osc.frequency.setValueAtTime(400, now);
				osc.frequency.linearRampToValueAtTime(200, now + 0.1);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.linearRampToValueAtTime(0, now + 0.15);
				osc.start(now);
				osc.stop(now + 0.15);
				break;

			case 'error':
				osc.type = 'sawtooth';
				osc.frequency.setValueAtTime(150, now);
				osc.frequency.linearRampToValueAtTime(100, now + 0.2);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.linearRampToValueAtTime(0, now + 0.2);
				osc.start(now);
				osc.stop(now + 0.2);
				break;

			case 'purchase':
			case 'upgrade':
			case 'cash':
				// Ka-ching!
				const osc2 = this.ctx.createOscillator();
				const gain2 = this.ctx.createGain();
				osc2.connect(gain2);
				gain2.connect(this.masterGain);

				osc.type = 'sine';
				osc.frequency.setValueAtTime(1200, now);
				gain.gain.setValueAtTime(0.1, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

				osc2.type = 'sine';
				osc2.frequency.setValueAtTime(2000, now);
				gain2.gain.setValueAtTime(0.05, now);
				gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

				osc.start(now);
				osc.stop(now + 0.4);
				osc2.start(now);
				osc2.stop(now + 0.5);
				break;

			case 'unequip':
				osc.type = 'square';
				osc.frequency.setValueAtTime(200, now);
				osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
				gain.gain.setValueAtTime(0.05, now);
				gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
				osc.start(now);
				osc.stop(now + 0.1);
				break;
		}
	}
}
