import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createECS } from './ecs'
import { defineComponent } from './component'
import { ValidationError, DatabaseError } from './errors'
import type { Database } from '@motioneffector/sql'

// Enhanced mock database for comprehensive testing
function createTestDatabase(): Database {
  const entities = new Map<string, { id: string; created_at: number }>()
  const componentTables = new Map<string, Map<string, Record<string, unknown>>>()
  const indexes = new Map<string, string[]>() // tableName -> indexNames
  let sqlLog: string[] = []
  let inTx = false
  let txSnapshot: {
    entities: Map<string, { id: string; created_at: number }>
    componentTables: Map<string, Map<string, Record<string, unknown>>>
  } | null = null

  // Helper to extract field names from INSERT statement
  function extractFieldNames(sql: string): string[] {
    // Match: INSERT INTO tablename (entity_id, field1, field2, ...) VALUES ...
    // Handle both quoted and unquoted table names
    const match = sql.match(/INSERT INTO "?\w+"?\s*\(([^)]+)\)/)
    if (match) {
      return match[1].split(',').map(f => {
        const trimmed = f.trim()
        // Remove surrounding quotes if present (e.g., "entity_id" -> entity_id)
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1).replace(/""/g, '"') // Also unescape doubled quotes
        }
        return trimmed
      })
    }
    return []
  }

  // Helper to extract SET clause fields from UPDATE
  function extractUpdateFields(sql: string): string[] {
    // Match: UPDATE table SET field1 = ?, field2 = ? WHERE ...
    const match = sql.match(/SET\s+(.+?)\s+WHERE/)
    if (match) {
      const setClause = match[1]
      return setClause.split(',').map(part => {
        // Match either quoted or unquoted identifiers
        const fieldMatch = part.trim().match(/^"([^"]+)"\s*=|^(\w+)\s*=/)
        if (fieldMatch) {
          // Return the first capturing group that matched (quoted or unquoted)
          return fieldMatch[1] || fieldMatch[2]
        }
        return ''
      }).filter(Boolean)
    }
    return []
  }

  const db: Database = {
    run: (sql: string, params?: unknown) => {
      sqlLog.push(sql)
      const sqlStr = typeof sql === 'string' ? sql : (sql as any).sql
      const paramsArray = Array.isArray(params) ? params : []

      // INSERT INTO entities
      if (sqlStr.includes('INSERT INTO entities')) {
        const id = paramsArray[0] as string
        const created_at = paramsArray[1] as number
        if (entities.has(id)) {
          throw new Error('UNIQUE constraint failed')
        }
        entities.set(id, { id, created_at })
        return { changes: 1, lastInsertRowId: 1 }
      }

      // INSERT INTO component tables
      if (sqlStr.includes('INSERT INTO component_') || sqlStr.includes('INSERT INTO "component_')) {
        // Match either quoted or unquoted table names
        const tableMatch = sqlStr.match(/INSERT INTO "?(component_\w+)"?/)
        if (tableMatch) {
          const tableName = tableMatch[1]
          if (!componentTables.has(tableName)) {
            componentTables.set(tableName, new Map())
          }
          const table = componentTables.get(tableName)!

          // Extract field names from the SQL
          const fieldNames = extractFieldNames(sqlStr)

          const entityId = paramsArray[0] as string
          if (table.has(entityId)) {
            throw new Error('UNIQUE constraint failed: component already exists')
          }

          // Store data with proper field names
          const data: Record<string, unknown> = {}
          for (let i = 0; i < fieldNames.length; i++) {
            data[fieldNames[i]] = paramsArray[i]
          }
          table.set(entityId, data)
          return { changes: 1, lastInsertRowId: 1 }
        }
      }

      // DELETE FROM entities
      if (sqlStr.includes('DELETE FROM entities')) {
        const id = paramsArray[0] as string
        const existed = entities.has(id)
        entities.delete(id)
        // Cascade delete
        for (const table of componentTables.values()) {
          table.delete(id)
        }
        return { changes: existed ? 1 : 0, lastInsertRowId: 0 }
      }

      // DELETE FROM component tables
      if (sqlStr.includes('DELETE FROM component_') || sqlStr.includes('DELETE FROM "component_')) {
        const match = sqlStr.match(/DELETE FROM "?(component_\w+)"?/)
        if (match) {
          const tableName = match[1]
          const table = componentTables.get(tableName)
          if (table) {
            const entityId = paramsArray[0] as string
            const existed = table.has(entityId)
            table.delete(entityId)
            return { changes: existed ? 1 : 0, lastInsertRowId: 0 }
          }
        }
      }

      // UPDATE component tables
      if (sqlStr.includes('UPDATE component_') || sqlStr.includes('UPDATE "component_')) {
        const match = sqlStr.match(/UPDATE "?(component_\w+)"?/)
        if (match) {
          const tableName = match[1]
          const table = componentTables.get(tableName)
          if (table) {
            const entityId = paramsArray[paramsArray.length - 1] as string
            const existing = table.get(entityId)
            if (existing) {
              const updated = { ...existing }
              const updateFields = extractUpdateFields(sqlStr)
              for (let i = 0; i < updateFields.length; i++) {
                updated[updateFields[i]] = paramsArray[i]
              }
              table.set(entityId, updated)
              return { changes: 1, lastInsertRowId: 0 }
            }
            return { changes: 0, lastInsertRowId: 0 }
          }
        }
      }

      // CREATE INDEX
      if (sqlStr.includes('CREATE INDEX')) {
        return { changes: 0, lastInsertRowId: 0 }
      }

      return { changes: 0, lastInsertRowId: 0 }
    },

    get: <T extends Record<string, unknown>>(sql: string, params?: unknown): T | undefined => {
      const sqlStr = typeof sql === 'string' ? sql : (sql as any).sql
      const paramsArray = Array.isArray(params) ? params : []

      // SELECT FROM entities
      if (sqlStr.includes('FROM entities')) {
        const id = paramsArray[0] as string
        const entity = entities.get(id)
        return entity as T | undefined
      }

      // SELECT FROM component tables
      if (sqlStr.includes('FROM component_') || sqlStr.includes('FROM "component_')) {
        const match = sqlStr.match(/FROM "?(component_\w+)"?/)
        if (match) {
          const tableName = match[1]
          const table = componentTables.get(tableName)
          if (table) {
            const entityId = paramsArray[0] as string
            return table.get(entityId) as T | undefined
          }
        }
      }

      return undefined
    },

    all: <T extends Record<string, unknown>>(sql: string, params?: unknown): T[] => {
      const sqlStr = typeof sql === 'string' ? sql : (sql as any).sql
      const paramsArray = Array.isArray(params) ? params : []

      // Validate SQL syntax - throw on obviously invalid SQL
      const normalizedSql = sqlStr.toUpperCase().trim()
      const validPatterns = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'BEGIN', 'COMMIT', 'ROLLBACK']
      const isValidStart = validPatterns.some(p => normalizedSql.startsWith(p))
      if (!isValidStart) {
        throw new Error(`Invalid SQL syntax: ${sqlStr}`)
      }

      // Aggregate/COUNT queries (check before generic SELECT)
      if (sqlStr.includes('COUNT(*)')) {
        if (sqlStr.includes('FROM entities')) {
          return [{ count: entities.size } as T]
        }
      }

      // SELECT * FROM entities
      if (sqlStr.includes('SELECT') && sqlStr.includes('FROM entities') && !sqlStr.includes('JOIN')) {
        return Array.from(entities.values()) as T[]
      }

      // SELECT from a single component table (with or without WHERE clause)
      if (sqlStr.includes('SELECT') && (sqlStr.includes('FROM component_') || sqlStr.includes('FROM "component_'))) {
        // Don't match if it's a multi-table JOIN
        if (sqlStr.includes('JOIN')) {
          // Let the JOIN handler below handle this
        } else {
          const match = sqlStr.match(/FROM "?(component_\w+)"?/)
          if (match) {
            const tableName = match[1]
            const table = componentTables.get(tableName)
            if (table) {
              let results = Array.from(table.values())

              // Handle WHERE clause with parameters
              if (sqlStr.includes('WHERE') && paramsArray.length > 0) {
                // Match either quoted or unquoted identifiers in WHERE clause
                const whereMatch = sqlStr.match(/WHERE\s+"([^"]+)"\s*=\s*\?|WHERE\s+(\w+)\s*=\s*\?/)
                if (whereMatch) {
                  const fieldName = whereMatch[1] || whereMatch[2]
                  const fieldValue = paramsArray[0]
                  results = results.filter(row => row[fieldName] === fieldValue)
                }
              }

              // Check if SELECT is requesting only entity_id (for query() method)
              // Pattern: SELECT t0."entity_id" FROM ...
              if (sqlStr.match(/SELECT\s+\w+\."?entity_id"?/)) {
                return results.map(row => ({ entity_id: row.entity_id })) as T[]
              }

              return results as T[]
            }
          }
        }
      }

      // Query with JOIN - find entities with all components
      if (sqlStr.includes('JOIN')) {
        const matches = sqlStr.matchAll(/component_(\w+)/g)
        const tableNames = Array.from(new Set(Array.from(matches).map(m => `component_${m[1]}`)))

        if (tableNames.length === 0) return []

        let entityIds = new Set<string>()
        let first = true

        for (const tableName of tableNames) {
          const table = componentTables.get(tableName)
          if (!table || table.size === 0) return []

          const tableEntityIds = new Set(table.keys())
          if (first) {
            entityIds = tableEntityIds
            first = false
          } else {
            entityIds = new Set([...entityIds].filter(id => tableEntityIds.has(id)))
          }
        }

        // Return only entity_id as the SQL SELECT statement requests
        return Array.from(entityIds).map(id => ({ entity_id: id }) as T)
      }

      return []
    },

    exec: (sql: string) => {
      sqlLog.push(sql)
      // Track index creation
      const indexMatch = sql.match(/CREATE INDEX\s+(?:IF NOT EXISTS\s+)?(\w+)\s+ON\s+(\w+)/)
      if (indexMatch) {
        const [, indexName, tableName] = indexMatch
        if (indexName && tableName) {
          if (!indexes.has(tableName)) {
            indexes.set(tableName, [])
          }
          const tableIndexes = indexes.get(tableName)
          if (tableIndexes && !tableIndexes.includes(indexName)) {
            tableIndexes.push(indexName)
          }
        }
      }
    },

    migrate: async (migrations: unknown[]) => [],
    rollback: async (targetVersion?: number, migrations?: unknown[]) => [],
    getMigrationVersion: () => 0,

    transaction: async <T>(fn: () => T | Promise<T>): Promise<T> => {
      if (inTx) {
        // Nested transaction - just run the function
        return await fn()
      }

      inTx = true
      // Take snapshot for rollback
      txSnapshot = {
        entities: new Map(entities),
        componentTables: new Map(
          Array.from(componentTables.entries()).map(([k, v]) => [k, new Map(v)])
        )
      }

      try {
        const result = await fn()
        txSnapshot = null
        inTx = false
        return result
      } catch (error) {
        // Rollback
        if (txSnapshot) {
          entities.clear()
          for (const [k, v] of txSnapshot.entities) {
            entities.set(k, v)
          }
          componentTables.clear()
          for (const [k, v] of txSnapshot.componentTables) {
            componentTables.set(k, v)
          }
        }
        txSnapshot = null
        inTx = false
        throw error
      }
    },

    get inTransaction() {
      return inTx
    },

    table: <T extends Record<string, unknown>>(tableName: string) => {
      return {} as any
    },

    export: () => new Uint8Array(),
    import: (data: Uint8Array | ArrayBuffer) => {},
    save: async () => {},
    load: async () => {},
    getTables: () => Array.from(componentTables.keys()),
    getTableInfo: (tableName: string) => [],
    getIndexes: (tableName?: string) => {
      if (tableName) {
        return indexes.get(tableName)?.map(name => ({ name, tableName, columns: [] })) ?? []
      }
      // Return all indexes if no table specified
      const allIndexes: Array<{ name: string; tableName: string; columns: string[] }> = []
      for (const [table, indexNames] of indexes.entries()) {
        for (const name of indexNames) {
          allIndexes.push({ name, tableName: table, columns: [] })
        }
      }
      return allIndexes
    },
    close: () => {},
    clone: async () => createTestDatabase(),
    clear: () => {
      entities.clear()
      componentTables.clear()
      sqlLog = []
    },
    destroy: async () => {},
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join('?'),
      params: values,
    }),
    prepare: <T>(sql: string) => {
      return {} as any
    },
    insertMany: (tableName: string, rows: Record<string, unknown>[]) => {
      return rows.map((_, i) => i + 1)
    },
  }

  return db as Database
}

