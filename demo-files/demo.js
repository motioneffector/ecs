// ============================================
// DEMO LOGIC AND EXHIBIT CODE
// ============================================

// Import library and expose globally for tests
import * as Library from '../dist/index.js'
window.Library = Library

// Extract library exports
const { defineComponent, createECS, ECSError, ValidationError, DatabaseError } = Library

// ============================================
// MOCK DATABASE FOR BROWSER
// ============================================

class MockDatabase {
  constructor() {
    this.entities = new Map()
    this.componentTables = new Map()
    this.indices = new Map()
    this.transactionDepth = 0
  }

  exec(sql) {
    // Handle CREATE TABLE statements
    if (sql.includes('CREATE TABLE')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)
      if (match) {
        const tableName = match[1]
        if (tableName !== 'entities' && !this.componentTables.has(tableName)) {
          this.componentTables.set(tableName, new Map())
        }
      }
    }

    // Handle CREATE INDEX
    if (sql.includes('CREATE INDEX')) {
      const match = sql.match(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+) \((\w+)\)/)
      if (match) {
        const [, indexName, tableName, fieldName] = match
        if (!this.indices.has(tableName)) {
          this.indices.set(tableName, new Set())
        }
        this.indices.get(tableName).add(fieldName)
      }
    }
  }

  run(sql, params = []) {
    // INSERT INTO entities
    if (sql.includes('INSERT INTO entities')) {
      const [id, created_at] = params
      this.entities.set(id, { id, created_at })
      return { changes: 1, lastInsertRowId: 1 }
    }

    // INSERT INTO component table
    if (sql.includes('INSERT INTO component_')) {
      const match = sql.match(/INSERT INTO (component_\w+)/)
      if (match) {
        const tableName = match[1]
        const table = this.componentTables.get(tableName)
        const fieldMatch = sql.match(/\(([^)]+)\) VALUES/)
        if (fieldMatch) {
          const fields = fieldMatch[1].split(',').map(f => f.trim())
          const data = {}
          fields.forEach((field, i) => {
            data[field] = params[i]
          })
          table.set(params[0], data)
        }
        return { changes: 1, lastInsertRowId: 1 }
      }
    }

    // DELETE FROM entities
    if (sql.includes('DELETE FROM entities')) {
      const id = params[0]
      const existed = this.entities.has(id)
      this.entities.delete(id)
      // Cascade delete
      for (const table of this.componentTables.values()) {
        table.delete(id)
      }
      return { changes: existed ? 1 : 0 }
    }

    // DELETE FROM component table
    if (sql.includes('DELETE FROM component_')) {
      const match = sql.match(/DELETE FROM (component_\w+)/)
      if (match) {
        const tableName = match[1]
        const table = this.componentTables.get(tableName)
        const entityId = params[0]
        const existed = table.has(entityId)
        table.delete(entityId)
        return { changes: existed ? 1 : 0 }
      }
    }

    // UPDATE component table
    if (sql.includes('UPDATE component_')) {
      const match = sql.match(/UPDATE (component_\w+) SET (.+) WHERE/)
      if (match) {
        const tableName = match[1]
        const setClause = match[2]
        const fields = setClause.split(',').map(s => s.trim().split('=')[0].trim())
        const table = this.componentTables.get(tableName)
        const entityId = params[params.length - 1]
        const existing = table.get(entityId)
        if (existing) {
          const updated = { ...existing }
          fields.forEach((field, i) => {
            updated[field] = params[i]
          })
          table.set(entityId, updated)
          return { changes: 1 }
        }
      }
    }

    return { changes: 0 }
  }

  get(sql, params = []) {
    // SELECT from entities
    if (sql.includes('SELECT id FROM entities WHERE id')) {
      const id = params[0]
      return this.entities.get(id)
    }

    // SELECT from component table
    if (sql.includes('SELECT * FROM component_')) {
      const match = sql.match(/SELECT \* FROM (component_\w+)/)
      if (match) {
        const tableName = match[1]
        const table = this.componentTables.get(tableName)
        const entityId = params[0]
        return table?.get(entityId)
      }
    }

    return undefined
  }

  all(sql, params = []) {
    // SELECT all entities
    if (sql === 'SELECT id FROM entities') {
      return Array.from(this.entities.values())
    }

    // SELECT from component table for query
    if (sql.includes('SELECT') && sql.includes('entity_id FROM component_')) {
      // Parse the query to extract table joins
      const tableMatches = [...sql.matchAll(/component_\w+/g)]
      if (tableMatches.length === 1) {
        // Single component query
        const tableName = tableMatches[0][0]
        const table = this.componentTables.get(tableName)
        if (table) {
          return Array.from(table.keys()).map(entityId => ({ entity_id: entityId }))
        }
      } else if (tableMatches.length > 1) {
        // Multi-component query (INNER JOIN)
        const tables = tableMatches.map(m => this.componentTables.get(m[0]))
        const firstTable = tables[0]
        if (!firstTable) return []

        const result = []
        for (const entityId of firstTable.keys()) {
          const hasAll = tables.every(t => t && t.has(entityId))
          if (hasAll) {
            result.push({ entity_id: entityId })
          }
        }
        return result
      }
    }

    // SELECT entity_id from specific component table
    if (sql.includes('SELECT entity_id FROM component_')) {
      const match = sql.match(/SELECT entity_id FROM (component_\w+)/)
      if (match) {
        const tableName = match[1]
        const table = this.componentTables.get(tableName)
        if (table) {
          return Array.from(table.keys()).map(entityId => ({ entity_id: entityId }))
        }
      }
    }

    return []
  }

  transaction(callback) {
    this.transactionDepth++
    try {
      const result = callback()
      this.transactionDepth--
      return Promise.resolve(result)
    } catch (error) {
      this.transactionDepth--
      return Promise.reject(error)
    }
  }
}

