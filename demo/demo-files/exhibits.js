// ============================================
// EXHIBITS - ECS Demo Implementations
// ============================================

import { createDatabase } from '../../../sql/dist/index.js';
import { createECS, defineComponent } from '../../dist/index.js';
import {
  escapeHtml,
  formatTime,
  truncate,
  deepClone,
  getEntityIcon,
  getComponentColor,
  getComponentIcon,
  flashElement,
  pulseElement,
  throttle,
  resetIdCounter
} from './utils.js';

// ============================================
// SHARED ECS STATE
// ============================================

let db = null;
let ecs = null;
let Position = null;
let Health = null;
let Inventory = null;

// Track entities for exhibits
let allEntities = new Set();

// Export getters for test runner
export function getECS() { return ecs; }
export function getComponents() { return { Position, Health, Inventory }; }
export function getAllEntities() { return allEntities; }
export function getDatabase() { return db; }

// ============================================
// INITIALIZATION
// ============================================

export async function initExhibits() {
  // Create in-memory database
  db = await createDatabase();

  // Define components first
  Position = defineComponent('Position', { x: 'number', y: 'number' });
  Health = defineComponent('Health', { current: 'number', max: 'number' });
  Inventory = defineComponent('Inventory', { capacity: 'number', items: 'json' });

  // Create shared ECS instance with database and components
  ecs = createECS(db, [Position, Health, Inventory]);

  // Initialize the ECS (creates tables)
  await ecs.initialize();

  // Create initial entities
  await createInitialEntities();

  // Initialize all exhibits
  initExhibit1();
  initExhibit2();
  initExhibit3();
  initExhibit4();
}

async function createInitialEntities() {
  // Player entity
  const player = ecs.createEntity('player');
  ecs.addComponent(player, Position, { x: 100, y: 100 });
  ecs.addComponent(player, Health, { current: 85, max: 100 });
  ecs.addComponent(player, Inventory, { capacity: 20, items: [{ id: 'sword', qty: 1 }] });
  allEntities.add(player);

  // Enemy entity
  const enemy = ecs.createEntity('enemy-goblin');
  ecs.addComponent(enemy, Position, { x: 200, y: 150 });
  ecs.addComponent(enemy, Health, { current: 30, max: 30 });
  allEntities.add(enemy);

  // Chest entity
  const chest = ecs.createEntity('chest-01');
  ecs.addComponent(chest, Position, { x: 180, y: 120 });
  ecs.addComponent(chest, Inventory, { capacity: 10, items: [{ id: 'potion', qty: 3 }] });
  allEntities.add(chest);

  // Particle entity
  const particle = ecs.createEntity('particle-fx');
  ecs.addComponent(particle, Position, { x: 150, y: 140 });
  allEntities.add(particle);
}

// ============================================
// EXHIBIT 1: ENTITY-COMPONENT PLAYGROUND
// ============================================

let selectedEntity = null;
let isDragging = false;
let dragEntity = null;
let dragOffset = { x: 0, y: 0 };
let idCounter = 0;

function initExhibit1() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  // Canvas event handlers
  canvas.addEventListener('mousemove', (e) => handleCanvasMouseMove(e, canvas, ctx));
  canvas.addEventListener('mousedown', (e) => handleCanvasMouseDown(e, canvas));
  canvas.addEventListener('mouseup', (e) => handleCanvasMouseUp(e, canvas));
  canvas.addEventListener('mouseleave', () => { isDragging = false; });
  canvas.addEventListener('click', (e) => handleCanvasClick(e, canvas));

  // Control buttons
  document.getElementById('new-entity').addEventListener('click', () => createNewEntity());
  document.getElementById('new-entity-with-id').addEventListener('click', () => {
    const customId = document.getElementById('custom-entity-id').value.trim();
    if (customId) {
      createNewEntity(customId);
      document.getElementById('custom-entity-id').value = '';
    }
  });
  document.getElementById('reset-exhibit-1').addEventListener('click', resetExhibit1);

  // Initial render
  renderCanvas(canvas, ctx);
  renderInspector();
  updateExhibit1State();
}

function renderCanvas(canvas, ctx) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw entities with Position
  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;
    const pos = ecs.getComponent(entityId, Position);
    if (!pos) continue;

    const hasHealth = ecs.hasComponent(entityId, Health);
    const hasInventory = ecs.hasComponent(entityId, Inventory);

    // Determine icon
    let icon = '⬡';
    if (hasHealth && hasInventory) icon = '🧑';
    else if (hasHealth && !hasInventory) icon = '👹';
    else if (hasInventory && !hasHealth) icon = '📦';
    else icon = '✨';

    // Draw selection ring
    if (entityId === selectedEntity) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
      ctx.strokeStyle = '#8957e5';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw entity icon
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, pos.x, pos.y);

    // Draw health bar if has Health
    if (hasHealth) {
      const health = ecs.getComponent(entityId, Health);
      const barWidth = 30;
      const barHeight = 4;
      const healthPercent = health.current / health.max;

      ctx.fillStyle = '#21262d';
      ctx.fillRect(pos.x - barWidth / 2, pos.y + 14, barWidth, barHeight);

      ctx.fillStyle = healthPercent > 0.5 ? '#3fb950' : healthPercent > 0.25 ? '#d29922' : '#f85149';
      ctx.fillRect(pos.x - barWidth / 2, pos.y + 14, barWidth * healthPercent, barHeight);
    }

    // Draw entity ID label
    ctx.font = '10px monospace';
    ctx.fillStyle = '#8b949e';
    ctx.fillText(truncate(entityId, 12), pos.x, pos.y - 18);
  }
}