// Component definitions used across tests
const Position = defineComponent('position', { x: 'number', y: 'number', room_id: 'string' })
const Velocity = defineComponent('velocity', { dx: 'number', dy: 'number' })
const Health = defineComponent('health', { current: 'number', max: 'number' })
const Description = defineComponent('description', { short: 'string', long: 'string' })
const Active = defineComponent('active', { enabled: 'boolean' })
const Inventory = defineComponent('inventory', { capacity: 'number', items: 'json' })

describe('ecs.addComponent()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health, Inventory, Active])
    await ecs.initialize()
  })

  describe('Basic Addition', () => {
    it('adds component data to entity', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      const pos = ecs.getComponent(id, Position)
      expect(pos).toEqual({ x: 10, y: 20, room_id: 'test' })
    })

    it('stores all schema fields', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      const pos = ecs.getComponent(id, Position)
      expect(pos).toMatchObject({ x: 10, y: 20, room_id: 'test' })
    })

    it('returns entity id for chaining', () => {
      const id = ecs.createEntity()
      const result = ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(result).toBe(id)
    })
  })

  describe('Field Types', () => {
    it('stores string values correctly', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test-room' })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.room_id).toBe('test-room')
    })

    it('stores number values correctly', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 75, max: 100 })
      const health = ecs.getComponent(id, Health)
      expect(health?.current).toBe(75)
      expect(health?.max).toBe(100)
    })

    it('stores boolean true as 1', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Active, { enabled: true })
      const active = ecs.getComponent(id, Active)
      expect(active?.enabled).toBe(true)
    })

    it('stores boolean false as 0', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Active, { enabled: false })
      const active = ecs.getComponent(id, Active)
      expect(active?.enabled).toBe(false)
    })

    it('stores json values as serialized string', () => {
      const id = ecs.createEntity()
      const items = [{ name: 'sword', damage: 10 }]
      ecs.addComponent(id, Inventory, { capacity: 20, items })
      const inv = ecs.getComponent(id, Inventory)
      expect(inv).toEqual({ capacity: 20, items })
    })

    it('retrieves json values as parsed objects', () => {
      const id = ecs.createEntity()
      const items = [{ name: 'sword', damage: 10 }]
      ecs.addComponent(id, Inventory, { capacity: 20, items })
      const inv = ecs.getComponent(id, Inventory)
      expect(inv?.items).toEqual(items)
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for non-existent entity', () => {
      expect(() => {
        ecs.addComponent('fake-id', Position, { x: 0, y: 0, room_id: 'test' })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for undefined component', () => {
      const id = ecs.createEntity()
      const UnknownComp = defineComponent('unknown', { field: 'string' })
      expect(() => {
        ecs.addComponent(id, UnknownComp, { field: 'value' })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for missing required field', () => {
      const id = ecs.createEntity()
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.addComponent(id, Position, { x: 0, y: 0 })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for wrong field type', () => {
      const id = ecs.createEntity()
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.addComponent(id, Health, { current: 'not-a-number', max: 100 })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError if component already exists on entity', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(() => {
        ecs.addComponent(id, Position, { x: 1, y: 1, room_id: 'test' })
      }).toThrow(ValidationError)
    })
  })

  describe('Events', () => {
    it('fires onComponentAdded event', () => {
      const callback = vi.fn()
      ecs.onComponentAdded(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 5, y: 10, room_id: 'test' })
      expect(callback).toHaveBeenCalled()
    })

    it('event includes entity id and component data', () => {
      const callback = vi.fn()
      ecs.onComponentAdded(Position, callback)
      const id = ecs.createEntity()
      const data = { x: 5, y: 10, room_id: 'test' }
      ecs.addComponent(id, Position, data)
      expect(callback).toHaveBeenCalledWith(id, expect.objectContaining(data))
    })
  })
})

