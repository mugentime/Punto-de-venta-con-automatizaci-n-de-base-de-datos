import type { Order } from '../types';

/**
 * Deduplicates orders based on ID, timestamp, and total amount
 * Keeps only the first occurrence of duplicate orders
 */
export function deduplicateOrders(orders: Order[]): Order[] {
    const seen = new Set<string>();
    const deduplicated: Order[] = [];
    const duplicateIds: string[] = []; // Track duplicate IDs for summary

    for (const order of orders) {
        // Create a unique key based on critical order properties
        // Orders with identical clientName, total, and timestamp (within same second) are considered duplicates
        const timestamp = new Date(order.date).getTime();
        const timestampKey = Math.floor(timestamp / 1000); // Round to nearest second
        const key = `${order.clientName}-${order.total}-${timestampKey}`;

        if (!seen.has(key)) {
            seen.add(key);
            deduplicated.push(order);
        } else {
            // ⚡ PERF: Only track duplicate IDs, don't log each one (too slow)
            duplicateIds.push(order.id);
        }
    }

    // ⚡ PERF: Log summary only once instead of per duplicate
    const removedCount = orders.length - deduplicated.length;
    if (removedCount > 0) {
        console.log(`🧹 Removed ${removedCount} duplicate order(s) from ${orders.length} total`);
        if (removedCount <= 5) {
            // Only show individual IDs if there are 5 or fewer duplicates
            console.log(`   Duplicates: ${duplicateIds.join(', ')}`);
        }
    }

    return deduplicated;
}

/**
 * Alternative deduplication by exact ID match
 * Use this when you know orders have duplicate IDs
 */
export function deduplicateById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
        if (seen.has(item.id)) {
            return false;
        }
        seen.add(item.id);
        return true;
    });
}

/**
 * Identify duplicates without removing them
 * Returns array of duplicate items
 */
export function findDuplicates(orders: Order[]): Order[] {
    const keyCount = new Map<string, number>();
    const duplicates: Order[] = [];

    // First pass: count occurrences
    for (const order of orders) {
        const timestamp = new Date(order.date).getTime();
        const timestampKey = Math.floor(timestamp / 1000);
        const key = `${order.clientName}-${order.total}-${timestampKey}`;

        keyCount.set(key, (keyCount.get(key) || 0) + 1);
    }

    // Second pass: identify duplicates
    const seen = new Set<string>();
    for (const order of orders) {
        const timestamp = new Date(order.date).getTime();
        const timestampKey = Math.floor(timestamp / 1000);
        const key = `${order.clientName}-${order.total}-${timestampKey}`;

        if (keyCount.get(key)! > 1) {
            if (seen.has(key)) {
                // This is a duplicate (not the first occurrence)
                duplicates.push(order);
            } else {
                seen.add(key);
            }
        }
    }

    return duplicates;
}
