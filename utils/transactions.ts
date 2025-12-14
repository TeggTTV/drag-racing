import { getFullUrl } from './prisma';

type TransactionType =
	| 'RACE_WIN'
	| 'RACE_LOSS'
	| 'ITEM_SALE'
	| 'ITEM_PURCHASE'
	| 'SHOP_PURCHASE'
	| 'JUNKYARD_PURCHASE'
	| 'REPAIR_COST'
	| 'DAILY_REWARD';

interface TransactionResult {
	success: boolean;
	newBalance: number;
	transaction: {
		type: TransactionType;
		amount: number;
		metadata?: Record<string, any>;
	};
}

/**
 * Processes a money transaction through the secure server endpoint
 * @param token - User's auth token
 * @param type - Type of transaction
 * @param amount - Amount to add (positive) or subtract (negative)
 * @param metadata - Optional metadata about the transaction
 * @returns The new balance and transaction details
 */
export async function processMoneyTransaction(
	token: string,
	type: TransactionType,
	amount: number,
	metadata?: Record<string, any>
): Promise<TransactionResult> {
	const response = await fetch(getFullUrl('/api/transactions/money'), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			type,
			amount,
			metadata,
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.message || 'Transaction failed');
	}

	return response.json();
}
