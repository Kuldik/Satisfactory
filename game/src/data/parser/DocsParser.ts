// ============================================================
// DocsParser — parses Satisfactory Docs.json into game data
// ============================================================

import type { RecipeDefinition, RecipeIngredient, MilestoneDefinition } from '../../core/types.ts';

interface RawNativeClass {
  NativeClass: string;
  Classes: RawClass[];
}

interface RawClass {
  ClassName: string;
  FullName?: string;
  mDisplayName?: string;
  mDescription?: string;
  mIngredients?: string;
  mProduct?: string;
  mManufactoringDuration?: string;
  mProducedIn?: string;
  mPowerConsumption?: string;
  mPowerConsumptionExponent?: string;
  // Milestone / Schematic fields
  mType?: string;
  mTechTier?: string;
  mCost?: string;
  mTimeToComplete?: string;
  mUnlocks?: string;
  // Item descriptor fields
  mStackSize?: string;
  mForm?: string;
  mEnergyValue?: string;
  [key: string]: unknown;
}

/** Extract a class name from a long Unreal path */
function extractClassName(unrealPath: string): string {
  // Match the last part like Desc_IronIngot_C or Build_ConstructorMk1_C
  const match = unrealPath.match(/\.(\w+)(?:'|")/);
  if (match) return match[1];

  // Fallback: take last segment after /
  const segments = unrealPath.split(/[/.]/);
  return segments[segments.length - 1] || unrealPath;
}

/** Parse Unreal's ingredient/product tuple format */
function parseIngredientList(raw: string): RecipeIngredient[] {
  if (!raw || raw === '()') return [];

  const results: RecipeIngredient[] = [];

  // Match patterns like (ItemClass="...path...",Amount=3)
  const regex = /\(ItemClass="([^"]+)",Amount=(\d+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    results.push({
      itemId: extractClassName(match[1]),
      amount: parseInt(match[2], 10),
    });
  }

  return results;
}

/** Parse the mProducedIn field to extract machine class names */
function parseProducedIn(raw: string): string[] {
  if (!raw || raw === '()') return [];

  const results: string[] = [];
  // Match paths inside quotes
  const regex = /"([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw)) !== null) {
    results.push(extractClassName(match[1]));
  }

  // Also handle without quotes
  if (results.length === 0) {
    const pathRegex = /\/([^,)]+)/g;
    while ((match = pathRegex.exec(raw)) !== null) {
      results.push(extractClassName(match[1]));
    }
  }

  return results;
}

/** Map of machine class names to our building IDs */
const MACHINE_MAP: Record<string, string> = {
  'Build_ConstructorMk1_C': 'constructor',
  'Build_AssemblerMk1_C': 'assembler',
  'Build_ManufacturerMk1_C': 'manufacturer',
  'Build_SmelterMk1_C': 'smelter',
  'Build_FoundryMk1_C': 'foundry',
  'Build_OilRefinery_C': 'refinery',
  'Build_Blender_C': 'blender',
  'Build_HadronCollider_C': 'particle_accelerator',
  'Build_Converter_C': 'converter',
  'Build_QuantumEncoder_C': 'quantum_encoder',
  'Build_Packager_C': 'packager',
  'BP_BuildGun_C': 'build_gun',
  'FGBuildGun': 'build_gun',
  'Build_AutomatedWorkBench_C': 'crafting_bench',
};

export interface ParsedGameData {
  recipes: RecipeDefinition[];
  milestones: MilestoneDefinition[];
  items: Map<string, ItemData>;
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  stackSize: string;
  form: string; // RF_SOLID, RF_LIQUID, RF_GAS
  energyValue: number;
}

export class DocsParser {
  private nativeClasses: RawNativeClass[] = [];
  private ruNativeClasses: RawNativeClass[] = [];

  /** Load and parse both EN and RU JSON files */
  async load(enUrl: string, ruUrl: string): Promise<ParsedGameData> {
    const [enResponse, ruResponse] = await Promise.all([
      fetch(enUrl),
      fetch(ruUrl),
    ]);

    this.nativeClasses = await enResponse.json();
    this.ruNativeClasses = await ruResponse.json();

    const recipes = this.parseRecipes();
    const milestones = this.parseMilestones();
    const items = this.parseItems();

    console.log(`[DocsParser] Parsed ${recipes.length} recipes, ${milestones.length} milestones, ${items.size} items`);

    return { recipes, milestones, items };
  }

  /** Find a native class section by partial name */
  private findNativeClass(data: RawNativeClass[], partialName: string): RawNativeClass | undefined {
    return data.find(nc => nc.NativeClass.includes(partialName));
  }

  /** Get RU name for a class */
  private getRuName(nativeClassName: string, className: string): string {
    const ruSection = this.findNativeClass(this.ruNativeClasses, nativeClassName);
    if (!ruSection) return '';
    const ruClass = ruSection.Classes.find(c => c.ClassName === className);
    return ruClass?.mDisplayName || '';
  }

