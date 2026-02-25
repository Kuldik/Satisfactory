// ============================================================
// ECS World — bitECS world setup and entity management
// ============================================================

import {
  createWorld,
  addEntity,
  removeEntity,
  addComponent,
  type IWorld,
} from 'bitecs';

import {
  Position,
  Rotation as RotationComp,
  Building,
  Producer,
  PowerConsumer,
  PowerGenerator,
  ConnectionPorts,
  IsPlaced,
  NeedsPower,
  RenderObject,
  ResourceNode,
  Miner,
  Conveyor,
  Pipe,
  PowerPole,
  Inventory,
} from './components.ts';

import type { GridPosition, Rotation, EntityId } from '../types.ts';

export interface BuildingSpawnData {
  typeId: number;
  position: GridPosition;
  rotation: Rotation;
  sizeX: number;
  sizeZ: number;
  sizeY: number;
  powerConsumption: number;
  conveyorInputs: number;
  conveyorOutputs: number;
  pipeInputs: number;
  pipeOutputs: number;
  requiresPower: boolean;
}

export class ECSWorld {
  readonly world: IWorld;

  constructor() {
    this.world = createWorld();
  }

  /** Spawn a building entity */
  spawnBuilding(data: BuildingSpawnData): EntityId {
    const eid = addEntity(this.world) as EntityId;

    // Position
    addComponent(this.world, Position, eid);
    Position.x[eid] = data.position.x;
    Position.y[eid] = data.position.y;
    Position.z[eid] = data.position.z;

    // Rotation
    addComponent(this.world, RotationComp, eid);
    RotationComp.value[eid] = data.rotation;

    // Building
    addComponent(this.world, Building, eid);
    Building.typeId[eid] = data.typeId;
    Building.sizeX[eid] = data.sizeX;
    Building.sizeZ[eid] = data.sizeZ;
    Building.sizeY[eid] = data.sizeY;

    // Connection ports
    addComponent(this.world, ConnectionPorts, eid);
    ConnectionPorts.conveyorInputs[eid] = data.conveyorInputs;
    ConnectionPorts.conveyorOutputs[eid] = data.conveyorOutputs;
    ConnectionPorts.pipeInputs[eid] = data.pipeInputs;
    ConnectionPorts.pipeOutputs[eid] = data.pipeOutputs;

    // Power
    if (data.requiresPower && data.powerConsumption > 0) {
      addComponent(this.world, PowerConsumer, eid);
      PowerConsumer.basePowerMW[eid] = data.powerConsumption;
      PowerConsumer.currentPowerMW[eid] = 0;
      PowerConsumer.networkId[eid] = 0;

      addComponent(this.world, NeedsPower, eid);
    }

    // Render
    addComponent(this.world, RenderObject, eid);
    RenderObject.meshId[eid] = 0; // will be set by render system

    // Placed
    addComponent(this.world, IsPlaced, eid);

    return eid;
  }

  /** Spawn a resource node */
  spawnResourceNode(
    position: GridPosition,
    resourceType: number,
    purity: number,
  ): EntityId {
    const eid = addEntity(this.world) as EntityId;

    addComponent(this.world, Position, eid);
    Position.x[eid] = position.x;
    Position.y[eid] = position.y;
    Position.z[eid] = position.z;

    addComponent(this.world, ResourceNode, eid);
    ResourceNode.resourceType[eid] = resourceType;
    ResourceNode.purity[eid] = purity;
    ResourceNode.isOccupied[eid] = 0;

    return eid;
  }

  /** Add producer component to an entity */
  addProducer(eid: EntityId, recipeId: number): void {
    addComponent(this.world, Producer, eid);
    Producer.recipeId[eid] = recipeId;
    Producer.progress[eid] = 0;
    Producer.speedMultiplier[eid] = 1.0;
    Producer.powerShards[eid] = 0;
    Producer.isActive[eid] = 0;
  }

  /** Add miner component to an entity */
  addMiner(eid: EntityId, tier: number, resourceType: number, purity: number): void {
    addComponent(this.world, Miner, eid);
    Miner.tier[eid] = tier;
    Miner.resourceType[eid] = resourceType;
    Miner.nodePurity[eid] = purity;

    // Calculate base output
    const tierMultipliers = [0, 30, 60, 120]; // items/min at impure
    const purityMultipliers = [1, 2, 3]; // impure, normal, pure
    Miner.outputPerMin[eid] = tierMultipliers[tier] * purityMultipliers[purity];
  }

  /** Add conveyor component */
  addConveyor(eid: EntityId, tier: number, speed: number): void {
    addComponent(this.world, Conveyor, eid);
    Conveyor.tier[eid] = tier;
    Conveyor.speedItemsPerMin[eid] = speed;
  }

  /** Add pipe component */
  addPipe(eid: EntityId, tier: number, flowRate: number): void {
    addComponent(this.world, Pipe, eid);
    Pipe.tier[eid] = tier;
    Pipe.flowRate[eid] = flowRate;
  }

  /** Add power generator */
  addPowerGenerator(eid: EntityId, basePower: number): void {
    addComponent(this.world, PowerGenerator, eid);
    PowerGenerator.basePowerMW[eid] = basePower;
    PowerGenerator.currentPowerMW[eid] = 0;
    PowerGenerator.networkId[eid] = 0;
  }

  /** Add power pole */
  addPowerPole(eid: EntityId, tier: number, maxConn: number, range: number): void {
    addComponent(this.world, PowerPole, eid);
    PowerPole.tier[eid] = tier;
    PowerPole.maxConnections[eid] = maxConn;
    PowerPole.currentConnections[eid] = 0;
    PowerPole.range[eid] = range;
  }

  /** Add inventory */
  addInventory(eid: EntityId, slots: number): void {
    addComponent(this.world, Inventory, eid);
    Inventory.slotCount[eid] = slots;
    Inventory.usedSlots[eid] = 0;
  }

  /** Remove an entity */
  despawn(eid: EntityId): void {
    removeEntity(this.world, eid);
  }
}