function renderInspector() {
  const list = document.getElementById('inspector-list');
  const noPositionEntities = document.getElementById('no-position-entities');

  let html = '';
  let noPositionHtml = '';

  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;

    const hasPosition = ecs.hasComponent(entityId, Position);
    const hasHealth = ecs.hasComponent(entityId, Health);
    const hasInventory = ecs.hasComponent(entityId, Inventory);

    const isSelected = entityId === selectedEntity;
    const components = [];
    if (hasPosition) components.push('Position');
    if (hasHealth) components.push('Health');
    if (hasInventory) components.push('Inventory');

    const icon = getEntityIcon(components);

    const cardHtml = `
      <div class="entity-card ${isSelected ? 'selected' : ''}" data-entity-id="${escapeHtml(entityId)}">
        <div class="entity-card-header">
          <span class="entity-icon">${icon}</span>
          <span class="entity-id">${escapeHtml(truncate(entityId, 20))}</span>
          <button class="btn btn-small btn-danger entity-delete" data-entity-id="${escapeHtml(entityId)}">×</button>
        </div>
        <div class="entity-badges">
          ${hasPosition ? `<span class="component-badge tag-blue" data-entity-id="${escapeHtml(entityId)}" data-component="Position">📍 Position <span class="badge-remove" data-entity-id="${escapeHtml(entityId)}" data-component="Position">×</span></span>` : ''}
          ${hasHealth ? `<span class="component-badge tag-red" data-entity-id="${escapeHtml(entityId)}" data-component="Health">❤️ Health <span class="badge-remove" data-entity-id="${escapeHtml(entityId)}" data-component="Health">×</span></span>` : ''}
          ${hasInventory ? `<span class="component-badge tag-yellow" data-entity-id="${escapeHtml(entityId)}" data-component="Inventory">📦 Inventory <span class="badge-remove" data-entity-id="${escapeHtml(entityId)}" data-component="Inventory">×</span></span>` : ''}
        </div>
        ${isSelected ? renderComponentEditor(entityId) : ''}
      </div>
    `;

    if (hasPosition) {
      html += cardHtml;
    } else {
      noPositionHtml += cardHtml;
    }
  }

  list.innerHTML = html || '<div class="inspector-empty">No entities with Position</div>';
  noPositionEntities.innerHTML = noPositionHtml;

  // Attach event listeners
  attachInspectorListeners();
}

