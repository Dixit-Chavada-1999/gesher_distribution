/**
 * Container Capacity Configuration
 * Defines standard container capacities for different tire sizes
 */

export const CONTAINER_CAPACITIES = {
  '290-85R38': 72,   // 38" tire - standard container holds 72 units
  '380-85R24': 96,   // 24" tire - standard container holds 96 units
} as const;

export type TireSKU = keyof typeof CONTAINER_CAPACITIES;

/**
 * Get container capacity for a given SKU
 */
export function getContainerCapacity(sku: string): number {
  return CONTAINER_CAPACITIES[sku as TireSKU] || 72; // Default to 72
}

/**
 * Check if a quantity needs to be split across multiple containers
 */
export function needsContainerSplit(sku: string, quantity: number): boolean {
  const capacity = getContainerCapacity(sku);
  return quantity > capacity;
}

/**
 * Calculate how many containers are needed for a quantity
 */
export function calculateContainersNeeded(sku: string, quantity: number): number {
  const capacity = getContainerCapacity(sku);
  return Math.ceil(quantity / capacity);
}

/**
 * Calculate optimal split of quantity across containers
 * Returns array of quantities per container
 *
 * Example: 100 tires with capacity 72 → [72, 28]
 */
export function calculateOptimalSplit(quantity: number, capacity: number): number[] {
  const containers = Math.ceil(quantity / capacity);
  const splits: number[] = [];
  let remaining = quantity;

  for (let i = 0; i < containers; i++) {
    const thisQty = Math.min(remaining, capacity);
    splits.push(thisQty);
    remaining -= thisQty;
  }

  return splits;
}

/**
 * Format split suggestion for display
 *
 * Example: [72, 28] → "72 + 28"
 */
export function formatSplitSuggestion(splits: number[]): string {
  return splits.join(' + ');
}

/**
 * Get split message for user
 */
export function getSplitMessage(sku: string, quantity: number): string {
  const capacity = getContainerCapacity(sku);
  const containers = calculateContainersNeeded(sku, quantity);
  const splits = calculateOptimalSplit(quantity, capacity);

  return `${quantity} tires need ${containers} container${containers > 1 ? 's' : ''}. Suggested split: ${formatSplitSuggestion(splits)} tires`;
}
