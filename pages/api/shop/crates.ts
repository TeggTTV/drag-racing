import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/auth';
import type { ApiResponse } from '../../../types/api';

interface PurchaseCrateRequest {
	crateId: string;
	crateName: string;
	cratePrice: number;
	quantity: number;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ApiResponse>
) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method not allowed' });
	}

	const userId = getUserIdFromRequest(req);
	if (!userId) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const { crateId, crateName, cratePrice, quantity }: PurchaseCrateRequest =
		req.body;

	// Validation
	if (!crateId || !cratePrice || !quantity) {
		return res.status(400).json({ message: 'Missing required fields' });
	}

	if (quantity <= 0) {
		return res.status(400).json({ message: 'Invalid quantity' });
	}

	if (cratePrice <= 0) {
		return res.status(400).json({ message: 'Invalid price' });
	}

	const totalCost = cratePrice * quantity;

	try {
		// Get current user
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { money: true },
		});

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Check if user has enough money
		if (user.money < totalCost) {
			return res.status(400).json({ message: 'Insufficient funds' });
		}

		// Calculate new balance
		const newBalance = user.money - totalCost;

		console.log(
			'[CRATE PURCHASE] Creating transaction for user:',
			userId,
			'Amount:',
			-totalCost
		);

		// Update user balance and create transaction record atomically
		const [updatedUser, transaction] = await prisma.$transaction([
			prisma.user.update({
				where: { id: userId },
				data: {
					money: newBalance,
				},
			}),
			prisma.transaction.create({
				data: {
					userId,
					type: 'CRATE_PURCHASE',
					amount: -totalCost, // Negative because it's an expense
					metadata: {
						crateId,
						crateName,
						cratePrice,
						quantity,
					},
				},
			}),
		]);

		console.log(
			'[CRATE PURCHASE] Transaction created successfully:',
			transaction.id,
			'New balance:',
			updatedUser.money
		);

		return res.status(200).json({
			success: true,
			newBalance: updatedUser.money,
			transaction: {
				id: transaction.id,
				type: transaction.type, // Now valid if consistent with DB
				amount: transaction.amount,
				createdAt: transaction.createdAt,
			},
		});
	} catch (err) {
		console.error('Crate purchase error:', err);
		return res
			.status(500)
			.json({ message: 'Error processing purchase', error: String(err) });
	}
}