function renderComponentEditor(entityId) {
  const hasPosition = ecs.hasComponent(entityId, Position);
  const hasHealth = ecs.hasComponent(entityId, Health);
  const hasInventory = ecs.hasComponent(entityId, Inventory);

  let html = '<div class="component-editor">';

  if (hasPosition) {
    const pos = ecs.getComponent(entityId, Position);
    html += `
      <div class="component-section">
        <div class="component-section-title">Position</div>
        <div class="component-fields">
          <label>x: <input type="number" class="input input-mono component-field" data-entity-id="${escapeHtml(entityId)}" data-component="Position" data-field="x" value="${pos.x}"></label>
          <label>y: <input type="number" class="input input-mono component-field" data-entity-id="${escapeHtml(entityId)}" data-component="Position" data-field="y" value="${pos.y}"></label>
        </div>
      </div>
    `;
  }

  if (hasHealth) {
    const health = ecs.getComponent(entityId, Health);
    html += `
      <div class="component-section">
        <div class="component-section-title">Health</div>
        <div class="component-fields">
          <label>current: <input type="number" class="input input-mono component-field" data-entity-id="${escapeHtml(entityId)}" data-component="Health" data-field="current" value="${health.current}"></label>
          <label>max: <input type="number" class="input input-mono component-field" data-entity-id="${escapeHtml(entityId)}" data-component="Health" data-field="max" value="${health.max}"></label>
        </div>
      </div>
    `;
  }

  if (hasInventory) {
    const inv = ecs.getComponent(entityId, Inventory);
    html += `
      <div class="component-section">
        <div class="component-section-title">Inventory</div>
        <div class="component-fields">
          <label>capacity: <input type="number" class="input input-mono component-field" data-entity-id="${escapeHtml(entityId)}" data-component="Inventory" data-field="capacity" value="${inv.capacity}"></label>
          <label>items: <span class="items-preview">${JSON.stringify(inv.items)}</span></label>
        </div>
      </div>
    `;
  }

  // Add component dropdown
  const availableComponents = [];
  if (!hasPosition) availableComponents.push('Position');
  if (!hasHealth) availableComponents.push('Health');
  if (!hasInventory) availableComponents.push('Inventory');

  if (availableComponents.length > 0) {
    html += `
      <div class="add-component-section">
        <select class="input add-component-select" data-entity-id="${escapeHtml(entityId)}">
          <option value="">+ Add Component</option>
          ${availableComponents.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

function attachInspectorListeners() {
  // Entity card click for selection
  document.querySelectorAll('.entity-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn') || e.target.classList.contains('input') ||
          e.target.classList.contains('badge-remove') || e.target.tagName === 'SELECT') return;
      const entityId = card.dataset.entityId;
      selectedEntity = selectedEntity === entityId ? null : entityId;
      renderInspector();
      renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    });
  });

  // Delete entity buttons
  document.querySelectorAll('.entity-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entityId = btn.dataset.entityId;
      deleteEntity(entityId);
    });
  });

  // Remove component badges
  document.querySelectorAll('.badge-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const entityId = btn.dataset.entityId;
      const componentName = btn.dataset.component;
      removeComponentFromEntity(entityId, componentName);
    });
  });

  // Component field editing
  document.querySelectorAll('.component-field').forEach(input => {
    input.addEventListener('change', (e) => {
      const entityId = input.dataset.entityId;
      const componentName = input.dataset.component;
      const field = input.dataset.field;
      const value = parseFloat(input.value) || 0;
      updateComponentField(entityId, componentName, field, value);
    });
  });

  // Add component dropdowns
  document.querySelectorAll('.add-component-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const entityId = select.dataset.entityId;
      const componentName = select.value;
      if (componentName) {
        addComponentToEntity(entityId, componentName);
        select.value = '';
      }
    });
  });
}

function handleCanvasMouseMove(e, canvas, ctx) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round(e.clientX - rect.left);
  const y = Math.round(e.clientY - rect.top);

  document.getElementById('canvas-coords').textContent = `(x: ${x}, y: ${y})`;

  if (isDragging && dragEntity) {
    const newX = Math.max(10, Math.min(canvas.width - 10, x - dragOffset.x));
    const newY = Math.max(10, Math.min(canvas.height - 10, y - dragOffset.y));

    ecs.updateComponent(dragEntity, Position, { x: newX, y: newY });
    renderCanvas(canvas, ctx);
    renderInspector();
    updateExhibit1State(`Updated ${truncate(dragEntity, 15)} Position to (${newX}, ${newY})`);

    // Notify other exhibits
    updateExhibit2Canvas();
  }
}

function handleCanvasMouseDown(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Check if clicking on an entity
  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;
    const pos = ecs.getComponent(entityId, Position);
    if (!pos) continue;

    const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
    if (dist < 20) {
      isDragging = true;
      dragEntity = entityId;
      dragOffset = { x: x - pos.x, y: y - pos.y };
      selectedEntity = entityId;
      renderInspector();
      return;
    }
  }
}

function handleCanvasMouseUp(e, canvas) {
  isDragging = false;
  dragEntity = null;
}

function handleCanvasClick(e, canvas) {
  if (isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const x = Math.round(e.clientX - rect.left);
  const y = Math.round(e.clientY - rect.top);

  // Check if clicking on existing entity
  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;
    const pos = ecs.getComponent(entityId, Position);
    if (!pos) continue;

    const dist = Math.sqrt((pos.x - x) ** 2 + (pos.y - y) ** 2);
    if (dist < 20) {
      selectedEntity = entityId;
      renderInspector();
      renderCanvas(canvas, canvas.getContext('2d'));
      return;
    }
  }

  // Create new entity at click position
  const newId = `entity-${++idCounter}`;
  createEntityAtPosition(newId, x, y);
}

function createNewEntity(customId = null) {
  const entityId = customId || `entity-${++idCounter}`;

  try {
    ecs.createEntity(entityId);
    allEntities.add(entityId);
    selectedEntity = entityId;

    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Created entity "${truncate(entityId, 15)}"`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function createEntityAtPosition(entityId, x, y) {
  try {
    ecs.createEntity(entityId);
    ecs.addComponent(entityId, Position, { x, y });
    allEntities.add(entityId);
    selectedEntity = entityId;

    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Created "${truncate(entityId, 15)}" at (${x}, ${y})`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function deleteEntity(entityId) {
  try {
    ecs.destroyEntity(entityId);
    allEntities.delete(entityId);
    if (selectedEntity === entityId) selectedEntity = null;

    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Destroyed "${truncate(entityId, 15)}"`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function addComponentToEntity(entityId, componentName) {
  try {
    let component, data;
    switch (componentName) {
      case 'Position':
        component = Position;
        data = { x: 200, y: 150 };
        break;
      case 'Health':
        component = Health;
        data = { current: 100, max: 100 };
        break;
      case 'Inventory':
        component = Inventory;
        data = { capacity: 10, items: [] };
        break;
    }

    ecs.addComponent(entityId, component, data);
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Added ${componentName} to "${truncate(entityId, 15)}"`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function removeComponentFromEntity(entityId, componentName) {
  try {
    let component;
    switch (componentName) {
      case 'Position': component = Position; break;
      case 'Health': component = Health; break;
      case 'Inventory': component = Inventory; break;
    }

    ecs.removeComponent(entityId, component);
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Removed ${componentName} from "${truncate(entityId, 15)}"`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function updateComponentField(entityId, componentName, field, value) {
  try {
    let component;
    switch (componentName) {
      case 'Position': component = Position; break;
      case 'Health': component = Health; break;
      case 'Inventory': component = Inventory; break;
    }

    ecs.updateComponent(entityId, component, { [field]: value });
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit1State(`Updated ${componentName}.${field} on "${truncate(entityId, 15)}"`);
    updateExhibit2Canvas();
  } catch (e) {
    updateExhibit1State(`Error: ${e.message}`);
  }
}

function updateExhibit1State(action = null) {
  let posCount = 0, healthCount = 0, invCount = 0;

  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;
    if (ecs.hasComponent(entityId, Position)) posCount++;
    if (ecs.hasComponent(entityId, Health)) healthCount++;
    if (ecs.hasComponent(entityId, Inventory)) invCount++;
  }

  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id));
  document.getElementById('entity-count').textContent = `${validEntities.length} entities`;
  document.getElementById('component-stats').textContent = `📍${posCount} ❤️${healthCount} 📦${invCount}`;

  if (action) {
    document.getElementById('last-action').textContent = action;
  }
}

function resetExhibit1() {
  // Destroy all current entities
  for (const entityId of [...allEntities]) {
    try {
      ecs.destroyEntity(entityId);
    } catch (e) {}
  }
  allEntities.clear();
  selectedEntity = null;
  idCounter = 0;

  // Recreate initial entities
  createInitialEntities();

  renderInspector();
  renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
  updateExhibit1State('Reset to initial state');
  updateExhibit2Canvas();
  updateExhibit2Query();
}

// ============================================
// EXHIBIT 2: QUERY EXPLORER
// ============================================

let queryFilters = [];
let queryRequired = [];
let queryExcluded = [];

function initExhibit2() {
  const canvas = document.getElementById('query-canvas');
  const ctx = canvas.getContext('2d');

  // Checkbox listeners for required components
  document.getElementById('req-position').addEventListener('change', updateExhibit2Query);
  document.getElementById('req-health').addEventListener('change', updateExhibit2Query);
  document.getElementById('req-inventory').addEventListener('change', updateExhibit2Query);

  // Checkbox listeners for excluded components
  document.getElementById('excl-position').addEventListener('change', updateExhibit2Query);
  document.getElementById('excl-health').addEventListener('change', updateExhibit2Query);
  document.getElementById('excl-inventory').addEventListener('change', updateExhibit2Query);

  // Filter builder
  document.getElementById('add-filter').addEventListener('click', showFilterBuilder);
  document.getElementById('apply-filter').addEventListener('click', applyFilter);
  document.getElementById('cancel-filter').addEventListener('click', hideFilterBuilder);
  document.getElementById('filter-component').addEventListener('change', updateFilterFields);

  // Control buttons
  document.getElementById('clear-query').addEventListener('click', clearQuery);
  document.getElementById('copy-query-code').addEventListener('click', copyQueryCode);

  // Initial render
  renderQueryCanvas(canvas, ctx, []);
  updateQueryCodePreview();
}

function updateExhibit2Canvas() {
  const canvas = document.getElementById('query-canvas');
  const ctx = canvas.getContext('2d');
  const matchingEntities = executeCurrentQuery();
  renderQueryCanvas(canvas, ctx, matchingEntities);
}

function updateExhibit2Query() {
  queryRequired = [];
  queryExcluded = [];

  if (document.getElementById('req-position').checked) queryRequired.push(Position);
  if (document.getElementById('req-health').checked) queryRequired.push(Health);
  if (document.getElementById('req-inventory').checked) queryRequired.push(Inventory);

  if (document.getElementById('excl-position').checked) queryExcluded.push(Position);
  if (document.getElementById('excl-health').checked) queryExcluded.push(Health);
  if (document.getElementById('excl-inventory').checked) queryExcluded.push(Inventory);

  const startTime = performance.now();
  const matchingEntities = executeCurrentQuery();
  const queryTime = (performance.now() - startTime).toFixed(1);

  // Update canvas
  const canvas = document.getElementById('query-canvas');
  const ctx = canvas.getContext('2d');
  renderQueryCanvas(canvas, ctx, matchingEntities);

  // Update results
  const totalEntities = [...allEntities].filter(id => ecs.hasEntity(id)).length;
  document.getElementById('query-match-count').textContent =
    `Matching: ${matchingEntities.length} of ${totalEntities} entities`;
  document.getElementById('query-time').textContent = `${queryTime}ms`;

  // Update results list
  renderQueryResults(matchingEntities);

  // Update code preview
  updateQueryCodePreview();
}

function executeCurrentQuery() {
  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id));

  if (queryRequired.length === 0 && queryExcluded.length === 0 && queryFilters.length === 0) {
    return validEntities;
  }

  return validEntities.filter(entityId => {
    // Check required components
    for (const comp of queryRequired) {
      if (!ecs.hasComponent(entityId, comp)) return false;
    }

    // Check excluded components
    for (const comp of queryExcluded) {
      if (ecs.hasComponent(entityId, comp)) return false;
    }

    // Check data filters
    for (const filter of queryFilters) {
      let component;
      switch (filter.component) {
        case 'Position': component = Position; break;
        case 'Health': component = Health; break;
        case 'Inventory': component = Inventory; break;
      }

      if (!ecs.hasComponent(entityId, component)) return false;

      const data = ecs.getComponent(entityId, component);
      const fieldValue = data[filter.field];
      const filterValue = parseFloat(filter.value) || filter.value;

      switch (filter.operator) {
        case '=': if (fieldValue !== filterValue) return false; break;
        case '!=': if (fieldValue === filterValue) return false; break;
        case '>': if (fieldValue <= filterValue) return false; break;
        case '<': if (fieldValue >= filterValue) return false; break;
        case '>=': if (fieldValue < filterValue) return false; break;
        case '<=': if (fieldValue > filterValue) return false; break;
      }
    }

    return true;
  });
}

function renderQueryCanvas(canvas, ctx, matchingEntities) {
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid
  ctx.strokeStyle = '#21262d';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw entities
  for (const entityId of allEntities) {
    if (!ecs.hasEntity(entityId)) continue;
    const pos = ecs.getComponent(entityId, Position);
    if (!pos) continue;

    const isMatch = matchingEntities.includes(entityId);
    const hasHealth = ecs.hasComponent(entityId, Health);
    const hasInventory = ecs.hasComponent(entityId, Inventory);

    let icon = '⬡';
    if (hasHealth && hasInventory) icon = '🧑';
    else if (hasHealth && !hasInventory) icon = '👹';
    else if (hasInventory && !hasHealth) icon = '📦';
    else icon = '✨';

    // Draw glow for matching entities
    if (isMatch) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#3fb950';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#3fb950';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Set opacity based on match
    ctx.globalAlpha = isMatch ? 1 : 0.3;

    // Draw entity
    ctx.font = isMatch ? '24px sans-serif' : '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, pos.x, pos.y);

    // Draw label
    ctx.font = '10px monospace';
    ctx.fillStyle = isMatch ? '#e6edf3' : '#6e7681';
    ctx.fillText(truncate(entityId, 12), pos.x, pos.y - 18);

    ctx.globalAlpha = 1;
  }
}

function renderQueryResults(matchingEntities) {
  const list = document.getElementById('query-results-list');

  if (matchingEntities.length === 0) {
    list.innerHTML = '<div class="query-no-results">No entities match</div>';
    return;
  }

  let html = '';
  for (const entityId of matchingEntities) {
    const components = [];
    if (ecs.hasComponent(entityId, Position)) components.push('Position');
    if (ecs.hasComponent(entityId, Health)) components.push('Health');
    if (ecs.hasComponent(entityId, Inventory)) components.push('Inventory');

    html += `
      <div class="query-result-item" data-entity-id="${escapeHtml(entityId)}">
        <span class="result-icon">${getEntityIcon(components)}</span>
        <span class="result-id">${escapeHtml(entityId)}</span>
        <span class="result-badges">${components.map(c => `<span class="tag ${getComponentColor(c)}">${c}</span>`).join('')}</span>
      </div>
    `;
  }

  list.innerHTML = html;
}

function showFilterBuilder() {
  document.getElementById('filter-builder').classList.remove('hidden');
  updateFilterFields();
}

function hideFilterBuilder() {
  document.getElementById('filter-builder').classList.add('hidden');
}

function updateFilterFields() {
  const component = document.getElementById('filter-component').value;
  const fieldSelect = document.getElementById('filter-field');

  let fields = [];
  switch (component) {
    case 'Position': fields = ['x', 'y']; break;
    case 'Health': fields = ['current', 'max']; break;
    case 'Inventory': fields = ['capacity']; break;
  }

  fieldSelect.innerHTML = fields.map(f => `<option value="${f}">${f}</option>`).join('');
}

function applyFilter() {
  const component = document.getElementById('filter-component').value;
  const field = document.getElementById('filter-field').value;
  const operator = document.getElementById('filter-operator').value;
  const value = document.getElementById('filter-value').value;

  if (!value) return;

  queryFilters.push({ component, field, operator, value });
  renderFilterChips();
  hideFilterBuilder();
  updateExhibit2Query();
}

function renderFilterChips() {
  const container = document.getElementById('filter-chips');

  container.innerHTML = queryFilters.map((f, i) => `
    <span class="filter-chip">
      ${f.component}.${f.field} ${f.operator} ${f.value}
      <span class="filter-remove" data-index="${i}">×</span>
    </span>
  `).join('');

  // Attach remove listeners
  container.querySelectorAll('.filter-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      queryFilters.splice(parseInt(btn.dataset.index), 1);
      renderFilterChips();
      updateExhibit2Query();
    });
  });
}

