# PROJECT_CONTEXT — карта проекта для агента

> Единый контекст-файл для ИИ-агентов (аналог индекса CodeGraph). Цель: дать
> агенту полную картину архитектуры, доменов, файлов и активной работы **за один
> файл**, чтобы не переоткрывать по 20 файлов на каждую задачу.
>
> Поддерживай этот файл при крупных изменениях. Дизайн-видение — в
> `PROJECT_PLAN.md`, история — в `CHANGELOG.md`, направление — в `ROADMAP.md`.
> Последняя сверка с кодом: **2026-06-04** (HEAD `e0d5377` + незакоммиченная работа по рельсам).

---

## 0. TL;DR — что это сейчас по факту

- **Браузерный factory-builder** (вдохновлён Satisfactory) на React + Three.js.
- **Симуляция запущена (фаза 1).** `Engine.tick()` гоняет ECS-мир через
  `SimulationManager` (`game/src/sim/`): майнеры добывают руду в **глобальный
  склад**, плавильня перерабатывает руду в слитки, генераторы дают энергию,
  при дефиците мощности — **блэкаут** (производство стоит). Поток предметов —
  напрямую через глобальный склад, **без конвейеров** (упрощение фазы 1).
  Конвейерная передача, отдельные энергосети, рецепты из `Docs.json` — ещё впереди.
- Что реально работает: 3D-сцена, орбитальная камера + WASD, сетка/этажи,
  меню строительства (Q), постановка зданий (одиночные GLB и JSON-паттерны),
  процедурные **конвейеры** и **трубы**, **железная дорога** (в активной разработке),
  **подвижной состав** поездов, **снос** (одиночный + удержание для композитов),
  **dev-конструктор** (admin-панель), светлая/тёмная тема, автосейв-каркас.
- **Доступ**: `IS_DEV = true` в `App.tsx` → admin-панель и снос доступны всем
  (временно, для прода). Вернуть на `import.meta.env.DEV !== false` когда не нужно.
- **Деплой**: Vercel, `vercel.json` в корне; `prebuild` симлинкует `kits/` в
  `game/public/kits`. Билд = `vite build` (без `tsc -b`).

---

## 1. Стек и запуск

- **Front**: React 19, TypeScript, Vite 6.
- **3D**: Three.js (GLTFLoader, OBJLoader; модели из `kits/`).
- **ECS**: самодостаточная типизированная модель в `sim/SimulationManager` (сущности +
  компоненты + системы). **bitECS 0.4 в рантайме НЕ используется**: его `core`-экспорт —
  новый API без `defineComponent/Types/defineQuery`, а `bitecs/legacy` в дистрибутиве
  отсутствует; старый `core/ecs/*` под классический API при импорте падал (`defineComponent`
  is undefined) → чёрный экран. Поэтому sim не зависит от bitECS.
- **Данные**: парсер `Docs.json` (экспорт Satisfactory) — рецепты/предметы.
- **Сохранения**: IndexedDB, ротация 5 слотов + checksum (каркас).

Запуск (PowerShell, Windows):
```
cd game
npm install
npm run dev        # vite dev server
npm run build      # prebuild (симлинк kits) + vite build
npx tsc --noEmit   # проверка типов (в build НЕ входит)
```
Ассеты `kits/` лежат в корне репо (вне `game/`); dev-сервер и `prebuild`
прокидывают их в `/kits/...`. `vite.config.ts` обслуживает `/kits` в dev.

---

## 2. Поток данных (архитектура)

