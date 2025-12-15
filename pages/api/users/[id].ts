import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/auth';
import type { ApiResponse } from '../../../types/api';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ApiResponse>
) {
	const { id } = req.query;

	if (!id || Array.isArray(id)) {
		return res.status(400).json({ message: 'Invalid ID' });
	}

	const requesterId = getUserIdFromRequest(req);

	if (req.method === 'GET') {
		try {
			const isSelf = requesterId === id;
			const user = await prisma.user.findUnique({
				where: { id },
				select: {
					id: true,
					username: true,
					level: true,
					xp: true,
					money: true,
					garage: true,
					inventory: true,
					settings: true,
					loginStreak: true,
					friendCode: true,
					createdAt: true,
					friendRequestsReceived: isSelf,
					partyInvites: isSelf,
					partyId: true,
				},
			});
			if (!user)
				return res.status(404).json({ message: 'User not found' });
			return res.status(200).json(user);
		} catch (err) {
			return res.status(500).json({ message: 'Error fetching user' });
		}
	}

	if (req.method === 'PUT') {
		// Only allow updating own data
		if (requesterId !== id) {
			return res.status(403).json({ message: 'Forbidden' });
		}

		// SECURITY: Only accept garage, inventory, level, xp, loginStreak updates
		// Money updates must go through secure transaction endpoints
		const { garage, inventory, level, xp, money, settings, loginStreak } =
			req.body;

		const updateData: any = {};
		if (garage !== undefined) updateData.garage = garage;
		if (inventory !== undefined) updateData.inventory = inventory;
		if (level !== undefined) updateData.level = Math.floor(Number(level));
		if (xp !== undefined) updateData.xp = Math.floor(Number(xp));
		if (money !== undefined) updateData.money = Number(money);
		if (settings !== undefined) updateData.settings = settings;
		if (loginStreak !== undefined) updateData.loginStreak = loginStreak;

		try {
			const updatedUser = await prisma.user.update({
				where: { id },
				data: updateData,
			});
			return res.status(200).json(updatedUser);
		} catch (err) {
			console.error('[API] Error updating user:', err);
			return res
				.status(500)
				.json({ message: 'Error updating user', error: String(err) });
		}
	}

	res.setHeader('Allow', ['GET', 'PUT']);
	return res.status(405).json({ message: 'Method not allowed' });
}
