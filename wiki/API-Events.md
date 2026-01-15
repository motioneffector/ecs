# Events API

Functions for subscribing to entity and component lifecycle events.

---

## `ECS.onEntityCreated()`

Subscribe to entity creation events. Callback fires after each entity is created.

**Signature:**

```typescript
onEntityCreated(callback: EntityCreatedCallback): UnsubscribeFunction
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `callback` | `EntityCreatedCallback` | Yes | Function called with the new entity ID |

**Returns:** `UnsubscribeFunction` — Call to stop receiving events.

**Example:**

```typescript
const unsubscribe = ecs.onEntityCreated((entityId) => {
  console.log(`Entity created: ${entityId}`)
})

ecs.createEntity()  // Triggers callback

unsubscribe()  // Stop listening
```

---

## `ECS.onEntityDestroyed()`

Subscribe to entity destruction events. Callback fires after each entity is destroyed.

**Signature:**

```typescript
onEntityDestroyed(callback: EntityDestroyedCallback): UnsubscribeFunction
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `callback` | `EntityDestroyedCallback` | Yes | Function called with the destroyed entity ID |

**Returns:** `UnsubscribeFunction` — Call to stop receiving events.

**Example:**

```typescript
const unsubscribe = ecs.onEntityDestroyed((entityId) => {
  console.log(`Entity destroyed: ${entityId}`)
})

ecs.destroyEntity(entity)  // Triggers callback

unsubscribe()
```

---

## `ECS.onComponentAdded()`

Subscribe to component addition events for a specific component type.

**Signature:**

```typescript
onComponentAdded<T extends ComponentSchema>(
  component: ComponentDefinition<T>,
  callback: ComponentAddedCallback<T>
): UnsubscribeFunction
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `component` | `ComponentDefinition<T>` | Yes | Component type to watch |
| `callback` | `ComponentAddedCallback<T>` | Yes | Function called with entity ID and component data |

**Returns:** `UnsubscribeFunction` — Call to stop receiving events.

**Example:**

```typescript
const unsubscribe = ecs.onComponentAdded(Health, (entityId, data) => {
  console.log(`${entityId} now has ${data.current}/${data.max} HP`)
})

ecs.addComponent(entity, Health, { current: 100, max: 100 })
// Logs: "entity-id now has 100/100 HP"

unsubscribe()
```

---

## `ECS.onComponentRemoved()`

Subscribe to component removal events for a specific component type.

**Signature:**

```typescript
onComponentRemoved<T extends ComponentSchema>(
  component: ComponentDefinition<T>,
  callback: ComponentRemovedCallback
): UnsubscribeFunction
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `component` | `ComponentDefinition<T>` | Yes | Component type to watch |
| `callback` | `ComponentRemovedCallback` | Yes | Function called with entity ID |

**Returns:** `UnsubscribeFunction` — Call to stop receiving events.

**Example:**

```typescript
const unsubscribe = ecs.onComponentRemoved(Health, (entityId) => {
  console.log(`${entityId} lost their Health component`)
})

ecs.removeComponent(entity, Health)
// Logs: "entity-id lost their Health component"

unsubscribe()
```

Note: The callback only receives the entity ID, not the removed data (it's already gone).

---

## `ECS.onComponentUpdated()`

Subscribe to component update events for a specific component type.

**Signature:**

```typescript
onComponentUpdated<T extends ComponentSchema>(
  component: ComponentDefinition<T>,
  callback: ComponentUpdatedCallback<T>
): UnsubscribeFunction
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `component` | `ComponentDefinition<T>` | Yes | Component type to watch |
| `callback` | `ComponentUpdatedCallback<T>` | Yes | Function called with entity ID, old data, and new data |

**Returns:** `UnsubscribeFunction` — Call to stop receiving events.

**Example:**

```typescript
const unsubscribe = ecs.onComponentUpdated(Health, (entityId, oldData, newData) => {
  const delta = newData.current - oldData.current
  if (delta < 0) {
    console.log(`${entityId} took ${-delta} damage`)
  } else if (delta > 0) {
    console.log(`${entityId} healed ${delta} HP`)
  }
})

ecs.updateComponent(entity, Health, { current: 75 })
// Logs: "entity-id took 25 damage" (if was at 100)

unsubscribe()
```

---

## Types

### `EntityCreatedCallback`

```typescript
type EntityCreatedCallback = (entityId: EntityId) => void
```

### `EntityDestroyedCallback`

```typescript
type EntityDestroyedCallback = (entityId: EntityId) => void
```

### `ComponentAddedCallback<T>`

```typescript
type ComponentAddedCallback<T extends ComponentSchema> = (
  entityId: EntityId,
  data: InferComponentData<T>
) => void
```

### `ComponentRemovedCallback`

```typescript
type ComponentRemovedCallback = (entityId: EntityId) => void
```

### `ComponentUpdatedCallback<T>`

```typescript
type ComponentUpdatedCallback<T extends ComponentSchema> = (
  entityId: EntityId,
  oldData: InferComponentData<T>,
  newData: InferComponentData<T>
) => void
```

### `UnsubscribeFunction`

```typescript
type UnsubscribeFunction = () => void
```

Call this function to stop receiving events. Safe to call multiple times.