```
index.html → main.tsx → <App/>
  App.tsx (React-стейт + обработчики мыши/канваса)
    └ хуки: useGameEngine, useBuilderKeyboard, useThemeHotkey,
            useAdminPanelHotkey, useDeconstructCompositeHold,
            useWindowShortcutGuards
    └ UI: HUD, BuildMenu, AdminPanel, оверлеи
        │  (вызывает методы Engine)
        ▼
  Engine  ← «фасад» движка; ВСЯ игровая логика идёт через него
    ├ loop(): requestAnimationFrame → tick() (фикс. 30 tps) + render() (каждый кадр)
    ├ tick(): SimulationManager.update(dt, snapshot) + троттл-нотификация sim-сводки в UI
    ├ SimulationManager ← ECS-мир (bitECS): синк со снапшотом зданий → энергия → производство
    ├ SceneManager   ← 3D-сцена, призраки, постановка, снос, билдеры линий; реестр зданий + снапшот
    ├ InputManager   ← клавиши/мышь → методы Engine
    ├ GridManager    ← чанки/ячейки (логическая сетка; к постановке слабо привязана)
    └ SaveManager    ← IndexedDB, 5 слотов; хранит игровое состояние (глобальный склад, gameTime)
```

**Принцип**: состояние → односторонний поток. Ввод → `InputManager`/`App` →
`Engine` → меняет `GameState` → `notifyStateChange` → React перерисовывает UI.
3D-мир живёт в `SceneManager`, React только накладывает HUD/меню поверх `<canvas>`.

**Важно**: `SceneManager` — большой бог-объект (постановка, призраки, снос,
билдеры конвейеров/труб/рельс, палитры, тема). Логика билдеров вынесена в
`render/builder/*`, модели китов — в `buildings/logistics/*KitModels.ts`.

---

## 3. Карта файлов (graph: файл → ответственность)

### Корень / точка входа
- `game/src/main.tsx` — монтирует `<App/>`.
- `game/src/App.tsx` — корневой компонент: React-стейт, обработчики мыши канваса
  (move/down/up/contextmenu), композиция хуков и UI. `IS_DEV` здесь.
- `game/vite.config.ts` — алиасы (`@core`, `@render`, …), раздача `/kits` в dev.

### Ядро — `core/`
- `core/Engine.ts` — фасад движка, game loop, публичный API для UI/билдеров.
  **`tick()` пуст** — точка интеграции симуляции.
- `core/types.ts` — все типы: `GridPosition`, `GameMode`, `GameState`,
  `BuilderMode` (`single|default|chord|curve|free`),
  `RailroadPlacementSubMode` (`straight|corner`), `BuildingDefinition`,
  `RecipeDefinition`, `MilestoneDefinition`, `SaveData`, `SavedEntity`.
- `core/constants.ts` — `GRID_CELL_SIZE=2`, `CHUNK_SIZE=32`, `TICK_RATE=30`,
  `AUTOSAVE_INTERVAL=10мин`, `CAMERA`, `ORE_COLORS`, кейбинды.
- `core/grid/GridManager.ts` — чанки 32×32, ячейки по Y-уровням.
- `core/save/SaveManager.ts` — IndexedDB, 5 слотов, checksum.
- `core/ecs/components.ts`, `core/ecs/world.ts` — **мёртвый** код (классический
  bitECS API). НЕ импортировать из живого графа: при исполнении падает
  (`defineComponent` undefined в bitECS 0.4). Симуляция их не использует.
- `core/commands/Command.ts` — паттерн команд (задел undo/redo).

### Рендер — `render/`
- `render/SceneManager.ts` — **центральный** (огромный): сцена, свет, земля,
  призраки (одиночный/префаб/паттерн), постановка, снос (одиночный/композит/
  мультиселект), билдеры линий, применение тем/палитр. Точка входа для большинства
  правок по постановке/сносу/рельсам.
- `render/CameraController.ts` — орбитальная камера + WASD (скорость растёт с зумом),
  плавный lerp; pan по Shift+ЛКМ, вращение ПКМ/СКМ, зум колесом.
- `render/GridRenderer.ts` — линии сетки на текущем этаже.
- `render/AssetLoader.ts` — кэш-загрузка GLB/OBJ.
- `render/ModelGallery.ts` — галерея всех моделей китов (dev-просмотр).
- `render/builderModelPath.ts` — резолв путей моделей.
- `render/buildingMaterialPalettes.ts` — перекраска префабов по теме. Тема-зависимы
  только: `alien_energy_extractor`, `loading_module`, `unloading_module`,
  `train_station` (свет = синий `0x1f5f96`, тьма = белый `0xf2f2f2`). Также фикс.
  палитры для `splitter/merger`, `pipe_mk1/2`.