function updateQueryCodePreview() {
  let code = 'ecs.query(';

  const requiredNames = queryRequired.map(c => c.name);
  code += `[${requiredNames.join(', ')}]`;

  const options = [];
  if (queryExcluded.length > 0) {
    options.push(`exclude: [${queryExcluded.map(c => c.name).join(', ')}]`);
  }
  if (queryFilters.length > 0) {
    const filterCode = queryFilters.map(f =>
      `data.${f.component}.${f.field} ${f.operator} ${f.value}`
    ).join(' && ');
    options.push(`filter: (data) => ${filterCode}`);
  }

  if (options.length > 0) {
    code += `, {\n  ${options.join(',\n  ')}\n}`;
  }

  code += ')';

  document.getElementById('query-code-preview').textContent = code;
}

function clearQuery() {
  queryRequired = [];
  queryExcluded = [];
  queryFilters = [];

  document.getElementById('req-position').checked = false;
  document.getElementById('req-health').checked = false;
  document.getElementById('req-inventory').checked = false;
  document.getElementById('excl-position').checked = false;
  document.getElementById('excl-health').checked = false;
  document.getElementById('excl-inventory').checked = false;

  renderFilterChips();
  updateExhibit2Query();
}

function copyQueryCode() {
  const code = document.getElementById('query-code-preview').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('copy-query-code');
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
  });
}

