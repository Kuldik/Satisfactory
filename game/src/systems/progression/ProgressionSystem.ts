// ============================================================
// ProgressionSystem — HUB milestones & Space Elevator phases
// ============================================================

import type { MilestoneDefinition, RecipeIngredient } from '../../core/types.ts';
import type { InventorySystem } from '../storage/InventorySystem.ts';

export interface MilestoneProgress {
  milestoneId: string;
  delivered: Map<string, number>;  // itemId → delivered count
  isComplete: boolean;
}

export interface SpaceElevatorPhase {
  phase: number;
  requirements: RecipeIngredient[];
  delivered: Map<string, number>;
  isComplete: boolean;
}

export class ProgressionSystem {
  /** All milestone definitions */
  private milestones: MilestoneDefinition[] = [];

  /** Unlocked milestone IDs */
  private unlockedMilestones: Set<string> = new Set();

  /** Current milestone progress */
  private milestoneProgress: Map<string, MilestoneProgress> = new Map();

  /** Unlocked recipes */
  private unlockedRecipes: Set<string> = new Set();

  /** Unlocked buildings */
  private unlockedBuildings: Set<string> = new Set();

  /** Space Elevator phases */
  private spaceElevatorPhases: SpaceElevatorPhase[] = [];
  private currentPhase = 0;

  /** Sink points (from resource sink) */
  private sinkPoints = 0;

  /** Initialize with parsed milestone data */
  initialize(milestones: MilestoneDefinition[]): void {
    this.milestones = milestones;

    // Sort milestones by tier
    this.milestones.sort((a, b) => a.tier - b.tier);

    // Unlock tier 0 milestones by default
    const tier0 = this.milestones.filter(m => m.tier === 0);
    for (const m of tier0) {
      this.unlockMilestone(m.id);
    }

    // Initialize Space Elevator phases
    this.initSpaceElevator();

    console.log(`[Progression] Initialized with ${milestones.length} milestones`);
  }

  /** Initialize Space Elevator phases (from Satisfactory data) */
  private initSpaceElevator(): void {
    // Phase 1-6 (from Docs.json space elevator parts)
    this.spaceElevatorPhases = [
      {
        phase: 1,
        requirements: [
          { itemId: 'Desc_SpaceElevatorPart_1_C', amount: 50 },
        ],
        delivered: new Map(),
        isComplete: false,
      },
      {
        phase: 2,
        requirements: [
          { itemId: 'Desc_SpaceElevatorPart_2_C', amount: 500 },
          { itemId: 'Desc_SpaceElevatorPart_1_C', amount: 100 },
        ],
        delivered: new Map(),
        isComplete: false,
      },
      {
        phase: 3,
        requirements: [
          { itemId: 'Desc_SpaceElevatorPart_3_C', amount: 500 },
          { itemId: 'Desc_SpaceElevatorPart_2_C', amount: 500 },
        ],
        delivered: new Map(),
        isComplete: false,
      },
      {
        phase: 4,
        requirements: [
          { itemId: 'Desc_SpaceElevatorPart_4_C', amount: 1000 },
          { itemId: 'Desc_SpaceElevatorPart_3_C', amount: 500 },
        ],
        delivered: new Map(),
        isComplete: false,
      },
      {
        phase: 5,
        requirements: [
          { itemId: 'Desc_SpaceElevatorPart_5_C', amount: 1000 },
          { itemId: 'Desc_SpaceElevatorPart_4_C', amount: 1000 },
        ],
        delivered: new Map(),
        isComplete: false,
      },
    ];
  }

  /** Try to unlock a milestone */
  unlockMilestone(milestoneId: string): boolean {
    if (this.unlockedMilestones.has(milestoneId)) return false;

    const milestone = this.milestones.find(m => m.id === milestoneId);
    if (!milestone) return false;

    this.unlockedMilestones.add(milestoneId);

    // Unlock associated recipes
    for (const recipeId of milestone.unlockedRecipes) {
      this.unlockedRecipes.add(recipeId);
    }

    // Unlock associated buildings
    for (const buildingId of milestone.unlockedBuildings) {
      this.unlockedBuildings.add(buildingId);
    }

    console.log(`[Progression] Unlocked milestone: ${milestone.name}`);
    return true;
  }

