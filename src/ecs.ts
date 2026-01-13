import type { Database } from '@motioneffector/sql'
import type {
  ComponentDefinition,
  ComponentSchema,
  ECS,
  EntityId,
  InferComponentData,
  PartialComponentData,
  QueryOptions,
  QueryResult,
  ArchetypeDefinition,
  ArchetypeData,
  EntityCreatedCallback,
  EntityDestroyedCallback,
  ComponentAddedCallback,
  ComponentRemovedCallback,
  ComponentUpdatedCallback,
  UnsubscribeFunction,
  TransactionCallback,
} from './types'
import { ValidationError, DatabaseError } from './errors'

/**
 * Create an ECS (Entity Component System) instance
 *
 * The ECS instance manages entities and their components within a SQL database,
 * providing persistent storage, queryability, and ACID guarantees.
 *
 * @param database - Database instance from @motioneffector/sql
 * @param components - Array of component definitions to register
 * @returns An ECS instance with all entity and component management methods
 *
 * @example
 * ```typescript
 * import { createDatabase } from '@motioneffector/sql'
 * import { createECS, defineComponent } from '@motioneffector/ecs'
 *
 * // Define components
 * const Position = defineComponent('position', { x: 'number', y: 'number' })
 * const Health = defineComponent('health', { current: 'number', max: 'number' })
 *
 * // Create database and ECS
 * const db = await createDatabase({ name: 'game' })
 * const ecs = createECS(db, [Position, Health])
 *
 * // Initialize (creates tables)
 * await ecs.initialize()
 *
 * // Create entity and add components
 * const entity = ecs.createEntity()
 * ecs.addComponent(entity, Position, { x: 0, y: 0 })
 * ecs.addComponent(entity, Health, { current: 100, max: 100 })
 *
 * // Query entities
 * const entities = ecs.query([Position, Health])
 * ```
 *
 * @throws {ValidationError} If database is invalid
 * @throws {ValidationError} If components array contains duplicate names
 */