// Make MockDatabase available globally for tests
window.MockDatabase = MockDatabase

// ============================================
// COMPONENT DEFINITIONS
// ============================================

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })
const Name = defineComponent('Name', { value: 'string' })
const Inventory = defineComponent('Inventory', { items: 'json' })
const Active = defineComponent('Active', { enabled: 'boolean' })

// ============================================
// SHARED ECS INSTANCE
// ============================================

let demoECS = null
let eventUnsubscribers = []

function initializeDemoECS() {
  const db = new MockDatabase()
  demoECS = createECS(db, [Position, Health, Name, Inventory, Active])
  demoECS.initialize()
  return demoECS
}

// Initialize on load (but don't run any operations)
document.addEventListener('DOMContentLoaded', () => {
  initializeDemoECS()

  // Set up initial placeholder text but don't execute anything
  const interactiveOutput = document.getElementById('interactive-output')
  if (interactiveOutput && !interactiveOutput.textContent.trim()) {
    interactiveOutput.textContent = 'Results will appear here...'
    interactiveOutput.dataset.placeholder = 'true'
  }

  const eventLog = document.getElementById('event-log')
  if (eventLog && !eventLog.textContent.trim()) {
    eventLog.textContent = 'Event log (enable event logging first)...'
    eventLog.dataset.placeholder = 'true'
  }

  // Wire up event listeners for buttons
  const createEntityBtn = document.getElementById('create-entity-btn')
  if (createEntityBtn) {
    createEntityBtn.addEventListener('click', createEntityManual)
  }

  const addComponentBtn = document.getElementById('add-component-btn')
  if (addComponentBtn) {
    addComponentBtn.addEventListener('click', addComponentManual)
  }

  const queryBtn = document.getElementById('query-btn')
  if (queryBtn) {
    queryBtn.addEventListener('click', queryEntitiesManual)
  }

  const enableEventsBtn = document.getElementById('enable-events-btn')
  if (enableEventsBtn) {
    enableEventsBtn.addEventListener('click', setupEventListeners)
  }

  const clearEventsBtn = document.getElementById('clear-events-btn')
  if (clearEventsBtn) {
    clearEventsBtn.addEventListener('click', clearEventLog)
  }
})

// ============================================
// EXHIBIT 1: ENTITY & COMPONENT MANAGEMENT
// ============================================

function createEntityManual() {
  const customId = document.getElementById('entityId').value.trim() || undefined
  const output = document.getElementById('interactive-output')

  try {
    const entityId = demoECS.createEntity(customId)

    // Animate result display
    output.classList.remove('animate-in')
    void output.offsetWidth // Force reflow
    output.classList.add('animate-in')

    output.textContent = `✓ Created entity: ${entityId}`
    output.style.background = '#e8f5e9'
    output.style.borderColor = '#4CAF50'

    document.getElementById('entityId').value = ''

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  } catch (e) {
    output.classList.remove('animate-in')
    void output.offsetWidth
    output.classList.add('animate-in')

    output.textContent = `✗ Error: ${e.message}`
    output.style.background = '#ffebee'
    output.style.borderColor = '#f44336'

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  }
}

function addComponentManual() {
  const entityId = document.getElementById('addEntityId').value.trim()
  const componentName = document.getElementById('componentSelect').value
  const output = document.getElementById('interactive-output')

  if (!entityId) {
    output.textContent = '⚠ Please enter an entity ID'
    output.style.background = '#fff3e0'
    output.style.borderColor = '#ff9800'
    return
  }

  try {
    let component, data
    switch (componentName) {
      case 'Position':
        component = Position
        data = { x: Math.round(Math.random() * 100), y: Math.round(Math.random() * 100) }
        break
      case 'Health':
        component = Health
        data = { current: 100, max: 100 }
        break
      case 'Name':
        component = Name
        data = { value: 'Entity-' + Math.floor(Math.random() * 1000) }
        break
    }

    demoECS.addComponent(entityId, component, data)

    // Animate result display
    output.classList.remove('animate-in')
    void output.offsetWidth
    output.classList.add('animate-in')

    output.textContent = `✓ Added ${componentName} to ${entityId}:\n${JSON.stringify(data, null, 2)}`
    output.style.background = '#e8f5e9'
    output.style.borderColor = '#4CAF50'

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  } catch (e) {
    output.classList.remove('animate-in')
    void output.offsetWidth
    output.classList.add('animate-in')

    output.textContent = `✗ Error: ${e.message}`
    output.style.background = '#ffebee'
    output.style.borderColor = '#f44336'

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  }
}