  /** Deliver items to a milestone (via HUB conveyor inputs) */
  deliverToMilestone(milestoneId: string, itemId: string, amount: number, inventory: InventorySystem): number {
    const milestone = this.milestones.find(m => m.id === milestoneId);
    if (!milestone) return 0;

    let progress = this.milestoneProgress.get(milestoneId);
    if (!progress) {
      progress = {
        milestoneId,
        delivered: new Map(),
        isComplete: false,
      };
      this.milestoneProgress.set(milestoneId, progress);
    }

    if (progress.isComplete) return 0;

    // Find how much of this item is needed
    const requirement = milestone.cost.find(c => c.itemId === itemId);
    if (!requirement) return 0;

    const alreadyDelivered = progress.delivered.get(itemId) || 0;
    const stillNeeded = requirement.amount - alreadyDelivered;
    const toDeliver = Math.min(amount, stillNeeded);

    if (toDeliver <= 0) return 0;

    // Remove from inventory
    const removed = inventory.removeFromPlayer(itemId, toDeliver);
    if (removed > 0) {
      progress.delivered.set(itemId, alreadyDelivered + removed);
    }

    // Check if milestone is complete
    const allDelivered = milestone.cost.every(c => {
      const delivered = progress!.delivered.get(c.itemId) || 0;
      return delivered >= c.amount;
    });

    if (allDelivered) {
      progress.isComplete = true;
      this.unlockMilestone(milestoneId);
    }

    return removed;
  }

  /** Deliver items to Space Elevator */
  deliverToSpaceElevator(itemId: string, amount: number, inventory: InventorySystem): number {
    const phase = this.spaceElevatorPhases[this.currentPhase];
    if (!phase || phase.isComplete) return 0;

    const requirement = phase.requirements.find(r => r.itemId === itemId);
    if (!requirement) return 0;

    const alreadyDelivered = phase.delivered.get(itemId) || 0;
    const stillNeeded = requirement.amount - alreadyDelivered;
    const toDeliver = Math.min(amount, stillNeeded);

    if (toDeliver <= 0) return 0;

    const removed = inventory.removeFromPlayer(itemId, toDeliver);
    if (removed > 0) {
      phase.delivered.set(itemId, alreadyDelivered + removed);
    }

    // Check if phase is complete
    const allDelivered = phase.requirements.every(r => {
      const delivered = phase.delivered.get(r.itemId) || 0;
      return delivered >= r.amount;
    });

    if (allDelivered) {
      phase.isComplete = true;
      this.currentPhase++;
      console.log(`[Progression] Space Elevator Phase ${phase.phase} complete!`);
    }

    return removed;
  }

  /** Add sink points from resource sink */
  addSinkPoints(points: number): void {
    this.sinkPoints += points;
  }

  /** Get sink points balance */
  getSinkPoints(): number {
    return this.sinkPoints;
  }

  // ---- Queries ----

  isRecipeUnlocked(recipeId: string): boolean {
    return this.unlockedRecipes.has(recipeId);
  }

  isBuildingUnlocked(buildingId: string): boolean {
    return this.unlockedBuildings.has(buildingId);
  }

  isMilestoneUnlocked(milestoneId: string): boolean {
    return this.unlockedMilestones.has(milestoneId);
  }

  /** Get available (not yet unlocked) milestones for a tier */
  getAvailableMilestones(tier: number): MilestoneDefinition[] {
    return this.milestones.filter(m =>
      m.tier === tier && !this.unlockedMilestones.has(m.id)
    );
  }

  /** Get all milestones grouped by tier */
  getMilestonesByTier(): Map<number, MilestoneDefinition[]> {
    const grouped = new Map<number, MilestoneDefinition[]>();
    for (const m of this.milestones) {
      const list = grouped.get(m.tier) || [];
      list.push(m);
      grouped.set(m.tier, list);
    }
    return grouped;
  }

  getCurrentSpaceElevatorPhase(): SpaceElevatorPhase | null {
    return this.spaceElevatorPhases[this.currentPhase] || null;
  }

  getAllSpaceElevatorPhases(): SpaceElevatorPhase[] {
    return this.spaceElevatorPhases;
  }

  /** Serialize for saving */
  serialize(): {
    unlockedMilestones: string[];
    unlockedRecipes: string[];
    milestoneProgress: Record<string, Record<string, number>>;
    sinkPoints: number;
    currentPhase: number;
  } {
    const milestoneProgressObj: Record<string, Record<string, number>> = {};
    for (const [id, progress] of this.milestoneProgress) {
      const delivered: Record<string, number> = {};
      for (const [itemId, amount] of progress.delivered) {
        delivered[itemId] = amount;
      }
      milestoneProgressObj[id] = delivered;
    }

    return {
      unlockedMilestones: Array.from(this.unlockedMilestones),
      unlockedRecipes: Array.from(this.unlockedRecipes),
      milestoneProgress: milestoneProgressObj,
      sinkPoints: this.sinkPoints,
      currentPhase: this.currentPhase,
    };
  }
}
