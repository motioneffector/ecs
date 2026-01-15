# Entities

Entities are unique identifiers in the ECS. They have no data themselves - they're just IDs that components attach to. Think of an entity as a primary key in a database: it uniquely identifies a "thing" in your game, whether that's a player, enemy, item, or particle effect.

## How It Works

When you create an entity, you get back a string ID. That ID is then used to attach components, query for the entity, and eventually destroy it.

```
Entity: "player-1"
    │
    ├── Position { x: 100, y: 200 }
    ├── Health { current: 80, max: 100 }
    └── PlayerControlled { active: true }

Entity: "enemy-1"
    │
    ├── Position { x: 50, y: 75 }
    └── Health { current: 30, max: 30 }
```

The entity itself is just the ID. All the actual data lives in the components attached to it.

## Basic Usage

```typescript
// Create with auto-generated ID (UUIDv7)
const entity = ecs.createEntity()
// entity = "0190a5b7-1234-7abc-..."

// Create with custom ID
const player = ecs.createEntity('player-1')

// Check if entity exists by trying to add a component
// (will throw if entity doesn't exist)
ecs.addComponent(player, Position, { x: 0, y: 0 })

// Destroy entity (removes all its components too)
ecs.destroyEntity(player)
```

## Key Points

- **IDs are strings** - Either auto-generated UUIDv7 or custom strings you provide.

- **UUIDv7 is sortable** - Auto-generated IDs are time-sortable, so entities created earlier have lexicographically smaller IDs.

- **Empty entities are valid** - An entity can exist with zero components. It's just an ID until you add data.

- **Cascade delete** - Destroying an entity automatically removes all its components from their tables.

- **IDs must be unique** - Creating an entity with an ID that already exists throws an error.

## Examples

### Auto-generated IDs

```typescript
const e1 = ecs.createEntity()
const e2 = ecs.createEntity()
const e3 = ecs.createEntity()

// IDs are UUIDv7 format, sortable by creation time
// e1 < e2 < e3 (lexicographically)
```

### Custom IDs

```typescript
// Use meaningful IDs for important entities
const player = ecs.createEntity('player')
const mainCamera = ecs.createEntity('camera-main')

// Use prefixed IDs for categories
const enemy1 = ecs.createEntity('enemy-001')
const enemy2 = ecs.createEntity('enemy-002')
```

### Checking Entity Existence

```typescript
// Query returns empty array if entity doesn't exist or lacks components
const entities = ecs.query([Position])

// hasComponent returns false for non-existent entities
const hasPos = ecs.hasComponent('maybe-exists', Position)  // false if entity doesn't exist
```

### Entity Lifecycle

```typescript
// Create
const entity = ecs.createEntity()

// Add data
ecs.addComponent(entity, Position, { x: 0, y: 0 })
ecs.addComponent(entity, Health, { current: 100, max: 100 })

// Update data
ecs.updateComponent(entity, Position, { x: 50 })

// Remove specific component
ecs.removeComponent(entity, Health)

// Destroy entity entirely
const wasDestroyed = ecs.destroyEntity(entity)  // true
```

## Related

- **[Components](Concept-Components)** - Data that attaches to entities
- **[Queries](Concept-Queries)** - Finding entities by their components
- **[Events](Concept-Events)** - React to entity creation and destruction
- **[Entity API](API-Entities)** - createEntity(), destroyEntity() reference
