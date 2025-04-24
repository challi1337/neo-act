const nf = new Intl.NumberFormat('en-US')

// Debug: Log when the script starts
console.log('Script.js loaded');

layer.on('status', function (e) {
  console.log('Status event:', e); // Debug: Log status events
  if (e.type === 'lock') {
    e.message ? hideResizeHandle() : displayResizeHandle();
  }
});

function displayResizeHandle() {
  document.documentElement.classList.add("resizeHandle")
}

function hideResizeHandle() {
  document.documentElement.classList.remove("resizeHandle")
}

function round(value, precision) {
  var multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
}

function formatAccuracy(value) {
  value = value.replace(/,/g, '.'); // handle comma-decimals
  if (isNaN(value) || value === '100.00') return '';
  return nf.format(round(value, 1).toFixed(1)) + '%';
}

function formatCritrate(value) {
  if (value === '0%') return '';
  return value;
}

function formatDps(value) {
  if (isNaN(value)) return '0/sec';
  return nf.format(value) + '/sec';
}

document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM fully loaded'); // Debug: Confirm DOM loaded

  const q = new URLSearchParams(this.location.search);

  if (q.get('font') === 'kr') {
    document.documentElement.setAttribute('lang', 'kr')
  }

  const style = document.createElement('style');
  style.textContent = `
    .rgb-gradient {
      background: linear-gradient(-45deg, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff) !important;
      background-size: 200% 200% !important;
      animation: gradientFlow 6s ease infinite;
      opacity: 0.9;
    }
    @keyframes gradientFlow {
      0% { background-position: 0% 50%; }
      25% { background-position: 100% 0%; }
      50% { background-position: 100% 100%; }
      75% { background-position: 0% 100%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(style);

  // Explicitly set WebSocket URL
  console.log('Setting WebSocket URL');
  layer.wsUrl = 'ws://127.0.0.1:10501/MiniParse'; // Replace 10501 with your WebSocket port if different
  console.log('Attempting to connect to WebSocket:', layer.wsUrl);
  layer.connect();
  console.log('WebSocket connect called');

  layer.on('connect', () => {
    console.log('WebSocket connected successfully');
  });

  layer.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  layer.on('data', (data) => {
    console.log('Data received:', data); // Debug: Log incoming data
    updateDPSMeter(data);
  });

  setupZoomControls();
  setupDamageToggle();
})

// Variable to track toggle state
let showTotalDamage = localStorage.getItem('showTotalDamage') === 'true' || false;

let popperInstance = null

function updateDPSMeter(data) {
  console.log('updateDPSMeter called with data:', data);

  const bossNameElement = document.getElementById('boss-name');
  if (!bossNameElement) {
    console.error('Boss name element not found');
    return;
  }
  bossNameElement.innerText = data.Encounter?.title || 'No Data';
  console.log('Boss name set to:', bossNameElement.innerText);

  let table = document.getElementById('combatantTable');
  if (!table) {
    console.error('Combatant table element not found');
    return;
  }
  table.innerHTML = '';
  console.log('Cleared combatant table');

  let combatants = Object.values(data.Combatant || {});
  console.log('Combatants:', combatants);

  if (!combatants.length) {
    console.log('No combatants found, rendering placeholder');
    table.innerHTML = '<div class="player"><div class="dps-bar"><div class="bar-content"><span class="dps-bar-label">No Combatants</span></div></div></div>';
    return;
  }

  combatants.sort((a, b) => parseFloat(b['damage']) - parseFloat(a['damage']));
  console.log('Sorted combatants:', combatants);

  const maxDamage = combatants.length > 0 
    ? Math.max(...combatants.map((c) => parseFloat(c['damage']) || 0)) 
    : 0;
  console.log('Max damage:', maxDamage);

  combatants.forEach((combatant, index) => {
    console.log(`Processing combatant ${index + 1}:`, combatant);
    const currentDamage = parseFloat(combatant['damage']) || 0;
    const widthPercentage = maxDamage > 0 
      ? (currentDamage / maxDamage) * 100 
      : 0;

    let playerDiv = document.createElement('div');
    playerDiv.setAttribute('data-player', combatant.name);
    playerDiv.addEventListener('mouseenter', (event) => showSkills(combatant, event));
    playerDiv.addEventListener('mouseleave', hideSkills);
    playerDiv.classList.add('player');

    if (combatant.name === 'You') {
      playerDiv.classList.add('you');
    }

    let dpsBar = document.createElement('div');
    dpsBar.className = 'dps-bar';

    let gradientBg = document.createElement('div');
    gradientBg.className = 'gradient-bg';
    gradientBg.style.clipPath = `inset(0 ${100 - widthPercentage}% 0 0)`;

    let barContent = document.createElement('div');
    barContent.className = 'bar-content';

    const name = document.createElement('span');
    name.className = 'dps-bar-label';
    name.textContent = combatant.name || 'Unknown';

    let damageInMeter = null;
    if (showTotalDamage) {
      damageInMeter = document.createElement('span');
      damageInMeter.className = 'dps-bar-damage-in-meter';
      // Format damage in thousands (e.g., 1540765 -> 1540k)
      const damageInThousands = currentDamage / 1000;
      damageInMeter.textContent = `${nf.format(Math.round(damageInThousands))}k`;
    }

    const critrate = document.createElement('span');
    critrate.className = 'dps-bar-critrate';
    critrate.textContent = combatant['crithit%'] ? formatCritrate(combatant['crithit%']) : '';

    const tohit = document.createElement('span');
    tohit.className = 'dps-bar-tohit';
    tohit.textContent = combatant['tohit'] ? formatAccuracy(combatant['tohit']) : '';

    const dps = document.createElement('span');
    dps.className = 'dps-bar-value';
    dps.textContent = formatDps(combatant.DPS);

    barContent.appendChild(name);
    if (showTotalDamage) {
      barContent.appendChild(damageInMeter);
    }
    barContent.appendChild(tohit);
    barContent.appendChild(critrate);
    barContent.appendChild(dps);
    dpsBar.appendChild(gradientBg);
    dpsBar.appendChild(barContent);
    playerDiv.appendChild(dpsBar);
    table.appendChild(playerDiv);

    console.log(`Added combatant ${combatant.name} to table`);
  });

  console.log('Finished rendering combatants');
}

function showSkills(combatant, event) {
  console.log('Showing skills for:', combatant);
  const skillDetails = document.getElementById('skill-details');
  if (!skillDetails) {
    console.error('Skill details element not found');
    return;
  }

  const referenceElement = {
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      top: event.clientY,
      right: event.clientX,
      bottom: event.clientY,
      left: event.clientX,
    }),
  }

  let skillHTML = `
      <div class="skill-summary">Total Damage: ${combatant['damage-*'] || 'N/A'} (${combatant['damage%'] || 'N/A'})</div>
      <div class="skill-summary">Hits: ${combatant['hits'] || 'N/A'}</div>
      <div class="skill-summary">Total Crit %: ${combatant['crithit%'] || 'N/A'}</div>
      <div class="skill-summary">Max Hit: ${combatant['maxhit-*'] || 'N/A'}</div>
      <div class="skill-labels">
          <span>Skill</span>
          <span>Hits</span>
          <span>Crit %</span>
          <span>Damage</span>
      </div>`;
      
  skillHTML += `<div class="skill">No skill data available</div>`;
  skillDetails.innerHTML = skillHTML;
  skillDetails.style.display = 'block';

  if (popperInstance) {
    popperInstance.destroy();
  }

  popperInstance = Popper.createPopper(referenceElement, skillDetails, {
    placement: 'right-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [0, 10],
        },
      },
      {
        name: 'preventOverflow',
        options: {
          padding: 10,
        },
      },
      {
        name: 'flip',
        options: {
          padding: 10,
        },
      },
    ],
  });

  console.log('Skills displayed');
}

function hideSkills() {
  console.log('Hiding skills');
  const skillDetails = document.getElementById('skill-details');
  if (skillDetails) {
    skillDetails.style.display = 'none';
  }
  if (popperInstance) {
    popperInstance.destroy();
    popperInstance = null;
  }
}

function setupZoomControls() {
  console.log('Setting up zoom controls');
  const zoomOutBtn = document.getElementById('zoom-out');
  const zoomInBtn = document.getElementById('zoom-in');
  if (!zoomOutBtn || !zoomInBtn) {
    console.error('Zoom buttons not found');
    return;
  }

  const root = document.documentElement;

  let currentZoom = 100; 
  const minZoom = 50;
  const maxZoom = 200;
  const zoomStep = 10;

  const savedZoom = localStorage.getItem('dpsMeterZoom');
  if (savedZoom) {
    currentZoom = parseInt(savedZoom);
    applyZoom();
  }

  function applyZoom() {
    root.style.fontSize = `${currentZoom / 100}rem`;
    localStorage.setItem('dpsMeterZoom', currentZoom);
    console.log('Zoom applied:', currentZoom);
  }

  zoomOutBtn.addEventListener('click', () => {
    currentZoom = Math.max(minZoom, currentZoom - zoomStep);
    applyZoom();
  });

  zoomInBtn.addEventListener('click', () => {
    currentZoom = Math.min(maxZoom, currentZoom + zoomStep);
    applyZoom();
  });

  document.querySelectorAll('.zoom-btn').forEach(element => {
    element.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
    });
  });

  console.log('Zoom controls set up');
}

function setupDamageToggle() {
  console.log('Setting up damage toggle');
  const toggleBtn = document.getElementById('toggle-damage');
  const toggleIcon = toggleBtn.querySelector('.toggle-icon');
  if (!toggleBtn || !toggleIcon) {
    console.error('Toggle button or icon not found');
    return;
  }

  // Update button appearance based on initial state
  toggleIcon.textContent = showTotalDamage ? '✔' : '✖';
  toggleBtn.classList.toggle('active', showTotalDamage);

  toggleBtn.addEventListener('click', () => {
    showTotalDamage = !showTotalDamage;
    localStorage.setItem('showTotalDamage', showTotalDamage);
    toggleIcon.textContent = showTotalDamage ? '✔' : '✖';
    toggleBtn.classList.toggle('active', showTotalDamage);
    console.log('Toggled showTotalDamage to:', showTotalDamage);

    // Trigger a UI update
    layer.fire('data', layer.lastData);
  });

  toggleBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  console.log('Damage toggle set up');
}

document.removeEventListener('DOMContentLoaded', setupZoomControls);