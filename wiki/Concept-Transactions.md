# Transactions

Transactions let you make multiple changes atomically. Either all operations succeed, or they all roll back. This is essential when you need to update several entities or components together and can't have partial updates.

## How It Works

The ECS wraps your operations in a database transaction. If any operation throws an error, the entire transaction rolls back - the database returns to its state before the transaction started.

```
Transaction Start
    │
    ├── createEntity()     ✓
    ├── addComponent()     ✓
    ├── updateComponent()  ✗ Error!
    │
    ▼
Rollback: entity and component additions are undone
```

## Basic Usage

```typescript
await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  ecs.addComponent(entity, Health, { current: 100, max: 100 })
  // If any of these fail, all are rolled back
})
```

## Key Points

- **Automatic rollback** - Any error inside the callback triggers a rollback

- **Callback receives ECS** - Use the ECS instance passed to the callback for operations

- **Async/await** - The transaction method is async, as is the callback

- **Return values** - You can return a value from the transaction callback

- **Nested transactions** - Supported by the underlying database (SQLite savepoints)

## Examples

### Atomic Entity Creation

Create an entity that must have all its components or none:

```typescript
await ecs.transaction(async (ecs) => {
  const player = ecs.createEntity('player')
  ecs.addComponent(player, Position, { x: 0, y: 0 })
  ecs.addComponent(player, Health, { current: 100, max: 100 })
  ecs.addComponent(player, Inventory, { capacity: 20, items: [] })
  // If any addComponent fails, player entity is also rolled back
})
```

### Transferring Resources

Move items between two entities atomically:

```typescript
await ecs.transaction(async (ecs) => {
  const senderInv = ecs.getComponent(sender, Inventory)
  const receiverInv = ecs.getComponent(receiver, Inventory)

  if (!senderInv || !receiverInv) {
    throw new Error('Missing inventory')
  }

  // Remove from sender
  const newSenderItems = senderInv.items.filter(i => i.id !== itemId)
  ecs.updateComponent(sender, Inventory, { items: newSenderItems })

  // Add to receiver
  const item = senderInv.items.find(i => i.id === itemId)
  const newReceiverItems = [...receiverInv.items, item]
  ecs.updateComponent(receiver, Inventory, { items: newReceiverItems })

  // If either update fails, both are rolled back
})
```

### Returning Values

```typescript
const newEntityId = await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })
  return entity  // Return the created ID
})

console.log(`Created: ${newEntityId}`)
```

### Intentional Rollback

```typescript
await ecs.transaction(async (ecs) => {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, { x: 0, y: 0 })

  // Check some condition
  const entities = ecs.query([Position])
  if (entities.length > 1000) {
    throw new Error('Too many entities')  // Rollback
  }
})
```

## Related

- **[Using Transactions](Guide-Using-Transactions)** - More patterns and use cases
- **[Entities](Concept-Entities)** - What gets created/destroyed in transactions
- **[Components](Concept-Components)** - What gets added/updated/removed in transactions
- **[Advanced API](API-Advanced)** - transaction() reference