describe('ecs.getComponent()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health, Inventory, Active])
    await ecs.initialize()
  })

  describe('Basic Retrieval', () => {
    it('returns component data for entity', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      const pos = ecs.getComponent(id, Position)
      expect(pos).toBeDefined()
      expect(pos?.x).toBe(10)
    })

    it('returns null if entity lacks component', () => {
      const id = ecs.createEntity()
      const pos = ecs.getComponent(id, Position)
      expect(pos).toBeNull()
    })

    it('returns null for non-existent entity', () => {
      const pos = ecs.getComponent('fake-id', Position)
      expect(pos).toBeNull()
    })

    it('returns all schema fields', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 1, y: 2, room_id: 'room1' })
      const pos = ecs.getComponent(id, Position)
      expect(pos).toMatchObject({ x: 1, y: 2, room_id: 'room1' })
    })
  })

  describe('Field Types', () => {
    it('returns strings as strings', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      const pos = ecs.getComponent(id, Position)
      expect(typeof pos?.room_id).toBe('string')
    })

    it('returns numbers as numbers', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 50, max: 100 })
      const health = ecs.getComponent(id, Health)
      expect(typeof health?.current).toBe('number')
    })

    it('returns booleans as booleans', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Active, { enabled: true })
      const active = ecs.getComponent(id, Active)
      expect(typeof active?.enabled).toBe('boolean')
    })

    it('returns json as parsed objects', () => {
      const id = ecs.createEntity()
      const items = [{ name: 'item1' }]
      ecs.addComponent(id, Inventory, { capacity: 10, items })
      const inv = ecs.getComponent(id, Inventory)
      expect(Array.isArray(inv?.items)).toBe(true)
    })
  })
})