// ============================================
// EXHIBIT 3: EVENT STREAM
// ============================================

let eventLog = [];
let eventSubscriptions = {};
let currentEventEntity = null;
let eventEntityCounter = 0;

function initExhibit3() {
  // Set up event subscriptions
  setupEventSubscriptions();

  // Action button listeners
  document.getElementById('evt-create-entity').addEventListener('click', createEventEntity);
  document.getElementById('evt-destroy-entity').addEventListener('click', destroyEventEntity);
  document.getElementById('evt-add-position').addEventListener('click', addPositionToEventEntity);
  document.getElementById('evt-add-health').addEventListener('click', addHealthToEventEntity);
  document.getElementById('evt-update-health').addEventListener('click', updateHealthOnEventEntity);
  document.getElementById('evt-remove-health').addEventListener('click', removeHealthFromEventEntity);

  // Filter toggle listeners
  document.getElementById('filter-entity-created').addEventListener('change', updateEventFilters);
  document.getElementById('filter-entity-destroyed').addEventListener('change', updateEventFilters);
  document.getElementById('filter-component-added').addEventListener('change', updateEventFilters);
  document.getElementById('filter-component-removed').addEventListener('change', updateEventFilters);
  document.getElementById('filter-component-updated').addEventListener('change', updateEventFilters);

  // Clear log button
  document.getElementById('clear-event-log').addEventListener('click', clearEventLog);

  updateEventDisplay();
}

