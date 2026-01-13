# @motioneffector/ecs

SQL-backed Entity Component System for persistent, queryable game entities.

## Purpose

Provide a lightweight ECS implementation that stores components in SQL tables via `@motioneffector/sql`. Entities are just IDs. Components are typed data bags. Systems query entities by component composition.

## Why SQL-Backed?

Most ECS libraries are in-memory only. This one:
- **Persists automatically** - Components live in SQLite tables
- **Queryable** - Use SQL for complex entity queries
- **Portable** - Entire game state in a single file
- **Debuggable** - Inspect state with any SQLite browser
- **Transactional** - ACID guarantees for state changes

## Core Concepts

### Entities
- Just unique IDs (integers or UUIDs)
- No data on the entity itself
- Created, destroyed, queried

### Components
- Typed data bags attached to entities
- Each component type = one SQL table
- Components define their own schema
- Entity can have 0 or 1 of each component type

### Queries
- Find entities by component composition
- "All entities with Position AND Velocity"
- "All entities with Health but NOT Dead"
- Returns entity IDs for system processing

## API Design

```typescript
import { createDatabase } from '@motioneffector/sql';
import { createECS, defineComponent } from '@motioneffector/ecs';

// Define components with their schemas
const Position = defineComponent('position', {
  x: 'number',
  y: 'number',
  room_id: 'string',
});

const Velocity = defineComponent('velocity', {
  dx: 'number',
  dy: 'number',
});

const Health = defineComponent('health', {
  current: 'number',
  max: 'number',
});

const Description = defineComponent('description', {
  short: 'string',
  long: 'string',
});

// Create ECS with database
const db = await createDatabase({ name: 'game' });
const ecs = createECS(db, [Position, Velocity, Health, Description]);

// Creates tables automatically via migrations
await ecs.initialize();

// Entity operations
const entity = ecs.createEntity();
const entity2 = ecs.createEntity('custom-id'); // Optional custom ID

// Component operations
ecs.addComponent(entity, Position, { x: 0, y: 0, room_id: 'start' });
ecs.addComponent(entity, Health, { current: 100, max: 100 });

const pos = ecs.getComponent(entity, Position);
// { x: 0, y: 0, room_id: 'start' }

ecs.updateComponent(entity, Position, { x: 5 }); // Partial update
ecs.removeComponent(entity, Position);

ecs.hasComponent(entity, Position); // boolean

// Queries
const movable = ecs.query([Position, Velocity]);
// Returns entity IDs that have BOTH components

const damaged = ecs.query([Health], (h) => h.current < h.max);
// With filter function

// Destroy entity (removes all components)
ecs.destroyEntity(entity);
```

## Component Definition

```typescript
type ComponentSchema = {
  [field: string]: FieldType;
};

type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'json';  // For complex nested data

const Inventory = defineComponent('inventory', {
  capacity: 'number',
  items: 'json',  // Stored as JSON text in SQLite
});

// Component definition includes:
// - Table name
// - Field types → SQL column types
// - Automatic entity_id foreign key
```

## SQL Schema Generation

Components become tables:

```sql
-- For Position component
CREATE TABLE component_position (
  entity_id TEXT PRIMARY KEY,
  x REAL NOT NULL,
  y REAL NOT NULL,
  room_id TEXT NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- For Health component
CREATE TABLE component_health (
  entity_id TEXT PRIMARY KEY,
  current REAL NOT NULL,
  max REAL NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- Entities table
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
```

## Query System

```typescript
// Simple query - all entities with these components
const results = ecs.query([Position, Velocity]);

// Query with filter
const lowHealth = ecs.query([Health], {
  filter: (health) => health.current < health.max * 0.5
});

// Query with component data included
const fullData = ecs.queryWithData([Position, Health]);
// Returns: { entityId, position: {...}, health: {...} }[]

// Exclude components
const alive = ecs.query([Health], {
  exclude: [Dead]  // Has Health but NOT Dead
});

// Raw SQL for complex queries
const nearby = ecs.rawQuery(`
  SELECT entity_id FROM component_position
  WHERE room_id = ? AND x BETWEEN ? AND ?
`, [roomId, x - 5, x + 5]);
```

## Batch Operations

```typescript
// Transaction for multiple operations
await ecs.transaction(async (tx) => {
  const e1 = tx.createEntity();
  const e2 = tx.createEntity();
  tx.addComponent(e1, Position, { x: 0, y: 0 });
  tx.addComponent(e2, Position, { x: 1, y: 1 });
  // All or nothing
});

// Bulk operations
ecs.addComponentBulk(entityIds, Health, { current: 100, max: 100 });
ecs.removeComponentBulk(entityIds, Velocity);
```

## Change Tracking

```typescript
// Subscribe to component changes
ecs.onComponentAdded(Position, (entityId, data) => {
  console.log(`Entity ${entityId} gained position:`, data);
});

ecs.onComponentRemoved(Health, (entityId) => {
  console.log(`Entity ${entityId} lost health component`);
});

ecs.onComponentUpdated(Position, (entityId, oldData, newData) => {
  console.log(`Entity ${entityId} moved from`, oldData, 'to', newData);
});

// Entity lifecycle
ecs.onEntityCreated((entityId) => { ... });
ecs.onEntityDestroyed((entityId) => { ... });
```

## Archetypes (Optional Optimization)

For frequently-used component combinations:

```typescript
// Define archetype
const Character = ecs.defineArchetype([
  Position,
  Health,
  Description,
  Inventory,
]);

// Create entity with all components at once
const npc = ecs.createFromArchetype(Character, {
  position: { x: 0, y: 0, room_id: 'town' },
  health: { current: 50, max: 50 },
  description: { short: 'A guard', long: 'A stern-looking guard.' },
  inventory: { capacity: 10, items: [] },
});
```

## Integration with @motioneffector/sql

```typescript
// ECS uses sql lib internally
const ecs = createECS(existingDatabase, components);

// Access underlying database if needed
const db = ecs.getDatabase();

// Export/import with project
const snapshot = await db.export();
```

## Dependencies

- `@motioneffector/sql` (peer dependency)
- Zero other runtime dependencies

## Use Cases

1. **Game development** - Any entity-based game
2. **Simulations** - Agent-based modeling
3. **Data modeling** - Flexible, composable records
4. **Prototyping** - Quick iteration on data structures

## Testing Strategy

- Unit tests for CRUD operations
- Query tests with various component combinations
- Transaction/rollback tests
- Performance tests with 10k+ entities
- Cascade delete tests
- Schema migration tests

## File Structure

```
src/
  index.ts           # Public exports
  ecs.ts             # Main createECS function
  entity.ts          # Entity operations
  component.ts       # Component definition and operations
  query.ts           # Query builder and executor
  schema.ts          # SQL schema generation
  events.ts          # Change tracking subscriptions
  archetype.ts       # Archetype definitions
  types.ts           # All type definitions
```

## Design Decisions

1. **Entity ID format**: UUID v7 (timestamp-sortable). Safe for future cloud sync and project merging.
2. **Soft delete**: No. Hard delete with CASCADE. Undo handled at application layer with command pattern.
3. **Versioning**: No. Single-user browser context doesn't need optimistic locking.
4. **Indexes**: Only entity_id (automatic via PK). Provide `addIndex(componentType, field)` helper for consumers who need more.
5. **Lazy loading**: Eager by default. All queried component data loaded immediately. Offer `queryIds()` for ID-only queries.