describe('ecs.updateComponent()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health, Inventory, Active])
    await ecs.initialize()
  })

  describe('Partial Updates', () => {
    it('updates single field', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'room1' })
      ecs.updateComponent(id, Position, { x: 10 })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.x).toBe(10)
    })

    it('updates multiple fields', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'room1' })
      ecs.updateComponent(id, Position, { x: 5, y: 10 })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.x).toBe(5)
      expect(pos?.y).toBe(10)
    })

    it('preserves unspecified fields', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 5, room_id: 'room1' })
      ecs.updateComponent(id, Position, { x: 10 })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.y).toBe(5)
      expect(pos?.room_id).toBe('room1')
    })

    it('returns entity id for chaining', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      const result = ecs.updateComponent(id, Position, { x: 10 })
      expect(result).toBe(id)
    })
  })

  describe('Field Types', () => {
    it('updates string values', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'room1' })
      ecs.updateComponent(id, Position, { room_id: 'room2' })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.room_id).toBe('room2')
    })

    it('updates number values', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 100, max: 100 })
      ecs.updateComponent(id, Health, { current: 50 })
      const health = ecs.getComponent(id, Health)
      expect(health?.current).toBe(50)
    })

    it('updates boolean values', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Active, { enabled: true })
      ecs.updateComponent(id, Active, { enabled: false })
      const active = ecs.getComponent(id, Active)
      expect(active?.enabled).toBe(false)
    })

    it('updates json values', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Inventory, { capacity: 10, items: [] })
      const newItems = [{ name: 'sword' }]
      ecs.updateComponent(id, Inventory, { items: newItems })
      const inv = ecs.getComponent(id, Inventory)
      expect(inv?.items).toEqual(newItems)
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for non-existent entity', () => {
      expect(() => {
        ecs.updateComponent('fake-id', Position, { x: 10 })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError if component not on entity', () => {
      const id = ecs.createEntity()
      expect(() => {
        ecs.updateComponent(id, Position, { x: 10 })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid field type', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 100, max: 100 })
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.updateComponent(id, Health, { current: 'invalid' })
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for unknown field', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.updateComponent(id, Position, { unknownField: 123 })
      }).toThrow(ValidationError)
    })
  })

  describe('Events', () => {
    it('fires onComponentUpdated event', () => {
      const callback = vi.fn()
      ecs.onComponentUpdated(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.updateComponent(id, Position, { x: 10 })
      expect(callback).toHaveBeenCalled()
    })

    it('event includes old and new data', () => {
      const callback = vi.fn()
      ecs.onComponentUpdated(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.updateComponent(id, Position, { x: 10 })
      expect(callback).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ x: 0 }),
        expect.objectContaining({ x: 10 })
      )
    })
  })
})

describe('ecs.removeComponent()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health])
    await ecs.initialize()
  })

  describe('Basic Removal', () => {
    it('removes component from entity', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      const pos = ecs.getComponent(id, Position)
      expect(pos).toBeNull()
    })

    it('returns entity id for chaining', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      const result = ecs.removeComponent(id, Position)
      expect(result).toBe(id)
    })

    it('does nothing if component not present', () => {
      const id = ecs.createEntity()
      expect(() => ecs.removeComponent(id, Position)).not.toThrow()
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for non-existent entity', () => {
      expect(() => {
        ecs.removeComponent('fake-id', Position)
      }).toThrow(ValidationError)
    })
  })

  describe('Events', () => {
    it('fires onComponentRemoved event', () => {
      const callback = vi.fn()
      ecs.onComponentRemoved(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      expect(callback).toHaveBeenCalled()
    })

    it('event includes entity id', () => {
      const callback = vi.fn()
      ecs.onComponentRemoved(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      expect(callback).toHaveBeenCalledWith(id)
    })
  })
})

describe('ecs.hasComponent()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position])
    await ecs.initialize()
  })

  describe('Basic Check', () => {
    it('returns true if entity has component', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(ecs.hasComponent(id, Position)).toBe(true)
    })

    it('returns false if entity lacks component', () => {
      const id = ecs.createEntity()
      expect(ecs.hasComponent(id, Position)).toBe(false)
    })

    it('returns false for non-existent entity', () => {
      expect(ecs.hasComponent('fake-id', Position)).toBe(false)
    })
  })
})

describe('ecs.query()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Velocity, Health])
    await ecs.initialize()
  })

  describe('Basic Query', () => {
    it('returns entity ids with all specified components', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id1, Velocity, { dx: 1, dy: 1 })
      ecs.addComponent(id2, Position, { x: 5, y: 5, room_id: 'test' })

      const results = ecs.query([Position, Velocity])
      expect(results).toContain(id1)
      expect(results).not.toContain(id2)
    })

    it('returns empty array if no matches', () => {
      const results = ecs.query([Position, Velocity])
      expect(results).toEqual([])
    })

    it('requires all components (AND logic)', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id2, Velocity, { dx: 1, dy: 1 })

      const results = ecs.query([Position, Velocity])
      expect(results.length).toBe(0)
    })
  })

  describe('With Filter', () => {
    it('applies filter function to results', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Health, { current: 50, max: 100 })
      ecs.addComponent(id2, Health, { current: 100, max: 100 })

      const results = ecs.query([Health], { filter: (h) => h.current < h.max })
      expect(results).toContain(id1)
      expect(results).not.toContain(id2)
    })

    it('filter receives component data', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 75, max: 100 })

      const filterFn = vi.fn(() => true)
      ecs.query([Health], { filter: filterFn })
      expect(filterFn).toHaveBeenCalledWith(expect.objectContaining({ current: 75, max: 100 }))
    })

    it('only returns entities passing filter', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      const id3 = ecs.createEntity()
      ecs.addComponent(id1, Health, { current: 25, max: 100 })
      ecs.addComponent(id2, Health, { current: 50, max: 100 })
      ecs.addComponent(id3, Health, { current: 75, max: 100 })

      const results = ecs.query([Health], { filter: (h) => h.current < 60 })
      expect(results).toHaveLength(2)
      expect(results).toContain(id1)
      expect(results).toContain(id2)
    })
  })

  describe('With Exclude', () => {
    it('excludes entities with specified components', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id2, Position, { x: 5, y: 5, room_id: 'test' })
      ecs.addComponent(id2, Health, { current: 100, max: 100 })

      const results = ecs.query([Position], { exclude: [Health] })
      expect(results).toContain(id1)
      expect(results).not.toContain(id2)
    })

    it('combines with required components correctly', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      const id3 = ecs.createEntity()
      ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id1, Velocity, { dx: 1, dy: 1 })
      ecs.addComponent(id2, Position, { x: 5, y: 5, room_id: 'test' })
      ecs.addComponent(id2, Velocity, { dx: 1, dy: 1 })
      ecs.addComponent(id2, Health, { current: 100, max: 100 })
      ecs.addComponent(id3, Position, { x: 10, y: 10, room_id: 'test' })

      const results = ecs.query([Position, Velocity], { exclude: [Health] })
      expect(results).toContain(id1)
      expect(results).not.toContain(id2)
      expect(results).not.toContain(id3)
    })
  })

  describe('Performance', () => {
    it('handles 1000 entities efficiently', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        const id = ecs.createEntity()
        ecs.addComponent(id, Position, { x: i, y: i, room_id: 'test' })
        if (i % 2 === 0) {
          ecs.addComponent(id, Velocity, { dx: 1, dy: 1 })
        }
      }
      const results = ecs.query([Position, Velocity])
      const elapsed = Date.now() - start
      expect(results.length).toBe(500)
      expect(elapsed).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('uses indexed lookups', () => {
      // This test verifies that queries use efficient SQL JOINs
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id, Velocity, { dx: 1, dy: 1 })

      const spy = vi.spyOn(db, 'all')
      ecs.query([Position, Velocity])
      expect(spy).toHaveBeenCalled()

      // Verify the SQL uses JOIN for multiple components
      const calls = spy.mock.calls
      const queryCalls = calls.filter(call => {
        const sql = typeof call[0] === 'string' ? call[0] : (call[0] as any).sql
        return sql && typeof sql === 'string' && sql.includes('component_position') && sql.includes('component_velocity')
      })
      expect(queryCalls.length).toBeGreaterThan(0)

      // Check that JOIN is used (not separate queries)
      const sql = typeof queryCalls[0][0] === 'string' ? queryCalls[0][0] : (queryCalls[0][0] as any).sql
      expect(sql.toUpperCase()).toMatch(/JOIN/)
    })
  })
})