function queryEntitiesManual() {
  const queryType = document.getElementById('queryComponent').value
  const output = document.getElementById('interactive-output')

  try {
    let components, results
    if (queryType.includes(',')) {
      const names = queryType.split(',')
      components = names.map(name => {
        switch (name.trim()) {
          case 'Position': return Position
          case 'Health': return Health
          case 'Name': return Name
        }
      })
      results = demoECS.queryWithData(components)
    } else {
      switch (queryType) {
        case 'Position': components = [Position]; break
        case 'Health': components = [Health]; break
        case 'Name': components = [Name]; break
      }
      results = demoECS.query(components)
    }

    // Animate result display with sequential reveal
    output.classList.remove('animate-in')
    void output.offsetWidth
    output.classList.add('animate-in')

    const resultText = `✓ Found ${results.length} ${results.length === 1 ? 'entity' : 'entities'}:\n${JSON.stringify(results, null, 2)}`
    output.textContent = ''

    // Reveal text character by character for visual effect
    let i = 0
    const revealInterval = setInterval(() => {
      if (i < resultText.length) {
        output.textContent += resultText[i]
        i++
      } else {
        clearInterval(revealInterval)
      }
    }, 10)

    output.style.background = '#e3f2fd'
    output.style.borderColor = '#2196F3'

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  } catch (e) {
    output.classList.remove('animate-in')
    void output.offsetWidth
    output.classList.add('animate-in')

    output.textContent = `✗ Error: ${e.message}`
    output.style.background = '#ffebee'
    output.style.borderColor = '#f44336'

    setTimeout(() => {
      output.style.background = ''
      output.style.borderColor = ''
    }, 2000)
  }
}

// ============================================
// EXHIBIT 2: EVENT SYSTEM
// ============================================

function setupEventListeners() {
  // Clear existing listeners
  eventUnsubscribers.forEach(unsub => unsub())
  eventUnsubscribers = []

  const log = document.getElementById('event-log')
  log.textContent = ''
  delete log.dataset.placeholder

  // Add animated header
  const header = document.createElement('div')
  header.style.color = '#4CAF50'
  header.style.fontWeight = 'bold'
  header.style.marginBottom = '10px'
  header.textContent = '✓ Event logging enabled. Perform operations to see events...\n\n'
  log.appendChild(header)

  function addLogEntry(icon, color, text) {
    const entry = document.createElement('div')
    entry.style.animation = 'slideIn 0.2s ease'
    entry.style.padding = '4px 0'
    entry.innerHTML = `<span style="color: ${color}; font-weight: bold;">${icon}</span> ${text}`
    log.appendChild(entry)
    log.scrollTop = log.scrollHeight
  }

  eventUnsubscribers.push(
    demoECS.onEntityCreated((id) => {
      addLogEntry('✚', '#4CAF50', `EntityCreated: ${id}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onEntityDestroyed((id) => {
      addLogEntry('✖', '#f44336', `EntityDestroyed: ${id}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentAdded(Position, (id, data) => {
      addLogEntry('▲', '#2196F3', `ComponentAdded: Position on ${id} → ${JSON.stringify(data)}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentAdded(Health, (id, data) => {
      addLogEntry('▲', '#2196F3', `ComponentAdded: Health on ${id} → ${JSON.stringify(data)}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentAdded(Name, (id, data) => {
      addLogEntry('▲', '#2196F3', `ComponentAdded: Name on ${id} → ${JSON.stringify(data)}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentUpdated(Health, (id, oldData, newData) => {
      addLogEntry('↻', '#9c27b0', `ComponentUpdated: Health on ${id}\n  Old: ${JSON.stringify(oldData)}\n  New: ${JSON.stringify(newData)}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentRemoved(Position, (id) => {
      addLogEntry('▼', '#ff9800', `ComponentRemoved: Position from ${id}`)
    })
  )

  eventUnsubscribers.push(
    demoECS.onComponentRemoved(Health, (id) => {
      addLogEntry('▼', '#ff9800', `ComponentRemoved: Health from ${id}`)
    })
  )
}

function clearEventLog() {
  const log = document.getElementById('event-log')
  log.textContent = 'Event log cleared. Enable logging and perform operations to see events.'
  log.dataset.placeholder = 'true'
  log.style.color = '#757575'
  log.style.fontStyle = 'italic'

  setTimeout(() => {
    log.style.color = ''
    log.style.fontStyle = ''
  }, 1000)
}
