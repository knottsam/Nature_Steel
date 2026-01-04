// Demo products used when Firestore has no data and VITE_ENABLE_DEMO_PRODUCTS=1
export const products = [
	{
		id: 'demo-1',
		slug: 'steel-coffee-table',
		name: 'Steel Coffee Table',
		description: 'Hand-welded steel coffee table with clear lacquer finish.',
		images: [
			'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?q=80&w=1200&auto=format&fit=crop',
		],
		basePricePence: 35000,
		materials: 'Steel, lacquer',
		material: 'Steel',
		itemType: 'Coffee table',
	},
	{
		id: 'demo-2',
		slug: 'industrial-shelf',
		name: 'Industrial Shelf',
		description: 'Minimal wall shelf with steel brackets and reclaimed wood.',
		images: [
			'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1200&auto=format&fit=crop',
		],
		basePricePence: 22000,
		materials: 'Steel, reclaimed wood',
		material: 'Steel and reclaimed wood',
		itemType: 'Shelf',
	},
]