  /** Parse all recipes */
  private parseRecipes(): RecipeDefinition[] {
    const section = this.findNativeClass(this.nativeClasses, 'FGRecipe');
    if (!section) {
      console.warn('[DocsParser] FGRecipe section not found');
      return [];
    }

    return section.Classes.map(cls => {
      const producedInList = parseProducedIn(cls.mProducedIn || '');
      const mappedMachine = producedInList
        .map(m => MACHINE_MAP[m] || m)
        .find(m => m !== 'build_gun' && m !== 'crafting_bench') || producedInList[0] || 'unknown';

      return {
        id: cls.ClassName,
        name: cls.mDisplayName || cls.ClassName,
        nameRu: this.getRuName('FGRecipe', cls.ClassName),
        duration: parseFloat(cls.mManufactoringDuration || '1'),
        producedIn: mappedMachine,
        ingredients: parseIngredientList(cls.mIngredients || ''),
        products: parseIngredientList(cls.mProduct || ''),
        isAlternate: (cls.mDisplayName || '').startsWith('Alternate:'),
      };
    });
  }

  /** Parse milestones/schematics */
  private parseMilestones(): MilestoneDefinition[] {
    const section = this.findNativeClass(this.nativeClasses, 'FGSchematic');
    if (!section) {
      console.warn('[DocsParser] FGSchematic section not found');
      return [];
    }

    // Filter only milestones (mType=EST_Milestone)
    const milestoneClasses = section.Classes.filter(
      cls => cls.mType === 'EST_Milestone'
    );

    return milestoneClasses.map(cls => {
      return {
        id: cls.ClassName,
        name: cls.mDisplayName || cls.ClassName,
        nameRu: this.getRuName('FGSchematic', cls.ClassName),
        tier: parseInt(cls.mTechTier || '0', 10),
        cost: parseIngredientList(cls.mCost || ''),
        timeToComplete: parseFloat(cls.mTimeToComplete || '0'),
        unlockedRecipes: [], // TODO: parse mUnlocks for recipes
        unlockedBuildings: [], // TODO: parse mUnlocks for buildings
        unlockedScanners: [],
      };
    });
  }

  /** Parse item descriptors */
  private parseItems(): Map<string, ItemData> {
    const items = new Map<string, ItemData>();

    // Gather from multiple NativeClass sections
    const itemSections = [
      'FGItemDescriptor',
      'FGResourceDescriptor',
      'FGItemDescriptorBiomass',
      'FGItemDescriptorNuclearFuel',
      'FGEquipmentDescriptor',
      'FGConsumableDescriptor',
      'FGAmmoTypeProjectile',
      'FGAmmoTypeInstantHit',
      'FGBuildingDescriptor',
    ];

    for (const sectionName of itemSections) {
      const section = this.findNativeClass(this.nativeClasses, sectionName);
      if (!section) continue;

      for (const cls of section.Classes) {
        items.set(cls.ClassName, {
          id: cls.ClassName,
          name: cls.mDisplayName || cls.ClassName,
          description: cls.mDescription || '',
          stackSize: cls.mStackSize || 'SS_MEDIUM',
          form: cls.mForm || 'RF_SOLID',
          energyValue: parseFloat(cls.mEnergyValue || '0'),
        });
      }
    }

    return items;
  }
}

/** Singleton game data store */
export class GameDataStore {
  private static instance: GameDataStore;
  private data: ParsedGameData | null = null;

  static getInstance(): GameDataStore {
    if (!GameDataStore.instance) {
      GameDataStore.instance = new GameDataStore();
    }
    return GameDataStore.instance;
  }

  async initialize(): Promise<void> {
    if (this.data) return;

    const parser = new DocsParser();
    this.data = await parser.load(
      '/recipe_data/en-GB.json',
      '/recipe_data/ru.json',
    );
  }

  getRecipes(): RecipeDefinition[] {
    return this.data?.recipes || [];
  }

  getMilestones(): MilestoneDefinition[] {
    return this.data?.milestones || [];
  }

  getItems(): Map<string, ItemData> {
    return this.data?.items || new Map();
  }

  getRecipeById(id: string): RecipeDefinition | undefined {
    return this.data?.recipes.find(r => r.id === id);
  }

  getRecipesForMachine(machineId: string): RecipeDefinition[] {
    return this.data?.recipes.filter(r => r.producedIn === machineId) || [];
  }

  getMilestoneById(id: string): MilestoneDefinition | undefined {
    return this.data?.milestones.find(m => m.id === id);
  }

  getMilestonesByTier(tier: number): MilestoneDefinition[] {
    return this.data?.milestones.filter(m => m.tier === tier) || [];
  }
}
