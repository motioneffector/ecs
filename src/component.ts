import type { ComponentSchema, ComponentDefinition, FieldType } from './types'
import { ValidationError } from './errors'

/**
 * Define a component with its name and schema
 *
 * Components are the data containers in an ECS architecture. Each component
 * represents a specific aspect of an entity (position, health, inventory, etc.)
 *
 * @param name - Unique name for the component (used as table suffix in SQL)
 * @param schema - Schema defining the fields and their types
 * @returns A frozen component definition that can be registered with an ECS instance
 *
 * @example
 * ```typescript
 * const Position = defineComponent('position', {
 *   x: 'number',
 *   y: 'number',
 *   room_id: 'string',
 * })
 *
 * const Health = defineComponent('health', {
 *   current: 'number',
 *   max: 'number',
 * })
 *
 * const Inventory = defineComponent('inventory', {
 *   capacity: 'number',
 *   items: 'json', // Stored as JSON
 * })
 * ```
 *
 * @throws {ValidationError} If name is empty
 * @throws {ValidationError} If schema is empty
 * @throws {ValidationError} If schema contains invalid field type
 * @throws {ValidationError} If schema contains reserved field name "entity_id"
 */
export function defineComponent<T extends ComponentSchema>(
  name: string,
  schema: T
): ComponentDefinition<T> {
  // Validation
  if (!name || name.trim() === '') {
    throw new ValidationError('Component name cannot be empty', 'name')
  }

  if (Object.keys(schema).length === 0) {
    throw new ValidationError('Component schema cannot be empty', 'schema')
  }

  // Check for reserved field names
  if ('entity_id' in schema) {
    throw new ValidationError(
      'Field name "entity_id" is reserved and cannot be used',
      'entity_id'
    )
  }

  // Validate field types
  const validTypes = new Set<FieldType>(['string', 'number', 'boolean', 'json'])
  for (const [fieldName, fieldType] of Object.entries(schema)) {
    if (!validTypes.has(fieldType)) {
      throw new ValidationError(
        `Invalid field type "${fieldType}" for field "${fieldName}". Must be one of: ${[...validTypes].join(', ')}`,
        fieldName
      )
    }
  }

  // Create and freeze the component definition
  // Deep freeze: freeze both the definition and the schema
  const frozenSchema = Object.freeze({ ...schema })
  const definition: ComponentDefinition<T> = Object.freeze({
    name: name.trim(),
    schema: frozenSchema,
  })

  return definition
}
