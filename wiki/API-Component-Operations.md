# Component Operations API

Functions for adding, reading, updating, and removing component data on entities.

---

## `ECS.addComponent()`

Adds a component with data to an entity. Each entity can have at most one instance of each component type.

**Signature:**

```typescript
addComponent<T extends ComponentSchema>(
  entityId: EntityId,
  component: ComponentDefinition<T>,
  data: InferComponentData<T>
): EntityId
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The entity to add the component to |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |
| `data` | `InferComponentData<T>` | Yes | The component data (must match schema) |

**Returns:** `EntityId` — The entity ID (for chaining).

**Example:**

```typescript
const entity = ecs.createEntity()

ecs.addComponent(entity, Position, { x: 100, y: 200 })
ecs.addComponent(entity, Health, { current: 80, max: 100 })
```

**Throws:**

- `ValidationError` — Entity does not exist
- `ValidationError` — Component not registered with ECS
- `ValidationError` — Entity already has this component
- `ValidationError` — Data missing required fields
- `ValidationError` — Data contains unknown fields
- `ValidationError` — Data field has wrong type

---

## `ECS.getComponent()`

Gets the component data for an entity, or null if the entity doesn't have the component.

**Signature:**

```typescript
getComponent<T extends ComponentSchema>(
  entityId: EntityId,
  component: ComponentDefinition<T>
): InferComponentData<T> | null
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The entity to get data from |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |

**Returns:** `InferComponentData<T> | null` — The component data, or null if not present.

**Example:**

```typescript
const pos = ecs.getComponent(entity, Position)
if (pos) {
  console.log(`Position: (${pos.x}, ${pos.y})`)
}

// Returns null for missing component
const health = ecs.getComponent(entity, Health)
// health = null (if not added)

// Returns null for non-existent entity
const data = ecs.getComponent('invalid-id', Position)
// data = null
```

---

## `ECS.updateComponent()`

Updates specific fields of a component. Only the fields provided are updated; others remain unchanged.

**Signature:**

```typescript
updateComponent<T extends ComponentSchema>(
  entityId: EntityId,
  component: ComponentDefinition<T>,
  data: Partial<InferComponentData<T>>
): EntityId
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The entity to update |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |
| `data` | `Partial<InferComponentData<T>>` | Yes | Fields to update |

**Returns:** `EntityId` — The entity ID (for chaining).

**Example:**

```typescript
// Update only x, leave y unchanged
ecs.updateComponent(entity, Position, { x: 150 })

// Update multiple fields
ecs.updateComponent(entity, Health, { current: 50, max: 120 })
```

**Throws:**

- `ValidationError` — Entity does not exist
- `ValidationError` — Entity does not have this component
- `ValidationError` — Data contains unknown fields
- `ValidationError` — Data field has wrong type

---

## `ECS.removeComponent()`

Removes a component from an entity. No-op if the entity doesn't have the component.

**Signature:**

```typescript
removeComponent<T extends ComponentSchema>(
  entityId: EntityId,
  component: ComponentDefinition<T>
): EntityId
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The entity to remove from |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |

**Returns:** `EntityId` — The entity ID (for chaining).

**Example:**

```typescript
ecs.removeComponent(entity, Health)

// Component is now gone
const health = ecs.getComponent(entity, Health)
// health = null
```

**Throws:**

- `ValidationError` — Entity does not exist

---

## `ECS.hasComponent()`

Checks if an entity has a specific component.

**Signature:**

```typescript
hasComponent<T extends ComponentSchema>(
  entityId: EntityId,
  component: ComponentDefinition<T>
): boolean
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityId` | `EntityId` | Yes | The entity to check |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |

**Returns:** `boolean` — `true` if entity has the component, `false` otherwise.

**Example:**

```typescript
if (ecs.hasComponent(entity, Health)) {
  const health = ecs.getComponent(entity, Health)!
  console.log(`HP: ${health.current}/${health.max}`)
}

// Returns false for non-existent entities
const has = ecs.hasComponent('invalid-id', Health)
// has = false
```

---

## `ECS.addComponentBulk()`

Adds the same component data to multiple entities in a single transaction.

**Signature:**

```typescript
addComponentBulk<T extends ComponentSchema>(
  entityIds: EntityId[],
  component: ComponentDefinition<T>,
  data: InferComponentData<T>
): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityIds` | `EntityId[]` | Yes | Array of entity IDs |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |
| `data` | `InferComponentData<T>` | Yes | Data to add to all entities |

**Returns:** `void`

**Example:**

```typescript
const enemies = [enemy1, enemy2, enemy3, enemy4]

// Add same health to all enemies
ecs.addComponentBulk(enemies, Health, { current: 50, max: 50 })
```

---

## `ECS.removeComponentBulk()`

Removes a component from multiple entities in a single transaction.

**Signature:**

```typescript
removeComponentBulk<T extends ComponentSchema>(
  entityIds: EntityId[],
  component: ComponentDefinition<T>
): void
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entityIds` | `EntityId[]` | Yes | Array of entity IDs |
| `component` | `ComponentDefinition<T>` | Yes | The component definition |

**Returns:** `void`

**Example:**

```typescript
const deadEnemies = [enemy1, enemy3]

// Remove health from dead enemies
ecs.removeComponentBulk(deadEnemies, Health)
```