- `render/builder/` — вынесенная логика билдеров линий:
  - `builderGhostSnapping.ts` — снап призрака к концам линий (рельсы/конвейеры/трубы).
  - `builderAxisLinePlacement.ts` — постановка по оси.
  - `conveyorPathSegments.ts` — сегменты конвейерной цепи.
  - `pipePathSegments.ts`, `pipeFreeCurve.ts`, `proceduralPipeGeometry.ts` — трубы
    (сегменты, свободная кривая, процедурная геометрия трубки).
  - `railroadPathSegments.ts` — прямые цепи рельс + один зеркальный угол (см. §7).

### UI — `ui/`
- `ui/hud/HUD.tsx` — верхняя/нижняя панель; индикатор режима, для рельс показывает
  «Прямая/Колено · geoN» (сейчас **geo8**).
- `ui/hud/DeconstructHoldOverlay.tsx` — круг-прогресс удержания сноса композита.
- `ui/hud/PatternGhostLoadOverlay.tsx` — спиннер загрузки паттерна/префаба.
- `ui/menus/BuildMenu.tsx` — меню Q: категории → подкатегории → список → превью.
  Описания зданий, `iconPath`, бейдж паттернов.
- `ui/menus/train/RollingStockModelPicker.tsx` — выбор варианта локомотива/вагона/
  цистерны (см. §6 — желаемый UX «клик = выбор, галочка = по умолчанию»).
- `ui/admin/AdminPanel.tsx` — dev-конструктор: части китов по категориям, линия/точка,
  масштаб, экспорт/импорт композиции, снос.
- `ui/admin/builderPartTypes.ts`, `ui/admin/spaceStationKitParts.ts` — каталоги частей
  конструктора (building-kit + space-station-kit, 11 категорий «Космос · …»).
- `ui/themeSync.ts` — `SceneThemeMode` (`light|dark`), синхронизация темы со сценой.

### Хуки — `hooks/`
- `useGameEngine.ts` — создаёт `Engine`, биндит canvas, прокидывает `onStateChange`.
- `useBuilderKeyboard.ts` — R (поворот), T (режим/прямая↔колено), Esc, снос-тоггл,
  масштаб, переключение `RailroadPlacementSubMode`.
