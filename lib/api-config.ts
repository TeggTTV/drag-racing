export const isLocal = process.env.NEXT_PUBLIC_VERCEL_ENV === 'local';
export const domain = isLocal ? 'localhost:3000' : 'drag-racing.vercel.app';
export const protocol = isLocal ? 'http://' : 'https://';

export type ApiRoute =
	| '/api'
	| '/api/users'
	| '/api/users/:id'
	| '/api/users/:id/money'
	| '/api/race'
	| '/api/race/:id'
	| '/api/party'
	| '/api/party/invite'
	| '/api/party/:id'
	| '/api/party/:id/join'
	| '/api/party/:id/leave'
	| '/api/party/join'
	| '/api/auth/signup'
	| '/api/auth/login'
	| '/api/auth/refresh'
	| '/api/auth/logout'
	| '/api/friends'
	| '/api/party/challenge'
	| '/api/party/challenge-respond'
	| '/api/party/ready'
	| '/api/auction'
	| '/api/auction?action=create'
	| '/api/auction?action=buy'
	| '/api/auction?action=claim'
	| '/api/transactions/money'
	| '/api/shop/crates'
	| '/api/actions/inventory';

export const getFullUrl = (route: ApiRoute, query?: string): string => {
	const fullUrl = `${protocol}${domain}${route}${query ? `?${query}` : ''}`;
	return fullUrl;
};
