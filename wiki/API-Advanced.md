# Advanced API

Functions for transactions, archetypes, and indexes.

---

## `ECS.transaction()`

Executes multiple operations atomically. If any operation fails, all changes roll back.

**Signature:**

```typescript
transaction<T>(callback: TransactionCallback<T>): Promise<T>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `callback` | `TransactionCallback<T>` | Yes | Async function that performs operations |

**Returns:** `Promise<T>` — The value returned from the callback.

**Example:**

```typescript
// Basic transaction
await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  ecs.addComponent(entity, Health, { current: 100, max: 100 })
})

// With return value
const newId = await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  return entity
})

// Automatic rollback on error
try {
  await ecs.transaction(async (ecs) => {
    ecs.createEntity('test')
    throw new Error('Oops')  // Entity creation rolled back
  })
} catch (e) {
  // Entity 'test' does not exist
}
```

---

## `ECS.defineArchetype()`

Defines an archetype (entity template) from a set of components.

**Signature:**

```typescript
defineArchetype(
  components: readonly ComponentDefinition[]
): ArchetypeDefinition
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `components` | `ComponentDefinition[]` | Yes | Components that make up the archetype |

**Returns:** `ArchetypeDefinition` — The archetype definition.

**Example:**

```typescript
const CharacterArchetype = ecs.defineArchetype([
  Position,
  Health,
  Velocity
])
```

**Throws:**

- `ValidationError` — Component not registered with ECS

---

## `ECS.createFromArchetype()`

Creates an entity with all components defined in an archetype.

**Signature:**

```typescript
createFromArchetype<T extends readonly ComponentDefinition[]>(
  archetype: ArchetypeDefinition,
  data: ArchetypeData<T>
): EntityId
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `archetype` | `ArchetypeDefinition` | Yes | The archetype to instantiate |
| `data` | `ArchetypeData<T>` | Yes | Data for each component, keyed by name |

**Returns:** `EntityId` — The created entity ID.

**Example:**

```typescript
const CharacterArchetype = ecs.defineArchetype([Position, Health, Velocity])

const player = ecs.createFromArchetype(CharacterArchetype, {
  Position: { x: 100, y: 100 },
  Health: { current: 100, max: 100 },
  Velocity: { vx: 0, vy: 0 }
})

// player now has all three components
```

**Throws:**

- `ValidationError` — Missing data for a component in the archetype

---

## `ECS.addIndex()`

Adds a database index on a component field to speed up queries.

**Signature:**

```typescript
addIndex<T extends ComponentSchema>(
  component: ComponentDefinition<T>,
  field: keyof InferComponentData<T>
): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `component` | `ComponentDefinition<T>` | Yes | Component to index |
| `field` | `keyof InferComponentData<T>` | Yes | Field name to index |

**Returns:** `void`

**Example:**

```typescript
// Index frequently-queried fields
ecs.addIndex(Position, 'x')
ecs.addIndex(Position, 'y')
ecs.addIndex(Team, 'name')

// Queries filtering on these fields will be faster
const enemies = ecs.rawQuery(
  `SELECT entity_id FROM "component_Team" WHERE name = ?`,
  ['enemy']
)
```

**Throws:**

- `ValidationError` — Component not registered with ECS
- `ValidationError` — Field does not exist in component schema
- `DatabaseError` — Index creation fails

---

## Types

### `TransactionCallback<T>`

```typescript
type TransactionCallback<T> = (ecs: ECS) => T | Promise<T>
```

Function passed to `transaction()`. Receives the ECS instance and can return a value.

### `ArchetypeDefinition`

```typescript
interface ArchetypeDefinition {
  readonly components: readonly ComponentDefinition[]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `components` | `ComponentDefinition[]` | The components in this archetype |

### `ArchetypeData<T>`

```typescript
type ArchetypeData<T extends readonly ComponentDefinition[]> = {
  [K in T[number]['name']]: InferComponentData<Extract<T[number], { name: K }>['schema']>
}
```

Object providing data for each component in an archetype, keyed by component name.

```typescript
// For archetype with Position and Health:
{
  Position: { x: 0, y: 0 },
  Health: { current: 100, max: 100 }
}
```