function setupEventSubscriptions() {
  // Entity created
  eventSubscriptions.entityCreated = ecs.onEntityCreated((entityId) => {
    if (document.getElementById('filter-entity-created').checked) {
      addEventEntry('entity-created', `EntityCreated`, entityId);
    }
  });

  // Entity destroyed
  eventSubscriptions.entityDestroyed = ecs.onEntityDestroyed((entityId) => {
    if (document.getElementById('filter-entity-destroyed').checked) {
      addEventEntry('entity-destroyed', `EntityDestroyed`, entityId);
    }
  });

  // Component added
  eventSubscriptions.positionAdded = ecs.onComponentAdded(Position, (entityId, data) => {
    if (document.getElementById('filter-component-added').checked) {
      addEventEntry('component-added', `ComponentAdded`, `${entityId} → Position ${JSON.stringify(data)}`);
    }
  });

  eventSubscriptions.healthAdded = ecs.onComponentAdded(Health, (entityId, data) => {
    if (document.getElementById('filter-component-added').checked) {
      addEventEntry('component-added', `ComponentAdded`, `${entityId} → Health ${JSON.stringify(data)}`);
    }
  });

  eventSubscriptions.inventoryAdded = ecs.onComponentAdded(Inventory, (entityId, data) => {
    if (document.getElementById('filter-component-added').checked) {
      addEventEntry('component-added', `ComponentAdded`, `${entityId} → Inventory`);
    }
  });

  // Component removed
  eventSubscriptions.positionRemoved = ecs.onComponentRemoved(Position, (entityId) => {
    if (document.getElementById('filter-component-removed').checked) {
      addEventEntry('component-removed', `ComponentRemoved`, `${entityId} → Position`);
    }
  });

  eventSubscriptions.healthRemoved = ecs.onComponentRemoved(Health, (entityId) => {
    if (document.getElementById('filter-component-removed').checked) {
      addEventEntry('component-removed', `ComponentRemoved`, `${entityId} → Health`);
    }
  });

  eventSubscriptions.inventoryRemoved = ecs.onComponentRemoved(Inventory, (entityId) => {
    if (document.getElementById('filter-component-removed').checked) {
      addEventEntry('component-removed', `ComponentRemoved`, `${entityId} → Inventory`);
    }
  });

  // Component updated
  eventSubscriptions.positionUpdated = ecs.onComponentUpdated(Position, (entityId, oldData, newData) => {
    if (document.getElementById('filter-component-updated').checked) {
      addEventEntry('component-updated', `ComponentUpdated`,
        `${entityId} → Position (${oldData.x},${oldData.y})→(${newData.x},${newData.y})`);
    }
  });

  eventSubscriptions.healthUpdated = ecs.onComponentUpdated(Health, (entityId, oldData, newData) => {
    if (document.getElementById('filter-component-updated').checked) {
      addEventEntry('component-updated', `ComponentUpdated`,
        `${entityId} → Health {current: ${oldData.current}→${newData.current}}`);
    }
  });

  eventSubscriptions.inventoryUpdated = ecs.onComponentUpdated(Inventory, (entityId, oldData, newData) => {
    if (document.getElementById('filter-component-updated').checked) {
      addEventEntry('component-updated', `ComponentUpdated`, `${entityId} → Inventory`);
    }
  });
}

function addEventEntry(type, eventName, details) {
  const entry = {
    time: formatTime(),
    type,
    eventName,
    details
  };

  eventLog.unshift(entry);

  // Limit log size
  if (eventLog.length > 100) {
    eventLog = eventLog.slice(0, 100);
  }

  renderEventLog();
  updateEventDisplay();
}

function renderEventLog() {
  const log = document.getElementById('event-log');

  if (eventLog.length === 0) {
    log.innerHTML = '<div class="event-log-empty">No events captured</div>';
    return;
  }

  const icons = {
    'entity-created': { icon: '+', class: 'event-created' },
    'entity-destroyed': { icon: '×', class: 'event-destroyed' },
    'component-added': { icon: '▲', class: 'event-added' },
    'component-removed': { icon: '▼', class: 'event-removed' },
    'component-updated': { icon: '↻', class: 'event-updated' }
  };

  log.innerHTML = eventLog.map(entry => {
    const { icon, class: cls } = icons[entry.type] || { icon: '?', class: '' };
    return `
      <div class="event-entry ${cls}">
        <span class="event-time">${entry.time}</span>
        <span class="event-icon">${icon}</span>
        <span class="event-name">${escapeHtml(entry.eventName)}</span>
        <span class="event-details">${escapeHtml(entry.details)}</span>
      </div>
    `;
  }).join('');
}

function updateEventDisplay() {
  let activeCount = 0;
  if (document.getElementById('filter-entity-created').checked) activeCount++;
  if (document.getElementById('filter-entity-destroyed').checked) activeCount++;
  if (document.getElementById('filter-component-added').checked) activeCount++;
  if (document.getElementById('filter-component-removed').checked) activeCount++;
  if (document.getElementById('filter-component-updated').checked) activeCount++;

  document.getElementById('subscription-count').textContent = `Listening to ${activeCount} event types`;
  document.getElementById('event-counter').textContent = `${eventLog.length} events captured`;
}

function updateEventFilters() {
  updateEventDisplay();
}