describe('ecs.queryWithData()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health])
    await ecs.initialize()
  })

  describe('Basic Query', () => {
    it('returns entity ids with component data', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })

      const results = ecs.queryWithData([Position])
      expect(results.length).toBe(1)
      expect(results[0]?.entityId).toBe(id)
    })

    it('returns object with entityId property', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })

      const results = ecs.queryWithData([Position])
      expect(results[0]).toHaveProperty('entityId')
    })

    it('includes data for each queried component', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      ecs.addComponent(id, Health, { current: 75, max: 100 })

      const results = ecs.queryWithData([Position, Health])
      expect(results[0]).toHaveProperty('position')
      expect(results[0]).toHaveProperty('health')
    })

    it('component data keyed by component name', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 5, y: 10, room_id: 'test' })

      const results = ecs.queryWithData([Position])
      expect(results[0]?.position).toMatchObject({ x: 5, y: 10, room_id: 'test' })
    })
  })

  describe('With Filter', () => {
    it('applies filter function', () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Health, { current: 50, max: 100 })
      ecs.addComponent(id2, Health, { current: 100, max: 100 })

      const results = ecs.queryWithData([Health], { filter: (h) => h.current < 100 })
      expect(results.length).toBe(1)
      expect(results[0]?.entityId).toBe(id1)
    })

    it('filter receives all component data', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      ecs.addComponent(id, Health, { current: 50, max: 100 })

      const filterFn = vi.fn(() => true)
      ecs.queryWithData([Position, Health], { filter: filterFn })
      expect(filterFn).toHaveBeenCalled()
    })
  })
})

describe('ecs.rawQuery()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position])
    await ecs.initialize()
  })

  describe('SQL Execution', () => {
    it('executes arbitrary SQL query', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })

      const results = ecs.rawQuery('SELECT * FROM component_position')
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(1)
    })

    it('returns result rows', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })

      const results = ecs.rawQuery('SELECT * FROM component_position')
      expect(Array.isArray(results)).toBe(true)
    })

    it('supports parameterized queries', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })

      const results = ecs.rawQuery('SELECT * FROM component_position WHERE x = ?', [10])
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(1)
    })

    it('handles SELECT queries', () => {
      const results = ecs.rawQuery('SELECT * FROM entities')
      expect(Array.isArray(results)).toBe(true)
    })

    it('handles aggregate queries', () => {
      ecs.createEntity()
      ecs.createEntity()

      const results = ecs.rawQuery('SELECT COUNT(*) as count FROM entities')
      expect(Array.isArray(results)).toBe(true)
      expect(results[0]).toHaveProperty('count')
      expect(results[0].count).toBe(2)
    })
  })

  describe('Validation', () => {
    it('throws DatabaseError for invalid SQL', () => {
      expect(() => {
        ecs.rawQuery('INVALID SQL SYNTAX')
      }).toThrow(DatabaseError)
    })
  })
})

describe('ecs.transaction()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health])
    await ecs.initialize()
  })

  describe('Basic Transaction', () => {
    it('executes callback in transaction', async () => {
      const callback = vi.fn()
      await ecs.transaction(callback)
      expect(callback).toHaveBeenCalled()
    })

    it('commits on success', async () => {
      let entityId: string | null = null
      await ecs.transaction(() => {
        entityId = ecs.createEntity()
        ecs.addComponent(entityId, Position, { x: 0, y: 0, room_id: 'test' })
      })
      expect(entityId).toBeDefined()
      expect(ecs.hasComponent(entityId!, Position)).toBe(true)
    })

    it('all operations visible after commit', async () => {
      let id1: string | null = null
      let id2: string | null = null
      await ecs.transaction(() => {
        id1 = ecs.createEntity()
        id2 = ecs.createEntity()
        ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })
        ecs.addComponent(id2, Position, { x: 5, y: 5, room_id: 'test' })
      })
      expect(ecs.query([Position]).length).toBe(2)
    })
  })

  describe('Rollback', () => {
    it('rolls back on error', async () => {
      let entityId: string | null = null
      try {
        await ecs.transaction(() => {
          entityId = ecs.createEntity()
          ecs.addComponent(entityId, Position, { x: 0, y: 0, room_id: 'test' })
          throw new Error('Rollback test')
        })
      } catch (e) {
        // Expected
      }
      expect(ecs.query([Position]).length).toBe(0)
    })

    it('entity not created on rollback', async () => {
      let entityId: string | null = null
      try {
        await ecs.transaction(() => {
          entityId = ecs.createEntity()
          throw new Error('Rollback')
        })
      } catch (e) {
        // Expected
      }
      const entities = ecs.rawQuery('SELECT * FROM entities')
      expect(entities.length).toBe(0)
    })

    it('component not added on rollback', async () => {
      const id = ecs.createEntity()
      try {
        await ecs.transaction(() => {
          ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
          throw new Error('Rollback')
        })
      } catch (e) {
        // Expected
      }
      expect(ecs.hasComponent(id, Position)).toBe(false)
    })

    it('throws the original error', async () => {
      const customError = new Error('Custom error')
      await expect(ecs.transaction(() => {
        throw customError
      })).rejects.toThrow('Custom error')
    })
  })

  describe('Nested Transactions', () => {
    it('supports nested transaction calls', async () => {
      await ecs.transaction(async () => {
        ecs.createEntity()
        await ecs.transaction(() => {
          ecs.createEntity()
        })
      })
      expect(ecs.rawQuery('SELECT * FROM entities').length).toBe(2)
    })

    it('inner rollback rolls back outer', async () => {
      try {
        await ecs.transaction(async () => {
          ecs.createEntity()
          await ecs.transaction(() => {
            ecs.createEntity()
            throw new Error('Rollback both')
          })
        })
      } catch (e) {
        // Expected
      }
      expect(ecs.rawQuery('SELECT * FROM entities').length).toBe(0)
    })
  })
})