- `useDeconstructCompositeHold.ts` — удержание ЛКМ для сноса композита (анимация).
- `useAdminPanelHotkey.ts` — тильда `` ` `` открывает admin.
- `useThemeHotkey.ts` — переключение светлой/тёмной темы.
- `useWindowShortcutGuards.ts` — гасит залипание клавиш/контекстное меню (фикс бага
  «зажат W + ПКМ → залипает движение»).

### Здания / контент — `buildings/`
- `buildings/BuildingPatterns.ts` — реестр **JSON-паттернов** (композитные постройки,
  ставятся целиком одним `compositeId`). См. §5.
- `buildings/BuildingPrefabs.ts` — реестр **одиночных GLB** (id → модель + scale). §5.
- `buildings/BuildingPorts.ts` — порты зданий (входы/выходы).
- `buildings/logistics/conveyorKitModels.ts` — GLB лент mk1–mk6.
- `buildings/logistics/conveyorFitScale.ts` — подгон масштаба ленты (до ~6 м).
- `buildings/logistics/pipeKitModels.ts` — модели труб (прямая/угол/процедурная).
- `buildings/logistics/railroadKitModels.ts` — пути и геом-константы рельс (OBJ):
  длина прямой, плечи угла, оффсет внутреннего угла L (см. §7).
- `buildings/*/**.json` — паттерны: майнеры mk1–3, вода/нефть/нагнетатель/скважина,
  плавильня/литейная/лесопилка, биогенератор, инопланетный, столбы/ЛЭП, детали.

### Поезда — `train/`
- `train/trainRollingStockCatalog.ts` — каталоги вариантов: 12 локомотивов,
  ~12 грузовых, цистерны (модели Kenney Train Kit).
- `train/rollingStockDefaults.ts` — выбранные «по умолчанию» варианты.

### Симуляция — `sim/` (АКТИВНА в тике, фаза 1)
- `sim/buildingCatalog.ts` — **единственный источник правды симуляции**:
  `menuBuildingId → BuildingSimSpec` (kind miner/producer/generator, powerMW,
  generationMW, inputs/outputs в предметах/мин). + `simItemName()` для UI.
- `sim/SimulationManager.ts` — держит ECS-модель (Map `compositeId → SimEntity`,
  самодостаточно, без bitECS); каждый тик:
  `syncWorld(snapshot)` (спавн/деспавн сущностей по `compositeId`), `computePower`
  (одна общая сеть, gen vs cons, блэкаут при дефиците), `runProduction` (вход/выход
  через глобальный склад, троттлинг по доступности входов). Сериализация склада+времени.
- Мост: `SceneManager.getPlacedBuildingSnapshot()` отдаёт логические здания
  (`compositeId, buildingId, xyz`) из реестра `placedBuildings` (заполняется в
  `placePattern`, прунится по выжившим частям, персистится в builder-state).

### Данные / прежние системы (НЕ активны; кандидаты на интеграцию/удаление)
- `data/parser/DocsParser.ts` — парсинг `Docs.json` (рецепты/предметы). Пока sim
  использует свой мини-каталог, не `Docs.json`.
- `systems/production/ProductionSystem.ts`, `systems/power/PowerGridSystem.ts`,
  `systems/progression/ProgressionSystem.ts`, `systems/storage/InventorySystem.ts`
  — **старые заготовки, к тику НЕ подключены** (актуальная логика — в `sim/`).
  В `ProductionSystem.ts` есть дубль метода `getBuffer` — не использовать как есть.
- `world/ChunkGenerator.ts` — генерация чанков (задел).

---

## 4. Управление (горячие клавиши)

- **Камера**: WASD — перемещение; ПКМ/СКМ — вращение; Shift+ЛКМ — pan; колесо — зум.
- **Q** — меню строительства. **B** — инвентарь (заглушка, только `console.log`).
- **`` ` ``** (тильда, dev) — admin-конструктор.
- **R** — поворот призрака / направление (рельсы: сторона колена).
- **T** — цикл `BuilderMode` / у рельс переключение Прямая↔Колено.
- **ЛКМ** — поставить; **ПКМ** — отмена линии/призрака.
- **Alt** — модификатор (снос-режим / прямая труба).
- **Снос**: тоггл (кнопка/клавиша), для композитов — **удержание ЛКМ** (круг-прогресс),
  есть мультиселект.

---

## 5. Две системы постановки зданий

1. **Префаб (одиночный GLB)** — `BuildingPrefabs.ts`. id → `{modelPath, scale}`.
   Призрак через `setPrefabBuildingGhost`. Для лент/труб/рельс включается билдер
   линий (`default`-режим). Пример: `constructor`, `hub`, `conveyor_mk1`, `pipe_mk1`,
   `train_station`, `locomotive`.
2. **Паттерн (JSON-композиция)** — `BuildingPatterns.ts`. Набор частей
   (`partName`, `position`, `rotationY`, `scale`). Ставится целиком, один `compositeId`
   → сносится как единое целое (удержанием). Пример: `miner_mk1..3`, `water_extractor`,
   `oil_extractor`, `pressure_booster`, `well_extractor`, `smelter`, `foundry`,
   `sawmill`, `biomass_burner`, `alien_extractor`, `power_pole_mk1..3`, `power_tower`.

**Конвенция путей в JSON-паттернах**: `partName` = **полный путь** к модели
(`/kits/.../model.glb`) — иначе движок берёт модель из building-kit по умолчанию,
и при совпадении имён (например `floor.glb` есть и в building-kit, и в
space-station-kit) сборка «едет». Это уже было источником бага у плавильни.

Создание новых паттернов: пользователь собирает в admin-конструкторе → экспорт JSON
(там только имена файлов) → агент подставляет полные пути по kit'ам → кладёт `*.json`
в `buildings/<категория>/` → регистрирует в `BuildingPatterns.ts` (`raw`) → добавляет
`iconPath` в `BuildMenu.tsx`.

---

## 6. Поезда / подвижной состав

- 3 вида: `locomotive`, `freight_car`, `fluid_freight_car`; у каждого список вариантов
  (`trainRollingStockCatalog.ts`), «по умолчанию» в `rollingStockDefaults.ts`.
- Желаемый UX пикера (`RollingStockModelPicker.tsx`): **клик по варианту = выбрать
  его сейчас**; **галочка = сделать вариантом по умолчанию** (иконка уезжает в основное
  меню, чекбокс сверху; снять чекбокс → снова открывается список). Фон пикера должен
  подчиняться теме (была проблема прозрачного/нечитабельного фона).
- Известные проблемы поездов (из истории): размер рельс/поездов мелковат относительно
  построек; стыковка вагонов (зазор между 1-м и 2-м вагоном после локомотива);
  поезд не «прилипает» к рельсам при постановке.

---

## 7. Железная дорога — активная зона, главные баги (geo8)

**Файлы**: `render/builder/railroadPathSegments.ts`,
`buildings/logistics/railroadKitModels.ts`, снап в `builderGhostSnapping.ts`,
постановка/якоря в `SceneManager.ts`, индикатор в `HUD.tsx`.

**Модели (OBJ, Kenney Train Kit)**:
- `railroad-straight.obj` — длина по Z = `RAILROAD_STRAIGHT_LENGTH_UNITS = 4`.
- `railroad-corner-large.obj` — внутренний угол L в (0,0,0); входящее плечо вдоль +Z
  до z≈4.487 (`ENTRY_LEG=4.48727`), исходящее вдоль −X до x≈−4 (`EXIT_LEG=4`);
  оффсет внутреннего угла от центра bbox `INNER_OFFSET={x:1.7565, z:-2.2435}`.

**Архитектура постановки**: два под-режима (`RailroadPlacementSubMode`):
`straight` (цепь прямых вдоль tangent, R — реверс направления) и `corner` (один
зеркальный угол, R — сторона зеркала). Снап — к **exit-концам** уже поставленных
сегментов; держится `railroadPlacedChainTip` (кончик цепи после прямой) с
приоритетом, lock якоря/`incomingRotY` — по точке exit, чтобы R и снап не сбрасывались
при движении мыши (это была причина «поворот работает долю секунды»).

**Остаточные/известные проблемы (статус на HEAD + uncommitted, geo8)**:
- Колено не всегда исходит строго из крайней ячейки прямой; визуальный overlap
  колена назад (~1 сегмент) из-за `entryLeg (≈31 м после scale) > длины прямой`.
- Прямая, начатая «с конца колена», иногда выходит из конца прямой, а не из exit угла.
- Реверс/зеркало колена при R: сторона иногда уходит вбок, зависит от плоскости/камеры.
- T у рельс может «задваивать» режим прямой.
- Размер рельс не согласован с поездами.

**Подход к правкам рельс**: менять геометрию/якоря только в `railroadPathSegments.ts`
и снап в `builderGhostSnapping.ts`; держать инвариант «exit предыдущего = anchor
следующего». В HUD бампать тег `geoN`, чтобы пользователь визуально подтверждал, что
правка доехала (был частый ложный вывод «изменений нет» из-за кэша/не того dev-сервера).

---

## 8. Темы (свет/тьма)

- `useThemeHotkey` → `themeSync` → `SceneManager` + `buildingMaterialPalettes`.
- Перекрашиваются **только вручную собранные/безтекстурные** префабы из
  `THEME_PALETTE_BUILDINGS`. Тёмная → белый, светлая → тёмно-синий. Не трогать общие
  текстурированные модели китов (была регрессия «всё стало чёрным»).

---

## 9. Сохранения и симуляция — состояние и оставшиеся ловушки

**Что есть:**
- **Визуальный мир** персистится в `localStorage` (`persistBuilderState`/
  `restoreBuilderState`) на каждое размещение — переживает рефреш. Туда же входит
  реестр логических зданий (`buildings`).
- **Игровое состояние** (глобальный склад + `gameTime`) пишется в `SaveData` через
  `SaveManager` (IndexedDB, 5 слотов, checksum), грузится на старте
  (`Engine.loadPersisted()` из `useGameEngine`). Автосейв раз в 10 мин.
- **Симуляция фазы 1** реально считается в тике (см. §3 `sim/`): добыча, переплавка,
  энергобаланс, блэкаут; HUD показывает энергию и склад.

**Чего пока нет (ловушки):**
- Между автосейвами (10 мин) склад на рефреше теряется и **перенакапливается заново**
  работающими зданиями — это ок для фазы 1, но при желании добавить save на `unload`.
- `SaveData.entities` всё ещё `[]` — ECS-сущности не сериализуются поштучно (не нужно:
  они детерминированно пересоздаются из снапшота визуального мира).
- Нет конвейерной передачи (поток идёт через глобальный склад), отдельных энергосетей,
  рецептов из `Docs.json`, бонуса инопланетного экстрактора, чистоты/типа узла под майнером.
- Инвентарь по кнопке **B** — всё ещё заглушка (склад показан только в HUD-панели).
- `getPlacedBuildingSnapshot()` вызывается каждый тик (O(n) по частям) — при больших
  фабриках вынести в инвалидацию по изменению размещения.

---

## 10. План (приоритезировано)

Активное (продолжать сейчас):
1. **Рельсы geo8+**: стабилизировать колено (anchor = конец прямой, без overlap),
   корректный R-реверс независимо от камеры, прямая из exit угла, фикс T-задвоения,
   согласовать размер рельс с поездами.
2. **Поезда**: пикер (клик/галочка + фон по теме), стыковка вагонов без зазора,
   прилипание состава к рельсам.

Сделано (фаза 1 симуляции, этот заход):
- [x] ECS подключён к `Engine.tick()` (`sim/SimulationManager`, фикс. порядок систем).
- [x] Спавн ECS-сущностей из размещённых зданий (мост через снапшот `compositeId`).
- [x] Минимальный производственный цикл (майнер → руда; плавильня руда → слиток).
- [x] Энергия: генерация/потребление, блэкаут при дефиците, индикация в HUD.
- [x] Сериализация игрового состояния (склад/время) в `SaveData` + загрузка на старте.

Среднесрочное (продолжение этапов 1–3):
3. Расширить каталог `sim/buildingCatalog.ts` (конструктор/сборщик/генераторы на
   топливе, очистка нефти и т.д.) и подтянуть рецепты из `Docs.json`.
4. Чистота/тип ресурсного узла под майнером (сейчас фикс. железо ×2).
5. Конвейеры: передача предметов между зданиями по тику (вместо глобального склада).
6. Отдельные энергосети (столбы/ЛЭП/дальность) вместо одной общей; бонус APA +30%.

Гигиена:
7. Разгрузка `SceneManager` (god-object) — продолжать выносить в `render/builder/*`.
8. Инвалидация снапшота по изменению размещения (не каждый тик).
9. Удалить/переписать старые `systems/*` (заменены `sim/`), убрать дубль в `ProductionSystem`.
10. Вернуть `IS_DEV` в прод-режим, когда конструктор не нужен публично.

---

## 11. Конвенции

- Комментарии — только про неочевидное «почему», без построчного нарратива.
- Точечные правки, не переписывать неупомянутое.
- Билд НЕ гоняет `tsc` — проверяй типы отдельно (`npx tsc --noEmit`).
- Не плодить дубли паттернов; полные пути моделей в JSON обязательны.
- PowerShell-среда: нет `head/cat/grep` в shell — использовать Read/Grep/Glob.
- Документы живут с кодом: крупное решение — заметка в `ROADMAP.md`/этом файле.
