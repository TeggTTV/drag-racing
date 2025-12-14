import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../utils/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return res.status(401).json({ message: 'Unauthorized' });
	}
	const token = authHeader.split(' ')[1];
	let userId: string;
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
		userId = decoded.userId;
	} catch (err) {
		return res.status(401).json({ message: 'Invalid token' });
	}

	const { action } = req.query; // 'create', 'sync', 'status'

	try {
		if (req.method === 'POST') {
			if (action === 'create') {
				// Start Race (Host only)
				const user = await prisma.user.findUnique({
					where: { id: userId },
				});
				if (!user?.partyId)
					return res.status(400).json({ message: 'Not in a party' });

				const party = await prisma.party.findUnique({
					where: { id: user.partyId },
				});
				if (party?.hostId !== userId)
					return res
						.status(403)
						.json({ message: 'Only host can start race' });

				// Check if all members (except host) are ready
				const otherMembers = party.members.filter(
					(id) => id !== userId
				);
				const allReady = otherMembers.every((id) =>
					party.readyMemberIds.includes(id)
				);

				if (!allReady) {
					return res
						.status(400)
						.json({ message: 'Not all players are ready' });
				}

				// Initialize player states
				const playerStates = party.members.map((mid) => ({
					userId: mid,
					progress: 0,
					speed: 0,
					finished: false,
					time: 0,
					placement: 0,
				}));

				// Delete any existing active race for this party
				await prisma.race.deleteMany({
					where: { partyId: party.id },
				});

				// Create Race
				const race = await prisma.race.create({
					data: {
						partyId: party.id,
						status: 'WAITING_FOR_PLAYERS',
						startTime: null, // Will be set when all ready
						playerStates: playerStates.map((s) => ({
							...s,
							ready: false,
						})),
					},
				});

				return res.status(201).json(race);
			}

			if (action === 'ready') {
				const { raceId } = req.body;
				const race = await prisma.race.findUnique({
					where: { id: raceId },
				});
				if (!race)
					return res.status(404).json({ message: 'Race not found' });

				const states = race.playerStates as any[];
				const myIndex = states.findIndex(
					(s: any) => s.userId === userId
				);

				if (myIndex === -1)
					return res
						.status(403)
						.json({ message: 'Not in this race' });

				// Mark me as ready
				states[myIndex].ready = true;

				// Check if ALL are ready
				const allReady = states.every((s: any) => s.ready);
				let updatedRace;

				if (allReady) {
					// Start Countdown (5 seconds)
					updatedRace = await prisma.race.update({
						where: { id: raceId },
						data: {
							status: 'COUNTDOWN',
							startTime: new Date(Date.now() + 5000),
							playerStates: states as any,
						},
					});
				} else {
					updatedRace = await prisma.race.update({
						where: { id: raceId },
						data: {
							playerStates: states as any,
						},
					});
				}

				return res.status(200).json(updatedRace);
			}

			if (action === 'sync') {
				// Update My State
				const { raceId, progress, speed, finished, time } = req.body;

				// Anti-Cheat Validation
				if (finished) {
					// 1/4 mile world record is ~3.58s. fast cars in game might do 4s.
					// Anything under 3.5s is considered physically impossible for this game's physics.
					// This prevents blatant speed hacks (e.g. 0.1s finish).
					if (time < 3.5) {
						return res.status(400).json({
							message:
								'Validation Failed: Race time physically impossible',
							code: 'INVALID_TIME',
						});
					}
				}

				const race = await prisma.race.findUnique({
					where: { id: raceId },
				});
				if (!race)
					return res.status(404).json({ message: 'Race not found' });

				const states = race.playerStates as any[];
				const myIndex = states.findIndex(
					(s: any) => s.userId === userId
				);

				if (myIndex === -1)
					return res
						.status(403)
						.json({ message: 'Not in this race' });

				// update state
				states[myIndex] = {
					...states[myIndex],
					progress,
					speed,
					finished,
					time: finished ? time : 0,
				};

				// Check if race should start (if currently COUNTDOWN and progress > 0)
				if (race.status === 'COUNTDOWN' && progress > 0) {
					await prisma.race.update({
						where: { id: raceId },
						data: { status: 'RACING' },
					});
				}

				// Check if I finished just now
				if (finished && !race.winnerId) {
					// I am first
					await prisma.race.update({
						where: { id: raceId },
						data: {
							winnerId: userId,
							playerStates: states as any,
						},
					});
				} else {
					// Save state
					await prisma.race.update({
						where: { id: raceId },
						data: { playerStates: states as any },
					});
				}

				// Check if ALL finished
				const allFinished = states.every((s: any) => s.finished);
				if (allFinished) {
					// 1. Reset Party Ready Status
					await prisma.party.update({
						where: { id: race.partyId },
						data: { readyMemberIds: [] },
					});

					// Track Stat
					const { incrementStat } = require('../../../utils/stats');
					incrementStat('races_finished');

					// 2. Mark Race as FINISHED (Do not delete yet, so clients can read result)
					await prisma.race.update({
						where: { id: raceId },
						data: { status: 'FINISHED' },
					});

					return res.status(200).json({
						message: 'Race Finished',
						status: 'FINISHED',
						winnerId: race.winnerId || (finished ? userId : null),
					});
				}

				return res.status(200).json({ message: 'Updated' });
			}
		}

		if (req.method === 'GET') {
			const { partyId } = req.query;
			if (!partyId || Array.isArray(partyId))
				return res.status(400).json({ message: 'Party ID required' });

			const race = await prisma.race.findUnique({
				where: { partyId },
			});

			return res.status(200).json(race);
		}

		if (req.method === 'DELETE') {
			const { partyId } = req.query;
			if (!partyId || Array.isArray(partyId))
				return res.status(400).json({ message: 'Party ID required' });

			// Only allow if user is in the party (or host) - simplified check
			const user = await prisma.user.findUnique({
				where: { id: userId },
			});
			if (user?.partyId !== partyId) {
				return res.status(403).json({ message: 'Not in party' });
			}

			await prisma.race.deleteMany({
				where: { partyId },
			});

			return res.status(200).json({ message: 'Race deleted' });
		}
	} catch (error) {
		console.error(error);
		return res.status(500).json({ message: 'Internal Server Error' });
	}

	return res.status(405).json({ message: 'Method not allowed' });
}
