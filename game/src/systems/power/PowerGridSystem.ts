// ============================================================
// PowerGridSystem — manages isolated power networks, blackouts
// ============================================================

import { defineQuery, type IWorld } from 'bitecs';
import {
  PowerConsumer,
  PowerGenerator,
  PowerPole,
  PowerStorage,
  AlienExtractor,
} from '../../core/ecs/components.ts';
import { ALIEN_ENERGY_BONUS, ALIEN_ENERGY_BASE_MW } from '../../core/constants.ts';

/** Runtime data for a power network */
export interface PowerNetwork {
  id: number;
  totalProduction: number;   // MW
  totalConsumption: number;   // MW
  totalStorage: number;       // MWh (capacity)
  storedEnergy: number;       // MWh (current)
  alienExtractorCount: number;
  effectiveProduction: number; // after alien bonus
  isBlackedOut: boolean;
  entities: Set<number>;      // all entities in this network
}

// Queries
const generatorQuery = defineQuery([PowerGenerator]);
const consumerQuery = defineQuery([PowerConsumer]);
const poleQuery = defineQuery([PowerPole]);
const storageQuery = defineQuery([PowerStorage]);
const alienQuery = defineQuery([AlienExtractor]);

export class PowerGridSystem {
  private networks: Map<number, PowerNetwork> = new Map();
  private nextNetworkId = 1;

  /** Create a new empty network */
  createNetwork(): number {
    const id = this.nextNetworkId++;
    this.networks.set(id, {
      id,
      totalProduction: 0,
      totalConsumption: 0,
      totalStorage: 0,
      storedEnergy: 0,
      alienExtractorCount: 0,
      effectiveProduction: 0,
      isBlackedOut: false,
      entities: new Set(),
    });
    return id;
  }

  /** Get a network by ID */
  getNetwork(id: number): PowerNetwork | undefined {
    return this.networks.get(id);
  }

  /** Get all networks */
  getAllNetworks(): PowerNetwork[] {
    return Array.from(this.networks.values());
  }

  /** Update power grid simulation */
  update(world: IWorld, dt: number): void {
    // Reset network stats
    for (const net of this.networks.values()) {
      net.totalProduction = 0;
      net.totalConsumption = 0;
      net.totalStorage = 0;
      net.alienExtractorCount = 0;
    }

    // Tally generators
    const generators = generatorQuery(world);
    for (const eid of generators) {
      const netId = PowerGenerator.networkId[eid];
      const net = this.networks.get(netId);
      if (!net) continue;
      net.totalProduction += PowerGenerator.currentPowerMW[eid];
    }

    // Tally alien extractors
    const aliens = alienQuery(world);
    for (const eid of aliens) {
      const netId = AlienExtractor.networkId[eid];
      const net = this.networks.get(netId);
      if (!net) continue;
      net.alienExtractorCount++;
      net.totalProduction += ALIEN_ENERGY_BASE_MW;
    }

    // Tally consumers
    const consumers = consumerQuery(world);
    for (const eid of consumers) {
      const netId = PowerConsumer.networkId[eid];
      const net = this.networks.get(netId);
      if (!net) continue;
      net.totalConsumption += PowerConsumer.currentPowerMW[eid];
    }

    // Tally storage
    const storages = storageQuery(world);
    for (const eid of storages) {
      const netId = PowerStorage.networkId[eid];
      const net = this.networks.get(netId);
      if (!net) continue;
      net.totalStorage += PowerStorage.capacity[eid];
      net.storedEnergy += PowerStorage.stored[eid];
    }

    // Calculate effective production with alien bonus
    for (const net of this.networks.values()) {
      // Base production WITHOUT alien extractors
      const baseProduction = net.totalProduction - (net.alienExtractorCount * ALIEN_ENERGY_BASE_MW);

      // Each alien extractor adds 30% of base (non-alien) production independently
      // They do NOT stack multiplicatively — each applies 30% to the same base
      const alienBonus = baseProduction * ALIEN_ENERGY_BONUS * net.alienExtractorCount;

      net.effectiveProduction = net.totalProduction + alienBonus;

      // Check blackout
      const surplus = net.effectiveProduction - net.totalConsumption;

      if (surplus < 0) {
        // Deficit — try to use stored energy
        const deficitMWh = Math.abs(surplus) * (dt / 3600); // Convert to MWh

        if (net.storedEnergy >= deficitMWh) {
          // Draw from storage
          net.storedEnergy -= deficitMWh;
          net.isBlackedOut = false;
        } else {
          // BLACKOUT! Not enough production + storage
          net.storedEnergy = 0;
          net.isBlackedOut = true;
        }
      } else {
        // Surplus — charge storage
        net.isBlackedOut = false;
        const surplusMWh = surplus * (dt / 3600);
        net.storedEnergy = Math.min(net.storedEnergy + surplusMWh, net.totalStorage);
      }

      // Update storage entities
      this.updateStorageEntities(world, net);
    }
  }

  /** Distribute stored energy across storage entities */
  private updateStorageEntities(world: IWorld, net: PowerNetwork): void {
    const storages = storageQuery(world);
    if (net.totalStorage === 0) return;

    for (const eid of storages) {
      if (PowerStorage.networkId[eid] !== net.id) continue;

      // Distribute proportionally
      const ratio = PowerStorage.capacity[eid] / net.totalStorage;
      PowerStorage.stored[eid] = net.storedEnergy * ratio;
    }
  }

  /** Check if an entity's network is blacked out */
  isEntityBlackedOut(networkId: number): boolean {
    const net = this.networks.get(networkId);
    return net?.isBlackedOut ?? false;
  }

  /** Get network stats formatted for UI */
  getNetworkStats(networkId: number): {
    production: number;
    consumption: number;
    surplus: number;
    storagePercent: number;
    isBlackedOut: boolean;
    alienBonus: number;
  } | null {
    const net = this.networks.get(networkId);
    if (!net) return null;

    return {
      production: net.effectiveProduction,
      consumption: net.totalConsumption,
      surplus: net.effectiveProduction - net.totalConsumption,
      storagePercent: net.totalStorage > 0 ? (net.storedEnergy / net.totalStorage) * 100 : 0,
      isBlackedOut: net.isBlackedOut,
      alienBonus: net.alienExtractorCount * ALIEN_ENERGY_BONUS * 100,
    };
  }
}
