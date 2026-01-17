// Import library to ensure it is available (also set by demo.js)
import * as Library from '../dist/index.js'
if (!window.Library) window.Library = Library

// ============================================
// DEMO INTEGRITY TESTS
// These tests verify the demo itself is correctly structured.
// They are IDENTICAL across all @motioneffector demos.
// Do not modify, skip, or weaken these tests.
// ============================================

function registerIntegrityTests() {
  // ─────────────────────────────────────────────
  // STRUCTURAL INTEGRITY
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Library is loaded', () => {
    if (typeof window.Library === 'undefined') {
      throw new Error('window.Library is undefined - library not loaded')
    }
  })

  testRunner.registerTest('[Integrity] Library has exports', () => {
    const exports = Object.keys(window.Library)
    if (exports.length === 0) {
      throw new Error('window.Library has no exports')
    }
  })

  testRunner.registerTest('[Integrity] Test runner exists', () => {
    const runner = document.getElementById('test-runner')
    if (!runner) {
      throw new Error('No element with id="test-runner"')
    }
  })

  testRunner.registerTest('[Integrity] Test runner is first section after header', () => {
    const main = document.querySelector('main')
    if (!main) {
      throw new Error('No <main> element found')
    }
    const firstSection = main.querySelector('section')
    if (!firstSection || firstSection.id !== 'test-runner') {
      throw new Error('Test runner must be the first <section> inside <main>')
    }
  })

  testRunner.registerTest('[Integrity] Run All Tests button exists with correct format', () => {
    const btn = document.getElementById('run-all-tests')
    if (!btn) {
      throw new Error('No button with id="run-all-tests"')
    }
    const text = btn.textContent.trim()
    if (!text.includes('Run All Tests')) {
      throw new Error(`Button text must include "Run All Tests", got: "${text}"`)
    }
    const icon = btn.querySelector('.btn-icon')
    if (!icon || !icon.textContent.includes('▶')) {
      throw new Error('Button must have play icon (▶) in .btn-icon element')
    }
  })

  testRunner.registerTest('[Integrity] At least one exhibit exists', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    if (exhibits.length === 0) {
      throw new Error('No elements with class="exhibit"')
    }
  })

  testRunner.registerTest('[Integrity] All exhibits have unique IDs', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    const ids = new Set()
    exhibits.forEach(ex => {
      if (!ex.id) {
        throw new Error('Exhibit missing id attribute')
      }
      if (ids.has(ex.id)) {
        throw new Error(`Duplicate exhibit id: ${ex.id}`)
      }
      ids.add(ex.id)
    })
  })

  testRunner.registerTest('[Integrity] All exhibits registered for walkthrough', () => {
    const exhibitElements = document.querySelectorAll('.exhibit')
    const registeredCount = testRunner.exhibits.length
    if (registeredCount < exhibitElements.length) {
      throw new Error(
        `Only ${registeredCount} exhibits registered for walkthrough, ` +
        `but ${exhibitElements.length} .exhibit elements exist`
      )
    }
  })

  testRunner.registerTest('[Integrity] CSS loaded from demo-files/', () => {
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    const hasExternal = Array.from(links).some(link =>
      link.href.includes('demo-files/')
    )
    if (!hasExternal) {
      throw new Error('No stylesheet loaded from demo-files/ directory')
    }
  })

  testRunner.registerTest('[Integrity] No inline style tags', () => {
    const styles = document.querySelectorAll('style')
    if (styles.length > 0) {
      throw new Error(`Found ${styles.length} inline <style> tags - extract to demo-files/demo.css`)
    }
  })

  testRunner.registerTest('[Integrity] No inline onclick handlers', () => {
    const withOnclick = document.querySelectorAll('[onclick]')
    if (withOnclick.length > 0) {
      throw new Error(`Found ${withOnclick.length} elements with onclick - use addEventListener`)
    }
  })

  // ─────────────────────────────────────────────
  // NO AUTO-PLAY VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Output areas are empty on load', () => {
    const outputs = document.querySelectorAll('.exhibit-output, .output, [data-output], .interactive-output')
    outputs.forEach(output => {
      // Allow placeholder text but not actual content
      const hasPlaceholder = output.dataset.placeholder ||
        output.classList.contains('placeholder') ||
        output.querySelector('.placeholder')

      const text = output.textContent.trim()
      const children = output.children.length

      // If it has content that isn't a placeholder, that's a violation
      if ((text.length > 50 || children > 1) && !hasPlaceholder) {
        throw new Error(
          `Output area appears pre-populated: "${text.substring(0, 50)}..." - ` +
          `outputs must be empty until user interaction`
        )
      }
    })
  })

  testRunner.registerTest('[Integrity] No setTimeout calls on module load', () => {
    if (window.__suspiciousTimersDetected) {
      throw new Error(
        'Detected setTimeout/setInterval during page load - ' +
        'demos must not auto-run'
      )
    }
  })

  // ─────────────────────────────────────────────
  // REAL LIBRARY VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Library functions are callable', () => {
    const lib = window.Library
    const exports = Object.keys(lib)

    // At least one export must be a function
    const hasFunctions = exports.some(key => typeof lib[key] === 'function')
    if (!hasFunctions) {
      throw new Error('Library exports no callable functions')
    }
  })

  testRunner.registerTest('[Integrity] No mock implementations detected', () => {
    // Check for common mock patterns in window
    const suspicious = [
      'mockParse', 'mockValidate', 'fakeParse', 'fakeValidate',
      'stubParse', 'stubValidate', 'testParse', 'testValidate'
    ]
    suspicious.forEach(name => {
      if (typeof window[name] === 'function') {
        throw new Error(`Detected mock function: window.${name} - use real library`)
      }
    })
  })

  // ─────────────────────────────────────────────
  // VISUAL FEEDBACK VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] CSS includes animation definitions', () => {
    const sheets = document.styleSheets
    let hasAnimations = false

    try {
      for (const sheet of sheets) {
        // Skip cross-origin stylesheets
        if (!sheet.href || sheet.href.includes('demo-files/')) {
          const rules = sheet.cssRules || sheet.rules
          for (const rule of rules) {
            if (rule.type === CSSRule.KEYFRAMES_RULE ||
                (rule.style && (
                  rule.style.animation ||
                  rule.style.transition ||
                  rule.style.animationName
                ))) {
              hasAnimations = true
              break
            }
          }
        }
        if (hasAnimations) break
      }
    } catch (e) {
      // CORS error - assume external sheet has animations
      hasAnimations = true
    }

    if (!hasAnimations) {
      throw new Error('No CSS animations or transitions found - visual feedback required')
    }
  })

  testRunner.registerTest('[Integrity] Interactive elements have hover states', () => {
    const buttons = document.querySelectorAll('button, .btn')
    if (buttons.length === 0) return // No buttons to check

    // Check that enabled buttons have pointer cursor (disabled buttons should have not-allowed)
    const enabledBtn = Array.from(buttons).find(btn => !btn.disabled)
    if (!enabledBtn) return // All buttons are disabled, skip check

    const styles = window.getComputedStyle(enabledBtn)
    if (styles.cursor !== 'pointer') {
      throw new Error('Buttons should have cursor: pointer')
    }
  })

  // ─────────────────────────────────────────────
  // WALKTHROUGH REGISTRATION VERIFICATION
  // ─────────────────────────────────────────────

  testRunner.registerTest('[Integrity] Walkthrough demonstrations are async functions', () => {
    testRunner.exhibits.forEach(exhibit => {
      if (typeof exhibit.demonstrate !== 'function') {
        throw new Error(`Exhibit "${exhibit.name}" has no demonstrate function`)
      }
    })
  })

  testRunner.registerTest('[Integrity] Each exhibit has required elements', () => {
    const exhibits = document.querySelectorAll('.exhibit')
    exhibits.forEach(exhibit => {
      // Must have a title
      const title = exhibit.querySelector('.exhibit-title, h2, h3')
      if (!title) {
        throw new Error(`Exhibit ${exhibit.id} missing title element`)
      }

      // Must have an interactive area or content
      const interactive = exhibit.querySelector(
        '.exhibit-interactive, .exhibit-content, .control-group, [data-interactive]'
      )
      if (!interactive) {
        throw new Error(`Exhibit ${exhibit.id} missing interactive area`)
      }
    })
  })
}

