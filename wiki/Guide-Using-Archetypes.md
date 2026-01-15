# Using Archetypes

This guide shows you how to use archetypes to create entities from predefined templates, ensuring consistent component sets for common entity types.

## Prerequisites

Before starting, you should:

- [Complete Your First ECS](Your-First-ECS)
- [Understand components](Concept-Components)

## Overview

We'll cover:

1. Defining an archetype
2. Creating entities from archetypes
3. Common archetype patterns

## Step 1: Define an Archetype

An archetype is a predefined combination of components. Define it once, then use it to create entities that always have those components.

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })
const Velocity = defineComponent('Velocity', { vx: 'number', vy: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Health, Velocity])
await ecs.initialize()

// Define an archetype for moving characters
const CharacterArchetype = ecs.defineArchetype([Position, Health, Velocity])
```

The archetype ensures all its components are registered with the ECS.

## Step 2: Create Entities from Archetypes

Use `createFromArchetype` to create an entity with all archetype components in one call:

```typescript
// Create a player using the archetype
const player = ecs.createFromArchetype(CharacterArchetype, {
  Position: { x: 0, y: 0 },
  Health: { current: 100, max: 100 },
  Velocity: { vx: 0, vy: 0 }
})

// The entity now has all three components
console.log(ecs.hasComponent(player, Position))  // true
console.log(ecs.hasComponent(player, Health))    // true
console.log(ecs.hasComponent(player, Velocity))  // true
```

You must provide data for every component in the archetype.

## Step 3: Common Archetype Patterns

### Player Archetype

```typescript
const PlayerControlled = defineComponent('PlayerControlled', {
  inputEnabled: 'boolean'
})

const PlayerArchetype = ecs.defineArchetype([
  Position,
  Health,
  Velocity,
  PlayerControlled
])

const player = ecs.createFromArchetype(PlayerArchetype, {
  Position: { x: 100, y: 100 },
  Health: { current: 100, max: 100 },
  Velocity: { vx: 0, vy: 0 },
  PlayerControlled: { inputEnabled: true }
})
```

### Enemy Archetype

```typescript
const AIControlled = defineComponent('AIControlled', {
  behavior: 'string',
  aggroRange: 'number'
})

const EnemyArchetype = ecs.defineArchetype([
  Position,
  Health,
  Velocity,
  AIControlled
])

function spawnEnemy(x: number, y: number, behavior: string) {
  return ecs.createFromArchetype(EnemyArchetype, {
    Position: { x, y },
    Health: { current: 30, max: 30 },
    Velocity: { vx: 0, vy: 0 },
    AIControlled: { behavior, aggroRange: 100 }
  })
}

const goblin = spawnEnemy(200, 150, 'patrol')
const boss = spawnEnemy(500, 500, 'guard')
```

### Item Archetype

```typescript
const Pickupable = defineComponent('Pickupable', {
  itemId: 'string',
  quantity: 'number'
})

const Sprite = defineComponent('Sprite', {
  texture: 'string',
  width: 'number',
  height: 'number'
})

const ItemArchetype = ecs.defineArchetype([
  Position,
  Sprite,
  Pickupable
])

function spawnItem(x: number, y: number, itemId: string, quantity: number) {
  return ecs.createFromArchetype(ItemArchetype, {
    Position: { x, y },
    Sprite: { texture: `items/${itemId}.png`, width: 32, height: 32 },
    Pickupable: { itemId, quantity }
  })
}

const healthPotion = spawnItem(100, 100, 'health-potion', 1)
const goldPile = spawnItem(150, 100, 'gold', 50)
```

## Complete Example

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

// Define components
const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })
const Velocity = defineComponent('Velocity', { vx: 'number', vy: 'number' })
const Team = defineComponent('Team', { name: 'string' })
const Damage = defineComponent('Damage', { amount: 'number' })

// Initialize ECS
const db = await createDatabase()
const ecs = createECS(db, [Position, Health, Velocity, Team, Damage])
await ecs.initialize()

// Define archetypes
const PlayerArchetype = ecs.defineArchetype([Position, Health, Velocity, Team])
const EnemyArchetype = ecs.defineArchetype([Position, Health, Velocity, Team, Damage])
const ProjectileArchetype = ecs.defineArchetype([Position, Velocity, Damage, Team])

// Create entities from archetypes
const player = ecs.createFromArchetype(PlayerArchetype, {
  Position: { x: 100, y: 100 },
  Health: { current: 100, max: 100 },
  Velocity: { vx: 0, vy: 0 },
  Team: { name: 'player' }
})

const enemy = ecs.createFromArchetype(EnemyArchetype, {
  Position: { x: 300, y: 100 },
  Health: { current: 50, max: 50 },
  Velocity: { vx: -1, vy: 0 },
  Team: { name: 'enemy' },
  Damage: { amount: 10 }
})

const fireball = ecs.createFromArchetype(ProjectileArchetype, {
  Position: { x: 100, y: 100 },
  Velocity: { vx: 5, vy: 0 },
  Damage: { amount: 25 },
  Team: { name: 'player' }
})

// Query by components (archetypes don't affect queries)
const movingEntities = ecs.query([Position, Velocity])
console.log(movingEntities.length)  // 3

const damageDealing = ecs.query([Damage])
console.log(damageDealing.length)  // 2 (enemy and fireball)
```

## Variations

### Factory Functions with Archetypes

```typescript
const EnemyArchetype = ecs.defineArchetype([Position, Health, Velocity])

// Wrap archetype usage in a factory for convenience
function createEnemy(config: {
  x: number
  y: number
  hp: number
  speed: number
}) {
  return ecs.createFromArchetype(EnemyArchetype, {
    Position: { x: config.x, y: config.y },
    Health: { current: config.hp, max: config.hp },
    Velocity: { vx: -config.speed, vy: 0 }
  })
}

// Clean API for game code
const enemy1 = createEnemy({ x: 100, y: 50, hp: 30, speed: 1 })
const enemy2 = createEnemy({ x: 200, y: 50, hp: 50, speed: 0.5 })
```

### Multiple Archetypes per Entity Type

```typescript
// Base archetype
const BaseCharacter = ecs.defineArchetype([Position, Health])

// Extended archetypes for variants
const MeleeEnemy = ecs.defineArchetype([Position, Health, MeleeDamage])
const RangedEnemy = ecs.defineArchetype([Position, Health, RangedAttack])
const FlyingEnemy = ecs.defineArchetype([Position, Health, Flying])
```

## Troubleshooting

### Missing Component Data

**Symptom:** Error about missing data for component.

**Cause:** You didn't provide data for all components in the archetype.

**Solution:** Ensure the data object has a key for every component in the archetype.

### Component Not Registered

**Symptom:** Error about component not registered with ECS.

**Cause:** The component used in the archetype wasn't passed to createECS().

**Solution:** Include all components in the array passed to createECS().

## See Also

- **[Components Concept](Concept-Components)** - Understanding components
- **[Advanced API](API-Advanced)** - defineArchetype(), createFromArchetype() reference
- **[Your First ECS](Your-First-ECS)** - Basic entity creation
