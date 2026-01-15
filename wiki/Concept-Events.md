# Events

Events let you react to changes in the ECS without polling. Subscribe to lifecycle events and your callbacks fire automatically when entities are created, destroyed, or when components are added, updated, or removed.

## How It Works

The ECS maintains lists of event handlers. When something happens (entity created, component added, etc.), it calls all registered handlers for that event type. You get an unsubscribe function to stop listening when you're done.

```
Entity Created
    │
    ▼
┌─────────────────────────┐
│ onEntityCreated handlers│
│ ├── spawn particles     │
│ ├── play sound          │
│ └── update UI           │
└─────────────────────────┘
```

## Basic Usage

```typescript
// Subscribe to entity creation
const unsubscribe = ecs.onEntityCreated((entityId) => {
  console.log(`Entity created: ${entityId}`)
})

// Create triggers the callback
const entity = ecs.createEntity()  // logs: "Entity created: ..."

// Stop listening
unsubscribe()
```

## Key Points

- **Five event types** - entityCreated, entityDestroyed, componentAdded, componentRemoved, componentUpdated

- **Component events are per-component** - Subscribe to Health changes separately from Position changes

- **Handlers receive data** - componentAdded receives the new data, componentUpdated receives old and new

- **Errors are isolated** - If your handler throws, it's logged but doesn't stop other handlers or corrupt state

- **Unsubscribe to clean up** - Always unsubscribe when you no longer need notifications (e.g., when a system is disabled)

## Examples

### Entity Lifecycle Events

```typescript
// When any entity is created
ecs.onEntityCreated((entityId) => {
  console.log(`New entity: ${entityId}`)
})

// When any entity is destroyed
ecs.onEntityDestroyed((entityId) => {
  console.log(`Entity gone: ${entityId}`)
})
```

### Component Events

```typescript
// When Health is added to an entity
ecs.onComponentAdded(Health, (entityId, data) => {
  console.log(`${entityId} now has ${data.current}/${data.max} HP`)
})

// When Health is updated
ecs.onComponentUpdated(Health, (entityId, oldData, newData) => {
  const damage = oldData.current - newData.current
  if (damage > 0) {
    console.log(`${entityId} took ${damage} damage`)
  }
})

// When Health is removed
ecs.onComponentRemoved(Health, (entityId) => {
  console.log(`${entityId} lost their Health component`)
})
```

### Managing Subscriptions

```typescript
// Store unsubscribe functions
const subscriptions: Array<() => void> = []

subscriptions.push(
  ecs.onEntityCreated((id) => { /* ... */ })
)
subscriptions.push(
  ecs.onComponentAdded(Health, (id, data) => { /* ... */ })
)

// Clean up all at once
function cleanup() {
  subscriptions.forEach(unsub => unsub())
  subscriptions.length = 0
}
```

### Error Handling

```typescript
// This handler throws, but other handlers still run
ecs.onEntityCreated(() => {
  throw new Error('Oops')
})

ecs.onEntityCreated((id) => {
  console.log('This still runs!')
})

ecs.createEntity()  // Both handlers called, error logged to console
```

## Related

- **[Working with Events](Guide-Working-with-Events)** - Detailed patterns and best practices
- **[Entities](Concept-Entities)** - What gets created and destroyed
- **[Components](Concept-Components)** - What gets added, updated, and removed
- **[Events API](API-Events)** - Full reference for all event methods