function createEventEntity() {
  const entityId = `demo-evt-${++eventEntityCounter}`;
  try {
    ecs.createEntity(entityId);
    allEntities.add(entityId);
    currentEventEntity = entityId;
    document.getElementById('current-entity-display').textContent = entityId;

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function destroyEventEntity() {
  if (!currentEventEntity || !ecs.hasEntity(currentEventEntity)) return;

  try {
    ecs.destroyEntity(currentEventEntity);
    allEntities.delete(currentEventEntity);
    currentEventEntity = null;
    document.getElementById('current-entity-display').textContent = 'None';

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function addPositionToEventEntity() {
  if (!currentEventEntity || !ecs.hasEntity(currentEventEntity)) return;
  if (ecs.hasComponent(currentEventEntity, Position)) return;

  try {
    ecs.addComponent(currentEventEntity, Position, { x: 50, y: 50 });

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function addHealthToEventEntity() {
  if (!currentEventEntity || !ecs.hasEntity(currentEventEntity)) return;
  if (ecs.hasComponent(currentEventEntity, Health)) return;

  try {
    ecs.addComponent(currentEventEntity, Health, { current: 100, max: 100 });

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function updateHealthOnEventEntity() {
  if (!currentEventEntity || !ecs.hasEntity(currentEventEntity)) return;
  if (!ecs.hasComponent(currentEventEntity, Health)) return;

  try {
    const newHealth = Math.floor(Math.random() * 100);
    ecs.updateComponent(currentEventEntity, Health, { current: newHealth });

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function removeHealthFromEventEntity() {
  if (!currentEventEntity || !ecs.hasEntity(currentEventEntity)) return;
  if (!ecs.hasComponent(currentEventEntity, Health)) return;

  try {
    ecs.removeComponent(currentEventEntity, Health);

    // Update other exhibits
    renderInspector();
    renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
    updateExhibit2Canvas();
  } catch (e) {
    console.error(e);
  }
}

function clearEventLog() {
  eventLog = [];
  renderEventLog();
  updateEventDisplay();
}

// ============================================
// EXHIBIT 4: TRANSACTION LAB
// ============================================

let transactionActive = false;
let transactionOperations = [];
let beforeState = null;
let txEntityCounter = 0;
let txCreatedEntities = [];

function initExhibit4() {
  document.getElementById('start-transaction').addEventListener('click', startTransaction);
  document.getElementById('tx-create-entity').addEventListener('click', queueCreateEntity);
  document.getElementById('tx-add-component').addEventListener('click', queueAddComponent);
  document.getElementById('tx-update-component').addEventListener('click', queueUpdateComponent);
  document.getElementById('tx-remove-component').addEventListener('click', queueRemoveComponent);
  document.getElementById('tx-destroy-entity').addEventListener('click', queueDestroyEntity);
  document.getElementById('tx-commit').addEventListener('click', commitTransaction);
  document.getElementById('tx-rollback').addEventListener('click', rollbackTransaction);
  document.getElementById('tx-cancel').addEventListener('click', cancelTransaction);

  renderTransactionState();
}

function renderTransactionState() {
  const beforePanel = document.getElementById('tx-before-state');
  const afterPanel = document.getElementById('tx-after-state');

  const stateHtml = generateStateHtml();

  if (transactionActive) {
    beforePanel.innerHTML = beforeState || stateHtml;
    afterPanel.innerHTML = stateHtml;
  } else {
    beforePanel.innerHTML = stateHtml;
    afterPanel.innerHTML = stateHtml;
  }
}

function generateStateHtml() {
  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id));

  if (validEntities.length === 0) {
    return '<div class="state-empty">No entities</div>';
  }

  return validEntities.map(entityId => {
    const components = [];
    if (ecs.hasComponent(entityId, Position)) components.push('Position');
    if (ecs.hasComponent(entityId, Health)) components.push('Health');
    if (ecs.hasComponent(entityId, Inventory)) components.push('Inventory');

    return `
      <div class="state-entity">
        <span class="state-entity-id">${escapeHtml(truncate(entityId, 15))}</span>
        <span class="state-entity-components">${components.map(c => `<span class="tag ${getComponentColor(c)}">${c}</span>`).join('')}</span>
      </div>
    `;
  }).join('');
}

function startTransaction() {
  transactionActive = true;
  transactionOperations = [];
  txCreatedEntities = [];
  beforeState = generateStateHtml();

  document.getElementById('start-transaction').disabled = true;
  document.getElementById('tx-op-buttons').classList.remove('hidden');
  document.getElementById('tx-commit-buttons').classList.remove('hidden');

  document.getElementById('transaction-status').textContent = 'Transaction in progress (0 operations queued)';
  document.getElementById('transaction-message').classList.add('hidden');

  renderOperationQueue();
  renderTransactionState();
}

function queueCreateEntity() {
  if (!transactionActive) return;

  const entityId = `tx-entity-${++txEntityCounter}`;
  transactionOperations.push({
    type: 'create',
    entityId,
    display: `Create entity "${entityId}"`
  });

  txCreatedEntities.push(entityId);
  updateTransactionUI();
}

function queueAddComponent() {
  if (!transactionActive) return;

  // Get available entities (existing + created in transaction)
  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id));
  const availableEntities = [...validEntities, ...txCreatedEntities];

  if (availableEntities.length === 0) {
    alert('No entities available');
    return;
  }

  // Simple prompt for demo
  const entityId = availableEntities[availableEntities.length - 1];
  const components = ['Position', 'Health', 'Inventory'];
  const component = components[Math.floor(Math.random() * components.length)];

  transactionOperations.push({
    type: 'addComponent',
    entityId,
    component,
    display: `Add ${component} to "${truncate(entityId, 12)}"`
  });

  updateTransactionUI();
}

function queueUpdateComponent() {
  if (!transactionActive) return;

  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id) && ecs.hasComponent(id, Health));

  if (validEntities.length === 0) {
    alert('No entities with Health component');
    return;
  }

  const entityId = validEntities[0];

  transactionOperations.push({
    type: 'updateComponent',
    entityId,
    component: 'Health',
    data: { current: Math.floor(Math.random() * 100) },
    display: `Update Health on "${truncate(entityId, 12)}"`
  });

  updateTransactionUI();
}

function queueRemoveComponent() {
  if (!transactionActive) return;

  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id) && ecs.hasComponent(id, Health));

  if (validEntities.length === 0) {
    alert('No entities with Health component');
    return;
  }

  const entityId = validEntities[0];

  transactionOperations.push({
    type: 'removeComponent',
    entityId,
    component: 'Health',
    display: `Remove Health from "${truncate(entityId, 12)}"`
  });

  updateTransactionUI();
}

function queueDestroyEntity() {
  if (!transactionActive) return;

  const validEntities = [...allEntities].filter(id => ecs.hasEntity(id));
  const availableEntities = [...validEntities, ...txCreatedEntities];

  if (availableEntities.length === 0) {
    alert('No entities available');
    return;
  }

  const entityId = availableEntities[availableEntities.length - 1];

  transactionOperations.push({
    type: 'destroy',
    entityId,
    display: `Destroy entity "${truncate(entityId, 12)}"`
  });

  updateTransactionUI();
}

function updateTransactionUI() {
  document.getElementById('transaction-status').textContent =
    `Transaction in progress (${transactionOperations.length} operations queued)`;
  renderOperationQueue();
}

function renderOperationQueue() {
  const queue = document.getElementById('operation-queue');

  if (transactionOperations.length === 0) {
    queue.innerHTML = '<div class="queue-empty">No operations queued</div>';
    return;
  }

  queue.innerHTML = transactionOperations.map((op, i) => `
    <div class="operation-card">
      <span class="operation-index">${i + 1}</span>
      <span class="operation-text">${escapeHtml(op.display)}</span>
      <button class="btn btn-small btn-danger operation-remove" data-index="${i}">×</button>
    </div>
  `).join('');

  queue.querySelectorAll('.operation-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      transactionOperations.splice(parseInt(btn.dataset.index), 1);
      updateTransactionUI();
    });
  });
}

