# Using Transactions

This guide shows you how to use transactions for atomic multi-step operations that either fully succeed or fully roll back.

## Prerequisites

Before starting, you should:

- [Complete Your First ECS](Your-First-ECS)
- [Understand basic component operations](Concept-Components)

## Overview

We'll cover:

1. Basic transaction usage
2. Atomic entity creation
3. Multi-entity updates
4. Handling rollbacks
5. Returning values from transactions

## Step 1: Basic Transaction Usage

Wrap multiple operations in a transaction callback. If any operation fails, all changes roll back.

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Health])
await ecs.initialize()

// All operations inside succeed or fail together
await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  ecs.addComponent(entity, Health, { current: 100, max: 100 })
})
```

## Step 2: Atomic Entity Creation

Ensure an entity is fully set up or not created at all:

```typescript
async function createPlayer(name: string) {
  return await ecs.transaction(async (ecs) => {
    const player = ecs.createEntity(`player-${name}`)

    // If any of these fail, the entity is also rolled back
    ecs.addComponent(player, Position, { x: 0, y: 0 })
    ecs.addComponent(player, Health, { current: 100, max: 100 })
    ecs.addComponent(player, Inventory, { capacity: 20, items: [] })
    ecs.addComponent(player, PlayerName, { name })

    return player
  })
}

// Usage
const playerId = await createPlayer('Alice')
```

This prevents "orphan" entities that exist but lack required components.

## Step 3: Multi-Entity Updates

Transfer resources between entities atomically:

```typescript
const Inventory = defineComponent('Inventory', {
  items: 'json'
})

async function transferItem(
  fromEntity: string,
  toEntity: string,
  itemId: string
) {
  await ecs.transaction(async (ecs) => {
    const fromInv = ecs.getComponent(fromEntity, Inventory)
    const toInv = ecs.getComponent(toEntity, Inventory)

    if (!fromInv || !toInv) {
      throw new Error('Both entities must have Inventory')
    }

    // Find the item
    const itemIndex = fromInv.items.findIndex(i => i.id === itemId)
    if (itemIndex === -1) {
      throw new Error('Item not found in source inventory')
    }

    const item = fromInv.items[itemIndex]

    // Remove from source
    const newFromItems = [...fromInv.items]
    newFromItems.splice(itemIndex, 1)
    ecs.updateComponent(fromEntity, Inventory, { items: newFromItems })

    // Add to destination
    const newToItems = [...toInv.items, item]
    ecs.updateComponent(toEntity, Inventory, { items: newToItems })

    // If either update fails, both roll back
  })
}
```

## Step 4: Handle Rollbacks

When a transaction fails, catch the error and handle it:

```typescript
try {
  await ecs.transaction(async (ecs) => {
    const entity = ecs.createEntity()
    ecs.addComponent(entity, Position, { x: 0, y: 0 })

    // This will fail - entity already has Position
    ecs.addComponent(entity, Position, { x: 100, y: 100 })
  })
} catch (error) {
  console.log('Transaction failed:', error.message)
  // Entity was NOT created - rolled back
}

// Verify rollback
const allEntities = ecs.query([])
console.log(allEntities.length)  // 0 - nothing was created
```

You can also intentionally trigger rollbacks:

```typescript
await ecs.transaction(async (ecs) => {
  // Do some work...
  const entities = ecs.query([Position])

  // Check a condition
  if (entities.length > 1000) {
    throw new Error('Too many entities!')  // Intentional rollback
  }

  // Continue if condition passes...
})
```

## Step 5: Return Values

Transactions can return values:

```typescript
const result = await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  ecs.addComponent(entity, Health, { current: 100, max: 100 })

  // Return data from the transaction
  return {
    entityId: entity,
    initialHealth: 100
  }
})

console.log(`Created ${result.entityId} with ${result.initialHealth} HP`)
```

## Complete Example

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })
const Gold = defineComponent('Gold', { amount: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Health, Gold])
await ecs.initialize()

// Create two players with gold
const player1 = await ecs.transaction(async (ecs) => {
  const id = ecs.createEntity('player-1')
  ecs.addComponent(id, Position, { x: 0, y: 0 })
  ecs.addComponent(id, Gold, { amount: 100 })
  return id
})

const player2 = await ecs.transaction(async (ecs) => {
  const id = ecs.createEntity('player-2')
  ecs.addComponent(id, Position, { x: 10, y: 10 })
  ecs.addComponent(id, Gold, { amount: 50 })
  return id
})

// Transfer gold atomically
async function transferGold(from: string, to: string, amount: number) {
  await ecs.transaction(async (ecs) => {
    const fromGold = ecs.getComponent(from, Gold)
    const toGold = ecs.getComponent(to, Gold)

    if (!fromGold || !toGold) {
      throw new Error('Both players need Gold component')
    }

    if (fromGold.amount < amount) {
      throw new Error('Insufficient gold')
    }

    ecs.updateComponent(from, Gold, { amount: fromGold.amount - amount })
    ecs.updateComponent(to, Gold, { amount: toGold.amount + amount })
  })
}

// Transfer 30 gold from player1 to player2
await transferGold(player1, player2, 30)

// Check balances
console.log(ecs.getComponent(player1, Gold))  // { amount: 70 }
console.log(ecs.getComponent(player2, Gold))  // { amount: 80 }

// Try invalid transfer (should fail and rollback)
try {
  await transferGold(player1, player2, 1000)
} catch (e) {
  console.log('Transfer failed:', e.message)  // "Insufficient gold"
}

// Balances unchanged after failed transfer
console.log(ecs.getComponent(player1, Gold))  // { amount: 70 }
console.log(ecs.getComponent(player2, Gold))  // { amount: 80 }
```

## Variations

### Batch Entity Creation

```typescript
async function createEnemyWave(count: number, spawnPoint: { x: number, y: number }) {
  await ecs.transaction(async (ecs) => {
    for (let i = 0; i < count; i++) {
      const enemy = ecs.createEntity()
      ecs.addComponent(enemy, Position, {
        x: spawnPoint.x + Math.random() * 50,
        y: spawnPoint.y + Math.random() * 50
      })
      ecs.addComponent(enemy, Health, { current: 30, max: 30 })
    }
  })
}
```

### Conditional Operations

```typescript
await ecs.transaction(async (ecs) => {
  const health = ecs.getComponent(entityId, Health)

  if (health && health.current <= 0) {
    // Entity is dead, clean it up
    ecs.destroyEntity(entityId)
  } else if (health) {
    // Apply damage
    ecs.updateComponent(entityId, Health, {
      current: Math.max(0, health.current - damage)
    })
  }
})
```

## Troubleshooting

### Transaction Keeps Rolling Back

**Symptom:** Your transaction always fails.

**Cause:** An operation inside is throwing an error.

**Solution:** Add try/catch inside to log the specific error, or check each operation's preconditions.

### Changes Visible Outside Transaction

**Symptom:** Partial changes appear even when transaction should rollback.

**Cause:** You're reading state outside the transaction while it's running.

**Solution:** All reads and writes for the atomic operation should be inside the transaction callback.

## See Also

- **[Transactions Concept](Concept-Transactions)** - Understanding transactions
- **[Advanced API](API-Advanced)** - transaction() reference
- **[Components](Concept-Components)** - Component operations
