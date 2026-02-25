// ============================================================
// InventorySystem — infinite player inventory + containers
// ============================================================

/**
 * The player has an INFINITE inventory.
 * Items flow into it from:
 *  - HUB connections
 *  - Loading Modules
 *  - Manual pickup
 *
 * Items flow out via:
 *  - Unloading Modules (select specific item to output)
 *  - Manual placement
 */

export class InventorySystem {
  /** Player's infinite inventory: itemId → amount */
  private playerInventory: Map<string, number> = new Map();

  /** Container inventories: entityId → Map<itemId, amount> */
  private containerInventories: Map<number, Map<string, number>> = new Map();

  // ---- Player Inventory ----

  /** Add items to player inventory */
  addToPlayer(itemId: string, amount: number): void {
    const current = this.playerInventory.get(itemId) || 0;
    this.playerInventory.set(itemId, current + amount);
  }

  /** Remove items from player inventory */
  removeFromPlayer(itemId: string, amount: number): number {
    const current = this.playerInventory.get(itemId) || 0;
    const removed = Math.min(current, amount);
    if (removed > 0) {
      this.playerInventory.set(itemId, current - removed);
      if (current - removed <= 0) {
        this.playerInventory.delete(itemId);
      }
    }
    return removed;
  }

  /** Check if player has enough of an item */
  playerHas(itemId: string, amount: number): boolean {
    return (this.playerInventory.get(itemId) || 0) >= amount;
  }

  /** Get player inventory count for an item */
  getPlayerCount(itemId: string): number {
    return this.playerInventory.get(itemId) || 0;
  }

  /** Get all items in player inventory */
  getPlayerInventory(): Map<string, number> {
    return new Map(this.playerInventory);
  }

  /** Get player inventory as sorted array */
  getPlayerInventoryArray(): { itemId: string; amount: number }[] {
    return Array.from(this.playerInventory.entries())
      .filter(([_, amount]) => amount > 0)
      .map(([itemId, amount]) => ({ itemId, amount }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }

  // ---- Container Inventory ----

  /** Initialize a container inventory */
  initContainer(entityId: number, _maxSlots: number): void {
    if (!this.containerInventories.has(entityId)) {
      this.containerInventories.set(entityId, new Map());
    }
  }

  /** Add items to a container */
  addToContainer(entityId: number, itemId: string, amount: number): number {
    const inv = this.containerInventories.get(entityId);
    if (!inv) return 0;

    const current = inv.get(itemId) || 0;
    inv.set(itemId, current + amount);
    return amount;
  }

  /** Remove items from a container */
  removeFromContainer(entityId: number, itemId: string, amount: number): number {
    const inv = this.containerInventories.get(entityId);
    if (!inv) return 0;

    const current = inv.get(itemId) || 0;
    const removed = Math.min(current, amount);
    if (removed > 0) {
      inv.set(itemId, current - removed);
    }
    return removed;
  }

  /** Get container inventory */
  getContainerInventory(entityId: number): Map<string, number> {
    return this.containerInventories.get(entityId) || new Map();
  }

  /** Remove a container (when building is demolished) */
  removeContainer(entityId: number): void {
    this.containerInventories.delete(entityId);
  }

  // ---- Serialization ----

  /** Serialize player inventory for saving */
  serializePlayer(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, val] of this.playerInventory) {
      result[key] = val;
    }
    return result;
  }

  /** Deserialize player inventory from save */
  deserializePlayer(data: Record<string, number>): void {
    this.playerInventory.clear();
    for (const [key, val] of Object.entries(data)) {
      this.playerInventory.set(key, val);
    }
  }
}