async function commitTransaction() {
  if (!transactionActive || transactionOperations.length === 0) return;

  try {
    await ecs.transaction(async (txEcs) => {
      for (const op of transactionOperations) {
        switch (op.type) {
          case 'create':
            txEcs.createEntity(op.entityId);
            allEntities.add(op.entityId);
            break;
          case 'addComponent':
            let component, data;
            switch (op.component) {
              case 'Position':
                component = Position;
                data = { x: 100, y: 100 };
                break;
              case 'Health':
                component = Health;
                data = { current: 100, max: 100 };
                break;
              case 'Inventory':
                component = Inventory;
                data = { capacity: 10, items: [] };
                break;
            }
            txEcs.addComponent(op.entityId, component, data);
            break;
          case 'updateComponent':
            txEcs.updateComponent(op.entityId, Health, op.data);
            break;
          case 'removeComponent':
            txEcs.removeComponent(op.entityId, Health);
            break;
          case 'destroy':
            txEcs.destroyEntity(op.entityId);
            allEntities.delete(op.entityId);
            break;
        }
      }
    });

    showTransactionMessage('Transaction committed successfully', 'success');
  } catch (e) {
    showTransactionMessage(`Transaction failed: ${e.message}`, 'error');
  }

  endTransaction();
  refreshAllExhibits();
}

async function rollbackTransaction() {
  if (!transactionActive) return;

  try {
    await ecs.transaction(async () => {
      // Execute some operations then throw error
      for (const op of transactionOperations) {
        switch (op.type) {
          case 'create':
            ecs.createEntity(op.entityId);
            break;
          case 'addComponent':
            let component, data;
            switch (op.component) {
              case 'Position': component = Position; data = { x: 100, y: 100 }; break;
              case 'Health': component = Health; data = { current: 100, max: 100 }; break;
              case 'Inventory': component = Inventory; data = { capacity: 10, items: [] }; break;
            }
            ecs.addComponent(op.entityId, component, data);
            break;
        }
      }

      throw new Error('Simulated error');
    });
  } catch (e) {
    showTransactionMessage(`Transaction rolled back: ${e.message}`, 'error');
  }

  endTransaction();
  refreshAllExhibits();
}

function cancelTransaction() {
  showTransactionMessage('Transaction cancelled', 'info');
  endTransaction();
}

function endTransaction() {
  transactionActive = false;
  transactionOperations = [];
  txCreatedEntities = [];
  beforeState = null;

  document.getElementById('start-transaction').disabled = false;
  document.getElementById('tx-op-buttons').classList.add('hidden');
  document.getElementById('tx-commit-buttons').classList.add('hidden');
  document.getElementById('transaction-status').textContent = 'No active transaction';

  renderOperationQueue();
  renderTransactionState();
}

function showTransactionMessage(message, type) {
  const msgEl = document.getElementById('transaction-message');
  msgEl.textContent = message;
  msgEl.className = `transaction-message tx-${type}`;
  msgEl.classList.remove('hidden');
}

function refreshAllExhibits() {
  renderInspector();
  renderCanvas(document.getElementById('world-canvas'), document.getElementById('world-canvas').getContext('2d'));
  updateExhibit1State();
  updateExhibit2Canvas();
  updateExhibit2Query();
  renderTransactionState();
}

// ============================================
// EXPORTS FOR DEMO PLAYBACK
// ============================================

export {
  renderCanvas,
  renderInspector,
  updateExhibit1State,
  updateExhibit2Canvas,
  updateExhibit2Query,
  clearQuery,
  clearEventLog,
  createEventEntity,
  destroyEventEntity,
  addPositionToEventEntity,
  addHealthToEventEntity,
  updateHealthOnEventEntity,
  removeHealthFromEventEntity,
  startTransaction,
  queueCreateEntity,
  queueAddComponent,
  queueUpdateComponent,
  queueDestroyEntity,
  commitTransaction,
  rollbackTransaction,
  cancelTransaction,
  selectedEntity,
  queryFilters,
  eventLog,
  transactionActive
};
