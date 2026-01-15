# Working with Events

This guide shows you how to use the ECS event system to react to entity and component changes without polling.

## Prerequisites

Before starting, you should:

- [Understand what entities are](Concept-Entities)
- [Understand what components are](Concept-Components)

## Overview

We'll cover:

1. Subscribing to entity lifecycle events
2. Subscribing to component lifecycle events
3. Managing subscriptions properly
4. Handling errors in callbacks

## Step 1: Subscribe to Entity Events

Entity events fire when entities are created or destroyed, regardless of their components.

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position])
await ecs.initialize()

// Subscribe to entity creation
const unsubCreate = ecs.onEntityCreated((entityId) => {
  console.log(`Entity created: ${entityId}`)
})

// Subscribe to entity destruction
const unsubDestroy = ecs.onEntityDestroyed((entityId) => {
  console.log(`Entity destroyed: ${entityId}`)
})

// Test it
const entity = ecs.createEntity()  // logs: "Entity created: ..."
ecs.destroyEntity(entity)          // logs: "Entity destroyed: ..."
```

The callback receives the entity ID that was created or destroyed.

## Step 2: Subscribe to Component Events

Component events are specific to a component type. You subscribe to Health events separately from Position events.

```typescript
const Health = defineComponent('Health', { current: 'number', max: 'number' })

// When Health is added to any entity
ecs.onComponentAdded(Health, (entityId, data) => {
  console.log(`${entityId} gained health: ${data.current}/${data.max}`)
})

// When Health is updated on any entity
ecs.onComponentUpdated(Health, (entityId, oldData, newData) => {
  if (newData.current < oldData.current) {
    console.log(`${entityId} took ${oldData.current - newData.current} damage`)
  } else if (newData.current > oldData.current) {
    console.log(`${entityId} healed ${newData.current - oldData.current} HP`)
  }
})

// When Health is removed from any entity
ecs.onComponentRemoved(Health, (entityId) => {
  console.log(`${entityId} lost their Health component`)
})
```

Note: `onComponentAdded` and `onComponentUpdated` receive component data, but `onComponentRemoved` only receives the entity ID (the data is already gone).

## Step 3: Manage Subscriptions

Every subscription method returns an unsubscribe function. Call it when you no longer need notifications.

```typescript
// Store subscriptions for later cleanup
const subscriptions: Array<() => void> = []

function setupEventHandlers() {
  subscriptions.push(
    ecs.onEntityCreated((id) => {
      // Handle creation
    })
  )

  subscriptions.push(
    ecs.onComponentAdded(Health, (id, data) => {
      // Handle health added
    })
  )

  subscriptions.push(
    ecs.onComponentUpdated(Health, (id, old, current) => {
      // Handle health changed
    })
  )
}

function cleanupEventHandlers() {
  for (const unsubscribe of subscriptions) {
    unsubscribe()
  }
  subscriptions.length = 0
}

// Usage
setupEventHandlers()
// ... game runs ...
cleanupEventHandlers()  // When done
```

## Step 4: Handle Errors Gracefully

If your event handler throws an error, the ECS catches it and logs to console. Other handlers still run, and the operation that triggered the event still completes.

```typescript
// This handler throws
ecs.onEntityCreated(() => {
  throw new Error('Handler error!')
})

// This handler still runs
ecs.onEntityCreated((id) => {
  console.log(`Entity ${id} created successfully`)
})

// Both handlers are called, error is logged, entity is created
const entity = ecs.createEntity()
```

This prevents buggy event handlers from breaking your game, but you should still fix the underlying issue.

## Complete Example

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Health])
await ecs.initialize()

// Track all subscriptions
const subs: Array<() => void> = []

// Entity events
subs.push(ecs.onEntityCreated((id) => {
  console.log(`[EVENT] Entity created: ${id}`)
}))

subs.push(ecs.onEntityDestroyed((id) => {
  console.log(`[EVENT] Entity destroyed: ${id}`)
}))

// Health component events
subs.push(ecs.onComponentAdded(Health, (id, data) => {
  console.log(`[EVENT] ${id} now has ${data.current}/${data.max} HP`)
}))

subs.push(ecs.onComponentUpdated(Health, (id, old, current) => {
  const delta = current.current - old.current
  if (delta < 0) {
    console.log(`[EVENT] ${id} took ${-delta} damage (${current.current} HP remaining)`)
  }
}))

// Game logic
const player = ecs.createEntity('player')
ecs.addComponent(player, Position, { x: 0, y: 0 })
ecs.addComponent(player, Health, { current: 100, max: 100 })

// Simulate damage
ecs.updateComponent(player, Health, { current: 75 })
ecs.updateComponent(player, Health, { current: 50 })

// Cleanup
ecs.destroyEntity(player)
subs.forEach(unsub => unsub())
```

Output:
```
[EVENT] Entity created: player
[EVENT] player now has 100/100 HP
[EVENT] player took 25 damage (75 HP remaining)
[EVENT] player took 25 damage (50 HP remaining)
[EVENT] Entity destroyed: player
```

## Variations

### Event-Driven UI Updates

```typescript
// Update health bar when Health changes
ecs.onComponentUpdated(Health, (entityId, old, current) => {
  if (entityId === playerId) {
    updateHealthBar(current.current, current.max)
  }
})
```

### Spawning Effects on Death

```typescript
ecs.onEntityDestroyed((entityId) => {
  // Check if it was at a position (might have been destroyed for other reasons)
  const pos = ecs.getComponent(entityId, Position)
  if (pos) {
    spawnDeathEffect(pos.x, pos.y)
  }
})
```

### Logging for Debugging

```typescript
if (DEBUG_MODE) {
  ecs.onEntityCreated((id) => console.debug('Entity+', id))
  ecs.onEntityDestroyed((id) => console.debug('Entity-', id))
  ecs.onComponentAdded(Health, (id) => console.debug('Health+', id))
  ecs.onComponentRemoved(Health, (id) => console.debug('Health-', id))
}
```

## Troubleshooting

### Events Not Firing

**Symptom:** Your callback never gets called.

**Cause:** You subscribed after the action already happened, or subscribed to the wrong component.

**Solution:** Subscribe before performing actions. Double-check you're using the same component definition.

### Too Many Events

**Symptom:** Your callback fires too often, causing performance issues.

**Cause:** You're doing expensive work in the callback.

**Solution:** Queue events and process them in batches, or filter early in the callback.

### Memory Leaks

**Symptom:** Memory usage grows over time.

**Cause:** Subscriptions aren't being cleaned up.

**Solution:** Always store and call unsubscribe functions when done.

## See Also

- **[Events Concept](Concept-Events)** - Understanding the event system
- **[Events API](API-Events)** - Full method reference
- **[Entities](Concept-Entities)** - Entity lifecycle
- **[Components](Concept-Components)** - Component lifecycle
