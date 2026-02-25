// ============================================================
// BuildMenu — building selection menu (Q key)
// ============================================================

import { useState, type FC } from 'react';
import { BuildingCategory } from '../../core/types.ts';
import './BuildMenu.css';

interface BuildMenuItem {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  category: BuildingCategory;
  iconPath?: string;
}

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBuilding: (buildingId: string) => void;
}

// Temporary placeholder buildings for demo
const DEMO_BUILDINGS: BuildMenuItem[] = [
  // Special
  { id: 'hub', name: 'HUB', nameRu: 'ХАБ', description: 'Центральное здание прогрессии', category: BuildingCategory.Special },
  { id: 'space_elevator', name: 'Space Elevator', nameRu: 'Космический лифт', description: 'Продвигает фазы прогрессии', category: BuildingCategory.Special },
  { id: 'resource_sink', name: 'Resource Sink', nameRu: 'Утилизатор', description: 'Утилизирует излишки за билеты', category: BuildingCategory.Special },
  // Production
  { id: 'constructor', name: 'Constructor', nameRu: 'Конструктор', description: '1 вход → 1 выход', category: BuildingCategory.Production },
  { id: 'assembler', name: 'Assembler', nameRu: 'Сборщик', description: '2 входа → 1 выход', category: BuildingCategory.Production },
  { id: 'manufacturer', name: 'Manufacturer', nameRu: 'Изготовитель', description: '4 входа → 1 выход', category: BuildingCategory.Production },
  { id: 'smelter', name: 'Smelter', nameRu: 'Плавильня', description: 'Переплавка руды в слитки', category: BuildingCategory.Production },
  { id: 'foundry', name: 'Foundry', nameRu: 'Литейная', description: '2 руды → сплав', category: BuildingCategory.Production },
  { id: 'refinery', name: 'Refinery', nameRu: 'Очистительный завод', description: 'Переработка нефти/бокситов', category: BuildingCategory.Production },
  { id: 'blender', name: 'Blender', nameRu: 'Смеситель', description: 'Смешивание твёрдых и жидкостей', category: BuildingCategory.Production },
  { id: 'particle_accelerator', name: 'Particle Accelerator', nameRu: 'Ускоритель частиц', description: 'Ускорение твёрдых + жидкости', category: BuildingCategory.Production },
  { id: 'converter', name: 'Converter', nameRu: 'Преобразователь', description: 'Преобразование предметов', category: BuildingCategory.Production },
  { id: 'quantum_encoder', name: 'Quantum Encoder', nameRu: 'Квантовый шифратор', description: 'Самая сложная машина', category: BuildingCategory.Production },
  { id: 'packager', name: 'Packager', nameRu: 'Упаковщик', description: 'Упаковка жидкостей в баллоны', category: BuildingCategory.Production },
  { id: 'miner_mk1', name: 'Miner Mk.1', nameRu: 'Буровая Ур.1', description: 'Базовая добыча руды', category: BuildingCategory.Production },
  { id: 'miner_mk2', name: 'Miner Mk.2', nameRu: 'Буровая Ур.2', description: 'Улучшенная добыча руды', category: BuildingCategory.Production },
  { id: 'miner_mk3', name: 'Miner Mk.3', nameRu: 'Буровая Ур.3', description: 'Максимальная добыча руды', category: BuildingCategory.Production },
  { id: 'water_extractor', name: 'Water Extractor', nameRu: 'Экстрактор воды', description: 'Добыча воды', category: BuildingCategory.Production },
  { id: 'oil_extractor', name: 'Oil Extractor', nameRu: 'Экстрактор нефти', description: 'Добыча нефти', category: BuildingCategory.Production },
  { id: 'sawmill', name: 'Sawmill', nameRu: 'Лесопилка', description: 'Производит древесину и траву', category: BuildingCategory.Production },
  // Power
  { id: 'biomass_burner', name: 'Biomass Burner', nameRu: 'Сжигатель биомассы', description: 'Базовый генератор', category: BuildingCategory.Power },
  { id: 'coal_generator', name: 'Coal Generator', nameRu: 'Угольный генератор', description: 'Уголь + вода → энергия', category: BuildingCategory.Power },
  { id: 'fuel_generator', name: 'Fuel Generator', nameRu: 'Топливный генератор', description: 'Топливо → энергия', category: BuildingCategory.Power },
  { id: 'nuclear_power', name: 'Nuclear Power Plant', nameRu: 'Атомная электростанция', description: 'Стержни + вода → мощная энергия', category: BuildingCategory.Power },
  { id: 'alien_extractor', name: 'Alien Energy Extractor', nameRu: 'Экстрактор инопланетной энергии', description: '500 МВт + 30% бонус сети', category: BuildingCategory.Power },
  { id: 'power_pole_mk1', name: 'Power Pole Mk.1', nameRu: 'Электростолб Ур.1', description: '4 подключения, 50м', category: BuildingCategory.Power },
  { id: 'power_pole_mk2', name: 'Power Pole Mk.2', nameRu: 'Электростолб Ур.2', description: '7 подключений, 50м', category: BuildingCategory.Power },
  { id: 'power_pole_mk3', name: 'Power Pole Mk.3', nameRu: 'Электростолб Ур.3', description: '10 подключений, 50м', category: BuildingCategory.Power },
  { id: 'power_tower', name: 'Power Line Tower', nameRu: 'ЛЭП', description: '3 ЛЭП + 4 столба, 150м', category: BuildingCategory.Power },
  { id: 'power_storage', name: 'Power Storage', nameRu: 'Накопитель энергии', description: 'Хранит излишки энергии', category: BuildingCategory.Power },
  // Logistics
  { id: 'conveyor_mk1', name: 'Conveyor Mk.1', nameRu: 'Конвейер Ур.1', description: '60 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_mk2', name: 'Conveyor Mk.2', nameRu: 'Конвейер Ур.2', description: '120 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_mk3', name: 'Conveyor Mk.3', nameRu: 'Конвейер Ур.3', description: '270 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_mk4', name: 'Conveyor Mk.4', nameRu: 'Конвейер Ур.4', description: '480 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_mk5', name: 'Conveyor Mk.5', nameRu: 'Конвейер Ур.5', description: '780 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_mk6', name: 'Conveyor Mk.6', nameRu: 'Конвейер Ур.6', description: '1200 предм./мин', category: BuildingCategory.Logistics },
  { id: 'conveyor_lift', name: 'Conveyor Lift', nameRu: 'Конвейерный лифт', description: 'Вертикальная транспортировка', category: BuildingCategory.Logistics },
  { id: 'splitter', name: 'Splitter', nameRu: 'Разветвитель', description: '1 вход → 2-3 выхода', category: BuildingCategory.Logistics },
  { id: 'smart_splitter', name: 'Smart Splitter', nameRu: 'Умный разветвитель', description: 'Фильтрация по типу', category: BuildingCategory.Logistics },
  { id: 'programmable_splitter', name: 'Programmable Splitter', nameRu: 'Программируемый разветвитель', description: 'Списки предметов на выход', category: BuildingCategory.Logistics },
  { id: 'merger', name: 'Merger', nameRu: 'Соединитель', description: '2-3 входа → 1 выход', category: BuildingCategory.Logistics },
  { id: 'pipe_mk1', name: 'Pipeline Mk.1', nameRu: 'Трубопровод Ур.1', description: '300 м³/мин', category: BuildingCategory.Logistics },
  { id: 'pipe_mk2', name: 'Pipeline Mk.2', nameRu: 'Трубопровод Ур.2', description: '600 м³/мин', category: BuildingCategory.Logistics },
  { id: 'pipe_junction', name: 'Pipe Junction', nameRu: 'Пересечение труб', description: 'Соединение нескольких труб', category: BuildingCategory.Logistics },
  { id: 'pump_mk1', name: 'Pump Mk.1', nameRu: 'Насос Ур.1', description: 'Подъём 20м', category: BuildingCategory.Logistics },
  { id: 'pump_mk2', name: 'Pump Mk.2', nameRu: 'Насос Ур.2', description: 'Подъём 50м', category: BuildingCategory.Logistics },
  { id: 'valve', name: 'Pipeline Valve', nameRu: 'Клапан трубопровода', description: 'Ограничение потока', category: BuildingCategory.Logistics },
  { id: 'throughput_monitor', name: 'Throughput Monitor', nameRu: 'Монитор пропускной способности', description: 'Замер потока предметов', category: BuildingCategory.Logistics },
  { id: 'train_station', name: 'Train Station', nameRu: 'Ж/д станция', description: 'Станция для поездов', category: BuildingCategory.Logistics },
  { id: 'locomotive', name: 'Locomotive', nameRu: 'Электровоз', description: 'Тяга поезда', category: BuildingCategory.Logistics },
  // Organization
  { id: 'storage_small', name: 'Storage Container', nameRu: 'Складской контейнер', description: '24 ячейки, 1 вход / 1 выход', category: BuildingCategory.Organization },
  { id: 'storage_large', name: 'Industrial Container', nameRu: 'Промышленный контейнер', description: '48 ячеек, 2 входа / 2 выхода', category: BuildingCategory.Organization },
  { id: 'fluid_buffer', name: 'Fluid Buffer', nameRu: 'Цистерна', description: '400 м³', category: BuildingCategory.Organization },
  { id: 'fluid_buffer_large', name: 'Industrial Fluid Buffer', nameRu: 'Промышленная цистерна', description: '2400 м³', category: BuildingCategory.Organization },
  { id: 'loading_module', name: 'Loading Module', nameRu: 'Модуль загрузки', description: 'Загрузка на склад', category: BuildingCategory.Organization },
  { id: 'unloading_module', name: 'Unloading Module', nameRu: 'Модуль выгрузки', description: 'Выгрузка со склада', category: BuildingCategory.Organization },
  { id: 'sign', name: 'Sign', nameRu: 'Табличка', description: 'Табличка с текстом и иконкой', category: BuildingCategory.Organization },
];