describe('Bulk Operations', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health])
    await ecs.initialize()
  })

  describe('ecs.addComponentBulk()', () => {
    it('adds component to multiple entities', () => {
      const ids = [ecs.createEntity(), ecs.createEntity(), ecs.createEntity()]
      ecs.addComponentBulk(ids, Position, { x: 0, y: 0, room_id: 'test' })

      ids.forEach(id => {
        expect(ecs.hasComponent(id, Position)).toBe(true)
      })
    })

    it('uses single transaction', async () => {
      const ids = [ecs.createEntity(), ecs.createEntity()]
      const txSpy = vi.spyOn(db, 'transaction')
      ecs.addComponentBulk(ids, Position, { x: 0, y: 0, room_id: 'test' })
      expect(txSpy).toHaveBeenCalled()
    })

    it('all or nothing on error', async () => {
      const id1 = ecs.createEntity()
      const id2 = ecs.createEntity()
      ecs.addComponent(id1, Position, { x: 0, y: 0, room_id: 'test' })

      // Bulk operation should fail due to duplicate on id1
      // Transaction should roll back, so id2 shouldn't get the component
      try {
        await ecs.addComponentBulk([id1, id2], Position, { x: 5, y: 5, room_id: 'test' })
      } catch (error) {
        // Expected to fail
      }

      // id2 should not have component since transaction rolled back
      expect(ecs.hasComponent(id2, Position)).toBe(false)
      // id1 should still have original component
      const pos1 = ecs.getComponent(id1, Position)
      expect(pos1?.x).toBe(0)
    })

    it('fires events for each entity', () => {
      const callback = vi.fn()
      ecs.onComponentAdded(Position, callback)
      const ids = [ecs.createEntity(), ecs.createEntity()]
      ecs.addComponentBulk(ids, Position, { x: 0, y: 0, room_id: 'test' })
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })

  describe('ecs.removeComponentBulk()', () => {
    it('removes component from multiple entities', () => {
      const ids = [ecs.createEntity(), ecs.createEntity(), ecs.createEntity()]
      ids.forEach(id => {
        ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      })

      ecs.removeComponentBulk(ids, Position)

      ids.forEach(id => {
        expect(ecs.hasComponent(id, Position)).toBe(false)
      })
    })

    it('uses single transaction', () => {
      const ids = [ecs.createEntity(), ecs.createEntity()]
      ids.forEach(id => {
        ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      })

      const txSpy = vi.spyOn(db, 'transaction')
      ecs.removeComponentBulk(ids, Position)
      expect(txSpy).toHaveBeenCalled()
    })

    it('fires events for each entity', () => {
      const ids = [ecs.createEntity(), ecs.createEntity()]
      ids.forEach(id => {
        ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      })

      const callback = vi.fn()
      ecs.onComponentRemoved(Position, callback)
      ecs.removeComponentBulk(ids, Position)
      expect(callback).toHaveBeenCalledTimes(2)
    })
  })
})

