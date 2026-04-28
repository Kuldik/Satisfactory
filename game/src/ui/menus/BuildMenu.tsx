// ============================================================
// BuildMenu — building selection menu (Q key) with subcategories
// ============================================================

import { useState, type FC } from 'react';
import { BuildingCategory } from '../../core/types.ts';
import { hasPattern } from '../../buildings/BuildingPatterns.ts';
import { hasPrefabBuilding } from '../../buildings/BuildingPrefabs.ts';
import { PIPE_PROCEDURAL_STRAIGHT_PATH } from '../../buildings/logistics/pipeKitModels.ts';
import './BuildMenu.css';

interface BuildMenuItem {
  id: string;
  name: string;
  nameRu: string;
  description: string;
  category: BuildingCategory;
  subcategory: string;
  modelPath?: string;
  iconPath?: string;
}

interface BuildMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBuilding: (buildingId: string) => void | Promise<void>;
}

// ---- ALL BUILDINGS organized by category + subcategory ----

const ALL_BUILDINGS: BuildMenuItem[] = [
  // ============ SPECIAL ============
  { id: 'hub', name: 'HUB', nameRu: 'ХАБ', category: BuildingCategory.Special, subcategory: 'Особые строения',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-a.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-a.png',
    description: 'Центральное здание вашей фабрики. Через ХАБ происходит разблокировка новых технологий посредством вехных заданий (Milestones). Имеет 6 входов для конвейерных лент для автоматической загрузки ресурсов.' },
  { id: 'space_elevator', name: 'Space Elevator', nameRu: 'Космический лифт', category: BuildingCategory.Special, subcategory: 'Особые строения',
    modelPath: '/kits/kenney_city-kit-commercial_2.1/Models/GLB format/low-detail-building-m.glb',
    iconPath: '/kits/kenney_city-kit-commercial_2.1/Previews/low-detail-building-m.png',
    description: 'Массивное сооружение, необходимое для глобальной прогрессии проекта. Доставка специальных деталей (Smart Plating, Versatile Framework и др.) открывает новые уровни технологий. Всего 5 фаз.' },
  { id: 'resource_sink', name: 'AWESOME Sink', nameRu: 'Утилизатор', category: BuildingCategory.Special, subcategory: 'Особые строения',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-o.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-o.png',
    description: 'Уничтожает любые предметы (кроме радиоактивных отходов) и начисляет за них купоны AWESOME Shop. Идеален для утилизации излишков производства. Потребляет 30 МВт.' },
  { id: 'detail_vertical_pipe', name: 'Vertical pipe stack', nameRu: 'Деталь: вертикальная труба', category: BuildingCategory.Special, subcategory: 'Детализация',
    description: 'Высокая вертикальная оболочка из скруглённых угловых бордюров. Для декора сцены.' },

  // ============ PRODUCTION ============
  // — Производство деталей —
  { id: 'constructor', name: 'Constructor', nameRu: 'Конструктор', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-p.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-p.png',
    description: 'Базовая производственная машина. Принимает 1 тип предмета на входе и производит 1 тип предмета на выходе. Используется для простых рецептов: железные пластины, провода, винты и др. Потребляет 4 МВт.' },
  { id: 'assembler', name: 'Assembler', nameRu: 'Сборщик', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-q.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-q.png',
    description: 'Комбинирует 2 типа предметов в один. Имеет 2 конвейерных входа и 1 выход. Производит промежуточные детали: усиленные пластины, роторы, модульные рамы и др. Потребляет 15 МВт.' },
  { id: 'manufacturer', name: 'Manufacturer', nameRu: 'Изготовитель', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-t.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-t.png',
    description: 'Продвинутая машина для сложных рецептов из 3-4 ингредиентов. Имеет 4 конвейерных входа и 1 выход. Производит компьютеры, тяжёлые модульные рамы, турбомоторы и др. Потребляет 55 МВт.' },
  { id: 'packager', name: 'Packager', nameRu: 'Упаковщик', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-r.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-r.png',
    description: 'Упаковывает жидкости/газы в канистры для транспортировки по конвейеру, или распаковывает обратно. 1 конвейерный вход/выход + 1 трубный вход/выход. Потребляет 10 МВт.' },
  { id: 'refinery', name: 'Refinery', nameRu: 'Очистительный завод', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-l.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-l.png',
    description: 'Перерабатывает нефть в пластик, резину, топливо; бокситы в алюминий; и др. 1 конвейерный и 1 трубный вход, 1 конвейерный и 1 трубный выход. Потребляет 30 МВт.' },
  { id: 'blender', name: 'Blender', nameRu: 'Смеситель', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-c.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-c.png',
    description: 'Смешивает твёрдые материалы с жидкостями/газами для создания продвинутых ресурсов. 2 конвейерных + 2 трубных входа, 1 конвейерный + 1 трубный выход. Потребляет 75 МВт.' },
  { id: 'particle_accelerator', name: 'Particle Accelerator', nameRu: 'Ускоритель частиц', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-g.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-g.png',
    description: 'Мощнейшая установка для производства ядерной пасты, плутониевых стержней и фиксония. 2 конвейерных входа + 1 трубный, 1 конвейерный выход. Потребление варьируется: 250–1500 МВт.' },
  { id: 'converter', name: 'Converter', nameRu: 'Преобразователь', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-e.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-e.png',
    description: 'Преобразует один материал в другой с использованием активированной СИМ и других ресурсов. 1 конвейерный и 1 трубный вход/выход. Потребляет 100 МВт.' },
  { id: 'quantum_encoder', name: 'Quantum Encoder', nameRu: 'Квантовый шифратор', category: BuildingCategory.Production, subcategory: 'Производство деталей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-f.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-f.png',
    description: 'Самая сложная и дорогая производственная машина в игре. Использует возбуждённую фотонную энергию из преобразователя для создания финальных компонентов. 1 конвейерный выход. Потребление: 0–2000 МВт.' },

  // — Добыча ресурсов —
  { id: 'miner_mk1', name: 'Miner Mk.1', nameRu: 'Буровая Ур.1', category: BuildingCategory.Production, subcategory: 'Добыча ресурсов',
    description: 'Базовая буровая установка. Устанавливается на ресурсном узле. Скорость: бедное — 30/мин, обычное — 60/мин, богатое — 120/мин. 1 конвейерный выход. Потребляет 5 МВт.' },
  { id: 'miner_mk2', name: 'Miner Mk.2', nameRu: 'Буровая Ур.2', category: BuildingCategory.Production, subcategory: 'Добыча ресурсов',
    description: 'Улучшенная буровая с удвоенной скоростью добычи. Бедное — 60/мин, обычное — 120/мин, богатое — 240/мин. 1 конвейерный выход. Потребляет 12 МВт.' },
  { id: 'miner_mk3', name: 'Miner Mk.3', nameRu: 'Буровая Ур.3', category: BuildingCategory.Production, subcategory: 'Добыча ресурсов',
    description: 'Максимальная буровая установка с утроенной скоростью. Бедное — 120/мин, обычное — 240/мин, богатое — 480/мин. 1 конвейерный выход. Потребляет 30 МВт.' },

  // — Экстракторы —
  { id: 'water_extractor', name: 'Water Extractor', nameRu: 'Экстрактор воды', category: BuildingCategory.Production, subcategory: 'Экстракторы',
    iconPath: '/kits/kenney_building-kit/Previews/gutter-vertical-top.png',
    description: 'Добывает воду из водоёмов и направляет её по трубам. Производит 120 м³/мин. 1 трубный выход. Потребляет 20 МВт.' },
  { id: 'oil_extractor', name: 'Oil Extractor', nameRu: 'Экстрактор нефти', category: BuildingCategory.Production, subcategory: 'Экстракторы',
    iconPath: '/kits/kenney_building-kit/Previews/gutter-vertical-top.png',
    description: 'Устанавливается на нефтяном узле для добычи сырой нефти. Производительность зависит от чистоты узла. 1 трубный выход. Потребляет 40 МВт.' },
  { id: 'pressure_booster', name: 'Resource Well Pressurizer', nameRu: 'Нагнетатель давления', category: BuildingCategory.Production, subcategory: 'Экстракторы',
    iconPath: '/kits/kenney_building-kit/Previews/gutter-vertical-top.png',
    description: 'Устанавливается на ресурсной скважине и создаёт давление для извлечения воды или азота. Активирует ближайшие точки добычи для установки экстракторов скважин. Потребляет 150 МВт.' },
  { id: 'well_extractor', name: 'Resource Well Extractor', nameRu: 'Экстрактор скважины', category: BuildingCategory.Production, subcategory: 'Экстракторы',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe-bend.png',
    description: 'Устанавливается на активированных скважинах вокруг нагнетателя давления. Извлекает воду или азот. 1 трубный выход. Потребляет 0 МВт (питается от нагнетателя).' },

  // — Переплавка —
  { id: 'smelter', name: 'Smelter', nameRu: 'Плавильня', category: BuildingCategory.Production, subcategory: 'Переплавка',
    iconPath: '/kits/kenney_space-station-kit/Previews/structure.png',
    description: 'Базовая плавильня для переплавки одного типа руды в слитки. Железная руда → железные слитки, медная руда → медные слитки и т.д. 1 вход, 1 выход. Потребляет 4 МВт.' },
  { id: 'foundry', name: 'Foundry', nameRu: 'Литейная', category: BuildingCategory.Production, subcategory: 'Переплавка',
    iconPath: '/kits/kenney_building-kit/Previews/plating-detailed-wide.png',
    description: 'Комбинирует 2 типа руды/слитков в сплав. Производит сталь (железо + уголь), алюминиевые слитки и др. 2 входа, 1 выход. Потребляет 16 МВт.' },

  // — Лесопилка —
  { id: 'sawmill', name: 'Sawmill', nameRu: 'Лесопилка', category: BuildingCategory.Production, subcategory: 'Автоматическая добыча',
    iconPath: '/kits/kenney_space-station-kit/Previews/structure.png',
    description: 'Уникальное строение, автоматически производящее древесину и траву — бесконечные ресурсы для биомассы. 2 конвейерных выхода: один для древесины, другой для травы. Потребляет 10 МВт.' },

  // ============ POWER ============
  // — Генераторы —
  { id: 'biomass_burner', name: 'Biomass Burner', nameRu: 'Сжигатель биомассы', category: BuildingCategory.Power, subcategory: 'Генераторы',
    iconPath: '/kits/kenney_space-station-kit/Previews/wall-door-wide-banner.png',
    description: 'Самый первый генератор. Сжигает древесину, листву, биомассу или твёрдое биотопливо для выработки энергии. 1 конвейерный вход. Вырабатывает 30 МВт.' },
  { id: 'coal_generator', name: 'Coal Generator', nameRu: 'Угольный генератор', category: BuildingCategory.Power, subcategory: 'Генераторы',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-n.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-n.png',
    description: 'Генератор на угле. Нагревает воду до пара для производства электричества. 1 конвейерный вход (уголь) + 1 трубный вход (вода). Вырабатывает 75 МВт.' },
  { id: 'fuel_generator', name: 'Fuel Generator', nameRu: 'Топливный генератор', category: BuildingCategory.Power, subcategory: 'Генераторы',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-m.glb',
    iconPath: '/kits/City Kit Industrial/Previews/building-m.png',
    description: 'Работает на жидком топливе (fuel), турботопливе или ракетном топливе, получаемом переработкой нефти. 1 трубный вход. Вырабатывает 250 МВт.' },
  { id: 'nuclear_power', name: 'Nuclear Power Plant', nameRu: 'Атомная электростанция', category: BuildingCategory.Power, subcategory: 'Генераторы',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/chimney-large.glb',
    iconPath: '/kits/City Kit Industrial/Previews/chimney-large.png',
    description: 'Колоссальная электростанция. Работает на урановых/плутониевых/фиксониевых стержнях + вода. Производит ядерные отходы (кроме фиксония). 1 вход ленты + 1 трубный + 1 выход отходов. Вырабатывает 2500 МВт.' },
  { id: 'alien_extractor', name: 'Alien Power Augmenter', nameRu: 'Экстрактор инопланетной энергии', category: BuildingCategory.Power, subcategory: 'Генераторы',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe-end-colored.png',
    description: 'Самый продвинутый источник энергии. Статически вырабатывает 500 МВт. Главный бонус: +30% ко всей мощности электросети, к которой подключён. Несколько экстракторов — каждый +30% от базовой мощности (без учёта других бонусов).' },
  { id: 'alien_energy_extractor', name: 'Alien Power Augmenter (model)', nameRu: 'Экстрактор инопланетной энергии (3D)', category: BuildingCategory.Power, subcategory: 'Генераторы',
    modelPath: '/kits/models/energy%20extractor.glb',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe-end-colored.png',
    description: 'Та же роль, что у экстрактора из набора деталей, но отдельная glb-модель (`energy extractor.glb`). Старый вариант в меню сохранён.' },

  // — Подача энергии —
  { id: 'power_pole_mk1', name: 'Power Pole Mk.1', nameRu: 'Электростолб Ур.1', category: BuildingCategory.Power, subcategory: 'Подача энергии',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe.png',
    description: 'Базовый электростолб. Позволяет подключить до 4 устройств (включая другие столбы). Дальность подключения — 50 м.' },
  { id: 'power_pole_mk2', name: 'Power Pole Mk.2', nameRu: 'Электростолб Ур.2', category: BuildingCategory.Power, subcategory: 'Подача энергии',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe-ring-colored.png',
    description: 'Улучшенный электростолб. Позволяет подключить до 7 устройств. Дальность подключения — 50 м.' },
  { id: 'power_pole_mk3', name: 'Power Pole Mk.3', nameRu: 'Электростолб Ур.3', category: BuildingCategory.Power, subcategory: 'Подача энергии',
    iconPath: '/kits/kenney_space-station-kit/Previews/pipe-end-colored.png',
    description: 'Максимальный электростолб. Позволяет подключить до 10 устройств. Дальность подключения — 50 м.' },
  { id: 'power_tower', name: 'Power Line Tower', nameRu: 'ЛЭП', category: BuildingCategory.Power, subcategory: 'Подача энергии',
    iconPath: '/kits/kenney_space-station-kit/Previews/structure-barrier-high.png',
    description: 'Линия электропередач. Передаёт энергию на большие расстояния. До 3 подключений к другим ЛЭП (дальность 150 м) + 4 подключения к обычным электростолбам.' },

  // — Накопление энергии —
  { id: 'power_storage', name: 'Power Storage', nameRu: 'Накопитель энергии', category: BuildingCategory.Power, subcategory: 'Накопление энергии',
    iconPath: '/kits/kenney_city-kit-commercial_2.1/Previews/low-detail-building-h.png',
    description: 'Накапливает излишки вырабатываемой энергии и отдаёт их при пиковых нагрузках. Предотвращает блэкаут при резких скачках потребления. Ёмкость: 100 МВт·ч.' },

  // ============ LOGISTICS ============
  // — Конвейеры (модели Kenney: game/src/buildings/logistics/conveyorKitModels.ts) —
  { id: 'conveyor_mk1', name: 'Conveyor Belt Mk.1', nameRu: 'Конвейер Ур.1', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Базовая конвейерная лента. Перемещает предметы по горизонтали со скоростью 60 предм./мин. Не требует электричества. R — переключение режима укладки (прямая / L-угол / кривая).' },
  { id: 'conveyor_mk2', name: 'Conveyor Belt Mk.2', nameRu: 'Конвейер Ур.2', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Улучшенная конвейерная лента. Скорость: 120 предм./мин. Не требует электричества.' },
  { id: 'conveyor_mk3', name: 'Conveyor Belt Mk.3', nameRu: 'Конвейер Ур.3', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Продвинутая конвейерная лента. Скорость: 270 предм./мин. Не требует электричества.' },
  { id: 'conveyor_mk4', name: 'Conveyor Belt Mk.4', nameRu: 'Конвейер Ур.4', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Высокоскоростная конвейерная лента. Скорость: 480 предм./мин. Не требует электричества.' },
  { id: 'conveyor_mk5', name: 'Conveyor Belt Mk.5', nameRu: 'Конвейер Ур.5', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Сверхскоростная конвейерная лента. Скорость: 780 предм./мин. Не требует электричества.' },
  { id: 'conveyor_mk6', name: 'Conveyor Belt Mk.6', nameRu: 'Конвейер Ур.6', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Максимальная конвейерная лента. Скорость: 1200 предм./мин. Не требует электричества.' },
  { id: 'throughput_monitor', name: 'Conveyor Ceiling Mount', nameRu: 'Монитор пропускной способности', category: BuildingCategory.Logistics, subcategory: 'Конвейеры',
    description: 'Устанавливается на конвейерную ленту. Замеряет поток предметов за минуту и отображает статистику. Не требует электричества. Чисто UI-элемент.' },

  // — Управление конвейерами —
  { id: 'splitter', name: 'Splitter', nameRu: 'Разветвитель', category: BuildingCategory.Logistics, subcategory: 'Управление конвейерами',
    modelPath: '/kits/models/splitter.glb',
    description: 'Разделяет поток одной конвейерной ленты на 2 или 3 выхода. Предметы распределяются равномерно. 1 вход, до 3 выходов.' },
  /* Позже: умный и программируемый разветвитель
  { id: 'smart_splitter', name: 'Smart Splitter', nameRu: 'Умный разветвитель', category: BuildingCategory.Logistics, subcategory: 'Управление конвейерами',
    description: '...' },
  { id: 'programmable_splitter', name: 'Programmable Splitter', nameRu: 'Программируемый разветвитель', category: BuildingCategory.Logistics, subcategory: 'Управление конвейерами',
    description: '...' },
  */
  { id: 'merger', name: 'Merger', nameRu: 'Соединитель', category: BuildingCategory.Logistics, subcategory: 'Управление конвейерами',
    modelPath: '/kits/models/connector.glb',
    description: 'Объединяет потоки 2-3 конвейерных лент в одну. До 3 входов, 1 выход. Предметы чередуются из каждого входа.' },

  // — Трубопроводы (орто 90°: процедурная труба + дуга; линия как у конвейера) —
  { id: 'pipe_mk1', name: 'Pipeline Mk.1', nameRu: 'Трубопровод Ур.1', category: BuildingCategory.Logistics, subcategory: 'Трубопроводы',
    modelPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
    description: 'Базовый трубопровод для транспортировки жидкостей и газов. Пропускная способность: 300 м³/мин. Не требует электричества.' },
  { id: 'pipe_mk2', name: 'Pipeline Mk.2', nameRu: 'Трубопровод Ур.2', category: BuildingCategory.Logistics, subcategory: 'Трубопроводы',
    modelPath: PIPE_PROCEDURAL_STRAIGHT_PATH,
    description: 'Улучшенный трубопровод с двойной пропускной способностью. 600 м³/мин. Не требует электричества.' },
  /* Позже: насосы и клапан
  { id: 'pump_mk1', ...
  { id: 'pump_mk2', ...
  { id: 'valve', ...
  */

  // — Железнодорожное сообщение —
  { id: 'railroad_track', name: 'Railway', nameRu: 'Ж/д пути', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Железнодорожные рельсы для прокладки маршрутов поездов. Поддерживают прямые, изогнутые участки, подъёмы и спуски.' },
  { id: 'train_station', name: 'Train Station', nameRu: 'Ж/д станция', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Платформа для остановки поездов. Позволяет загружать и выгружать предметы через конвейерные порты. Можно настраивать расписание.' },
  { id: 'train_signal', name: 'Block Signal', nameRu: 'Блок-сигнал', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Светофор для регулирования движения поездов. Делит путь на блок-секции для предотвращения столкновений.' },
  { id: 'train_path_signal', name: 'Path Signal', nameRu: 'Путевой сигнал', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Продвинутый светофор. Позволяет нескольким поездам одновременно использовать перекрёсток, если их маршруты не пересекаются.' },
  { id: 'locomotive', name: 'Electric Locomotive', nameRu: 'Электровоз', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Тяговый модуль поезда. Работает от электросети через рельсы. Каждый поезд требует минимум 1 локомотив. Потребляет 25 МВт.' },
  { id: 'freight_car', name: 'Freight Car', nameRu: 'Грузовой вагон', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Грузовой вагон для перевозки твёрдых предметов по железной дороге. Вместимость: 32 стака. Цепляется к локомотиву.' },
  { id: 'fluid_freight_car', name: 'Fluid Freight Car', nameRu: 'Цистерный вагон', category: BuildingCategory.Logistics, subcategory: 'Железнодорожное сообщение',
    description: 'Вагон-цистерна для перевозки жидкостей и газов по железной дороге. Вместимость: 2400 м³. Цепляется к локомотиву.' },

  // ============ ORGANIZATION ============
  // — Складирование предметов —
  { id: 'storage_small', name: 'Storage Container', nameRu: 'Складской контейнер', category: BuildingCategory.Organization, subcategory: 'Складирование предметов',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-s.glb',
    description: 'Хранит до 24 стаков предметов. 1 конвейерный вход и 1 выход. Отличный буфер между производственными цепочками.' },
  { id: 'storage_large', name: 'Industrial Storage Container', nameRu: 'Промышленный контейнер', category: BuildingCategory.Organization, subcategory: 'Складирование предметов',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/building-i.glb',
    description: 'Хранит до 48 стаков предметов. 2 конвейерных входа и 2 выхода. Удвоенная ёмкость для массового хранения.' },

  // — Хранение жидкостей —
  { id: 'fluid_buffer', name: 'Fluid Buffer', nameRu: 'Цистерна', category: BuildingCategory.Organization, subcategory: 'Хранение жидкостей',
    modelPath: '/kits/kenney_space-station-kit/Models/GLB format/container-tall.glb',
    description: 'Буфер для хранения жидкостей и газов. Вместимость: 400 м³. Имеет трубные порты для входа и выхода.' },
  { id: 'fluid_buffer_large', name: 'Industrial Fluid Buffer', nameRu: 'Промышленная цистерна', category: BuildingCategory.Organization, subcategory: 'Хранение жидкостей',
    modelPath: '/kits/City Kit Industrial/Models/GLB format/detail-tank.glb',
    description: 'Увеличенный буфер для жидкостей. Вместимость: 2400 м³. Для масштабных жидкостных сетей и резервного хранения.' },

  // — Модули склада —
  { id: 'loading_module', name: 'Loading Module', nameRu: 'Модуль загрузки', category: BuildingCategory.Organization, subcategory: 'Модули склада',
    modelPath: '/kits/models/module-in.glb',
    description: 'Принимает предметы с конвейера и автоматически загружает их на бесконечный склад игрока. 1 конвейерный вход. Без ограничений по скорости.' },
  { id: 'unloading_module', name: 'Unloading Module', nameRu: 'Модуль выгрузки', category: BuildingCategory.Organization, subcategory: 'Модули склада',
    modelPath: '/kits/models/module-out.glb',
    description: 'Выгружает выбранный тип предмета из бесконечного склада игрока на конвейер. 1 конвейерный выход. В модальном окне выбирается предмет из инвентаря.' },

  /* Позже: табличка
  { id: 'sign', name: 'Sign', nameRu: 'Табличка', ...
  */
];

const CATEGORY_INFO: Record<BuildingCategory, { icon: string; nameRu: string }> = {
  [BuildingCategory.Special]:       { icon: '⭐', nameRu: 'Особенное' },
  [BuildingCategory.Production]:    { icon: '⚙️', nameRu: 'Производство' },
  [BuildingCategory.Power]:         { icon: '⚡', nameRu: 'Энергетика' },
  [BuildingCategory.Logistics]:     { icon: '🔄', nameRu: 'Логистика' },
  [BuildingCategory.Organization]:  { icon: '📦', nameRu: 'Организация' },
};

/** Group buildings by subcategory */
function groupBySubcategory(buildings: BuildMenuItem[]): Map<string, BuildMenuItem[]> {
  const map = new Map<string, BuildMenuItem[]>();
  for (const b of buildings) {
    const list = map.get(b.subcategory) || [];
    list.push(b);
    map.set(b.subcategory, list);
  }
  return map;
}

export const BuildMenu: FC<BuildMenuProps> = ({ isOpen, onClose, onSelectBuilding }) => {
  const [selectedCategory, setSelectedCategory] = useState<BuildingCategory>(BuildingCategory.Special);
  const [hoveredItem, setHoveredItem] = useState<BuildMenuItem | null>(null);

  if (!isOpen) return null;

  const filteredBuildings = ALL_BUILDINGS.filter(b => b.category === selectedCategory);
  const grouped = groupBySubcategory(filteredBuildings);
  const isSpecial = selectedCategory === BuildingCategory.Special;

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

        {/* Center: Building list with subcategory headers */}
        <div className="build-menu-list">
          {Array.from(grouped.entries()).map(([subcategory, buildings]) => (
            <div key={subcategory} className="build-subcategory">
              <div className="subcategory-header">{subcategory}</div>
              <div className={`subcategory-grid ${isSpecial ? 'special-grid' : ''}`}>
                {buildings.map(building => (
                  <button
                    key={building.id}
                    className={`build-menu-item ${isSpecial ? 'build-menu-item-special' : ''}${hasPattern(building.id) || hasPrefabBuilding(building.id) ? ' has-pattern' : ''}`}
                    onClick={() => {
                      onSelectBuilding(building.id);
                      onClose();
                    }}
                    onMouseEnter={() => setHoveredItem(building)}
                    onMouseLeave={() => setHoveredItem(null)}
                  >
                    {building.iconPath ? (
                      <img className="item-icon-preview" src={building.iconPath} alt={building.nameRu} />
                    ) : (
                      <div className="item-icon">{isSpecial ? '🏛️' : '🏭'}</div>
                    )}
                    <div className="item-name">{building.nameRu}</div>
                    {(hasPattern(building.id) || hasPrefabBuilding(building.id)) && (
                      <div className="pattern-badge">3D</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Details */}
        <div className="build-menu-details">
          {hoveredItem ? (
            <>
              {hoveredItem.iconPath ? (
                <img className="detail-icon-preview" src={hoveredItem.iconPath} alt={hoveredItem.nameRu} />
              ) : (
                <div className="detail-icon">🏭</div>
              )}
              <h3>{hoveredItem.nameRu}</h3>
              <p className="detail-name-en">{hoveredItem.name}</p>
              {hoveredItem.modelPath && <p className="detail-name-en">Модель: {hoveredItem.modelPath}</p>}
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
