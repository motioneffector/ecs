# @motioneffector/ecs

A SQL-backed Entity Component System that brings database persistence, ACID guarantees, and powerful querying to game state management. Store your game entities in SQLite with automatic table generation, indexes, and transactions.

[![npm version](https://img.shields.io/npm/v/@motioneffector/ecs.svg)](https://www.npmjs.com/package/@motioneffector/ecs)
[![license](https://img.shields.io/npm/l/@motioneffector/ecs.svg)](https://github.com/motioneffector/ecs/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## Installation

```bash
npm install @motioneffector/ecs
```

## Quick Start

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

// Create your SQL database
const db = createDatabase(':memory:')

// Define component schemas
const Position = defineComponent('Position', {
  x: 'REAL',
  y: 'REAL'
})

const Health = defineComponent('Health', {
  current: 'INTEGER',
  max: 'INTEGER'
})

// Initialize ECS with your database
const ecs = createECS(db, [Position, Health])

// Create entities and add components
const player = ecs.createEntity('player-1')
ecs.addComponent(player, Position, { x: 100, y: 200 })
ecs.addComponent(player, Health, { current: 80, max: 100 })

// Query entities by components
const positioned = ecs.query([Position])
console.log(positioned) // ['player-1']

// Get component data
const pos = ecs.getComponent(player, Position)
console.log(pos) // { x: 100, y: 200 }
```

## Features

- **SQL-Backed Persistence** - All entities and components stored in SQL tables for automatic persistence
- **ACID Guarantees** - Full transaction support with automatic rollback on errors
- **Type-Safe** - Complete TypeScript definitions with type inference for component data
- **Powerful Queries** - Filter entities by components with custom predicates
- **Event System** - Subscribe to entity creation, component changes, and more
- **Automatic Indexing** - Optimize queries with field-level indexes
- **Archetype Support** - Pre-define entity templates for common patterns
- **Zero Runtime Dependencies** - Only peer dependency is @motioneffector/sql
- **Tree-Shakeable ESM Build** - Import only what you need

## API Reference

### `createECS(database, components, options?)`

Creates a new ECS instance with the given database and component definitions.

**Parameters:**
- `database` - A database instance from @motioneffector/sql
- `components` - Array of component definitions created with `defineComponent`
- `options` - Optional configuration object

**Returns:** `ECS` instance

**Example:**
```typescript
const ecs = createECS(db, [Position, Health])
```

### `defineComponent(name, schema)`

Defines a component type with its data schema.

**Parameters:**
- `name` - Unique name for the component
- `schema` - Object mapping field names to SQL types ('INTEGER', 'REAL', 'TEXT', 'BLOB')

**Returns:** `ComponentDefinition<T>` with full type inference

**Example:**
```typescript
const Velocity = defineComponent('Velocity', {
  dx: 'REAL',
  dy: 'REAL'
})
```

### `ecs.createEntity(id?)`

Creates a new entity with an optional custom ID.

**Parameters:**
- `id` - Optional custom entity ID (auto-generated if not provided)

**Returns:** `EntityId` (string)

**Example:**
```typescript
const entity = ecs.createEntity()
const player = ecs.createEntity('player-1')
```

### `ecs.destroyEntity(entityId)`

Destroys an entity and removes all its components.

**Parameters:**
- `entityId` - The ID of the entity to destroy

**Example:**
```typescript
ecs.destroyEntity('player-1')
```

### `ecs.addComponent(entityId, component, data)`

Adds a component to an entity with the given data.

**Parameters:**
- `entityId` - The entity to add the component to
- `component` - Component definition
- `data` - Component data matching the schema

**Example:**
```typescript
ecs.addComponent('player-1', Position, { x: 50, y: 100 })
```

### `ecs.removeComponent(entityId, component)`

Removes a component from an entity.

**Parameters:**
- `entityId` - The entity to remove the component from
- `component` - Component definition to remove

**Example:**
```typescript
ecs.removeComponent('player-1', Position)
```

### `ecs.getComponent(entityId, component)`

Retrieves component data for an entity.

**Parameters:**
- `entityId` - The entity to get data from
- `component` - Component definition

**Returns:** Component data object or `null` if not present

**Example:**
```typescript
const pos = ecs.getComponent('player-1', Position)
if (pos) {
  console.log(pos.x, pos.y)
}
```

### `ecs.updateComponent(entityId, component, updates)`

Updates component data with partial changes.

**Parameters:**
- `entityId` - The entity to update
- `component` - Component definition
- `updates` - Partial component data to merge

**Example:**
```typescript
ecs.updateComponent('player-1', Position, { x: 150 })
```

### `ecs.hasComponent(entityId, component)`

Checks if an entity has a specific component.

**Parameters:**
- `entityId` - The entity to check
- `component` - Component definition

**Returns:** `boolean`

**Example:**
```typescript
if (ecs.hasComponent('player-1', Health)) {
  // Entity has health
}
```

### `ecs.query(components, options?)`

Queries for entities that have all specified components.

**Parameters:**
- `components` - Array of component definitions
- `options` - Optional query options
  - `filter` - Predicate function to filter results
  - `exclude` - Array of components to exclude

**Returns:** Array of `EntityId`

**Example:**
```typescript
// Get all entities with Position and Health
const entities = ecs.query([Position, Health])

// Filter by component data
const lowHealth = ecs.query([Health], {
  filter: health => health.current < health.max * 0.3
})

// Exclude entities with certain components
const movableNonPlayers = ecs.query([Position], {
  exclude: [Player]
})
```

### `ecs.queryWithData(components, options?)`

Like `query()` but returns entity IDs with their component data.

**Parameters:**
- `components` - Array of component definitions
- `options` - Optional query options (same as `query`)

**Returns:** Array of objects with `entityId` and component data properties

**Example:**
```typescript
const results = ecs.queryWithData([Position, Health])
for (const entity of results) {
  console.log(entity.entityId, entity.Position, entity.Health)
}
```

### `ecs.createIndex(component, field)`

Creates a database index on a component field for faster queries.

**Parameters:**
- `component` - Component definition
- `field` - Field name to index

**Example:**
```typescript
ecs.createIndex(Health, 'current')
```

### `ecs.transaction(callback)`

Executes operations in a transaction with automatic rollback on error.

**Parameters:**
- `callback` - Function that performs database operations

**Returns:** The return value of the callback

**Example:**
```typescript
ecs.transaction(() => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  ecs.addComponent(entity, Health, { current: 100, max: 100 })
})
```

### Event Subscriptions

Subscribe to entity and component lifecycle events:

- `ecs.onEntityCreated(callback)` - Called when entities are created
- `ecs.onEntityDestroyed(callback)` - Called when entities are destroyed
- `ecs.onComponentAdded(callback)` - Called when components are added
- `ecs.onComponentRemoved(callback)` - Called when components are removed
- `ecs.onComponentUpdated(callback)` - Called when components are updated

All subscription methods return an unsubscribe function.

**Example:**
```typescript
const unsubscribe = ecs.onComponentUpdated((entityId, component, newData, oldData) => {
  console.log(`${component.name} updated on ${entityId}`)
})

// Later: stop listening
unsubscribe()
```

### Archetypes

Define reusable entity templates:

```typescript
const Player = ecs.defineArchetype('Player', [Position, Health, Name])

const player = ecs.createFromArchetype(Player, {
  Position: { x: 0, y: 0 },
  Health: { current: 100, max: 100 },
  Name: { value: 'Hero' }
})
```

## Error Handling

The library exports three error classes for specific error scenarios:

```typescript
import { ECSError, ValidationError, DatabaseError } from '@motioneffector/ecs'

try {
  ecs.addComponent(entityId, Position, { x: 'invalid' })
} catch (e) {
  if (e instanceof ValidationError) {
    console.error('Invalid component data:', e.message)
  } else if (e instanceof DatabaseError) {
    console.error('Database operation failed:', e.message)
  } else if (e instanceof ECSError) {
    console.error('ECS error:', e.message)
  }
}
```

## Demo

Try the interactive demo to explore all features in your browser:

[https://motioneffector.github.io/ecs/index.html](https://motioneffector.github.io/ecs/index.html)

## Browser Support

Works in all modern browsers that support ES2022+. For browser usage, you'll need a SQL database implementation like `@motioneffector/sql` with its WebAssembly SQLite backend.

For Node.js, use better-sqlite3 or similar through the @motioneffector/sql adapter.

## License

MIT © [motioneffector](https://github.com/motioneffector)