const CATEGORY_INFO: Record<BuildingCategory, { icon: string; nameRu: string }> = {
  [BuildingCategory.Special]:       { icon: '⭐', nameRu: 'Особенное' },
  [BuildingCategory.Production]:    { icon: '⚙️', nameRu: 'Производство' },
  [BuildingCategory.Power]:         { icon: '⚡', nameRu: 'Энергетика' },
  [BuildingCategory.Logistics]:     { icon: '🔄', nameRu: 'Логистика' },
  [BuildingCategory.Organization]:  { icon: '📦', nameRu: 'Организация' },
};

export const BuildMenu: FC<BuildMenuProps> = ({ isOpen, onClose, onSelectBuilding }) => {
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory>(BuildingCategory.Special);
  const [hoveredItem, setHoveredItem] = useState<BuildMenuItem | null>(null);

  if (!isOpen) return null;

  const filteredBuildings = DEMO_BUILDINGS.filter(b => b.category === selectedCategory);

  return (
    <div className="build-menu-overlay" onClick={onClose}>
      <div className="build-menu" onClick={e => e.stopPropagation()}>
        {/* Left: Categories */}
        <div className="build-menu-categories">
          <div className="build-menu-title">Строительство</div>
          {Object.entries(CATEGORY_INFO).map(([cat, info]) => (
            <button
              key={cat}
              className={`build-menu-cat-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat as BuildingCategory)}
            >
              <span className="cat-icon">{info.icon}</span>
              <span className="cat-name">{info.nameRu}</span>
            </button>
          ))}
        </div>

        {/* Center: Building list */}
        <div className="build-menu-list">
          {filteredBuildings.map(building => (
            <button
              key={building.id}
              className="build-menu-item"
              onClick={() => {
                onSelectBuilding(building.id);
                onClose();
              }}
              onMouseEnter={() => setHoveredItem(building)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <div className="item-icon">🏭</div>
              <div className="item-name">{building.nameRu}</div>
            </button>
          ))}
        </div>

        {/* Right: Details */}
        <div className="build-menu-details">
          {hoveredItem ? (
            <>
              <div className="detail-icon">🏭</div>
              <h3>{hoveredItem.nameRu}</h3>
              <p className="detail-name-en">{hoveredItem.name}</p>
              <p className="detail-desc">{hoveredItem.description}</p>
            </>
          ) : (
            <p className="detail-hint">Наведите на строение для подробностей</p>
          )}
        </div>
      </div>
    </div>
  );
};