describe('Event System', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health])
    await ecs.initialize()
  })

  describe('onEntityCreated', () => {
    it('fires when entity created', () => {
      const callback = vi.fn()
      ecs.onEntityCreated(callback)
      const id = ecs.createEntity()
      expect(callback).toHaveBeenCalledWith(id)
    })

    it('receives entity id', () => {
      const callback = vi.fn()
      ecs.onEntityCreated(callback)
      const id = ecs.createEntity()
      expect(callback).toHaveBeenCalledWith(id)
    })

    it('multiple listeners supported', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      ecs.onEntityCreated(callback1)
      ecs.onEntityCreated(callback2)
      ecs.createEntity()
      expect(callback1).toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })

  describe('onEntityDestroyed', () => {
    it('fires when entity destroyed', () => {
      const callback = vi.fn()
      ecs.onEntityDestroyed(callback)
      const id = ecs.createEntity()
      ecs.destroyEntity(id)
      expect(callback).toHaveBeenCalledWith(id)
    })

    it('receives entity id', () => {
      const callback = vi.fn()
      ecs.onEntityDestroyed(callback)
      const id = ecs.createEntity()
      ecs.destroyEntity(id)
      expect(callback).toHaveBeenCalledWith(id)
    })
  })

  describe('onComponentAdded', () => {
    it('fires for specific component type', () => {
      const posCallback = vi.fn()
      const healthCallback = vi.fn()
      ecs.onComponentAdded(Position, posCallback)
      ecs.onComponentAdded(Health, healthCallback)

      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })

      expect(posCallback).toHaveBeenCalled()
      expect(healthCallback).not.toHaveBeenCalled()
    })

    it('receives entity id and data', () => {
      const callback = vi.fn()
      ecs.onComponentAdded(Position, callback)
      const id = ecs.createEntity()
      const data = { x: 10, y: 20, room_id: 'test' }
      ecs.addComponent(id, Position, data)
      expect(callback).toHaveBeenCalledWith(id, expect.objectContaining(data))
    })

    it('fires after data committed', () => {
      const callback = vi.fn(() => {
        const results = ecs.query([Position])
        expect(results.length).toBeGreaterThan(0)
      })
      ecs.onComponentAdded(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('onComponentRemoved', () => {
    it('fires for specific component type', () => {
      const callback = vi.fn()
      ecs.onComponentRemoved(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      expect(callback).toHaveBeenCalledWith(id)
    })

    it('receives entity id', () => {
      const callback = vi.fn()
      ecs.onComponentRemoved(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      expect(callback).toHaveBeenCalledWith(id)
    })

    it('fires after removal committed', () => {
      const callback = vi.fn(() => {
        expect(ecs.query([Position]).length).toBe(0)
      })
      ecs.onComponentRemoved(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.removeComponent(id, Position)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('onComponentUpdated', () => {
    it('fires for specific component type', () => {
      const callback = vi.fn()
      ecs.onComponentUpdated(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.updateComponent(id, Position, { x: 10 })
      expect(callback).toHaveBeenCalled()
    })

    it('receives entity id, old data, new data', () => {
      const callback = vi.fn()
      ecs.onComponentUpdated(Position, callback)
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.updateComponent(id, Position, { x: 10 })
      expect(callback).toHaveBeenCalledWith(
        id,
        expect.objectContaining({ x: 0 }),
        expect.objectContaining({ x: 10 })
      )
    })

    it('fires after update committed', () => {
      const callback = vi.fn(() => {
        const pos = ecs.getComponent(id, Position)
        expect(pos?.x).toBe(10)
      })
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.onComponentUpdated(Position, callback)
      ecs.updateComponent(id, Position, { x: 10 })
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('Unsubscribe', () => {
    it('returns unsubscribe function', () => {
      const unsubscribe = ecs.onEntityCreated(() => {})
      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribe stops events', () => {
      const callback = vi.fn()
      const unsubscribe = ecs.onEntityCreated(callback)
      ecs.createEntity()
      expect(callback).toHaveBeenCalledTimes(1)
      unsubscribe()
      ecs.createEntity()
      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('other listeners unaffected', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const unsubscribe1 = ecs.onEntityCreated(callback1)
      ecs.onEntityCreated(callback2)
      unsubscribe1()
      ecs.createEntity()
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).toHaveBeenCalled()
    })
  })
})

describe('Archetypes', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health, Description])
    await ecs.initialize()
  })

  describe('defineArchetype()', () => {
    it('creates archetype from component list', () => {
      const archetype = ecs.defineArchetype([Position, Health])
      expect(archetype).toHaveProperty('components')
      expect(archetype.components).toEqual([Position, Health])
    })

    it('validates all components exist', () => {
      const UnknownComp = defineComponent('unknown', { field: 'string' })
      expect(() => {
        ecs.defineArchetype([Position, UnknownComp])
      }).toThrow(ValidationError)
    })

    it('returns archetype definition', () => {
      const archetype = ecs.defineArchetype([Position, Health])
      expect(archetype).toHaveProperty('components')
    })
  })

  describe('createFromArchetype()', () => {
    it('creates entity with all archetype components', () => {
      const archetype = ecs.defineArchetype([Position, Health])
      const id = ecs.createFromArchetype(archetype, {
        position: { x: 0, y: 0, room_id: 'test' },
        health: { current: 100, max: 100 },
      })
      expect(ecs.hasComponent(id, Position)).toBe(true)
      expect(ecs.hasComponent(id, Health)).toBe(true)
    })

    it('accepts initial data for each component', () => {
      const archetype = ecs.defineArchetype([Position, Health])
      const id = ecs.createFromArchetype(archetype, {
        position: { x: 10, y: 20, room_id: 'room1' },
        health: { current: 75, max: 100 },
      })
      const pos = ecs.getComponent(id, Position)
      const health = ecs.getComponent(id, Health)
      expect(pos).toMatchObject({ x: 10, y: 20 })
      expect(health).toMatchObject({ current: 75, max: 100 })
    })

    it('returns entity id', () => {
      const archetype = ecs.defineArchetype([Position])
      const id = ecs.createFromArchetype(archetype, {
        position: { x: 0, y: 0, room_id: 'test' },
      })
      expect(typeof id).toBe('string')
    })

    it('fires onComponentAdded for each', () => {
      const callback = vi.fn()
      ecs.onComponentAdded(Position, callback)
      const archetype = ecs.defineArchetype([Position, Health])
      ecs.createFromArchetype(archetype, {
        position: { x: 0, y: 0, room_id: 'test' },
        health: { current: 100, max: 100 },
      })
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for missing component data', () => {
      const archetype = ecs.defineArchetype([Position, Health])
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.createFromArchetype(archetype, {
          position: { x: 0, y: 0, room_id: 'test' },
        })
      }).toThrow(ValidationError)
    })

    it('validates each component data', () => {
      const archetype = ecs.defineArchetype([Position])
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.createFromArchetype(archetype, {
          position: { x: 'invalid', y: 0, room_id: 'test' },
        })
      }).toThrow(ValidationError)
    })
  })
})

describe('ecs.addIndex()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position])
    await ecs.initialize()
  })

  describe('Index Creation', () => {
    it('creates index on component field', () => {
      expect(() => {
        ecs.addIndex(Position, 'x')
      }).not.toThrow()
    })

    it('index speeds up queries on that field', () => {
      // Create many entities
      for (let i = 0; i < 100; i++) {
        const id = ecs.createEntity()
        ecs.addComponent(id, Position, { x: i, y: 0, room_id: 'test' })
      }

      ecs.addIndex(Position, 'x')

      // Query should still work
      const results = ecs.rawQuery('SELECT * FROM component_position WHERE x = 50')
      expect(results.length).toBeGreaterThan(0)
    })

    it('can create multiple indexes', () => {
      expect(() => {
        ecs.addIndex(Position, 'x')
        ecs.addIndex(Position, 'y')
      }).not.toThrow()
    })

    it('index persists across restarts', () => {
      ecs.addIndex(Position, 'x')
      const indexes = db.getIndexes('component_position')
      expect(Array.isArray(indexes)).toBe(true)
      expect(indexes.length).toBeGreaterThan(0)
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for unknown component', () => {
      const UnknownComp = defineComponent('unknown', { field: 'string' })
      expect(() => {
        ecs.addIndex(UnknownComp, 'field')
      }).toThrow(ValidationError)
    })

    it('throws ValidationError for unknown field', () => {
      expect(() => {
        // @ts-expect-error - Testing runtime validation
        ecs.addIndex(Position, 'unknownField')
      }).toThrow(ValidationError)
    })
  })
})

describe('ecs.getDatabase()', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [])
    await ecs.initialize()
  })

  describe('Database Access', () => {
    it('returns underlying database instance', () => {
      const returnedDb = ecs.getDatabase()
      expect(returnedDb).toBe(db)
    })

    it('can execute direct SQL on database', () => {
      const returnedDb = ecs.getDatabase()
      expect(() => {
        returnedDb.exec('CREATE TABLE test_table (id INTEGER)')
      }).not.toThrow()
    })
  })
})

