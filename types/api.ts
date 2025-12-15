export interface ApiResponse<T = any> {
	// Success fields
	data?: T;
	message?: string;

	// Error fields
	error?: string;

	// Auth-specific fields
	user?: any;
	token?: string;

	// Transaction-specific fields
	success?: boolean;
	newBalance?: number;
	transaction?: any;

	// Inventory-specific fields
	inventory?: any;
	garage?: any;
	newItem?: any;
	xpGained?: number;

	// Allow additional properties
	[key: string]: any;
}

export type TransactionType =
	| 'RACE_WIN'
	| 'RACE_LOSS'
	| 'ITEM_SALE'
	| 'ITEM_PURCHASE'
	| 'SHOP_PURCHASE'
	| 'JUNKYARD_PURCHASE'
	| 'REPAIR_COST'
	| 'DAILY_REWARD'
	| 'CRATE_PURCHASE';

export interface TransactionRequest {
	type: TransactionType;
	amount: number;
	metadata?: Record<string, any>;
}
