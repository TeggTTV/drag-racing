import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import type { ApiResponse, TransactionRequest } from '../../../types/api';
import { getUserIdFromRequest } from '../../../lib/auth';

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

	const { type, amount, metadata }: TransactionRequest = req.body;

	if (!type || amount === undefined) {
		return res.status(400).json({ message: 'Missing required fields' });
	}

	try {
		// Validate transaction type and amount
		let validAmount = amount;

		// Server-side validation for different transaction types
		switch (type) {
			case 'RACE_WIN':
				// Ensure amount is positive
				if (amount <= 0) {
					return res
						.status(400)
						.json({ message: 'Invalid win amount' });
				}
				// Optional: Add max win validation based on difficulty
				break;

			case 'RACE_LOSS':
				// Race losses should be negative or zero
				if (amount > 0) {
					return res
						.status(400)
						.json({ message: 'Invalid loss amount' });
				}
				break;

			case 'ITEM_SALE':
				// Item sales should be positive
				if (amount <= 0) {
					return res
						.status(400)
						.json({ message: 'Invalid sale amount' });
				}
				break;

			case 'ITEM_PURCHASE':
			case 'SHOP_PURCHASE':
			case 'JUNKYARD_PURCHASE':
			case 'REPAIR_COST':
				// Purchases/costs should be negative
				if (amount >= 0) {
					return res
						.status(400)
						.json({ message: 'Invalid purchase amount' });
				}
				break;

			case 'DAILY_REWARD':
				// Daily reward should be positive amount
				if (amount <= 0) {
					return res
						.status(400)
						.json({ message: 'Invalid daily reward amount' });
				}
				break;

			default:
				return res
					.status(400)
					.json({ message: 'Invalid transaction type' });
		}

		// Get current user
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { money: true },
		});

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		// Calculate new balance
		const newBalance = Math.max(0, user.money + validAmount);

		// Check if user has enough money for negative transactions
		if (validAmount < 0 && user.money + validAmount < 0) {
			return res.status(400).json({ message: 'Insufficient funds' });
		}

		console.log(
			`[TRANSACTION] Processing ${type} for user ${userId}, amount: ${validAmount}`
		);

		// Execute all updates in a single transaction
		const [updatedUser, transaction] = await prisma.$transaction([
			prisma.user.update({
				where: { id: userId! },
				data: {
					money: newBalance,
				},
			}),
			prisma.transaction.create({
				data: {
					userId: userId!,
					type,
					amount: validAmount,
					metadata: metadata || {},
				},
			}),
		]);

		console.log(
			`[TRANSACTION] Success! New Balance: ${updatedUser.money}, TxID: ${transaction.id}`
		);

		return res.status(200).json({
			success: true,
			newBalance: updatedUser.money,
			transaction: {
				type,
				amount: validAmount,
				metadata,
			},
		});
	} catch (err) {
		console.error('Transaction error:', err);
		return res
			.status(500)
			.json({ message: 'Error processing transaction' });
	}
}