describe('Integration Tests', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Velocity, Health, Description])
    await ecs.initialize()
  })

  describe('Complex Workflows', () => {
    it('create entity, add components, query, update, destroy', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id, Health, { current: 100, max: 100 })

      const entities = ecs.query([Position, Health])
      expect(entities).toContain(id)

      ecs.updateComponent(id, Health, { current: 50 })
      expect(ecs.getComponent(id, Health)?.current).toBe(50)

      ecs.destroyEntity(id)
      expect(ecs.query([Position]).length).toBe(0)
    })

    it('multiple entity types coexist', () => {
      // Player
      const player = ecs.createEntity()
      ecs.addComponent(player, Position, { x: 0, y: 0, room_id: 'start' })
      ecs.addComponent(player, Health, { current: 100, max: 100 })

      // NPC
      const npc = ecs.createEntity()
      ecs.addComponent(npc, Position, { x: 5, y: 5, room_id: 'start' })
      ecs.addComponent(npc, Description, { short: 'Guard', long: 'A guard' })

      // Item
      const item = ecs.createEntity()
      ecs.addComponent(item, Position, { x: 10, y: 10, room_id: 'start' })

      expect(ecs.query([Position]).length).toBe(3)
      expect(ecs.query([Position, Health]).length).toBe(1)
      expect(ecs.query([Position, Description]).length).toBe(1)
    })

    it('large scale operations complete', () => {
      const ids = []
      for (let i = 0; i < 100; i++) {
        const id = ecs.createEntity()
        ecs.addComponent(id, Position, { x: i, y: i, room_id: 'test' })
        ids.push(id)
      }

      expect(ecs.query([Position]).length).toBe(100)

      // Update all
      ids.forEach(id => {
        ecs.updateComponent(id, Position, { x: 0 })
      })

      // Verify
      const results = ecs.queryWithData([Position])
      results.forEach(r => {
        expect(r.position?.x).toBe(0)
      })
    })
  })

  describe('Persistence', () => {
    it('data survives database close/reopen', async () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })

      // Simulate close/reopen by creating new ECS with same db
      const ecs2 = createECS(db, [Position])
      await ecs2.initialize()

      const pos = ecs2.getComponent(id, Position)
      expect(pos).toMatchObject({ x: 10, y: 20, room_id: 'test' })
    })

    it('queries work after restore', async () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 10, y: 20, room_id: 'test' })
      ecs.addComponent(id, Velocity, { dx: 1, dy: 1 })

      const ecs2 = createECS(db, [Position, Velocity])
      await ecs2.initialize()

      const results = ecs2.query([Position, Velocity])
      expect(results).toContain(id)
    })

    it('events fire after restore', async () => {
      const id = ecs.createEntity()

      const ecs2 = createECS(db, [Position])
      await ecs2.initialize()

      const callback = vi.fn()
      ecs2.onComponentAdded(Position, callback)
      ecs2.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })

      expect(callback).toHaveBeenCalled()
    })
  })
})

describe('Edge Cases', () => {
  let db: Database
  let ecs: ReturnType<typeof createECS>

  beforeEach(async () => {
    db = createTestDatabase()
    ecs = createECS(db, [Position, Health, Inventory])
    await ecs.initialize()
  })

  describe('Empty State', () => {
    it('query returns empty for no entities', () => {
      const results = ecs.query([Position])
      expect(results).toEqual([])
    })

    it('getComponent returns null for no entities', () => {
      const pos = ecs.getComponent('nonexistent', Position)
      expect(pos).toBeNull()
    })
  })

  describe('Large Data', () => {
    it('handles 10000 entities', () => {
      for (let i = 0; i < 10000; i++) {
        const id = ecs.createEntity()
        if (i % 2 === 0) {
          ecs.addComponent(id, Position, { x: i, y: i, room_id: 'test' })
        }
      }
      expect(ecs.query([Position]).length).toBe(5000)
    })

    it('handles component with large json field', () => {
      const id = ecs.createEntity()
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item${i}` }))
      ecs.addComponent(id, Inventory, { capacity: 1000, items: largeArray })
      const inv = ecs.getComponent(id, Inventory)
      expect(inv?.items).toHaveLength(1000)
    })

    it('handles many components per entity', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      ecs.addComponent(id, Health, { current: 100, max: 100 })
      ecs.addComponent(id, Inventory, { capacity: 10, items: [] })

      expect(ecs.hasComponent(id, Position)).toBe(true)
      expect(ecs.hasComponent(id, Health)).toBe(true)
      expect(ecs.hasComponent(id, Inventory)).toBe(true)
    })
  })

  describe('Concurrent Operations', () => {
    it('transactions serialize correctly', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          ecs.transaction(() => {
            const id = ecs.createEntity()
            ecs.addComponent(id, Position, { x: i, y: i, room_id: 'test' })
          })
        )
      }
      await Promise.all(promises)
      expect(ecs.query([Position]).length).toBe(10)
    })

    it('no data corruption under load', async () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Health, { current: 100, max: 100 })

      const updates = []
      for (let i = 0; i < 50; i++) {
        updates.push(
          ecs.transaction(() => {
            const health = ecs.getComponent(id, Health)
            if (health) {
              ecs.updateComponent(id, Health, { current: health.current - 1 })
            }
          })
        )
      }

      await Promise.all(updates)
      const finalHealth = ecs.getComponent(id, Health)
      expect(finalHealth?.current).toBeLessThanOrEqual(100)
      expect(finalHealth?.current).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Unicode', () => {
    it('handles unicode in string fields', () => {
      const id = ecs.createEntity()
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: '测试房间🏠' })
      const pos = ecs.getComponent(id, Position)
      expect(pos?.room_id).toBe('测试房间🏠')
    })

    it('handles unicode in entity ids', () => {
      const id = ecs.createEntity('实体-123-🎮')
      ecs.addComponent(id, Position, { x: 0, y: 0, room_id: 'test' })
      expect(ecs.hasComponent(id, Position)).toBe(true)
    })

    it('handles unicode in json fields', () => {
      const id = ecs.createEntity()
      const items = [{ name: '剑⚔️', description: 'Une épée magique' }]
      ecs.addComponent(id, Inventory, { capacity: 10, items })
      const inv = ecs.getComponent(id, Inventory)
      expect(inv?.items[0]?.name).toBe('剑⚔️')
    })
  })
})
