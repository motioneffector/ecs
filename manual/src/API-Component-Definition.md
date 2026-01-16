# Component Definition API

Functions for defining component schemas.

---

## `defineComponent()`

Creates a component definition with a name and schema. Component definitions are immutable blueprints used to add typed data to entities.

**Signature:**

```typescript
function defineComponent<T extends ComponentSchema>(
  name: string,
  schema: T
): ComponentDefinition<T>
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | Yes | Unique name for the component. Used as the database table suffix. |
| `schema` | `T` | Yes | Object mapping field names to field types. |

**Returns:** `ComponentDefinition<T>` — A frozen component definition object.

**Example:**

```typescript
import { defineComponent } from '@motioneffector/ecs'

const Position = defineComponent('Position', {
  x: 'number',
  y: 'number'
})

const Health = defineComponent('Health', {
  current: 'number',
  max: 'number'
})

const Inventory = defineComponent('Inventory', {
  capacity: 'number',
  items: 'json'
})
```

**Throws:**

- `ValidationError` — Name is empty or whitespace-only
- `ValidationError` — Schema is empty (no fields)
- `ValidationError` — Schema contains invalid field type
- `ValidationError` — Schema contains reserved field name `entity_id`

---

## Types

### `FieldType`

```typescript
type FieldType = 'string' | 'number' | 'boolean' | 'json'
```

The supported field types for component schemas:

| Type | TypeScript Type | SQL Type | Notes |
|------|-----------------|----------|-------|
| `'string'` | `string` | `TEXT` | Any string value |
| `'number'` | `number` | `REAL` | Any numeric value |
| `'boolean'` | `boolean` | `INTEGER` | Stored as 0 or 1 |
| `'json'` | `unknown` | `TEXT` | JSON-serialized, can be arrays or objects |

### `ComponentSchema`

```typescript
type ComponentSchema = Record<string, FieldType>
```

An object mapping field names to their types.

### `ComponentDefinition<T>`

```typescript
interface ComponentDefinition<T extends ComponentSchema = ComponentSchema> {
  readonly name: string
  readonly schema: T
}
```

The frozen definition object returned by `defineComponent()`.

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The component name |
| `schema` | `T` | The field schema |

### `InferComponentData<T>`

```typescript
type InferComponentData<T extends ComponentSchema> = {
  [K in keyof T]: T[K] extends 'string'
    ? string
    : T[K] extends 'number'
      ? number
      : T[K] extends 'boolean'
        ? boolean
        : T[K] extends 'json'
          ? unknown
          : never
}
```

Infers the TypeScript data type from a component schema. Used for type-safe component operations.

```typescript
const Position = defineComponent('Position', { x: 'number', y: 'number' })

// InferComponentData<typeof Position.schema> = { x: number, y: number }
```
