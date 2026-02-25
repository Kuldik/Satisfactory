// ============================================================
// ProductionSystem — handles machine production cycles
// ============================================================

import { defineQuery, type IWorld } from 'bitecs';
import {
  Producer,
  PowerConsumer,
  NeedsPower,
  IsPlaced,
} from '../../core/ecs/components.ts';
import { POWER_SHARD } from '../../core/types.ts';
import type { PowerGridSystem } from '../power/PowerGridSystem.ts';

// Queries
const activeProducerQuery = defineQuery([Producer, IsPlaced]);
const poweredProducerQuery = defineQuery([Producer, PowerConsumer, NeedsPower, IsPlaced]);

/** Simple item buffer per entity */
export interface MachineBuffer {
  inputSlots: Map<string, number>;   // itemId → count
  outputSlots: Map<string, number>;  // itemId → count
}

/** Recipe runtime data */
export interface RuntimeRecipe {
  id: string;
  duration: number;        // seconds
  ingredients: { itemId: string; amount: number }[];
  products: { itemId: string; amount: number }[];
}

export class ProductionSystem {
  /** Per-entity machine buffers */
  private buffers: Map<number, MachineBuffer> = new Map();

  /** Recipe registry (loaded from DocsParser) */
  private recipes: Map<number, RuntimeRecipe> = new Map();

  /** Register a recipe with an index */
  registerRecipe(index: number, recipe: RuntimeRecipe): void {
    this.recipes.set(index, recipe);
  }

  /** Ensure a buffer exists for an entity */
  private getBuffer(eid: number): MachineBuffer {
    let buf = this.buffers.get(eid);
    if (!buf) {
      buf = {
        inputSlots: new Map(),
        outputSlots: new Map(),
      };
      this.buffers.set(eid, buf);
    }
    return buf;
  }

  /** Main update — run production for all machines */
  update(world: IWorld, dt: number, powerGrid: PowerGridSystem): void {
    // Process powered producers
    const producers = activeProducerQuery(world);

    for (const eid of producers) {
      // Check if this machine needs power
      const needsPower = PowerConsumer.basePowerMW[eid] !== undefined &&
                         PowerConsumer.basePowerMW[eid] > 0;

      if (needsPower) {
        const netId = PowerConsumer.networkId[eid];
        if (powerGrid.isEntityBlackedOut(netId)) {
          // Network is blacked out — machine stops
          Producer.isActive[eid] = 0;
          PowerConsumer.currentPowerMW[eid] = 0;
          continue;
        }
      }

      this.processProducer(eid, dt);
    }
  }

  /** Process a single producer entity */
  private processProducer(eid: number, dt: number): void {
    const recipeIndex = Producer.recipeId[eid];
    const recipe = this.recipes.get(recipeIndex);
    if (!recipe) {
      Producer.isActive[eid] = 0;
      return;
    }

    const buffer = this.getBuffer(eid);

    // Calculate speed multiplier from power shards
    const shardCount = Producer.powerShards[eid];
    const shardBonus = shardCount * POWER_SHARD.bonusPerSlot;
    const speedMultiplier = Math.min(1.0 + shardBonus, POWER_SHARD.maxMultiplier);
    Producer.speedMultiplier[eid] = speedMultiplier;

    // Update power consumption proportionally
    if (PowerConsumer.basePowerMW[eid] > 0) {
      // Power scales with speed^1.6 (Satisfactory formula)
      const powerMultiplier = Math.pow(speedMultiplier, 1.6);
      PowerConsumer.currentPowerMW[eid] = PowerConsumer.basePowerMW[eid] * powerMultiplier;
    }

    // Check if output buffer has space
    const canOutput = this.canOutput(buffer, recipe);
    if (!canOutput) {
      Producer.isActive[eid] = 0;
      return;
    }

    // Check if we have all ingredients (only when starting new cycle)
    if (Producer.progress[eid] === 0) {
      const hasIngredients = this.hasIngredients(buffer, recipe);
      if (!hasIngredients) {
        Producer.isActive[eid] = 0;
        return;
      }
      // Consume ingredients
      this.consumeIngredients(buffer, recipe);
    }

    // Machine is active
    Producer.isActive[eid] = 1;

    // Advance progress
    const progressDelta = (dt / recipe.duration) * speedMultiplier;
    Producer.progress[eid] += progressDelta;

    // Check completion
    if (Producer.progress[eid] >= 1.0) {
      Producer.progress[eid] = 0;
      // Produce outputs
      this.produceOutputs(buffer, recipe);
    }
  }

  /** Check if input buffer has all required ingredients */
  private hasIngredients(buffer: MachineBuffer, recipe: RuntimeRecipe): boolean {
    for (const ing of recipe.ingredients) {
      const available = buffer.inputSlots.get(ing.itemId) || 0;
      if (available < ing.amount) return false;
    }
    return true;
  }

  /** Consume ingredients from input buffer */
  private consumeIngredients(buffer: MachineBuffer, recipe: RuntimeRecipe): void {
    for (const ing of recipe.ingredients) {
      const current = buffer.inputSlots.get(ing.itemId) || 0;
      buffer.inputSlots.set(ing.itemId, current - ing.amount);
    }
  }

  /** Check if output buffer has space */
  private canOutput(buffer: MachineBuffer, recipe: RuntimeRecipe): boolean {
    // Simple check: output slots < max stack per slot
    const MAX_OUTPUT_BUFFER = 100;
    for (const prod of recipe.products) {
      const current = buffer.outputSlots.get(prod.itemId) || 0;
      if (current + prod.amount > MAX_OUTPUT_BUFFER) return false;
    }
    return true;
  }

  /** Add products to output buffer */
  private produceOutputs(buffer: MachineBuffer, recipe: RuntimeRecipe): void {
    for (const prod of recipe.products) {
      const current = buffer.outputSlots.get(prod.itemId) || 0;
      buffer.outputSlots.set(prod.itemId, current + prod.amount);
    }
  }

  /** Get buffer for UI display */
  getBuffer(eid: number): MachineBuffer {
    return this.buffers.get(eid) || {
      inputSlots: new Map(),
      outputSlots: new Map(),
    };
  }

  /** Add items to a machine's input buffer (from conveyor) */
  addToInput(eid: number, itemId: string, amount: number): number {
    const buffer = this.getBuffer(eid);
    const current = buffer.inputSlots.get(itemId) || 0;
    const maxInput = 100;
    const canAccept = Math.min(amount, maxInput - current);
    if (canAccept > 0) {
      buffer.inputSlots.set(itemId, current + canAccept);
    }
    return canAccept;
  }

  /** Take items from a machine's output buffer (to conveyor) */
  takeFromOutput(eid: number, itemId: string, amount: number): number {
    const buffer = this.getBuffer(eid);
    const current = buffer.outputSlots.get(itemId) || 0;
    const canTake = Math.min(amount, current);
    if (canTake > 0) {
      buffer.outputSlots.set(itemId, current - canTake);
    }
    return canTake;
  }

  /** Remove entity from system */
  removeEntity(eid: number): void {
    this.buffers.delete(eid);
  }
}