export function createECS(
  database: Database,
  components: readonly ComponentDefinition[]
): ECS {
  // Validation
  if (!database || typeof database !== 'object') {
    throw new ValidationError('Invalid database instance', 'database')
  }

  // Check for duplicate component names
  const names = new Set<string>()
  for (const component of components) {
    if (names.has(component.name)) {
      throw new ValidationError(
        `Duplicate component name: "${component.name}"`,
        'components'
      )
    }
    names.add(component.name)
  }

  // Store component definitions
  const componentMap = new Map<string, ComponentDefinition>()
  for (const component of components) {
    componentMap.set(component.name, component)
  }

  // Event handlers
  const entityCreatedHandlers: EntityCreatedCallback[] = []
  const entityDestroyedHandlers: EntityDestroyedCallback[] = []
  const componentAddedHandlers = new Map<string, ComponentAddedCallback<any>[]>()
  const componentRemovedHandlers = new Map<string, ComponentRemovedCallback[]>()
  const componentUpdatedHandlers = new Map<string, ComponentUpdatedCallback<any>[]>()

  // Helper functions
  function getTableName(component: ComponentDefinition): string {
    return `component_${component.name}`
  }

  function serializeValue(value: unknown, fieldType: string): unknown {
    if (fieldType === 'json') {
      return JSON.stringify(value)
    }
    if (fieldType === 'boolean') {
      return value ? 1 : 0
    }
    return value
  }

  function deserializeValue(value: unknown, fieldType: string): unknown {
    if (fieldType === 'json' && typeof value === 'string') {
      return JSON.parse(value)
    }
    if (fieldType === 'boolean') {
      return value === 1
    }
    return value
  }

  function validateComponentData<T extends ComponentSchema>(
    component: ComponentDefinition<T>,
    data: Record<string, unknown>,
    partial = false
  ): void {
    const schema = component.schema

    if (!partial) {
      for (const fieldName of Object.keys(schema)) {
        if (!(fieldName in data)) {
          throw new ValidationError(
            `Missing required field "${fieldName}" for component "${component.name}"`,
            fieldName
          )
        }
      }
    }

    for (const [fieldName, value] of Object.entries(data)) {
      if (!(fieldName in schema)) {
        throw new ValidationError(
          `Unknown field "${fieldName}" for component "${component.name}"`,
          fieldName
        )
      }

      const fieldType = schema[fieldName]
      const actualType = typeof value

      switch (fieldType) {
        case 'string':
          if (actualType !== 'string') {
            throw new ValidationError(
              `Field "${fieldName}" must be a string, got ${actualType}`,
              fieldName
            )
          }
          break
        case 'number':
          if (actualType !== 'number') {
            throw new ValidationError(
              `Field "${fieldName}" must be a number, got ${actualType}`,
              fieldName
            )
          }
          break
        case 'boolean':
          if (actualType !== 'boolean') {
            throw new ValidationError(
              `Field "${fieldName}" must be a boolean, got ${actualType}`,
              fieldName
            )
          }
          break
        case 'json':
          break
      }
    }
  }

  function entityExists(entityId: EntityId): boolean {
    const result = database.get<{ id: string }>(
      'SELECT id FROM entities WHERE id = ?',
      [entityId]
    )
    return result !== undefined
  }

  // Return the ECS interface
  const ecs: ECS = {
    async initialize(): Promise<void> {
      try {
        // Create entities table
        database.exec(`
          CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
          )
        `)

        // Create component tables
        for (const component of components) {
          const tableName = `component_${component.name}`
          const columns: string[] = ['entity_id TEXT PRIMARY KEY']

          for (const [fieldName, fieldType] of Object.entries(component.schema)) {
            let sqlType: string
            switch (fieldType) {
              case 'string':
                sqlType = 'TEXT'
                break
              case 'number':
                sqlType = 'REAL'
                break
              case 'boolean':
                sqlType = 'INTEGER'
                break
              case 'json':
                sqlType = 'TEXT'
                break
            }
            columns.push(`${fieldName} ${sqlType} NOT NULL`)
          }

          columns.push('FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE')

          database.exec(`
            CREATE TABLE IF NOT EXISTS ${tableName} (
              ${columns.join(',\n              ')}
            )
          `)
        }
      } catch (error) {
        throw new DatabaseError(
          `Failed to initialize ECS: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
      }
    },

    createEntity(customId?: EntityId): EntityId {
      const id = customId ?? generateUUIDv7()

      if (customId !== undefined) {
        if (typeof customId !== 'string' || customId.trim() === '') {
          throw new ValidationError('Entity ID must be a non-empty string', 'id')
        }

        // Check if entity already exists
        const existing = database.get<{ id: string }>(
          'SELECT id FROM entities WHERE id = ?',
          [customId]
        )
        if (existing) {
          throw new ValidationError(`Entity with ID "${customId}" already exists`, 'id')
        }
      }

      const timestamp = Date.now()
      database.run('INSERT INTO entities (id, created_at) VALUES (?, ?)', [id, timestamp])

      // Fire entity created event
      for (const handler of entityCreatedHandlers) {
        handler(id)
      }

      return id
    },

    destroyEntity(entityId: EntityId): boolean {
      if (!entityExists(entityId)) {
        return false
      }

      // Get all components for this entity before deletion
      const componentsToRemove: ComponentDefinition[] = []
      for (const component of components) {
        if (ecs.hasComponent(entityId, component)) {
          componentsToRemove.push(component)
        }
      }

      // Fire component removed events
      for (const component of componentsToRemove) {
        const handlers = componentRemovedHandlers.get(component.name) ?? []
        for (const handler of handlers) {
          handler(entityId)
        }
      }

      // Delete entity (CASCADE will delete components)
      const result = database.run('DELETE FROM entities WHERE id = ?', [entityId])

      // Fire entity destroyed event
      if (result.changes > 0) {
        for (const handler of entityDestroyedHandlers) {
          handler(entityId)
        }
        return true
      }

      return false
    },

    addComponent<T extends ComponentSchema>(
      entityId: EntityId,
      component: ComponentDefinition<T>,
      data: InferComponentData<T>
    ): EntityId {
      if (!entityExists(entityId)) {
        throw new ValidationError(`Entity "${entityId}" does not exist`, 'entityId')
      }

      if (!componentMap.has(component.name)) {
        throw new ValidationError(
          `Component "${component.name}" is not registered with this ECS instance`,
          'component'
        )
      }

      if (ecs.hasComponent(entityId, component)) {
        throw new ValidationError(
          `Entity "${entityId}" already has component "${component.name}"`,
          'component'
        )
      }

      validateComponentData(component, data as Record<string, unknown>)

      const tableName = getTableName(component)
      const fields = Object.keys(component.schema)
      const values = fields.map(field =>
        serializeValue((data as Record<string, unknown>)[field], component.schema[field])
      )
      const placeholders = fields.map(() => '?').join(', ')

      database.run(
        `INSERT INTO ${tableName} (entity_id, ${fields.join(', ')}) VALUES (?, ${placeholders})`,
        [entityId, ...values]
      )

      const handlers = componentAddedHandlers.get(component.name) ?? []
      for (const handler of handlers) {
        handler(entityId, data)
      }

      return entityId
    },

    getComponent<T extends ComponentSchema>(
      entityId: EntityId,
      component: ComponentDefinition<T>
    ): InferComponentData<T> | null {
      if (!entityExists(entityId)) {
        return null
      }

      const tableName = getTableName(component)
      const result = database.get<Record<string, unknown>>(
        `SELECT * FROM ${tableName} WHERE entity_id = ?`,
        [entityId]
      )

      if (!result) {
        return null
      }

      const data: Record<string, unknown> = {}
      for (const [fieldName, fieldType] of Object.entries(component.schema)) {
        data[fieldName] = deserializeValue(result[fieldName], fieldType)
      }

      return data as InferComponentData<T>
    },

    updateComponent<T extends ComponentSchema>(
      entityId: EntityId,
      component: ComponentDefinition<T>,
      data: PartialComponentData<T>
    ): EntityId {
      if (!entityExists(entityId)) {
        throw new ValidationError(`Entity "${entityId}" does not exist`, 'entityId')
      }

      if (!ecs.hasComponent(entityId, component)) {
        throw new ValidationError(
          `Entity "${entityId}" does not have component "${component.name}"`,
          'component'
        )
      }

      validateComponentData(component, data as Record<string, unknown>, true)

      const oldData = ecs.getComponent(entityId, component)!

      const tableName = getTableName(component)
      const fields = Object.keys(data as Record<string, unknown>)
      const values = fields.map(field =>
        serializeValue((data as Record<string, unknown>)[field], component.schema[field])
      )
      const setClause = fields.map(field => `${field} = ?`).join(', ')

      database.run(
        `UPDATE ${tableName} SET ${setClause} WHERE entity_id = ?`,
        [...values, entityId]
      )

      const newData = ecs.getComponent(entityId, component)!

      const handlers = componentUpdatedHandlers.get(component.name) ?? []
      for (const handler of handlers) {
        handler(entityId, oldData, newData)
      }

      return entityId
    },

    removeComponent<T extends ComponentSchema>(
      entityId: EntityId,
      component: ComponentDefinition<T>
    ): EntityId {
      if (!entityExists(entityId)) {
        throw new ValidationError(`Entity "${entityId}" does not exist`, 'entityId')
      }

      const hadComponent = ecs.hasComponent(entityId, component)

      const tableName = getTableName(component)
      database.run(`DELETE FROM ${tableName} WHERE entity_id = ?`, [entityId])

      if (hadComponent) {
        const handlers = componentRemovedHandlers.get(component.name) ?? []
        for (const handler of handlers) {
          handler(entityId)
        }
      }

      return entityId
    },

    hasComponent<T extends ComponentSchema>(
      entityId: EntityId,
      component: ComponentDefinition<T>
    ): boolean {
      if (!entityExists(entityId)) {
        return false
      }

      return ecs.getComponent(entityId, component) !== null
    },

    query<T extends ComponentSchema>(
      components: ComponentDefinition<T>[],
      options?: QueryOptions<T>
    ): EntityId[] {
      if (components.length === 0) {
        const results = database.all<{ id: string }>('SELECT id FROM entities')
        return results.map(r => r.id)
      }

      const tableNames = components.map(c => getTableName(c))
      const joins = tableNames
        .map((table, i) => {
          if (i === 0) {
            return `${table} t0`
          }
          return `INNER JOIN ${table} t${i} ON t0.entity_id = t${i}.entity_id`
        })
        .join(' ')

      const sql = `SELECT t0.entity_id FROM ${joins}`
      const results = database.all<{ entity_id: string }>(sql)
      let entityIds = results.map(r => r.entity_id)

      if (options?.exclude && options.exclude.length > 0) {
        const excludeSet = new Set<string>()
        for (const excludeComponent of options.exclude) {
          const excludeTable = getTableName(excludeComponent)
          const excludeResults = database.all<{ entity_id: string }>(
            `SELECT entity_id FROM ${excludeTable}`
          )
          for (const result of excludeResults) {
            excludeSet.add(result.entity_id)
          }
        }
        entityIds = entityIds.filter(id => !excludeSet.has(id))
      }

      if (options?.filter) {
        entityIds = entityIds.filter(entityId => {
          const data = ecs.getComponent(entityId, components[0])
          return data !== null && options.filter!(data)
        })
      }

      return entityIds
    },

    queryWithData<T extends ComponentDefinition[]>(
      components: T,
      options?: QueryOptions<T[number]['schema']>
    ): QueryResult<T>[] {
      const entityIds = ecs.query(components as ComponentDefinition<any>[], options)

      return entityIds.map(entityId => {
        const result: Record<string, unknown> = { entityId }

        for (const component of components) {
          const data = ecs.getComponent(entityId, component)
          if (data !== null) {
            result[component.name] = data
          }
        }

        return result as QueryResult<T>
      })
    },

    rawQuery<T = unknown>(sql: string, params?: unknown[]): T[] {
      try {
        return database.all<T>(sql, params)
      } catch (error) {
        throw new DatabaseError(
          `Raw query failed: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
      }
    },

    addComponentBulk<T extends ComponentSchema>(
      entityIds: EntityId[],
      component: ComponentDefinition<T>,
      data: InferComponentData<T>
    ): void {
      for (const entityId of entityIds) {
        ecs.addComponent(entityId, component, data)
      }
    },

    removeComponentBulk<T extends ComponentSchema>(
      entityIds: EntityId[],
      component: ComponentDefinition<T>
    ): void {
      for (const entityId of entityIds) {
        ecs.removeComponent(entityId, component)
      }
    },

    async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
      // Stub implementation
      return await database.transaction(() => callback(ecs))
    },

    onEntityCreated(callback: EntityCreatedCallback): UnsubscribeFunction {
      entityCreatedHandlers.push(callback)
      return () => {
        const index = entityCreatedHandlers.indexOf(callback)
        if (index !== -1) {
          entityCreatedHandlers.splice(index, 1)
        }
      }
    },

    onEntityDestroyed(callback: EntityDestroyedCallback): UnsubscribeFunction {
      entityDestroyedHandlers.push(callback)
      return () => {
        const index = entityDestroyedHandlers.indexOf(callback)
        if (index !== -1) {
          entityDestroyedHandlers.splice(index, 1)
        }
      }
    },

    onComponentAdded<T extends ComponentSchema>(
      component: ComponentDefinition<T>,
      callback: ComponentAddedCallback<T>
    ): UnsubscribeFunction {
      if (!componentAddedHandlers.has(component.name)) {
        componentAddedHandlers.set(component.name, [])
      }
      const handlers = componentAddedHandlers.get(component.name)!
      handlers.push(callback)
      return () => {
        const index = handlers.indexOf(callback)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
      }
    },

    onComponentRemoved<T extends ComponentSchema>(
      component: ComponentDefinition<T>,
      callback: ComponentRemovedCallback
    ): UnsubscribeFunction {
      if (!componentRemovedHandlers.has(component.name)) {
        componentRemovedHandlers.set(component.name, [])
      }
      const handlers = componentRemovedHandlers.get(component.name)!
      handlers.push(callback)
      return () => {
        const index = handlers.indexOf(callback)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
      }
    },

    onComponentUpdated<T extends ComponentSchema>(
      component: ComponentDefinition<T>,
      callback: ComponentUpdatedCallback<T>
    ): UnsubscribeFunction {
      if (!componentUpdatedHandlers.has(component.name)) {
        componentUpdatedHandlers.set(component.name, [])
      }
      const handlers = componentUpdatedHandlers.get(component.name)!
      handlers.push(callback)
      return () => {
        const index = handlers.indexOf(callback)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
      }
    },

    defineArchetype<T extends readonly ComponentDefinition[]>(
      components: T
    ): ArchetypeDefinition {
      for (const component of components) {
        if (!componentMap.has(component.name)) {
          throw new ValidationError(
            `Component "${component.name}" is not registered with this ECS instance`,
            'components'
          )
        }
      }
      return { components }
    },

    createFromArchetype<T extends readonly ComponentDefinition[]>(
      archetype: ArchetypeDefinition,
      data: ArchetypeData<T>
    ): EntityId {
      const entityId = ecs.createEntity()

      for (const component of archetype.components) {
        const componentData = (data as Record<string, unknown>)[component.name]
        if (componentData === undefined) {
          throw new ValidationError(
            `Missing data for component "${component.name}" in archetype`,
            component.name
          )
        }
        ecs.addComponent(entityId, component, componentData as InferComponentData<any>)
      }

      return entityId
    },

    addIndex<T extends ComponentSchema>(
      component: ComponentDefinition<T>,
      field: keyof InferComponentData<T>
    ): void {
      if (!componentMap.has(component.name)) {
        throw new ValidationError(
          `Component "${component.name}" is not registered with this ECS instance`,
          'component'
        )
      }

      if (!(field in component.schema)) {
        throw new ValidationError(
          `Field "${String(field)}" does not exist in component "${component.name}"`,
          String(field)
        )
      }

      const tableName = getTableName(component)
      const fieldName = String(field)
      const indexName = `idx_${tableName}_${fieldName}`

      try {
        database.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${fieldName})`)
      } catch (error) {
        throw new DatabaseError(
          `Failed to create index: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
      }
    },

    getDatabase(): Database {
      return database
    },
  }

  return ecs
}

/**
 * Generate a UUID v7 (timestamp-sortable)
 * Works in both browser and Node.js environments
 */
function generateUUIDv7(): string {
  const timestamp = Date.now()

  // Get crypto from either global or from crypto module
  const cryptoObj = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : (
    typeof crypto !== 'undefined' ? crypto : null
  )

  if (!cryptoObj) {
    // Fallback for environments without crypto
    const randomHex = Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join('')

    const timestampHex = timestamp.toString(16).padStart(12, '0')
    return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-7${randomHex.slice(0, 3)}-${randomHex.slice(3, 7)}-${randomHex.slice(7, 19)}`
  }

  const randomPart = cryptoObj.getRandomValues(new Uint8Array(10))
  const randomHex = Array.from(randomPart)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // UUID v7 format: timestamp(48bit) + version(4bit) + random(12bit) + variant(2bit) + random(62bit)
  const timestampHex = timestamp.toString(16).padStart(12, '0')
  const uuid = `${timestampHex.slice(0, 8)}-${timestampHex.slice(8, 12)}-7${randomHex.slice(0, 3)}-${randomHex.slice(3, 7)}-${randomHex.slice(7, 19)}`

  return uuid
}
