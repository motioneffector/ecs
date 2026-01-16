# Entities API

Functions for creating and destroying entities.

---

## `ECS.createEntity()`

Creates a new entity with an auto-generated or custom ID.

**Signature:**

```typescript
createEntity(customId?: EntityId): EntityId
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `customId` | `EntityId` | No | Custom string ID. If omitted, generates UUIDv7. |

**Returns:** `EntityId` — The ID of the created entity.

**Example:**

```typescript
// Auto-generated ID (UUIDv7)
const entity1 = ecs.createEntity()
// entity1 = "0190a5b7-1234-7abc-8def-..."

// Custom ID
const player = ecs.createEntity('player-1')
// player = "player-1"
```

**Throws:**

- `ValidationError` — Custom ID is empty or whitespace-only
- `ValidationError` — Entity with custom ID already exists

---

## `ECS.destroyEntity()`

Destroys an entity and all its components. Components are removed via CASCADE delete.

**Signature:**

```typescript
destroyEntity(entityId: EntityId): boolean
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The ID of the entity to destroy |

**Returns:** `boolean` — `true` if the entity existed and was destroyed, `false` if it didn't exist.

**Example:**

```typescript
const entity = ecs.createEntity()
ecs.addComponent(entity, Position, { x: 0, y: 0 })

const destroyed = ecs.destroyEntity(entity)
// destroyed = true

// Components are also removed
const pos = ecs.getComponent(entity, Position)
// pos = null

// Destroying non-existent entity
const result = ecs.destroyEntity('does-not-exist')
// result = false
```

---

## Types

### `EntityId`

```typescript
type EntityId = string
```

Entity identifiers are strings. Auto-generated IDs use UUIDv7 format, which is:
- Time-sortable (earlier entities have lexicographically smaller IDs)
- Globally unique
- 36 characters with hyphens: `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`

Custom IDs can be any non-empty string.