// Call this function at the start
registerIntegrityTests()

// ============================================
// LIBRARY-SPECIFIC TESTS
// ============================================

// Component definition tests
testRunner.registerTest('defineComponent: creates component with valid schema', async () => {
  const comp = window.Library.defineComponent('TestComp', { field: 'string' })
  if (!comp.name || comp.name !== 'TestComp') throw new Error('Component name incorrect')
  if (!comp.schema || comp.schema.field !== 'string') throw new Error('Schema incorrect')
})

testRunner.registerTest('defineComponent: rejects empty name', async () => {
  try {
    window.Library.defineComponent('', { field: 'string' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

testRunner.registerTest('defineComponent: rejects empty schema', async () => {
  try {
    window.Library.defineComponent('Test', {})
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

testRunner.registerTest('defineComponent: rejects reserved field name "entity_id"', async () => {
  try {
    window.Library.defineComponent('Test', { entity_id: 'string' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
    if (!e.message.includes('reserved')) throw new Error('Wrong error message')
  }
})

testRunner.registerTest('defineComponent: rejects invalid field type', async () => {
  try {
    window.Library.defineComponent('Test', { field: 'invalid' })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

// Helper to create a MockDatabase - note: MockDatabase is defined in demo.js
function createMockDB() {
  // Access MockDatabase from window where demo.js exposes it
  if (typeof window.MockDatabase === 'undefined') {
    throw new Error('MockDatabase not available - demo.js must be loaded first')
  }
  return new window.MockDatabase()
}

// ECS initialization tests
testRunner.registerTest('createECS: initializes with empty component list', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  if (!ecs) throw new Error('ECS not created')
})

testRunner.registerTest('createECS: initializes with multiple components', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const Health = window.Library.defineComponent('Health', { current: 'number', max: 'number' })
  const ecs = window.Library.createECS(db, [Position, Health])
  await ecs.initialize()
  if (!ecs) throw new Error('ECS not created')
})

testRunner.registerTest('createECS: rejects duplicate component names', async () => {
  try {
    const db = createMockDB()
    const Dup1 = window.Library.defineComponent('Duplicate', { x: 'number' })
    const Dup2 = window.Library.defineComponent('Duplicate', { y: 'number' })
    window.Library.createECS(db, [Dup1, Dup2])
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
    if (!e.message.includes('Duplicate')) throw new Error('Wrong error message')
  }
})

// Entity creation tests
testRunner.registerTest('createEntity: generates unique auto ID', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  const id1 = ecs.createEntity()
  const id2 = ecs.createEntity()
  if (!id1 || !id2) throw new Error('Entity IDs not generated')
  if (id1 === id2) throw new Error('Entity IDs not unique')
})

testRunner.registerTest('createEntity: accepts custom ID', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  const id = ecs.createEntity('custom-123')
  if (id !== 'custom-123') throw new Error('Custom ID not used')
})

testRunner.registerTest('createEntity: rejects duplicate custom ID', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  ecs.createEntity('duplicate')
  try {
    ecs.createEntity('duplicate')
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

testRunner.registerTest('createEntity: rejects empty string ID', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  try {
    ecs.createEntity('')
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

// Entity destruction tests
testRunner.registerTest('destroyEntity: removes existing entity', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  const id = ecs.createEntity()
  const result = ecs.destroyEntity(id)
  if (!result) throw new Error('Entity not destroyed')
})

testRunner.registerTest('destroyEntity: returns false for non-existent entity', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  const result = ecs.destroyEntity('non-existent')
  if (result) throw new Error('Should return false for non-existent entity')
})

// Component operations tests
testRunner.registerTest('addComponent: adds valid component data', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const ecs = window.Library.createECS(db, [Position])
  await ecs.initialize()
  const id = ecs.createEntity()
  ecs.addComponent(id, Position, { x: 10, y: 20 })
  const data = ecs.getComponent(id, Position)
  if (!data || data.x !== 10 || data.y !== 20) throw new Error('Component data incorrect')
})

testRunner.registerTest('addComponent: rejects missing required fields', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const ecs = window.Library.createECS(db, [Position])
  await ecs.initialize()
  const id = ecs.createEntity()
  try {
    ecs.addComponent(id, Position, { x: 10 })
    throw new Error('Should have thrown ValidationError')
  } catch (e) {
    if (!(e instanceof window.Library.ValidationError)) throw new Error('Expected ValidationError')
  }
})

testRunner.registerTest('query: finds entities with single component', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const ecs = window.Library.createECS(db, [Position])
  await ecs.initialize()
  const e1 = ecs.createEntity()
  ecs.addComponent(e1, Position, { x: 0, y: 0 })
  const e2 = ecs.createEntity()
  ecs.addComponent(e2, Position, { x: 10, y: 10 })
  const results = ecs.query([Position])
  if (results.length !== 2) throw new Error(`Expected 2 entities, got ${results.length}`)
  if (!results.includes(e1) || !results.includes(e2)) throw new Error('Missing entities')
})

testRunner.registerTest('query: finds entities with multiple components', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const Health = window.Library.defineComponent('Health', { current: 'number', max: 'number' })
  const ecs = window.Library.createECS(db, [Position, Health])
  await ecs.initialize()
  const e1 = ecs.createEntity()
  ecs.addComponent(e1, Position, { x: 0, y: 0 })
  ecs.addComponent(e1, Health, { current: 100, max: 100 })
  const e2 = ecs.createEntity()
  ecs.addComponent(e2, Position, { x: 10, y: 10 })
  const results = ecs.query([Position, Health])
  if (results.length !== 1) throw new Error(`Expected 1 entity, got ${results.length}`)
  if (!results.includes(e1)) throw new Error('Wrong entity returned')
})

// Event tests
testRunner.registerTest('onEntityCreated: fires when entity is created', async () => {
  const db = createMockDB()
  const ecs = window.Library.createECS(db, [])
  await ecs.initialize()
  let fired = false
  let capturedId = null
  const unsub = ecs.onEntityCreated((id) => {
    fired = true
    capturedId = id
  })
  const entityId = ecs.createEntity()
  if (!fired) throw new Error('Event did not fire')
  if (capturedId !== entityId) throw new Error('Wrong entity ID')
  unsub()
})

testRunner.registerTest('onComponentAdded: fires when component is added', async () => {
  const db = createMockDB()
  const Position = window.Library.defineComponent('Position', { x: 'number', y: 'number' })
  const ecs = window.Library.createECS(db, [Position])
  await ecs.initialize()
  let fired = false
  const entityId = ecs.createEntity()
  const unsub = ecs.onComponentAdded(Position, (id, data) => {
    fired = true
    if (id !== entityId) throw new Error('Wrong entity ID')
    if (data.x !== 10 || data.y !== 20) throw new Error('Wrong data')
  })
  ecs.addComponent(entityId, Position, { x: 10, y: 20 })
  if (!fired) throw new Error('Event did not fire')
  unsub()
})

// ============================================
// EXHIBIT REGISTRATIONS FOR WALKTHROUGH
// ============================================

testRunner.registerExhibit(
  'Entity & Component Management',
  document.getElementById('exhibit-entity-management'),
  async () => {
    // Demonstrate creating an entity
    const entityIdInput = document.getElementById('entityId')
    const createBtn = document.querySelector('#exhibit-entity-management button')

    if (entityIdInput && createBtn) {
      entityIdInput.value = 'demo-entity-' + Date.now()
      await testRunner.delay(300)
      createBtn.click()
      await testRunner.delay(800)
    }

    // Demonstrate adding a component
    const addEntityIdInput = document.getElementById('addEntityId')
    const componentSelect = document.getElementById('componentSelect')
    const addBtn = document.querySelectorAll('#exhibit-entity-management .btn-action')[0]

    if (addEntityIdInput && componentSelect && addBtn && entityIdInput) {
      addEntityIdInput.value = entityIdInput.value || 'demo-entity'
      componentSelect.value = 'Position'
      await testRunner.delay(300)
      addBtn.click()
      await testRunner.delay(800)
    }

    // Demonstrate querying
    const querySelect = document.getElementById('queryComponent')
    const queryBtn = document.querySelectorAll('#exhibit-entity-management .btn-action')[1]

    if (querySelect && queryBtn) {
      querySelect.value = 'Position'
      await testRunner.delay(300)
      queryBtn.click()
      await testRunner.delay(800)
    }
  }
)

testRunner.registerExhibit(
  'Event System',
  document.getElementById('exhibit-events'),
  async () => {
    // Enable event logging
    const enableBtn = document.querySelector('#exhibit-events .btn-action')
    if (enableBtn) {
      enableBtn.click()
      await testRunner.delay(500)
    }

    // Create an entity (will trigger event)
    const createBtn = document.getElementById('exhibit-entity-management')?.querySelector('button')
    if (createBtn) {
      createBtn.click()
      await testRunner.delay(800)
    }
  }
)
