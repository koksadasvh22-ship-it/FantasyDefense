"use strict";

const coinImg = new Image();
coinImg.src = 'coin.png';


/* =========================================================================
   CONSTANTS
   ========================================================================= */
const CANVAS_BASE_W  = 960;   // logical canvas width
const CANVAS_BASE_H  = 400;   // logical canvas height (16:9 wrapper = 540, minus 50 HUD + 80 bottom = 400 canvas + 10 margin)
const HUD_H          = 50;    // px, synced with CSS
const BOTTOM_H       = 80;    // px, synced with CSS
const WRAPPER_RATIO  = 16 / 9;
const ROAD_WIDTH     = 38;    // logical px
const MAX_DT         = 0.1;   // cap delta-time
const STARTING_GOLD  = 150;
const STARTING_LIVES = 20;
const NODE_RADIUS    = 18;    // logical px, clickable build pad radius

/* =========================================================================
   WAYPOINTS  [x_frac, y_frac]  relative to logical canvas (960×400)
   ========================================================================= */
const WAYPOINT_FRACS = [
  [0.00, 0.22],   // W0 – entry from left
  [0.22, 0.22],   // W1 – go right
  [0.22, 0.72],   // W2 – turn down
  [0.45, 0.72],   // W3 – go right
  [0.45, 0.28],   // W4 – turn up
  [0.70, 0.28],   // W5 – go right
  [0.70, 0.75],   // W6 – turn down
  [1.00, 0.75],   // W7 – exit right
];

/* =========================================================================
   BUILD NODE POSITIONS  [x_frac, y_frac]  — stone build pads
   Carefully placed off the road, distributed across the map.
   ========================================================================= */
const BUILD_NODE_FRACS = [
  // Near first horizontal segment (top-left area)
  [0.10, 0.07],
  [0.10, 0.40],
  [0.16, 0.07],
  // Near first vertical segment (left side)
  [0.09, 0.52],
  [0.09, 0.62],
  // Near second horizontal segment (mid area, below)
  [0.30, 0.85],
  [0.38, 0.85],
  [0.38, 0.58],
  // Near second vertical segment (going up)
  [0.56, 0.58],
  [0.56, 0.85],
  // Between horizontal segments (middle of map)
  [0.33, 0.12],
  [0.40, 0.12],
  [0.57, 0.12],
  // Near third horizontal segment (top-right)
  [0.62, 0.12],
  [0.62, 0.42],
  [0.80, 0.42],
  // Near third vertical segment (right side)
  [0.80, 0.60],
  [0.81, 0.88],
  // Far right
  [0.91, 0.55],
  [0.91, 0.88],
];

/* =========================================================================
   ENEMY TYPE DEFINITIONS
   ========================================================================= */
const ENEMY_TYPES = {
  goblin: {
    label:       'Goblin',
    hp:          75,
    speed:       140,
    reward:      8,
    scoreReward: 50,
    armorFlat:   0,
    armorRatio:  0,
    lifeCost:    1,
    radius:      11,
    bodyColor:   ['#ff4444', '#ff8800'],
    glowColor:   '#ff2200',
    textColor:   '#ffe066',
    desc:        'Fast & agile scout, grants gold',
  },
  orc: {
    label:       'Armored Orc',
    hp:          230,
    speed:       70,
    reward:      20,
    scoreReward: 160,
    armorFlat:   5,
    armorRatio:  0.25, // 25% physical resistance vs arrows
    lifeCost:    2,
    radius:      15,
    bodyColor:   ['#2e7d32', '#66bb6a'],
    glowColor:   '#1b5e20',
    textColor:   '#e8f5e9',
    desc:        'Heavy plate armor resistance vs physical attacks',
  },
  elite_orc: {
    label:       'Elite Orc Champion',
    hp:          460,
    speed:       58,
    reward:      35,
    scoreReward: 300,
    armorFlat:   8,
    armorRatio:  0.35, // 35% physical resistance
    lifeCost:    3,
    radius:      18,
    bodyColor:   ['#8b0000', '#ff3d00'],
    glowColor:   '#b71c1c',
    textColor:   '#ffcdd2',
    desc:        'Heavily armored crimson brute with heavy steel plate',
  },
  troll: {
    label:       'Troll Boss',
    hp:          750,
    speed:       34,
    reward:      55,
    scoreReward: 550,
    armorFlat:   8,
    armorRatio:  0.15,
    lifeCost:    5,
    radius:      22,
    isBoss:      true,
    bodyColor:   ['#1a237e', '#5c6bc0'],
    glowColor:   '#283593',
    textColor:   '#e8eaf6',
    desc:        'Massive health pool, high bounty reward',
  },
  heavy_troll: {
    label:       'Ancient Behemoth',
    hp:          2200,
    speed:       25,
    reward:      160,
    scoreReward: 1600,
    armorFlat:   14,
    armorRatio:  0.22,
    lifeCost:    10,
    radius:      28,
    isBoss:      true,
    bodyColor:   ['#26150d', '#5d4037'],
    glowColor:   '#ff3d00',
    textColor:   '#ffe0b2',
    desc:        'Colossal titan with volcanic magma horns and immense durability',
  },
};

/* =========================================================================
   TOWER TYPE DEFINITIONS
   ========================================================================= */
const TOWER_TYPES = {
  archer: {
    label:        'Archer',
    cost:         50,
    damage:       20,
    range:        130,
    fireRate:     1.5,     // shots per second
    projType:     'arrow',
    projSpeed:    280,
    splashRadius: 0,
  },
  mage: {
    label:        'Mage',
    cost:         80,
    damage:       35,
    range:        170,
    fireRate:     0.65,
    projType:     'orb',
    projSpeed:    200,
    splashRadius: 40,
  },
  cannon: {
    label:        'Cannon',
    cost:         120,
    damage:       90,
    range:        140,
    fireRate:     0.40,
    projType:     'cannonball',
    projSpeed:    240,
    splashRadius: 55,
  },
  barracks: {
    label:        'Barracks',
    cost:         70,
    damage:       0,      // no projectile damage
    range:        160,    // Rally Point placement range
    fireRate:     0,
    projType:     null,
    projSpeed:    0,
    splashRadius: 0,
    // Barracks-specific
    soldierCount: 3,      // max soldiers deployed
    soldierHp:    55,
    soldierDmg:   12,
    soldierSpeed: 80,
    respawnTime:  8,      // seconds to respawn dead soldier
  },
};

/* =========================================================================
   TOWER UPGRADE DEFINITIONS (3 Levels per Tower)
   ========================================================================= */
const TOWER_UPGRADES = {
  archer: [
    { level: 1, cost: 50,  damage: 20, range: 130, fireRate: 1.50, splash: 0,  title: 'Archer Tower' },
    { level: 2, cost: 45,  damage: 35, range: 155, fireRate: 1.85, splash: 0,  title: 'Marksman Tower' },
    { level: 3, cost: 70,  damage: 60, range: 180, fireRate: 2.30, splash: 0,  title: 'Sharpshooter Citadel' },
  ],
  mage: [
    { level: 1, cost: 80,  damage: 35, range: 170, fireRate: 0.65, splash: 40, title: 'Mage Spire' },
    { level: 2, cost: 75,  damage: 65, range: 200, fireRate: 0.85, splash: 50, title: 'Sorcerer Sanctum' },
    { level: 3, cost: 110, damage: 110, range: 230, fireRate: 1.05, splash: 65, title: 'Archmage Obelisk' },
  ],
  cannon: [
    { level: 1, cost: 120, damage: 90,  range: 140, fireRate: 0.40, splash: 55, title: 'Bombard Tower' },
    { level: 2, cost: 95,  damage: 160, range: 165, fireRate: 0.50, splash: 70, title: 'Heavy Mortar' },
    { level: 3, cost: 140, damage: 260, range: 190, fireRate: 0.65, splash: 90, title: 'Dreadnought Battery' },
  ],
  barracks: [
    { level: 1, cost: 70,  range: 160, soldierCount: 3, soldierHp: 55,  soldierDmg: 12, soldierSpeed: 80,  respawnTime: 8,  title: 'Barracks' },
    { level: 2, cost: 65,  range: 185, soldierCount: 4, soldierHp: 90,  soldierDmg: 20, soldierSpeed: 85,  respawnTime: 7,  title: 'War Camp' },
    { level: 3, cost: 100, range: 215, soldierCount: 5, soldierHp: 145, soldierDmg: 32, soldierSpeed: 90,  respawnTime: 5,  title: 'Fortress Keep' },
  ],
};

/* =========================================================================
   WAVE DEFINITIONS (10 Progressive Waves + Endless Generator)
   ========================================================================= */
const WAVE_DEFS = [
  // Wave 1 – The Scout Incursion (Fast goblins)
  [ { type: 'goblin', count: 10, interval: 0.85 } ],

  // Wave 2 – Orcish Vanguard (Goblins + first Armored Orcs)
  [ { type: 'goblin', count: 12, interval: 0.75 },
    { type: 'orc',    count: 5,  interval: 1.35 } ],

  // Wave 3 – The Mountain Beast (Armored Orc battalion + first Troll Boss!)
  [ { type: 'goblin', count: 14, interval: 0.65 },
    { type: 'orc',    count: 8,  interval: 1.10 },
    { type: 'troll',  count: 1,  interval: 3.50 } ],

  // Wave 4 – Siege of the Citadel (Heavy mixed horde + dual Troll Bosses)
  [ { type: 'goblin', count: 16, interval: 0.55 },
    { type: 'orc',    count: 12, interval: 0.90 },
    { type: 'troll',  count: 2,  interval: 3.00 } ],

  // Wave 5 – Mid-Campaign Boss Siege (Elite Orcs + Ancient Behemoth Titan!)
  [ { type: 'goblin',     count: 18, interval: 0.45 },
    { type: 'orc',        count: 10, interval: 0.85 },
    { type: 'elite_orc',  count: 3,  interval: 1.80 },
    { type: 'heavy_troll',count: 1,  interval: 4.00 } ],

  // Wave 6 – Crimson Legion (Armored horde + Elite Orc vanguard)
  [ { type: 'goblin',     count: 16, interval: 0.45 },
    { type: 'orc',        count: 14, interval: 0.75 },
    { type: 'elite_orc',  count: 6,  interval: 1.30 } ],

  // Wave 7 – Mountain Stampede (Horde supported by multi-troll siege line)
  [ { type: 'goblin',     count: 18, interval: 0.40 },
    { type: 'orc',        count: 14, interval: 0.70 },
    { type: 'troll',      count: 3,  interval: 2.40 } ],

  // Wave 8 – Elite Phalanx (Heavy armored front + double titan assault)
  [ { type: 'goblin',     count: 20, interval: 0.35 },
    { type: 'elite_orc',  count: 14, interval: 0.65 },
    { type: 'heavy_troll',count: 2,  interval: 3.20 } ],

  // Wave 9 – Dread Vanguard (High-density horde approaching final gates)
  [ { type: 'goblin',     count: 24, interval: 0.30 },
    { type: 'orc',        count: 16, interval: 0.55 },
    { type: 'elite_orc',  count: 10, interval: 0.80 },
    { type: 'troll',      count: 3,  interval: 2.00 } ],

  // Wave 10 – The Cataclysmic Siege (Ultimate Horde + Dual Ancient Titans!)
  [ { type: 'goblin',     count: 28, interval: 0.25 },
    { type: 'elite_orc',  count: 18, interval: 0.50 },
    { type: 'troll',      count: 4,  interval: 1.60 },
    { type: 'heavy_troll',count: 2,  interval: 3.00 } ],
];

/** Procedural wave generator for Endless Mode (Wave 11+) */
function getWaveDefinition(waveNum) {
  if (waveNum <= WAVE_DEFS.length) {
    return WAVE_DEFS[waveNum - 1];
  }
  const tier = waveNum - WAVE_DEFS.length;
  const gobCount   = Math.min(60, 26 + tier * 4);
  const orcCount   = Math.min(30, 14 + tier * 2);
  const eliteCount = Math.min(25, 10 + tier * 2);
  const trollCount = Math.min(8,  3 + Math.floor(tier * 0.8));
  const heavyCount = Math.min(6,  1 + Math.floor(tier * 0.6));
  return [
    { type: 'goblin',     count: gobCount,   interval: Math.max(0.18, 0.28 - tier * 0.01) },
    { type: 'orc',        count: orcCount,   interval: Math.max(0.35, 0.55 - tier * 0.02) },
    { type: 'elite_orc',  count: eliteCount, interval: Math.max(0.40, 0.65 - tier * 0.02) },
    { type: 'troll',      count: trollCount, interval: Math.max(1.10, 1.80 - tier * 0.08) },
    { type: 'heavy_troll',count: heavyCount, interval: Math.max(1.60, 2.80 - tier * 0.10) }
  ];
}

/* =========================================================================
   UTILITY FUNCTIONS
   ========================================================================= */
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Find closest point on the dirt road and distance to it */
function getClosestPointOnRoad(px, py) {
  let minDist = Infinity;
  let closestX = px, closestY = py;
  if (!GS.waypoints || GS.waypoints.length < 2) return { x: px, y: py, dist: 0 };
  for (let i = 0; i < GS.waypoints.length - 1; i++) {
    const a = GS.waypoints[i];
    const b = GS.waypoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / lenSq, 0, 1);
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    const d = dist(px, py, projX, projY);
    if (d < minDist) {
      minDist = d;
      closestX = projX;
      closestY = projY;
    }
  }
  return { x: closestX, y: closestY, dist: minDist };
}


/** Seeded PRNG (Mulberry32) for deterministic grass placement. */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* =========================================================================
   AUDIO & SOUNDTRACK SYSTEM (With Web Audio SFX & Dual Volume Sliders)
   ========================================================================= */
const SoundtrackManager = {
  audio: null,
  muted: false,
  musicVolume: 0.5,
  sfxVolume: 0.7,
  initialized: false,
  webAudioCtx: null,
  synthTimer: null,
  isSynthPlaying: false,
  synthGainNode: null,
  sfxGainNode: null,

  get volume() { return this.musicVolume; },
  set volume(v) { this.musicVolume = v; },

  setup() {
    // Load persisted settings
    const savedMuted = localStorage.getItem('fantasyDefense_muted');
    if (savedMuted !== null) this.muted = (savedMuted === 'true');

    const savedMusic = localStorage.getItem('fantasyDefense_musicVolume') || localStorage.getItem('fantasyDefense_volume');
    if (savedMusic !== null) this.musicVolume = Math.max(0, Math.min(1, parseFloat(savedMusic)));

    const savedSfx = localStorage.getItem('fantasyDefense_sfxVolume');
    if (savedSfx !== null) this.sfxVolume = Math.max(0, Math.min(1, parseFloat(savedSfx)));

    this.updateAudioIcons();
    this.updateSliderInputs();
    this.setupAutoplayListener();

    // Attempt direct play on startup
    this.init();
  },

  setupAutoplayListener() {
    const unlock = () => {
      this.init();
      ['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, unlock);
      });
    };
    ['click', 'touchstart', 'pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { once: true, passive: true });
    });
  },

  init() {
    if (!this.audio) {
      this.audio = document.getElementById('bg-audio');
      if (!this.audio) {
        this.audio = new Audio('soundtrack.mp3');
        this.audio.id = 'bg-audio';
        this.audio.loop = true;
        document.body.appendChild(this.audio);
      }
      this.audio.volume = this.musicVolume;

      // Graceful fallback to synthesized fantasy chords if soundtrack.mp3 is missing or fails
      this.audio.addEventListener('error', () => {
        if (!this.muted) {
          this.startSynthAmbience();
        }
      });
    }

    this.initialized = true;
    if (!this.muted) {
      this.play();
    }
  },

  play() {
    if (this.muted) return;
    if (this.audio) {
      this.audio.volume = this.musicVolume;
      const p = this.audio.play();
      if (p !== undefined) {
        p.then(() => {
          this.stopSynthAmbience();
        }).catch(() => {
          if (!this.muted) this.startSynthAmbience();
        });
      }
    } else {
      this.startSynthAmbience();
    }
  },

  pause() {
    if (this.audio) {
      try { this.audio.pause(); } catch (e) {}
    }
    this.stopSynthAmbience();
  },

  updateSliderInputs() {
    const mSlider = document.getElementById('setting-music-volume');
    const mLabel  = document.getElementById('setting-music-volume-label');
    const sSlider = document.getElementById('setting-sfx-volume');
    const sLabel  = document.getElementById('setting-sfx-volume-label');
    const legSlider = document.getElementById('setting-volume');
    const legLabel  = document.getElementById('setting-volume-label');

    const mPct = Math.round(this.musicVolume * 100);
    const sPct = Math.round(this.sfxVolume * 100);

    if (mSlider) mSlider.value = mPct;
    if (mLabel)  mLabel.textContent = `${mPct}%`;
    if (sSlider) sSlider.value = sPct;
    if (sLabel)  sLabel.textContent = `${sPct}%`;
    if (legSlider) legSlider.value = mPct;
    if (legLabel)  legLabel.textContent = `${mPct}%`;
  },

  setMusicVolume(pct) {
    this.musicVolume = Math.max(0, Math.min(1, pct / 100));
    localStorage.setItem('fantasyDefense_musicVolume', this.musicVolume);
    localStorage.setItem('fantasyDefense_volume', this.musicVolume);
    if (this.audio) {
      this.audio.volume = this.musicVolume;
    }
    if (this.synthGainNode && this.webAudioCtx) {
      this.synthGainNode.gain.setValueAtTime(this.musicVolume * 0.04, this.webAudioCtx.currentTime);
    }
    this.updateSliderInputs();
  },

  setSfxVolume(pct) {
    this.sfxVolume = Math.max(0, Math.min(1, pct / 100));
    localStorage.setItem('fantasyDefense_sfxVolume', this.sfxVolume);
    if (this.sfxGainNode && this.webAudioCtx) {
      this.sfxGainNode.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.webAudioCtx.currentTime);
    }
    this.updateSliderInputs();
  },

  setVolume(pct) {
    this.setMusicVolume(pct);
  },

  toggleMute() {
    if (!this.initialized) {
      this.init();
    }
    this.muted = !this.muted;
    localStorage.setItem('fantasyDefense_muted', this.muted);
    this.updateAudioIcons();
    if (this.sfxGainNode && this.webAudioCtx) {
      this.sfxGainNode.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.webAudioCtx.currentTime);
    }
    if (this.muted) {
      this.pause();
    } else {
      this.play();
    }
  },

  updateAudioIcons() {
    const icon = this.muted ? '🔇' : '🔊';
    const hudBtn = document.getElementById('btn-audio');
    const menuBtn = document.getElementById('btn-menu-audio');
    if (hudBtn) hudBtn.textContent = icon;
    if (menuBtn) menuBtn.textContent = icon;
  },

  startSynthAmbience() {
    if (this.isSynthPlaying || this.muted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.webAudioCtx) {
        this.webAudioCtx = new AudioCtx();
        this.synthGainNode = this.webAudioCtx.createGain();
        this.synthGainNode.connect(this.webAudioCtx.destination);
      }
      if (this.webAudioCtx.state === 'suspended') {
        this.webAudioCtx.resume();
      }
      this.isSynthPlaying = true;
      this.synthGainNode.gain.setValueAtTime(this.musicVolume * 0.04, this.webAudioCtx.currentTime);

      const chords = [
        [146.83, 220.00, 261.63, 349.23], // Dm7
        [130.81, 196.00, 261.63, 329.63], // C
        [174.61, 220.00, 261.63, 349.23], // F
        [196.00, 261.63, 293.66, 392.00]  // Gsus4
      ];
      let chordIndex = 0;

      const playChord = () => {
        if (!this.isSynthPlaying || this.muted || !this.webAudioCtx) return;
        const freqs = chords[chordIndex % chords.length];
        chordIndex++;
        const now = this.webAudioCtx.currentTime;
        const duration = 4.2;

        freqs.forEach(freq => {
          const osc = this.webAudioCtx.createOscillator();
          const gain = this.webAudioCtx.createGain();
          const filter = this.webAudioCtx.createBiquadFilter();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(700, now);

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.8, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + duration - 0.2);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.synthGainNode);

          osc.start(now);
          osc.stop(now + duration);
        });

        this.synthTimer = setTimeout(playChord, (duration - 0.5) * 1000);
      };

      playChord();
    } catch (e) {}
  },

  stopSynthAmbience() {
    this.isSynthPlaying = false;
    if (this.synthTimer) {
      clearTimeout(this.synthTimer);
      this.synthTimer = null;
    }
  },

  getAudioCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.webAudioCtx) {
      this.webAudioCtx = new AudioCtx();
    }
    if (!this.sfxGainNode && this.webAudioCtx) {
      this.sfxGainNode = this.webAudioCtx.createGain();
      this.sfxGainNode.gain.setValueAtTime(this.muted ? 0 : this.sfxVolume, this.webAudioCtx.currentTime);
      this.sfxGainNode.connect(this.webAudioCtx.destination);
    }
    if (this.webAudioCtx.state === 'suspended') {
      this.webAudioCtx.resume();
    }
    return this.webAudioCtx;
  },

    playUiClickSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.035);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.04);
    } catch(e) {}
  },

  playReinforceSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      [330, 440, 554, 660].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.06);
        g.gain.setValueAtTime(0.22, t + idx * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.28);
        osc.connect(g);
        g.connect(this.sfxGainNode || ctx.destination);
        osc.start(t + idx * 0.06);
        osc.stop(t + idx * 0.06 + 0.3);
      });
    } catch(e) {}
  },

  playUpgradeSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      [440, 554, 659, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.07);
        g.gain.setValueAtTime(0.18, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22);
        osc.connect(g);
        g.connect(this.sfxGainNode || ctx.destination);
        osc.start(t + i * 0.07);
        osc.stop(t + i * 0.07 + 0.25);
      });
    } catch(e) {}
  },

  playSellSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      [1100, 1550].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        g.gain.setValueAtTime(0.20, t + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.18);
        osc.connect(g);
        g.connect(this.sfxGainNode || ctx.destination);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.20);
      });
    } catch(e) {}
  },

  playArrowSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch(e) {}
  },

  playMageBoltSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      [880, 1320].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + idx * 0.03);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + idx * 0.03 + 0.12);
        g.gain.setValueAtTime(0.12, t + idx * 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.14);
        osc.connect(g);
        g.connect(this.sfxGainNode || ctx.destination);
        osc.start(t + idx * 0.03);
        osc.stop(t + idx * 0.03 + 0.15);
      });
    } catch(e) {}
  },

  playCannonFireSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);
      g.gain.setValueAtTime(0.35, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.35);
    } catch(e) {}
  },

  playWaveStartSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.08);
        g.gain.setValueAtTime(0.24, t + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.38);
        osc.connect(g);
        g.connect(this.sfxGainNode || ctx.destination);
        osc.start(t + idx * 0.08);
        osc.stop(t + idx * 0.08 + 0.4);
      });
    } catch(e) {}
  },

  playHeroAttackSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.10);
    } catch(e) {}
  },

  playWhirlwindSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.3);
      g.gain.setValueAtTime(0.20, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.34);
    } catch(e) {}
  },

  playMeteorLaunchSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, t);
      osc.frequency.exponentialRampToValueAtTime(140, t + 0.45);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.46);
    } catch(e) {}
  },

  playMeteorBoomSfx() {
    if (this.muted || this.sfxVolume <= 0) return;
    try {
      const ctx = this.getAudioCtx();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, t);
      osc.frequency.exponentialRampToValueAtTime(25, t + 0.65);
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.70);
      osc.connect(g);
      g.connect(this.sfxGainNode || ctx.destination);
      osc.start(t);
      osc.stop(t + 0.72);
    } catch(e) {}
  }
};

/* =========================================================================
   GAME STATE  (single source of truth)
   ========================================================================= */
const GS = {
  canvas:        null,   /** @type {HTMLCanvasElement} */
  ctx:           null,   /** @type {CanvasRenderingContext2D} */
  logW:          CANVAS_BASE_W,
  logH:          CANVAS_BASE_H,
  scale:         1,      // pixel-per-logical unit
  running:       false,
  paused:        false,
  phase:         'menu', // 'menu' | 'playing' | 'gameover' | 'victory'
  gold:          STARTING_GOLD,
  lives:         STARTING_LIVES,
  wave:          0,
  waveActive:    false,
  score:         0,      // current run score
  killsThisRun:  0,      // enemies defeated this run
  wavesCleared:  0,      // completed waves this run
  gameSpeed:     1.0,    // 1.0x | 1.5x | 2.0x
  graphicsMode:  'high', // 'high' | 'low'
  selectedStartingWave: 1,
  spellCooldown:    0,     // seconds until Meteor is ready
  spellMaxCooldown: 30,    // 30 seconds
  reinforceSpellCd:    0,     // 20s cooldown for militia
  reinforceSpellMaxCd: 20,
  targetingMode:    null,  // null | 'meteor' | 'reinforce'
  meteorAimPos:     null,  // {x, y}
  meteors:          [],    // active MeteorShower instances
  craters:          [],    // scorch marks on the battlefield
  sparks:           [],    // burst particles on upgrade / sell
  shakeDuration:    0,     // screen shake remaining
  shakeMagnitude:   0,     // screen shake strength
  spawnQueue:    [],
  spawnTimer:    0,
  enemiesAlive:  0,
  enemies:       [],
  soldiers:      [],     // Soldier instances from Barracks towers
  towers:        [],
  projectiles:   [],
  floats:        [],
  waypoints:     [],     // [{x,y}] logical, recomputed on resize
  buildNodes:    [],     // [{id, x, y, tower}] logical, recomputed on resize
  selectedNode:  null,   // id of node player tapped (empty) to build on
  inspectedNode: null,   // id of node player tapped (occupied) to view range/upgrade
  previewShopTower: null,
  selectedUnit: null,
  selectedUnitType: null,// 'archer' | 'mage' | 'cannon' | 'barracks' for range indicator
  endlessMode:   false,  // whether player continued into endless mode
  // Hero
  hero:          null,   // Hero instance
  heroSelected:  false,  // whether hero is selected for movement
  heroSpellCd:   0,      // Whirlwind cooldown
  heroSpellMaxCd:15,
  lastTime:      0,
  rafId:         null,
};

/* =========================================================================
   CLASS: Enemy
   ========================================================================= */
class Enemy {
  constructor(type, wave = 1) {
    const def        = ENEMY_TYPES[type];
    this.type        = type;
    this.label       = def.label;
    // Scale enemy HP with progressive waves (+15% HP per wave tier)
    const waveHpMult = 1 + (Math.max(1, wave) - 1) * 0.15;
    this.hp          = Math.round(def.hp * waveHpMult);
    this.maxHp       = this.hp;
    this.speed       = def.speed;
    this.armorFlat   = def.armorFlat || 0;
    this.armorRatio  = def.armorRatio || 0;
    this.lifeCost    = def.lifeCost || 1;
    this.scoreReward = (def.scoreReward || 50) + (Math.max(1, wave) - 1) * 20;
    this.isBoss      = !!def.isBoss;
    // Scale gold reward on higher waves (+2 gold per wave tier)
    this.reward      = def.reward + Math.floor((Math.max(1, wave) - 1) * 2);
    this.radius      = def.radius;
    this.bodyColor   = def.bodyColor;
    this.glowColor   = def.glowColor;
    this.textColor   = def.textColor;
    this.dead        = false;
    this.reached     = false;       // reached end of path
    this.waypointIdx = 1;           // current target waypoint index
    this.x           = GS.waypoints[0].x;
    this.y           = GS.waypoints[0].y;
    this.hitFlash    = 0;
    this._counted    = false;       // for wave-count tracking
  }

  /** Advance along the path by dt seconds. */
  update(dt) {
    if (this.dead || this.reached) return;
    if (this.waypointIdx >= GS.waypoints.length) {
      this.reached = true; return;
    }
    const target       = GS.waypoints[this.waypointIdx];
    const dx           = target.x - this.x;
    const dy           = target.y - this.y;
    const distToTarget = Math.hypot(dx, dy);
    const moveAmt      = this.speed * dt;

    if (moveAmt >= distToTarget) {
      this.x = target.x;
      this.y = target.y;
      this.waypointIdx++;
      if (this.waypointIdx >= GS.waypoints.length) this.reached = true;
    } else {
      const nx = dx / distToTarget;
      const ny = dy / distToTarget;
      this.x += nx * moveAmt;
      this.y += ny * moveAmt;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt * 4;
  }

  /** Take damage. Returns { killed, actualDamage, wasArmored } */
  takeDamage(amount, damageType = 'physical') {
    if (this.dead) return { killed: false, actualDamage: 0, wasArmored: false };

    let actualDamage = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
    let wasArmored = false;

    // Physical damage (arrows) is mitigated by armored enemies
    if (damageType === 'physical' && (this.armorFlat > 0 || this.armorRatio > 0)) {
      actualDamage = Math.max(3, Math.round((amount - this.armorFlat) * (1 - this.armorRatio)));
      if (actualDamage < amount) wasArmored = true;
    }

    this.hp -= actualDamage;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.hp   = 0;
      this.dead = true;
      return { killed: true, actualDamage, wasArmored };
    }
    return { killed: false, actualDamage, wasArmored };
  }

  /** Draw on ctx (logical → pixel via GS.scale). */
  draw(ctx) {
    const s  = GS.scale;
    const px = this.x * s;
    const py = this.y * s;
    const r  = this.radius * s;

    ctx.save();
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur  = (this.isBoss ? 16 : 10) * s;

    const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
    grad.addColorStop(0, this.bodyColor[1]);
    grad.addColorStop(1, this.bodyColor[0]);

    if (this.hitFlash > 0) ctx.globalAlpha = 0.6 + this.hitFlash * 0.4;

    // Outer circle
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Distinct geometric overlays per type
    if (this.type === 'goblin') {
      // Goblin pointy scout ears
      ctx.fillStyle = this.bodyColor[0];
      ctx.beginPath();
      ctx.moveTo(px - r * 0.7, py - r * 0.2);
      ctx.lineTo(px - r * 1.5, py - r * 0.8);
      ctx.lineTo(px - r * 0.4, py - r * 0.8);
      ctx.moveTo(px + r * 0.7, py - r * 0.2);
      ctx.lineTo(px + r * 1.5, py - r * 0.8);
      ctx.lineTo(px + r * 0.4, py - r * 0.8);
      ctx.fill();

      // Glowing feral eyes
      ctx.fillStyle = '#ffff66';
      ctx.beginPath();
      ctx.arc(px - r * 0.35, py - r * 0.15, 1.8 * s, 0, Math.PI * 2);
      ctx.arc(px + r * 0.35, py - r * 0.15, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'orc') {
      // Armored steel plating & helmet crest
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth   = 2.8 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      // Forehead steel plate
      ctx.fillStyle = '#78909c';
      ctx.beginPath();
      ctx.arc(px, py, r, -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.lineTo(px, py - r * 0.2);
      ctx.closePath();
      ctx.fill();

      // Armor shield badge
      ctx.font = `bold ${Math.max(9, 10 * s)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', px, py + 2 * s);
    } else if (this.type === 'elite_orc') {
      // Crimson plate armor, gold spiked crest & battle crossed axes
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 3.2 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      // Forehead gold horned crest
      ctx.fillStyle = '#ff8f00';
      ctx.beginPath();
      ctx.arc(px, py, r, -Math.PI * 0.85, -Math.PI * 0.15);
      ctx.lineTo(px, py - r * 0.1);
      ctx.closePath();
      ctx.fill();

      // Glowing feral crimson eyes
      ctx.fillStyle = '#ffff55';
      ctx.beginPath();
      ctx.arc(px - r * 0.35, py - r * 0.15, 2.2 * s, 0, Math.PI * 2);
      ctx.arc(px + r * 0.35, py - r * 0.15, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();

      // Elite battle crossed axes badge
      ctx.font = `bold ${Math.max(10, 11 * s)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚔️', px, py + 2 * s);
    } else if (this.type === 'heavy_troll') {
      // Heavy Titan Boss: Molten Gold Rim & 4 massive Magma battle horns
      ctx.strokeStyle = '#ff3d00';
      ctx.lineWidth   = 4.5 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      // 4 Magma horns
      ctx.fillStyle = '#ff6d00';
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 1.6 * s;
      // Left outer horn
      ctx.beginPath();
      ctx.moveTo(px - r * 0.6, py - r * 0.4);
      ctx.quadraticCurveTo(px - r * 1.8, py - r * 1.2, px - r * 1.6, py - r * 2.0);
      ctx.quadraticCurveTo(px - r * 0.9, py - r * 1.1, px - r * 0.2, py - r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right outer horn
      ctx.beginPath();
      ctx.moveTo(px + r * 0.6, py - r * 0.4);
      ctx.quadraticCurveTo(px + r * 1.8, py - r * 1.2, px + r * 1.6, py - r * 2.0);
      ctx.quadraticCurveTo(px + r * 0.9, py - r * 1.1, px + r * 0.2, py - r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing molten magma eyes
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ff3d00';
      ctx.shadowBlur = 12 * s;
      ctx.beginPath();
      ctx.arc(px - r * 0.35, py - r * 0.1, 3.2 * s, 0, Math.PI * 2);
      ctx.arc(px + r * 0.35, py - r * 0.1, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'troll') {
      // Mountain Troll Boss: Gold rim
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 3 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      // Curved ivory battle horns
      ctx.fillStyle = '#f5f5f0';
      ctx.strokeStyle = '#8d6e63';
      ctx.lineWidth = 1.4 * s;
      // Left horn
      ctx.beginPath();
      ctx.moveTo(px - r * 0.6, py - r * 0.5);
      ctx.quadraticCurveTo(px - r * 1.5, py - r * 1.3, px - r * 1.3, py - r * 1.9);
      ctx.quadraticCurveTo(px - r * 0.8, py - r * 1.1, px - r * 0.2, py - r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Right horn
      ctx.beginPath();
      ctx.moveTo(px + r * 0.6, py - r * 0.5);
      ctx.quadraticCurveTo(px + r * 1.5, py - r * 1.3, px + r * 1.3, py - r * 1.9);
      ctx.quadraticCurveTo(px + r * 0.8, py - r * 1.1, px + r * 0.2, py - r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing mystic blue eyes
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8 * s;
      ctx.beginPath();
      ctx.arc(px - r * 0.35, py - r * 0.1, 2.5 * s, 0, Math.PI * 2);
      ctx.arc(px + r * 0.35, py - r * 0.1, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash white blink
    if (this.hitFlash > 0) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.6})`;
      ctx.fill();
    }
    ctx.restore();

    // Health bar
    const barW   = (this.isBoss ? r * 3.2 : r * 2.6);
    const barH   = (this.isBoss ? 7 * s : 5 * s);
    const barX   = px - barW / 2;
    const barY   = py - r - (this.isBoss ? 17 * s : 9 * s);
    const hpFrac = clamp(this.hp / this.maxHp, 0, 1);

    // Background
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.roundRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3, 3);
    ctx.fill();

    // Boss label & gold frame
    if (this.isBoss) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 1.5 * s;
      ctx.stroke();

      ctx.font = `bold ${Math.max(9, 10 * s)}px Arial`;
      ctx.fillStyle = '#ffd54f';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      const bossLabel = this.type === 'heavy_troll' ? '👑 ANCIENT BEHEMOTH' : '👑 TROLL BOSS';
      ctx.fillText(bossLabel, px, barY - 5 * s);
    }

    const barColor = hpFrac > 0.5 ? '#44dd44' : hpFrac > 0.25 ? '#eecc00' : '#ee3333';
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * hpFrac, barH, 3);
    ctx.fill();
  }
}

/* =========================================================================
   CLASS: Tower
   ========================================================================= */
class Tower {
  constructor(type, lx, ly) {
    const def          = TOWER_TYPES[type];
    this.type          = type;
    this.label         = def.label;
    this.level         = 1;
    this.baseCost      = def.cost;
    this.totalInvested = def.cost;
    this.damage        = def.damage;
    this.range         = def.range;
    this.fireRate      = def.fireRate;
    this.cost          = def.cost;
    this.projType      = def.projType;
    this.projSpeed     = def.projSpeed;
    this.splash        = def.splashRadius || 0;
    this.x             = lx;        // logical center
    this.y             = ly;
    this.fireCd        = 0;
    this.target        = null;
    this.angle         = 0;
    // Barracks-specific
    if (this.type === 'barracks') {
      const spec = TOWER_UPGRADES.barracks[0];
      this.soldierCount  = spec.soldierCount;
      this.soldierHp     = spec.soldierHp;
      this.soldierDmg    = spec.soldierDmg;
      this.soldierSpeed  = spec.soldierSpeed;
      this.respawnTime   = spec.respawnTime;
      this._soldiers     = [];
      this._soldierSpawnCd = 0;
      const initialRally = (typeof getClosestPointOnRoad === 'function') ? getClosestPointOnRoad(this.x, this.y) : { x: this.x, y: this.y };
      this.rallyX        = initialRally.x;
      this.rallyY        = initialRally.y;
    }
  }

  setRallyPoint(targetX, targetY) {
    const pt = (typeof getClosestPointOnRoad === 'function') ? getClosestPointOnRoad(targetX, targetY) : { x: targetX, y: targetY };
    const snapX = pt.x;
    const snapY = pt.y;
    const dx = snapX - this.x;
    const dy = snapY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= this.range) {
      this.rallyX = snapX;
      this.rallyY = snapY;
    } else {
      const angle = Math.atan2(dy, dx);
      this.rallyX = this.x + Math.cos(angle) * this.range;
      this.rallyY = this.y + Math.sin(angle) * this.range;
    }
    this.updateSoldierRallyPositions();
  }

  updateSoldierRallyPositions() {
    if (!this._soldiers || !this._soldiers.length) return;
    const living = this._soldiers.filter(s => !s.dead);
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: -12, dy: 6 },
      { dx: 12, dy: -6 },
      { dx: 0, dy: 12 }
    ];
    living.forEach((soldier, idx) => {
      const off = offsets[idx % offsets.length];
      soldier.rallyX = (this.rallyX !== null && this.rallyX !== undefined ? this.rallyX : this.x) + off.dx;
      soldier.rallyY = (this.rallyY !== null && this.rallyY !== undefined ? this.rallyY : this.y) + off.dy;
    });
  }

  _updateBarracks(dt) {
    if (!this._soldiers) this._soldiers = [];
    this._soldiers = this._soldiers.filter(s => GS.soldiers.includes(s));
    const maxSoldiers = this.soldierCount || 3;
    const livingSoldiers = this._soldiers.filter(s => !s.dead || s.respawnTimer > 0);
    if (livingSoldiers.length < maxSoldiers && this._soldierSpawnCd <= 0) {
      const sol = new Soldier(this);
      this._soldiers.push(sol);
      GS.soldiers.push(sol);
      this.updateSoldierRallyPositions();
      this._soldierSpawnCd = 0.4;
    }
    if (this._soldierSpawnCd > 0) this._soldierSpawnCd -= dt;
  }

  getUpgradeInfo() {
    const list = TOWER_UPGRADES[this.type];
    if (!list || this.level >= 3) return null;
    const nextSpec = list[this.level]; // index 1 is Lv2, index 2 is Lv3
    if (this.type === 'barracks') {
      return {
        nextLevel:    nextSpec.level,
        cost:         nextSpec.cost,
        soldierCount: nextSpec.soldierCount,
        soldierHp:    nextSpec.soldierHp,
        soldierDmg:   nextSpec.soldierDmg,
        soldierSpeed: nextSpec.soldierSpeed,
        respawnTime:  nextSpec.respawnTime,
        title:        nextSpec.title,
        // For UI display
        damage:   nextSpec.soldierDmg,
        range:    0,
        fireRate: 0,
        splash:   0,
        dmgDiff:  nextSpec.soldierDmg - (this.soldierDmg || 0),
        rngDiff:  0,
        spdDiff:  0,
      };
    }
    return {
      nextLevel: nextSpec.level,
      cost:      nextSpec.cost,
      damage:    nextSpec.damage,
      range:     nextSpec.range,
      fireRate:  nextSpec.fireRate,
      splash:    nextSpec.splash,
      dmgDiff:   nextSpec.damage - this.damage,
      rngDiff:   nextSpec.range - this.range,
      spdDiff:   +(nextSpec.fireRate - this.fireRate).toFixed(2),
      title:     nextSpec.title
    };
  }

  getSellRefund() {
    return Math.floor(this.totalInvested * 0.70);
  }

  upgrade() {
    const info = this.getUpgradeInfo();
    if (!info) return false;
    if (GS.gold < info.cost) return false;

    GS.gold -= info.cost;
    this.totalInvested += info.cost;
    this.level     = info.nextLevel;
    if (this.type === 'barracks') {
      this.soldierCount = info.soldierCount;
      this.soldierHp    = info.soldierHp;
      this.soldierDmg   = info.soldierDmg;
      this.soldierSpeed = info.soldierSpeed;
      this.respawnTime  = info.respawnTime;
    } else {
      this.damage    = info.damage;
      this.range     = info.range;
      this.fireRate  = info.fireRate;
      this.splash    = info.splash;
    }

    SoundtrackManager.playUpgradeSfx();
    GS.floats.push(new FloatingText(`-${info.cost}🪙`, this.x, this.y - 28, '#ffcc44', 1.0));
    GS.floats.push(new FloatingText(`LEVEL ${this.level}! ⭐`, this.x, this.y - 44, '#44ff88', 1.25, 0, -35));
    spawnSparkBurst(this.x, this.y, '#44ffaa', 18);
    updateHUD();
    return true;
  }

  update(dt) {
    // Barracks: manage soldiers instead of projectile shooting
    if (this.type === 'barracks') {
      this._updateBarracks(dt);
      return;
    }

    if (this.fireCd > 0) this.fireCd -= dt;

    // Validate existing target
    if (this.target && (this.target.dead || this.target.reached)) this.target = null;

    // Re-acquire: pick furthest-progressed enemy in range
    if (!this.target || dist(this.x, this.y, this.target.x, this.target.y) > this.range) {
      this.target = null;
      let bestProgress = -1;
      for (const e of GS.enemies) {
        if (e.dead || e.reached) continue;
        const d = dist(this.x, this.y, e.x, e.y);
        if (d <= this.range) {
          let progress = e.waypointIdx;
          if (e.waypointIdx < GS.waypoints.length) {
            const prevWP = GS.waypoints[e.waypointIdx - 1];
            const nextWP = GS.waypoints[e.waypointIdx];
            const totalSeg = dist(prevWP?.x ?? e.x, prevWP?.y ?? e.y, nextWP.x, nextWP.y);
            const cur      = dist(e.x, e.y, nextWP.x, nextWP.y);
            progress += (totalSeg > 0 ? 1 - cur / totalSeg : 0);
          }
          if (progress > bestProgress) { bestProgress = progress; this.target = e; }
        }
      }
    }

    if (this.target) {
      this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    }

    // Hero "Aura of Courage" passive (+20% tower attack speed)
    let effectiveRate = this.fireRate;
    this.hasAuraBuff = false;
    if (GS.hero && !GS.hero.dead) {
      if (dist(this.x, this.y, GS.hero.x, GS.hero.y) <= GS.hero.auraRadius) {
        effectiveRate *= (1 + GS.hero.auraBuff);
        this.hasAuraBuff = true;
      }
    }

    if (this.target && this.fireCd <= 0) {
      this.fireCd = 1 / effectiveRate;
      GS.projectiles.push(new Projectile(this, this.target));
      if (this.type === 'archer') {
        SoundtrackManager.playArrowSfx();
      } else if (this.type === 'mage') {
        SoundtrackManager.playMageBoltSfx();
      } else if (this.type === 'cannon') {
        SoundtrackManager.playCannonFireSfx();
      }
    }
  }

  draw(ctx, showRange) {
    const s  = GS.scale;
    const px = this.x * s;
    const py = this.y * s;
    const sz = 20 * s;

    ctx.save();
    ctx.translate(px, py);
    if (this.type === 'archer')         drawArcherTower(ctx, sz, s, this.level);
    else if (this.type === 'mage')      drawMageTower(ctx, sz, s, this.level);
    else if (this.type === 'barracks')  drawBarracksTower(ctx, sz, s, this.level);
    else                                drawCannonTower(ctx, sz, s, this.angle, this.level);
    ctx.restore();

    // Draw level stars above tower
    drawLevelStars(ctx, px, py, this.level, s);

    // Hero Aura of Courage courage star/shimmer
    if (this.hasAuraBuff) {
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8 * s;
      ctx.font = `${10 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡', px, py - 24 * s);
      ctx.restore();
    }

    if (showRange) {
      ctx.save();
      const rColor = this.type === 'archer' ? 'rgba(76, 175, 80, 0.85)'
                   : this.type === 'mage' ? 'rgba(186, 104, 200, 0.85)'
                   : this.type === 'cannon' ? 'rgba(255, 112, 67, 0.85)'
                   : 'rgba(68, 136, 255, 0.85)';
      const fColor = this.type === 'archer' ? 'rgba(76, 175, 80, 0.12)'
                   : this.type === 'mage' ? 'rgba(186, 104, 200, 0.12)'
                   : this.type === 'cannon' ? 'rgba(255, 112, 67, 0.12)'
                   : 'rgba(68, 136, 255, 0.12)';
      const effRange = (this.type === 'barracks' ? 110 : this.range);

      // Current range circle
      ctx.beginPath();
      ctx.arc(px, py, effRange * s, 0, Math.PI * 2);
      ctx.strokeStyle = rColor;
      ctx.lineWidth   = 2.2 * s;
      ctx.setLineDash([7 * s, 5 * s]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = fColor;
      ctx.fill();

      // Range text badge
      ctx.font = `bold ${Math.max(10, 11 * s)}px Arial`;
      ctx.fillStyle = rColor;
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4 * s;
      const typeLabel = this.type === 'barracks' ? 'Rally Range' : 'Attack Range';
      ctx.fillText(`🎯 ${this.label} ${typeLabel}: ${effRange}px`, px, py - effRange * s - 6 * s);

      // Next level range preview (cyan ring) if upgradable
      const info = this.getUpgradeInfo();
      if (info && info.range > this.range && this.type !== 'barracks') {
        ctx.beginPath();
        ctx.arc(px, py, info.range * s, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 230, 255, 0.70)';
        ctx.lineWidth   = 2 * s;
        ctx.setLineDash([5 * s, 5 * s]);
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 230, 255, 0.05)';
        ctx.fill();

        ctx.setLineDash([]);
        ctx.font = `bold ${Math.max(10, 11 * s)}px Arial`;
        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4 * s;
        ctx.fillText(`+Preview Range (Lv ${info.nextLevel}): ${info.range}px`, px, py - info.range * s - 20 * s);
      }
      ctx.restore();
    }
  }
}

/* ---- Tower drawing helpers (standalone, stateless) ---- */

function drawBarracksTower(ctx, sz, s, level = 1) {
  // Stone fort base
  ctx.shadowColor = level === 3 ? '#ffd700' : level === 2 ? '#cc9933' : '#887744';
  ctx.shadowBlur  = (8 + level * 3) * s;
  ctx.fillStyle   = level === 3 ? '#4a3820' : level === 2 ? '#5a4828' : '#6a5830';
  ctx.strokeStyle = level === 3 ? '#ffd700' : level === 2 ? '#cc9933' : '#aa8844';
  ctx.lineWidth   = (2 + level * 0.5) * s;

  // Square fort body
  ctx.beginPath();
  ctx.roundRect(-sz * 0.85, -sz * 0.5, sz * 1.7, sz * 1.5, 3);
  ctx.fill();
  ctx.stroke();

  // Battlements (top crenellations)
  ctx.fillStyle = level === 3 ? '#3a2810' : level === 2 ? '#4a3818' : '#5a4820';
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(i * sz * 0.55 - sz * 0.2, -sz * 0.5 - sz * 0.35, sz * 0.38, sz * 0.35);
  }

  // Flag / banner
  const flagColor = level === 3 ? '#cc2222' : level === 2 ? '#cc6622' : '#aa4422';
  ctx.fillStyle = flagColor;
  ctx.beginPath();
  ctx.moveTo(-sz * 0.1, -sz * 0.5 - sz * 0.35);
  ctx.lineTo(-sz * 0.1, -sz * 0.5 - sz * 0.9);
  ctx.lineTo(sz * 0.45, -sz * 0.5 - sz * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = level === 3 ? '#ffd700' : '#cc8844';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(-sz * 0.1, -sz * 0.5 - sz * 0.35);
  ctx.lineTo(-sz * 0.1, -sz * 0.5 - sz * 0.9);
  ctx.stroke();

  // Gate arch
  ctx.fillStyle = '#1a1008';
  ctx.beginPath();
  ctx.roundRect(-sz * 0.22, -sz * 0.1, sz * 0.44, sz * 0.8, [sz * 0.18, sz * 0.18, 0, 0]);
  ctx.fill();

  // Shield icon on front
  if (level >= 2) {
    ctx.font = `bold ${Math.max(9, 11 * s)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(level === 3 ? '🏰' : '🛡️', 0, -sz * 0.25);
  }
}

function drawArcherTower(ctx, sz, s, level = 1) {
  ctx.shadowColor = level === 3 ? '#ffaa00' : level === 2 ? '#885522' : '#553300';
  ctx.shadowBlur  = (8 + level * 3) * s;
  ctx.fillStyle   = level === 3 ? '#50505a' : level === 2 ? '#605850' : '#776655';
  ctx.beginPath();
  ctx.roundRect(-sz, -sz * 0.6, sz * 2, sz * 1.6, 4);
  ctx.fill();
  ctx.strokeStyle = level === 3 ? '#ffd700' : level === 2 ? '#b87333' : '#998866';
  ctx.lineWidth   = (2 + level * 0.5) * s;
  ctx.stroke();

  // Battlements
  ctx.fillStyle = level === 3 ? '#444450' : level === 2 ? '#554840' : '#887766';
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(i * sz * 0.6 - sz * 0.18, -sz * 0.6 - sz * 0.35, sz * 0.34, sz * 0.35);
  }
  if (level >= 2) {
    ctx.fillStyle = level === 3 ? '#ffd700' : '#cd7f32';
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * sz * 0.6 - sz * 0.12, -sz * 0.6 - sz * 0.45, sz * 0.24, sz * 0.12);
    }
  }

  // Arrow slits
  ctx.fillStyle = '#1a0d00';
  if (level === 1) {
    ctx.fillRect(-sz * 0.08, -sz * 0.35, sz * 0.16, sz * 0.55);
  } else {
    ctx.fillRect(-sz * 0.45, -sz * 0.35, sz * 0.14, sz * 0.55);
    ctx.fillRect( sz * 0.31, -sz * 0.35, sz * 0.14, sz * 0.55);
  }

  // Crest / Banner for Lv2 / Lv3
  if (level === 2) {
    ctx.fillStyle = '#b01c1c';
    ctx.fillRect(-sz * 0.2, -sz * 0.25, sz * 0.4, sz * 0.6);
  } else if (level === 3) {
    ctx.fillStyle = '#4a0e78';
    ctx.fillRect(-sz * 0.24, -sz * 0.3, sz * 0.48, sz * 0.7);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1.2 * s;
    ctx.strokeRect(-sz * 0.24, -sz * 0.3, sz * 0.48, sz * 0.7);
  }

  // Arrow symbol
  ctx.strokeStyle = level === 3 ? '#ffd700' : level === 2 ? '#ffb347' : '#cc8800';
  ctx.lineWidth   = (2.5 + level * 0.5) * s;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(sz * 0.4, 0);  ctx.lineTo(-sz * 0.3, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sz * 0.4, 0);  ctx.lineTo(sz * 0.2, -sz * 0.2);
  ctx.moveTo(sz * 0.4, 0);  ctx.lineTo(sz * 0.2,  sz * 0.2);
  ctx.stroke();
}

function drawMageTower(ctx, sz, s, level = 1) {
  const grad = ctx.createLinearGradient(-sz, -sz, sz, sz);
  if (level === 1) {
    grad.addColorStop(0, '#8844cc'); grad.addColorStop(1, '#441188');
  } else if (level === 2) {
    grad.addColorStop(0, '#a838e6'); grad.addColorStop(1, '#2c0866');
  } else {
    grad.addColorStop(0, '#00e5ff'); grad.addColorStop(0.5, '#7b1fa2'); grad.addColorStop(1, '#1a0033');
  }

  ctx.shadowColor = level === 3 ? '#00e5ff' : level === 2 ? '#dd44ff' : '#aa44ff';
  ctx.shadowBlur  = (12 + level * 5) * s;
  ctx.fillStyle   = grad;
  ctx.beginPath();
  ctx.roundRect(-sz * 0.8, -sz * 0.7, sz * 1.6, sz * 1.7, sz * 0.5);
  ctx.fill();
  ctx.strokeStyle = level === 3 ? '#00ffff' : level === 2 ? '#e088ff' : '#cc88ff';
  ctx.lineWidth   = (2 + level * 0.5) * s;
  ctx.stroke();

  // Pointed roof / apex crystal
  ctx.fillStyle = level === 3 ? '#005577' : level === 2 ? '#3a0077' : '#5500aa';
  ctx.beginPath();
  ctx.moveTo(0,         -sz * (1.3 + level * 0.15));
  ctx.lineTo(-sz * 0.9, -sz * 0.7);
  ctx.lineTo( sz * 0.9, -sz * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = level === 3 ? '#80ffff' : '#cc88ff';
  ctx.lineWidth   = 1.5 * s;
  ctx.stroke();

  // Apex crystal gem
  const gemY = -sz * (1.35 + level * 0.15);
  const gemR = (4 + level * 2) * s;
  const gemColor = level === 3 ? '#00ffff' : level === 2 ? '#ff33aa' : '#ffee22';
  ctx.save();
  ctx.fillStyle = gemColor;
  ctx.shadowColor = gemColor;
  ctx.shadowBlur = 12 * s;
  ctx.beginPath();
  ctx.arc(0, gemY, gemR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Star / Mystic glyph on tower body
  const symbolColor = level === 3 ? '#ffffff' : level === 2 ? '#ff99ff' : '#ffee22';
  drawStar(ctx, 0, sz * 0.1, 5, sz * (0.32 + level * 0.05), sz * 0.16, symbolColor);

  // Floating orbit runes for Lv2 and Lv3
  if (level >= 2) {
    const t = performance.now() / 1000;
    const orbitCount = level === 3 ? 3 : 2;
    for (let i = 0; i < orbitCount; i++) {
      const ang = t * 3 + (i * Math.PI * 2) / orbitCount;
      const ox = Math.cos(ang) * sz * 0.95;
      const oy = Math.sin(ang) * sz * 0.45;
      ctx.save();
      ctx.fillStyle = level === 3 ? '#00ffff' : '#ff77ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8 * s;
      ctx.beginPath();
      ctx.arc(ox, oy, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawCannonTower(ctx, sz, s, angle, level = 1) {
  ctx.shadowColor = level === 3 ? '#ff4400' : level === 2 ? '#553311' : '#332200';
  ctx.shadowBlur  = (10 + level * 4) * s;
  ctx.fillStyle   = level === 3 ? '#2a2220' : level === 2 ? '#443830' : '#554433';
  ctx.beginPath();
  ctx.arc(0, 0, sz, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = level === 3 ? '#ff9900' : level === 2 ? '#997755' : '#887766';
  ctx.lineWidth   = (2.5 + level * 0.5) * s;
  ctx.stroke();

  // Armored rim rivets for level >= 2
  if (level >= 2) {
    ctx.fillStyle = level === 3 ? '#ffd700' : '#aaaaaa';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * sz * 0.82, Math.sin(a) * sz * 0.82, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Rotating barrel(s)
  ctx.save();
  ctx.rotate(angle);

  if (level === 1) {
    // Single barrel
    ctx.fillStyle   = '#333333';
    ctx.strokeStyle = '#666666';
    ctx.lineWidth   = 2 * s;
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, -sz * 0.2, sz * 0.85, sz * 0.4, sz * 0.15);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sz * 0.85, 0, sz * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#555555';
    ctx.fill();
    ctx.stroke();
  } else if (level === 2) {
    // Dual heavy barrels
    ctx.fillStyle   = '#282828';
    ctx.strokeStyle = '#777777';
    ctx.lineWidth   = 1.8 * s;
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, -sz * 0.28, sz * 0.9, sz * 0.24, sz * 0.1);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, sz * 0.04, sz * 0.9, sz * 0.24, sz * 0.1);
    ctx.fill(); ctx.stroke();
  } else {
    // Level 3: Dreadnought Triple Magma Cannon
    ctx.fillStyle   = '#1f1510';
    ctx.strokeStyle = '#ff7700';
    ctx.lineWidth   = 2 * s;
    // Center mega barrel
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, -sz * 0.18, sz * 1.05, sz * 0.36, sz * 0.1);
    ctx.fill(); ctx.stroke();
    // Flanking barrels
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, -sz * 0.38, sz * 0.85, sz * 0.18, sz * 0.08);
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(sz * 0.1, sz * 0.20, sz * 0.85, sz * 0.18, sz * 0.08);
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();

  // Center orb / magma core
  const cg = ctx.createRadialGradient(0, 0, sz * 0.08, 0, 0, sz * 0.45);
  if (level === 3) {
    cg.addColorStop(0, '#ffffff');
    cg.addColorStop(0.3, '#ffaa00');
    cg.addColorStop(0.8, '#ff2200');
    cg.addColorStop(1, '#440000');
  } else if (level === 2) {
    cg.addColorStop(0, '#ffcc00');
    cg.addColorStop(1, '#dd4400');
  } else {
    cg.addColorStop(0, '#ffaa00');
    cg.addColorStop(1, '#cc5500');
  }
  ctx.beginPath();
  ctx.arc(0, 0, sz * (0.36 + level * 0.04), 0, Math.PI * 2);
  ctx.fillStyle = cg;
  ctx.fill();
}

function drawLevelStars(ctx, px, py, level, s) {
  const count = level;
  const starY = py - 26 * s;
  const spacing = 11 * s;
  const startX = px - ((count - 1) * spacing) / 2;
  for (let i = 0; i < count; i++) {
    const sx = startX + i * spacing;
    drawMiniStar(ctx, sx, starY, 4.2 * s, '#ffd700');
  }
}

function drawMiniStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle   = color;
  ctx.shadowColor = '#ffbb00';
  ctx.shadowBlur  = 6;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad)
            : ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, cx, cy, points, outerR, innerR, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r   = i % 2 === 0 ? outerR : innerR;
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    i === 0 ? ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r)
            : ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
  }
  ctx.closePath();
  ctx.fillStyle   = color;
  ctx.shadowColor = color;
  ctx.shadowBlur  = 8;
  ctx.fill();
  ctx.restore();
}

/* =========================================================================
   CLASS: Projectile
   ========================================================================= */
class Projectile {
  constructor(tower, target) {
    this.type   = tower.projType;
    this.damage = tower.damage;
    this.splash = tower.splash;
    this.speed  = tower.projSpeed;
    this.x      = tower.x;   // logical
    this.y      = tower.y;
    this.target = target;
    this.done   = false;
    this.age    = 0;
    this.vx     = 0;
    this.vy     = 0;
    this._updateVelocity();
  }

  _updateVelocity() {
    if (!this.target || this.target.dead || this.target.reached) return;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d  = Math.hypot(dx, dy) || 1;
    this.vx  = (dx / d) * this.speed;
    this.vy  = (dy / d) * this.speed;
  }

  update(dt) {
    if (this.done) return;
    this.age += dt;

    // Homing
    if (this.target && !this.target.dead && !this.target.reached) {
      this._updateVelocity();
    } else {
      // Target gone — keep flying briefly
      if (this.age > 0.3) { this.done = true; return; }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Hit check
    if (this.target && !this.target.dead && !this.target.reached) {
      if (dist(this.x, this.y, this.target.x, this.target.y) < this.target.radius + 5) {
        this._impact();
      }
    }
  }

  _impact() {
    this.done = true;
    const dmgType = this.type === 'orb' ? 'magic' : this.type === 'cannonball' ? 'explosive' : 'physical';

    if (this.splash > 0) {
      // AoE Splash
      for (const e of GS.enemies) {
        if (e.dead || e.reached) continue;
        if (dist(this.x, this.y, e.x, e.y) <= this.splash) {
          const res = e.takeDamage(this.damage, dmgType);
          if (res.killed) {
            onEnemyKilled(e);
          } else {
            if (res.wasArmored) {
              GS.floats.push(new FloatingText(`-${res.actualDamage} 🛡️`, e.x, e.y - e.radius - 6, '#ffa726', 0.95, 0, -38));
            } else if (dmgType === 'magic') {
              GS.floats.push(new FloatingText(`-${res.actualDamage} 🔮`, e.x, e.y - e.radius - 6, '#ba68c8', 1.0, 0, -38));
            } else if (dmgType === 'explosive') {
              GS.floats.push(new FloatingText(`-${res.actualDamage} 💥`, e.x, e.y - e.radius - 6, '#ff7043', 1.05, 0, -38));
            } else {
              GS.floats.push(new FloatingText(`-${res.actualDamage}`, e.x, e.y - e.radius - 6, '#ef5350', 0.9, 0, -38));
            }
          }
        }
      }
      GS.floats.push(new FloatingText('💥', this.x, this.y, '#ff6600', 1.3, 0, -22));
    } else {
      // Single Target
      if (this.target && !this.target.dead) {
        const res = this.target.takeDamage(this.damage, dmgType);
        if (res.killed) {
          onEnemyKilled(this.target);
        } else {
          if (res.wasArmored) {
            GS.floats.push(new FloatingText(`-${res.actualDamage} 🛡️`, this.target.x, this.target.y - this.target.radius - 6, '#ffa726', 0.95, 0, -38));
          } else if (dmgType === 'magic') {
            GS.floats.push(new FloatingText(`-${res.actualDamage} 🔮`, this.target.x, this.target.y - this.target.radius - 6, '#ba68c8', 1.0, 0, -38));
          } else {
            GS.floats.push(new FloatingText(`-${res.actualDamage}`, this.target.x, this.target.y - this.target.radius - 6, '#ef5350', 0.9, 0, -38));
          }
        }
      }
    }
  }

  draw(ctx) {
    if (this.done) return;
    const s  = GS.scale;
    const px = this.x * s;
    const py = this.y * s;

    ctx.save();
    if (this.type === 'arrow') {
      const ang = Math.atan2(this.vy, this.vx);
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth   = 2 * s;
      ctx.lineCap     = 'round';
      ctx.beginPath();
      ctx.moveTo(-8*s, 0); ctx.lineTo(8*s, 0);
      ctx.stroke();
      ctx.fillStyle = '#cc9900';
      ctx.beginPath();
      ctx.moveTo( 8*s, 0);
      ctx.lineTo( 4*s, -2.5*s);
      ctx.lineTo( 4*s,  2.5*s);
      ctx.closePath();
      ctx.fill();

    } else if (this.type === 'orb') {
      const pulse = 0.85 + 0.15 * Math.sin(this.age * 10);
      const r     = 6 * s * pulse;
      const grad  = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3,'#dd88ff');
      grad.addColorStop(1, '#6600cc');
      ctx.shadowColor = '#aa44ff';
      ctx.shadowBlur  = 14 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

    } else if (this.type === 'cannonball') {
      const r    = 7 * s;
      const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
      grad.addColorStop(0, '#888');
      grad.addColorStop(1, '#222');
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur  = 10 * s;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.restore();
  }
}

/* =========================================================================
   CLASS: FloatingText
   ========================================================================= */
class FloatingText {
  constructor(text, lx, ly, color, scale = 1, vx = 0, vy = -40) {
    this.text    = text;
    this.x       = lx;
    this.y       = ly;
    this.color   = color;
    this.scale   = scale;
    this.vx      = vx;
    this.vy      = vy;
    this.life    = 1.1;
    this.maxLife = 1.1;
    this.done    = false;
  }

  update(dt) {
    this.x    += this.vx * dt;
    this.y    += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.done = true;
  }

  draw(ctx) {
    if (this.done) return;
    const alpha = clamp(this.life / this.maxLife, 0, 1);
    const s     = GS.scale;
    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = this.color;
    ctx.font         = `bold ${14 * s * this.scale}px Arial, sans-serif`;
    ctx.shadowColor  = '#000';
    ctx.shadowBlur   = 4 * s;

    if (this.text.includes('🪙')) {
      const cleanText = this.text.replace('🪙', '').trim();
      const textMetrics = ctx.measureText(cleanText);
      const textW = textMetrics.width;
      const coinR = 6.5 * s * this.scale;
      const totalW = textW + coinR * 2 + 4 * s;
      const startX = this.x * s - totalW / 2;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanText, startX, this.y * s);

      const coinX = startX + textW + 4 * s + coinR;
      const coinY = this.y * s;
      if (coinImg && coinImg.complete && coinImg.naturalWidth > 0) {
        ctx.drawImage(coinImg, coinX - coinR, coinY - coinR, coinR * 2, coinR * 2);
      } else {
        ctx.beginPath();
        ctx.arc(coinX, coinY, coinR, 0, Math.PI * 2);
        const cg = ctx.createRadialGradient(coinX - coinR*0.3, coinY - coinR*0.3, coinR*0.2, coinX, coinY, coinR);
        cg.addColorStop(0, '#ffe066');
        cg.addColorStop(0.7, '#f59e0b');
        cg.addColorStop(1, '#b45309');
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1 * s;
        ctx.stroke();
      }
    } else {
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.text, this.x * s, this.y * s);
    }
    ctx.restore();
  }
}


/* =========================================================================
   CLASS: Militia (Temporary Reinforcements)
   ========================================================================= */
class Militia {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.rallyX = x;
    this.rallyY = y;
    this.hp = 70;
    this.maxHp = 70;
    this.damage = 11;
    this.speed = 95;
    this.radius = 8;
    this.dead = false;
    this.isMilitia = true;
    this.lifeTimer = 15;     // 15 seconds duration
    this.maxLife = 15;

    this.target = null;
    this.attackCd = 0;
    this.attackRate = 1.3;
    this.attackRange = 18;
    this.hitFlash = 0;
  }

  update(dt) {
    if (this.dead) return;
    this.lifeTimer -= dt;
    if (this.lifeTimer <= 0) {
      this.dead = true;
      spawnSparkBurst(this.x, this.y, '#94a3b8', 8);
      return;
    }
    if (this.hitFlash > 0) this.hitFlash -= dt * 4;
    if (this.attackCd > 0) this.attackCd -= dt;

    // Find nearest live enemy within engage radius
    this.target = null;
    let bestD = 85;
    for (const e of GS.enemies) {
      if (e.dead || e.reached) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bestD) { bestD = d; this.target = e; }
    }

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > this.attackRange) {
        const nx = dx / d, ny = dy / d;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
      } else {
        if (this.attackCd <= 0) {
          this.attackCd = 1 / this.attackRate;
          const res = this.target.takeDamage(this.damage, 'physical');
          if (res.killed) onEnemyKilled(this.target);
          else GS.floats.push(new FloatingText(`-${this.damage}`, this.target.x, this.target.y - 10, '#ffffff', 0.8, 0, -25));
        }
        // Enemy strikes back at militia
        const enemyDmg = (this.target.isBoss ? 18 : (this.target.type === 'elite_orc' ? 10 : 5)) * dt;
        this.takeDamage(enemyDmg);
      }
      // Blocking mechanic: pin and heavily block enemy
      if (d < this.attackRange + 8 && !this.target.dead) {
        this.target.speed = Math.max(2, this.target.speed * 0.12);
        this.target.blocked = true;
      }
    } else {
      // Return to rally point
      const dx = this.rallyX - this.x;
      const dy = this.rallyY - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      spawnSparkBurst(this.x, this.y, '#94a3b8', 10);
      this.target = null;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const s = GS.scale;
    const px = this.x * s;
    const py = this.y * s;
    const r  = this.radius * s;

    // Fade/flash during last 2.5s
    const alpha = (this.lifeTimer < 2.5) ? (0.4 + 0.6 * Math.sin(this.lifeTimer * 8)) : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur  = 6 * s;

    // Body gradient (blue/steel militia armor)
    const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
    grad.addColorStop(0, '#93c5fd');
    grad.addColorStop(1, '#1d4ed8');
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#bfdbfe';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Spear / pike icon
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - r*0.4, py + r*0.5);
    ctx.lineTo(px + r*0.5, py - r*0.6);
    ctx.stroke();

    // Spear tip
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(px + r*0.5, py - r*0.6, 2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Mini timer bar above militia
    const barW = 14 * s;
    const barH = 2.5 * s;
    const pct = clamp(this.lifeTimer / this.maxLife, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px - barW/2, py - r - 6*s, barW, barH);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px - barW/2, py - r - 6*s, barW * pct, barH);

    ctx.restore();
  }
}

/* =========================================================================
   CLASS: Soldier  (spawned by Barracks towers onto the road)
   ========================================================================= */
class Soldier {
  constructor(barracks) {
    this.barracks    = barracks;     // owning Tower (barracks type)
    this.hp          = barracks.soldierHp;
    this.maxHp       = barracks.soldierHp;
    this.damage      = barracks.soldierDmg;
    this.speed       = barracks.soldierSpeed;
    this.radius      = 8;
    this.dead        = false;
    this.respawnTimer= 0;

    // Start at barracks position, walk to rally point on path
    this.x           = barracks.x;
    this.y           = barracks.y;
    this.rallyX      = barracks.rallyX || barracks.x;
    this.rallyY      = barracks.rallyY || barracks.y;
    this.atRally     = false;

    // Combat
    this.target      = null;
    this.attackCd    = 0;
    this.attackRate  = 1.2; // attacks/sec
    this.attackRange = 18;  // logical px
    this.hitFlash    = 0;
  }

  _computeRally() {
    // Find closest point on path to barracks position
    let bestDist = Infinity;
    let bestX = this.barracks.x, bestY = this.barracks.y;
    const wps = GS.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const ax = wps[i].x, ay = wps[i].y;
      const bx = wps[i+1].x, by = wps[i+1].y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx*dx + dy*dy;
      if (lenSq === 0) continue;
      const t = clamp(((this.barracks.x-ax)*dx + (this.barracks.y-ay)*dy) / lenSq, 0, 1);
      const cx = ax + t*dx, cy = ay + t*dy;
      const d = dist(this.barracks.x, this.barracks.y, cx, cy);
      if (d < bestDist) { bestDist = d; bestX = cx; bestY = cy; }
    }
    this.rallyX = this.barracks.rallyX || bestX;
    this.rallyY = this.barracks.rallyY || bestY;
  }

  update(dt) {
    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        // Respawn
        this.hp = this.maxHp;
        this.dead = false;
        this.x = this.barracks.x;
        this.y = this.barracks.y;
        this.atRally = false;
        this.target = null;
      }
      return;
    }

    if (this.hitFlash > 0) this.hitFlash -= dt * 4;

    // Update soldier stats from barracks (in case upgraded)
    this.maxHp = this.barracks.soldierHp;
    this.damage = this.barracks.soldierDmg;
    this.speed  = this.barracks.soldierSpeed;

    if (this.attackCd > 0) this.attackCd -= dt;

    // Find target: nearest live enemy within engage range
    this.target = null;
    let bestD = 100; // engage radius
    for (const e of GS.enemies) {
      if (e.dead || e.reached) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d < bestD) { bestD = d; this.target = e; }
    }

    if (this.target) {
      // Move towards target
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > this.attackRange) {
        const nx = dx / d, ny = dy / d;
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
      } else if (this.attackCd <= 0) {
        // Attack
        this.attackCd = 1 / this.attackRate;
        const res = this.target.takeDamage(this.damage, 'physical');
        if (res.killed) {
          onEnemyKilled(this.target);
        }
      }
      // Slow enemy movement when adjacent (blocking)
      if (d < this.attackRange + 5 && !this.target.dead) {
        this.target.speed = Math.max(10, this.target.speed * 0.6);
      }
    } else {
      // No target: return to/stay at rally point
      this.atRally = false;
      const dx = this.rallyX - this.x;
      const dy = this.rallyY - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        this.x += (dx / d) * this.speed * dt;
        this.y += (dy / d) * this.speed * dt;
      } else {
        this.atRally = true;
      }
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlash = 1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnTimer = this.barracks.respawnTime;
      this.target = null;
    }
  }

  draw(ctx) {
    if (this.dead) {
      const s = GS.scale;
      const dx = (this.deathX !== undefined ? this.deathX : this.x) * s;
      const dy = (this.deathY !== undefined ? this.deathY : this.y) * s;
      ctx.save();
      ctx.globalAlpha = 0.85;
      // Fallen marker emblem
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(dx, dy, 11 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5 * s;
      ctx.stroke();

      ctx.font = `bold ${12 * s}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛡️', dx, dy);

      // Respawn timer text above tombstone
      ctx.font = `bold ${11 * s}px Arial, sans-serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4 * s;
      ctx.fillText(`⏱ ${Math.ceil(this.respawnTimer)}s`, dx, dy - 16 * s);
      ctx.restore();
      return;
    }
    const s = GS.scale;
    const px = this.x * s;
    const py = this.y * s;
    const r  = this.radius * s;

    ctx.save();
    ctx.shadowColor = '#ffaa33';
    ctx.shadowBlur  = 6 * s;

    // Body
    const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
    grad.addColorStop(0, '#ffdd88');
    grad.addColorStop(1, '#cc7700');
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#fff8cc';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Sword symbol
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px, py - r * 0.7);
    ctx.lineTo(px, py + r * 0.6);
    ctx.moveTo(px - r * 0.45, py - r * 0.2);
    ctx.lineTo(px + r * 0.45, py - r * 0.2);
    ctx.stroke();

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${this.hitFlash * 0.5})`;
      ctx.fill();
    }
    ctx.restore();

    // HP bar
    const barW = r * 2.4;
    const barH = 3 * s;
    const barX = px - barW / 2;
    const barY = py - r - 6 * s;
    const hpFrac = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = '#222';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = hpFrac > 0.5 ? '#44dd44' : hpFrac > 0.25 ? '#eecc00' : '#ee3333';
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
  }
}

/* =========================================================================
   CLASS: Hero  (player-controlled champion unit)
   ========================================================================= */
class Hero {
  constructor() {
    this.x          = GS.logW * 0.12;
    this.y          = GS.logH * 0.50;
    this.targetX    = this.x;
    this.targetY    = this.y;
    this.moving     = false;
    this.hp         = 200;
    this.maxHp      = 200;
    this.dead       = false;
    this.respawnTimer = 0;
    this.respawnMax   = 10;

    this.damage     = 28;
    this.range      = 90;
    this.attackRate = 1.25;
    this.attackCd   = 0;
    this.moveSpeed  = 160;
    this.radius     = 14;

    // Passive 1: Built-in HP Regeneration (4 HP/s continuously)
    this.regenRate  = 4;

    // Passive 2: "Aura of Courage" (+20% Tower Attack Speed within 140px)
    this.auraRadius = 140;
    this.auraBuff   = 0.20;

    this.target     = null;
    this.angle      = 0;
    this.hitFlash   = 0;

    // Whirlwind
    this.whirlActive = false;
    this.whirlTimer  = 0;
    this.whirlDuration = 0.5;

    // Visual animation
    this.animTimer  = 0;
  }

  update(dt) {
    this.animTimer += dt;

    if (this.dead) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.hp = this.maxHp;
        this.dead = false;
        // Respawn at EXACT coordinates where he fell
        this.x = (this.deathX !== undefined) ? this.deathX : this.x;
        this.y = (this.deathY !== undefined) ? this.deathY : this.y;
        this.targetX = this.x;
        this.targetY = this.y;
        this.moving = false;
        this.target = null;
        spawnSparkBurst(this.x, this.y, '#ffd700', 22);
        showWaveBanner('⚔️ Hero Respawned at Fall Point!');
      }
      this._updateHudHpBar();
      return;
    }

    if (this.hitFlash > 0) this.hitFlash -= dt * 4;

    // Passive 1: Built-in HP Regeneration (4 HP/s continuously when alive)
    if (!this.dead && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + (this.regenRate || 4) * dt);
    }

    // Whirlwind effect
    if (this.whirlActive) {
      this.whirlTimer -= dt;
      if (this.whirlTimer <= 0) this.whirlActive = false;
    }

    // Movement towards target position
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const moveDist = Math.hypot(dx, dy);
    if (moveDist > 4) {
      this.moving = true;
      const nx = dx / moveDist, ny = dy / moveDist;
      const step = Math.min(this.moveSpeed * dt, moveDist);
      this.x += nx * step;
      this.y += ny * step;
    } else {
      this.moving = false;
    }

    if (this.attackCd > 0) this.attackCd -= dt;

    // Find target with safe null-checks
    this.target = null;
    let bestD = this.range;
    if (Array.isArray(GS.enemies)) {
      for (const e of GS.enemies) {
        if (!e || e.dead || e.reached) continue;
        const d = dist(this.x, this.y, e.x, e.y);
        if (d < bestD) { bestD = d; this.target = e; }
      }
    }

    // Melee attack loop with robust null-checks and try-catch
    if (this.target && !this.target.dead && !this.target.reached) {
      try {
        const tX = typeof this.target.x === 'number' ? this.target.x : this.x;
        const tY = typeof this.target.y === 'number' ? this.target.y : this.y;
        this.angle = Math.atan2(tY - this.y, tX - this.x);

        if (this.attackCd <= 0) {
          this.attackCd = 1 / this.attackRate;

          // Sound trigger with safe execution
          try {
            if (SoundtrackManager && typeof SoundtrackManager.playHeroAttackSfx === 'function') {
              SoundtrackManager.playHeroAttackSfx();
            }
          } catch (audioErr) {
            console.warn('Hero attack SFX error:', audioErr);
          }

          // Damage calculation and dealing
          if (typeof this.target.takeDamage === 'function') {
            const res = this.target.takeDamage(this.damage, 'physical');
            if (res && res.killed) {
              if (typeof onEnemyKilled === 'function') {
                onEnemyKilled(this.target);
              }
              this.target = null;
            } else if (res && typeof res.actualDamage === 'number') {
              const enemyR = typeof this.target.radius === 'number' ? this.target.radius : 12;
              GS.floats.push(new FloatingText(`-${res.actualDamage}⚔️`, tX, tY - enemyR - 6, '#ffe066', 0.9, 0, -30));
            }
          }
        }
      } catch (err) {
        console.error('Safe hero attack error handled:', err);
        this.target = null;
      }
    } else {
      this.target = null;
    }

    // Enemies deal damage to hero when adjacent (safe collision loop)
    if (Array.isArray(GS.enemies)) {
      for (const e of GS.enemies) {
        if (!e || e.dead || e.reached) continue;
        try {
          const eR = typeof e.radius === 'number' ? e.radius : 10;
          const d = dist(this.x, this.y, e.x, e.y);
          if (d < this.radius + eR + 4) {
            const baseDmg = (e.isBoss ? (e.type === 'heavy_troll' ? 24 : 15) : (e.type === 'elite_orc' ? 9 : e.type === 'orc' ? 6 : 3));
            const dmg = baseDmg * dt;
            this.hp -= dmg;
            this.hitFlash = Math.min(1, this.hitFlash + 0.3);
          }
        } catch (colErr) {
          console.warn('Hero collision check error:', colErr);
        }
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathX = this.x;
      this.deathY = this.y;
      this.respawnTimer = this.respawnMax;
      this.target = null;
      GS.floats.push(new FloatingText('💀 HERO FALLS!', this.x, this.y - 20, '#ff4444', 1.3, 0, -40));
    }

    this._updateHudHpBar();
  }

  castWhirlwind() {
    if (GS.heroSpellCd > 0 || this.dead) return;
    GS.heroSpellCd = GS.heroSpellMaxCd;
    this.whirlActive = true;
    this.whirlTimer = this.whirlDuration;

    const aoeRadius = 80;
    let hit = 0;
    if (Array.isArray(GS.enemies)) {
      for (const e of GS.enemies) {
        if (!e || e.dead || e.reached) continue;
        try {
          const d = dist(this.x, this.y, e.x, e.y);
          if (d <= aoeRadius) {
            const dmg = 60;
            if (typeof e.takeDamage === 'function') {
              const res = e.takeDamage(dmg, 'magic');
              if (res && res.killed) {
                if (typeof onEnemyKilled === 'function') onEnemyKilled(e);
              } else {
                const eR = typeof e.radius === 'number' ? e.radius : 10;
                GS.floats.push(new FloatingText(`-${dmg}🌀`, e.x, e.y - eR - 6, '#88ddff', 1.1, 0, -35));
              }
              hit++;
            }
          }
        } catch (whirlErr) {
          console.warn('Whirlwind hit error:', whirlErr);
        }
      }
    }
    spawnSparkBurst(this.x, this.y, '#4488ff', 24);
    GS.floats.push(new FloatingText('🌀 WHIRLWIND!', this.x, this.y - 22, '#88ccff', 1.3, 0, -40));
    try {
      if (SoundtrackManager && typeof SoundtrackManager.playWhirlwindSfx === 'function') {
        SoundtrackManager.playWhirlwindSfx();
      }
    } catch (e) {}
    updateHeroSpellButton();
  }

  _updateHudHpBar() {
    const bar = document.getElementById('hero-hp-bar');
    const hudEl = document.getElementById('hero-hud');
    const respawnEl = document.getElementById('hero-respawn-text');
    if (!bar) return;
    const pct = clamp(this.hp / this.maxHp * 100, 0, 100);
    bar.style.width = pct + '%';
    bar.style.background = this.hp > this.maxHp * 0.5 ? 'linear-gradient(90deg,#4488ff,#00ccff)' : this.hp > this.maxHp * 0.25 ? 'linear-gradient(90deg,#ffaa00,#ffdd44)' : 'linear-gradient(90deg,#ee3333,#ff6644)';
    if (hudEl) hudEl.classList.toggle('hero-dead', this.dead);
    if (respawnEl) {
      if (this.dead) {
        respawnEl.style.display = 'block';
        respawnEl.textContent = `⏱ ${Math.ceil(this.respawnTimer)}s`;
      } else {
        respawnEl.style.display = 'none';
      }
    }
  }

  draw(ctx) {
    const s  = GS.scale;
    const px = this.x * s;
    const py = this.y * s;
    const r  = this.radius * s;

    if (this.dead) {
      // Ghost / tombstone while dead
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(this.animTimer * 3);
      ctx.fillStyle = '#8899bb';
      ctx.beginPath();
      ctx.arc(px, py, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();

    // Selection ring when hero is selected
    if (GS.heroSelected) {
      const pulse = 0.6 + 0.4 * Math.sin(this.animTimer * 5);
      ctx.strokeStyle = `rgba(100,200,255,${pulse})`;
      ctx.lineWidth = 2.5 * s;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 12 * s;
      ctx.beginPath();
      ctx.arc(px, py, r + 5 * s, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Whirlwind AoE ring
    if (this.whirlActive) {
      const wFrac = 1 - this.whirlTimer / this.whirlDuration;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - wFrac * 1.5);
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 3 * s;
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 18 * s;
      ctx.beginPath();
      ctx.arc(px, py, 80 * s * (0.3 + wFrac * 0.7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Body gradient
    ctx.shadowColor = '#4488ff';
    ctx.shadowBlur  = 14 * s;
    const grad = ctx.createRadialGradient(px - r*0.35, py - r*0.35, r*0.1, px, py, r);
    grad.addColorStop(0, '#88ccff');
    grad.addColorStop(0.5, '#2255cc');
    grad.addColorStop(1, '#0a1a55');
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Gold rim
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 0.55;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Sword symbol — rotates toward target
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.2 * s;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#ffdd00';
    ctx.shadowBlur = 5 * s;
    // Blade
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, r * 0.55);
    ctx.lineTo(r * 0.75, -r * 0.55);
    ctx.stroke();
    // Guard
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, 0);
    ctx.lineTo(r * 0.5, 0);
    ctx.stroke();
    ctx.restore();

    // Moving trail indicator
    if (this.moving) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.arc(px, py, r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // HP bar above hero
    const barW = r * 3.0;
    const barH = 5 * s;
    const barX = px - barW / 2;
    const barY = py - r - 10 * s;
    const hpFrac = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = '#111';
    ctx.fillRect(barX - 1.5, barY - 1.5, barW + 3, barH + 3);
    const barCol = hpFrac > 0.5 ? '#4488ff' : hpFrac > 0.25 ? '#ffaa00' : '#ee3333';
    ctx.fillStyle = barCol;
    ctx.fillRect(barX, barY, barW * hpFrac, barH);
    // Hero label
    ctx.save();
    ctx.font = `bold ${Math.max(8, 8 * s)}px Arial`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText('⚔ HERO', px, barY - 3 * s);
    ctx.restore();
  }
}

/* =========================================================================
   CLASS: SparkParticle (upgrade & sell visual feedback)
   ========================================================================= */
class SparkParticle {
  constructor(lx, ly, color) {
    this.x = lx;
    this.y = ly;
    const ang = Math.random() * Math.PI * 2;
    const spd = 30 + Math.random() * 80;
    this.vx = Math.cos(ang) * spd;
    this.vy = Math.sin(ang) * spd;
    this.color = color;
    this.life = 0.45 + Math.random() * 0.35;
    this.maxLife = this.life;
    this.size = 2 + Math.random() * 3.5;
    this.done = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
    if (this.life <= 0) this.done = true;
  }
  draw(ctx) {
    if (this.done) return;
    const s = GS.scale;
    const a = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(this.x * s, this.y * s, this.size * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function spawnSparkBurst(lx, ly, color, count = 16) {
  for (let i = 0; i < count; i++) {
    GS.sparks.push(new SparkParticle(lx, ly, color));
  }
}

/* =========================================================================
   CLASS: MeteorShower (Special Hero Spell - Meteor Strike)
   ========================================================================= */
class MeteorShower {
  constructor(targetX, targetY) {
    this.targetX = targetX;
    this.targetY = targetY;
    this.aoeRadius = 75;
    this.damage = 220;
    this.duration = 1.6;
    this.elapsed = 0;
    this.hasExploded = false;
    this.done = false;

    // Multi-meteor volley
    this.meteors = [
      { delay: 0.00, startX: targetX + 130, startY: targetY - 240, progress: 0, speed: 2.7, size: 14, trail: [] },
      { delay: 0.08, startX: targetX + 170, startY: targetY - 270, progress: 0, speed: 2.5, size: 10, trail: [] },
      { delay: 0.15, startX: targetX + 90,  startY: targetY - 220, progress: 0, speed: 3.0, size: 16, trail: [] },
      { delay: 0.22, startX: targetX + 150, startY: targetY - 250, progress: 0, speed: 2.6, size: 12, trail: [] },
    ];

    this.shockwaves = [];
    this.particles = [];

    SoundtrackManager.playMeteorLaunchSfx();
  }

  update(dt) {
    this.elapsed += dt;

    for (const m of this.meteors) {
      if (this.elapsed >= m.delay && m.progress < 1) {
        m.progress += dt * m.speed;
        const curX = lerp(m.startX, this.targetX, Math.min(1, m.progress));
        const curY = lerp(m.startY, this.targetY, Math.min(1, m.progress));

        m.trail.push({ x: curX, y: curY, size: m.size * (0.7 + Math.random() * 0.4) });
        if (m.trail.length > 10) m.trail.shift();

        if (m.progress >= 1) {
          this._subImpact(this.targetX + (Math.random() - 0.5) * 20, this.targetY + (Math.random() - 0.5) * 20, m.size);
        }
      }
    }

    // Main explosion triggered on first main meteor landing
    if (!this.hasExploded && this.elapsed >= 0.35) {
      this.hasExploded = true;
      this._mainImpact();
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      sw.r += dt * sw.speed;
      sw.alpha -= dt * sw.fade;
    }
    this.shockwaves = this.shockwaves.filter(sw => sw.alpha > 0);

    // Particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy += 32 * dt; // subtle gravity
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    if (this.elapsed > this.duration && this.particles.length === 0 && this.shockwaves.length === 0) {
      this.done = true;
    }
  }

  _subImpact(x, y, sz) {
    for (let i = 0; i < 7; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 90;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 25,
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        size: sz * (0.3 + Math.random() * 0.3),
        color: Math.random() > 0.4 ? '#ff6600' : '#ffcc00'
      });
    }
  }

  _mainImpact() {
    // Screen shake
    GS.shakeDuration = 0.45;
    GS.shakeMagnitude = 9;

    // Expanding shockwaves
    this.shockwaves.push({ r: 5, speed: 280, fade: 1.8, alpha: 1.0, color: '#ff4400', width: 4.5 });
    this.shockwaves.push({ r: 5, speed: 360, fade: 2.2, alpha: 0.8, color: '#ffaa00', width: 2.5 });

    // 40 ember particles
    const emberColors = ['#ff2200', '#ff6600', '#ffaa00', '#ffee33', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 190;
      this.particles.push({
        x: this.targetX,
        y: this.targetY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (30 + Math.random() * 60),
        life: 0.5 + Math.random() * 0.7,
        maxLife: 1.2,
        size: 3 + Math.random() * 6,
        color: emberColors[Math.floor(Math.random() * emberColors.length)]
      });
    }

    // Battlefield crater
    GS.craters.push({
      x: this.targetX,
      y: this.targetY,
      radius: this.aoeRadius * 0.85,
      alpha: 0.75,
      life: 18.0
    });

    // SFX
    SoundtrackManager.playMeteorBoomSfx();

    // Damage enemies in AoE
    let enemiesHit = 0;
    for (const e of GS.enemies) {
      if (e.dead || e.reached) continue;
      const d = dist(this.targetX, this.targetY, e.x, e.y);
      if (d <= this.aoeRadius + e.radius) {
        enemiesHit++;
        const res = e.takeDamage(this.damage, 'spell');
        if (res.killed) {
          onEnemyKilled(e);
        } else {
          GS.floats.push(new FloatingText(`-${res.actualDamage} 🔥`, e.x, e.y - e.radius - 8, '#ff3300', 1.25, 0, -45));
        }
      }
    }

    GS.floats.push(new FloatingText('💥 METEOR BLAST!', this.targetX, this.targetY - 24, '#ff9900', 1.4, 0, -35));
  }

  draw(ctx) {
    const s = GS.scale;

    // Draw active falling meteors and trails
    for (const m of this.meteors) {
      if (this.elapsed >= m.delay && m.progress < 1) {
        const curX = lerp(m.startX, this.targetX, m.progress) * s;
        const curY = lerp(m.startY, this.targetY, m.progress) * s;

        // Trail
        for (let i = 0; i < m.trail.length; i++) {
          const pt = m.trail[i];
          const trAlpha = (i / m.trail.length) * 0.75;
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x * s, pt.y * s, pt.size * (i / m.trail.length) * s, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, ${80 + i * 14}, 0, ${trAlpha})`;
          ctx.shadowColor = '#ff4400';
          ctx.shadowBlur = 8 * s;
          ctx.fill();
          ctx.restore();
        }

        // Meteor head
        ctx.save();
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 18 * s;
        const radGrad = ctx.createRadialGradient(curX, curY, 2 * s, curX, curY, m.size * s);
        radGrad.addColorStop(0, '#ffffff');
        radGrad.addColorStop(0.3, '#ffcc00');
        radGrad.addColorStop(0.7, '#ff3300');
        radGrad.addColorStop(1, '#660000');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(curX, curY, m.size * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.width * s;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 14 * s;
      ctx.beginPath();
      ctx.arc(this.targetX * s, this.targetY * s, sw.r * s, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(255, 100, 0, ${sw.alpha * 0.14})`;
      ctx.fill();
      ctx.restore();
    }

    // Particles
    for (const p of this.particles) {
      ctx.save();
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6 * s;
      ctx.beginPath();
      ctx.arc(p.x * s, p.y * s, p.size * (alpha * 0.6 + 0.4) * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/* =========================================================================
   BATTLEFIELD CRATERS & METEOR RETICLE
   ========================================================================= */
function drawCraters(ctx) {
  const s = GS.scale;
  for (const c of GS.craters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, c.alpha);
    const grad = ctx.createRadialGradient(c.x * s, c.y * s, c.radius * 0.15 * s, c.x * s, c.y * s, c.radius * s);
    grad.addColorStop(0, 'rgba(20, 10, 5, 0.88)');
    grad.addColorStop(0.5, 'rgba(45, 20, 8, 0.55)');
    grad.addColorStop(1, 'rgba(30, 78, 44, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x * s, c.y * s, c.radius * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMeteorReticle(ctx, lx, ly) {
  const s = GS.scale;
  const px = lx * s;
  const py = ly * s;
  const aoeR = 75 * s;
  const now = performance.now() / 1000;
  const pulse = 0.88 + 0.12 * Math.sin(now * 8);

  ctx.save();

  // AoE danger zone fill
  const grad = ctx.createRadialGradient(px, py, 10 * s, px, py, aoeR);
  grad.addColorStop(0, 'rgba(255, 60, 0, 0.32)');
  grad.addColorStop(0.7, 'rgba(255, 120, 0, 0.18)');
  grad.addColorStop(1, 'rgba(255, 40, 0, 0.04)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, aoeR, 0, Math.PI * 2);
  ctx.fill();

  // Outer dashed warning circle
  ctx.strokeStyle = '#ff3300';
  ctx.lineWidth = 2.5 * s;
  ctx.shadowColor = '#ff2200';
  ctx.shadowBlur = 10 * s;
  ctx.setLineDash([10 * s, 6 * s]);
  ctx.lineDashOffset = -now * 30 * s;
  ctx.beginPath();
  ctx.arc(px, py, aoeR * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosshairs
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2 * s;
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 6 * s;
  const chLen = 16 * s;
  ctx.beginPath();
  ctx.moveTo(px - chLen, py); ctx.lineTo(px + chLen, py);
  ctx.moveTo(px, py - chLen); ctx.lineTo(px, py + chLen);
  ctx.stroke();

  // Center pip
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px, py, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Target banner text
  ctx.font = `bold ${Math.max(12, 13 * s)}px Arial, sans-serif`;
  ctx.fillStyle = '#ffd54f';
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.fillText('☄️ TAP TO STRIKE', px, py - aoeR - 10 * s);

  ctx.restore();
}

/* =========================================================================
   SPAWN QUEUE
   ========================================================================= */
function buildSpawnQueue(waveDef) {
  const groups = [];
  for (const group of waveDef) {
    let t = 0;
    for (let i = 0; i < group.count; i++) {
      groups.push({ type: group.type, time: t });
      t += group.interval;
    }
  }
  groups.sort((a, b) => a.time - b.time);
  const queue = [];
  let prev = 0;
  for (const g of groups) {
    queue.push({ type: g.type, delay: g.time - prev });
    prev = g.time;
  }
  return queue;
}

/* =========================================================================
   GAME EVENT HANDLERS
   ========================================================================= */
function onEnemyKilled(enemy) {
  GS.gold += enemy.reward;
  GS.killsThisRun++;
  const scoreReward = enemy.scoreReward || (enemy.reward * 10);
  GS.score += scoreReward;

  ProfileManager.recordKill();
  ProfileManager.updateHighScore(GS.score);

  GS.floats.push(new FloatingText(`+${enemy.reward}🪙`, enemy.x, enemy.y - enemy.radius - 12, '#ffd54f', 1.1, 0, -35));
  GS.floats.push(new FloatingText(`+${scoreReward} pts`, enemy.x, enemy.y - enemy.radius - 26, '#aaffaa', 0.9, 0, -28));
  updateHUD();
}

function onEnemyReached(enemy) {
  const penalty = enemy.lifeCost || 1;
  GS.lives = Math.max(0, GS.lives - penalty);
  GS.floats.push(new FloatingText(`-${penalty} ❤️`, enemy.x, enemy.y - enemy.radius - 10, '#ff3333', 1.25, 0, -40));
  updateHUD();
  if (GS.lives <= 0) triggerGameOver();
}

function triggerGameOver() {
  GS.phase   = 'gameover';
  GS.running = false;

  ProfileManager.recordWave(GS.wave);
  ProfileManager.updateHighScore(GS.score);
  updateHUD();

  showOverlay(
    'gameover',
    '💀 Defeat - Kingdom Overrun!',
    `Your defenses collapsed on Wave ${GS.wave} of ${WAVE_DEFS.length}. The enemy horde breached your kingdom walls!`,
    '🔄 Try Again'
  );
}

function triggerVictory() {
  GS.phase   = 'victory';
  GS.running = false;

  // Clear bonuses: 100 pts per surviving life, 2 pts per unused gold
  const lifeBonus = GS.lives * 100;
  const goldBonus = GS.gold * 2;
  const grandBonus = lifeBonus + goldBonus;
  GS.score += grandBonus;

  ProfileManager.recordWave(10);
  ProfileManager.updateHighScore(GS.score);
  updateHUD();

  showOverlay(
    'victory',
    '🏆 VICTORY, COMMANDER!',
    `The realm is victorious! All 10 waves of the dark horde were vanquished!\nKingdom Bonus: +${lifeBonus} pts (Lives) & +${goldBonus} pts (Gold).`,
    '🎉 Play Campaign Again'
  );
}

/* =========================================================================
   WAVE MANAGEMENT
   ========================================================================= */
function startWave() {
  SoundtrackManager.playWaveStartSfx();
  if (GS.waveActive || (!GS.endlessMode && GS.wave >= WAVE_DEFS.length)) return;
  GS.wave++;
  GS.waveActive   = true;
  GS.spawnQueue   = buildSpawnQueue(getWaveDefinition(GS.wave));
  GS.spawnTimer   = 0;
  GS.enemiesAlive = GS.spawnQueue.length;
  updateHUD();
  updateWaveButton();
  if (GS.wave === 5) {
    showWaveBanner('⚠️ MID-CAMPAIGN BOSS: Heavy Titan Approaching!');
  } else if (GS.wave === 10) {
    showWaveBanner('☠️ FINAL BOSS SIEGE: Ancient Behemoths Arrive!');
  } else if (GS.wave > 10) {
    showWaveBanner(`⚔️ Endless Wave ${GS.wave} Unleashed! ⚔️`);
  } else {
    showWaveBanner(`⚔️  Wave ${GS.wave} / ${WAVE_DEFS.length}  ⚔️`);
  }
}

function checkWaveComplete() {
  if (!GS.waveActive) return;
  if (GS.spawnQueue.length === 0 && GS.enemiesAlive === 0) {
    GS.waveActive = false;
    GS.wavesCleared = GS.wave;
    ProfileManager.recordWave(GS.wave + 1);

    // Wave completion bonus points
    const waveBonus = GS.wave * 200;
    GS.score += waveBonus;
    ProfileManager.updateHighScore(GS.score);
    updateHUD();

    if (!GS.endlessMode && GS.wave >= WAVE_DEFS.length) {
      showWaveBanner('🏆 ALL 10 WAVES CLEARED! VICTORY!');
      setTimeout(triggerVictory, 1500);
    } else {
      showWaveBanner(`⚔️ Wave ${GS.wave} Complete! (+${waveBonus} pts)`);
      updateWaveButton();
    }
  }
}

/* =========================================================================
   SPAWN SYSTEM
   ========================================================================= */
function processSpawns(dt) {
  if (!GS.waveActive || GS.spawnQueue.length === 0) return;
  GS.spawnTimer -= dt;
  if (GS.spawnTimer <= 0) {
    const item  = GS.spawnQueue.shift();
    GS.enemies.push(new Enemy(item.type, GS.wave));
    GS.spawnTimer = GS.spawnQueue.length > 0 ? GS.spawnQueue[0].delay : 0;
  }
}

/* =========================================================================
   COORDINATE COMPUTATION
   ========================================================================= */
function computeWaypoints() {
  GS.waypoints = WAYPOINT_FRACS.map(([fx, fy]) => ({
    x: fx * GS.logW,
    y: fy * GS.logH,
  }));
}

function computeBuildNodes() {
  const existingMap = new Map();
  if (GS.buildNodes && GS.buildNodes.length) {
    for (const node of GS.buildNodes) {
      if (node.tower) existingMap.set(node.id, node.tower);
    }
  }
  GS.buildNodes = BUILD_NODE_FRACS.map(([fx, fy], i) => {
    const prevTower = existingMap.get(i) || null;
    return {
      id:    i,
      x:     fx * GS.logW,
      y:     fy * GS.logH,
      tower: prevTower,
    };
  });
}

/* =========================================================================
   PATH HIT TESTING
   ========================================================================= */
function isOnPath(lx, ly) {
  const halfW = (ROAD_WIDTH / 2) + 12;
  for (let i = 0; i < GS.waypoints.length - 1; i++) {
    const ax = GS.waypoints[i].x,   ay = GS.waypoints[i].y;
    const bx = GS.waypoints[i+1].x, by = GS.waypoints[i+1].y;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx*dx + dy*dy;
    if (lenSq === 0) continue;
    const t  = clamp(((lx-ax)*dx + (ly-ay)*dy) / lenSq, 0, 1);
    const cx = ax + t*dx, cy = ay + t*dy;
    if (Math.hypot(lx - cx, ly - cy) < halfW) return true;
  }
  return false;
}

/* =========================================================================
   TOWER PLACEMENT  (node-based)
   ========================================================================= */
function buildOnNode(nodeId, towerType) {
  const node = GS.buildNodes.find(n => n.id === nodeId);
  if (!node || node.tower !== null) return;

  const def = TOWER_TYPES[towerType];
  if (GS.gold < def.cost) {
    GS.floats.push(new FloatingText('Not enough 🪙', node.x, node.y - 25, '#ff4444', 0.95));
    closePopup();
    return;
  }

  GS.gold -= def.cost;
  const tower = new Tower(towerType, node.x, node.y);
  node.tower = tower;
  GS.towers.push(tower);
  GS.floats.push(new FloatingText(`-${def.cost}🪙`, node.x, node.y - 28, '#ffcc44', 0.95));
  updateHUD();
  closePopup();
}

/* =========================================================================
   BUILD & TOWER ACTION POPUP CONTROLS
   ========================================================================= */
function openPopup(nodeId) {
  GS.selectedNode  = nodeId;
  GS.inspectedNode = null;
  closeTowerActionPopup();
  document.getElementById('build-popup').classList.remove('hidden');
}

function closePopup() {
  GS.selectedNode = null;
  GS.previewShopTower = null;
  if (typeof updateShopButtonSelection === 'function') updateShopButtonSelection();
  document.getElementById('build-popup').classList.add('hidden');
}

function openTowerActionPopup(nodeId) {
  const node = GS.buildNodes.find(n => n.id === nodeId);
  if (!node || !node.tower) return;

  GS.inspectedNode = nodeId;
  GS.selectedNode  = null;
  closePopup();

  const tower = node.tower;
  const popup = document.getElementById('tower-action-popup');
  const title = document.getElementById('tap-title');
  const dmg = document.getElementById('tap-dmg');
  const rng = document.getElementById('tap-rng');
  const spd = document.getElementById('tap-spd');
  const btnUpgrade = document.getElementById('btn-tower-upgrade');
  const nextLvl = document.getElementById('tap-next-lvl');
  const upInfo = document.getElementById('tap-upgrade-info');
  const sellInfo = document.getElementById('tap-sell-info');

  const typeIcons = { archer: '🏹', mage: '🔮', cannon: '💣', barracks: '🏰' };
  title.textContent = `${typeIcons[tower.type] || '🏰'} ${tower.label} (Lv ${tower.level})`;
  if (tower.type === 'barracks') {
    dmg.textContent = tower.soldierDmg || 0;
    rng.textContent = `${tower.soldierCount || 0} sol`;
    spd.textContent = tower.respawnTime || 0;
  } else {
    dmg.textContent = tower.damage;
    rng.textContent = tower.range;
    spd.textContent = tower.fireRate;
  }

  const info = tower.getUpgradeInfo();
  if (info) {
    btnUpgrade.disabled = (GS.gold < info.cost);
    nextLvl.textContent = info.nextLevel;
    if (GS.gold < info.cost) {
      upInfo.innerHTML = `<img src="coin.png" class="coin-icon-sm" alt=""> ${info.cost} (Need More Gold)`;
    } else if (tower.type === 'barracks') {
      upInfo.innerHTML = `<img src="coin.png" class="coin-icon-sm" alt=""> ${info.cost} (+${info.dmgDiff} SolDmg, +${info.soldierCount} Soldiers)`;
    } else {
      upInfo.innerHTML = `<img src="coin.png" class="coin-icon-sm" alt=""> ${info.cost} (+${info.dmgDiff} Dmg, +${info.rngDiff} Rng)`;
    }
  } else {
    btnUpgrade.disabled = true;
    nextLvl.textContent = 'MAX';
    upInfo.textContent = '⭐ MAX LEVEL REACHED';
  }

  const refund = tower.getSellRefund();
  sellInfo.innerHTML = `<img src="coin.png" class="coin-icon-sm" alt=""> +${refund} (70% refund)`;

  popup.classList.remove('hidden');
}

function closeTowerActionPopup() {
  GS.inspectedNode = null;
  const popup = document.getElementById('tower-action-popup');
  if (popup) popup.classList.add('hidden');
}

function updateTowerActionPopupIfOpen() {
  if (GS.inspectedNode !== null) {
    const node = GS.buildNodes.find(n => n.id === GS.inspectedNode);
    if (node && node.tower) {
      openTowerActionPopup(node.id);
    } else {
      closeTowerActionPopup();
    }
  }
}

/* =========================================================================
   SPECIAL HERO SPELL (Meteor Strike Controls)
   ========================================================================= */
function toggleMeteorTargeting() {
  if (GS.phase !== 'playing' || GS.paused) return;
  if (GS.spellCooldown > 0) {
    GS.floats.push(new FloatingText(`Meteor Cooldown (${Math.ceil(GS.spellCooldown)}s)`, GS.logW * 0.25, GS.logH * 0.8, '#ff8844', 1.0));
    return;
  }

  if (GS.targetingMode === 'meteor') {
    cancelMeteorTargeting();
  cancelReinforceTargeting();
  } else {
    GS.targetingMode = 'meteor';
    GS.selectedNode  = null;
    closePopup();
    closeTowerActionPopup();
    updateSpellButton();
    showWaveBanner('☄️ METEOR TARGETING: Tap anywhere on map to strike!');
  }
}

function cancelMeteorTargeting() {
  GS.targetingMode = null;
  GS.meteorAimPos  = null;
  updateSpellButton();
}

function castMeteorStrike(lx, ly) {
  if (GS.spellCooldown > 0) return;
  GS.spellCooldown = GS.spellMaxCooldown;
  cancelMeteorTargeting();
  GS.meteors.push(new MeteorShower(lx, ly));
}


/* =========================================================================
   CALL REINFORCEMENTS CONTROLLER
   ========================================================================= */
function toggleReinforceTargeting() {
  if (GS.phase !== 'playing' || GS.paused) return;
  if (GS.reinforceSpellCd > 0) {
    GS.floats.push(new FloatingText(`Reinforce Cooldown (${Math.ceil(GS.reinforceSpellCd)}s)`, GS.logW * 0.35, GS.logH * 0.8, '#38bdf8', 1.0));
    return;
  }

  if (GS.targetingMode === 'reinforce') {
    cancelReinforceTargeting();
  } else {
    cancelMeteorTargeting();
    GS.targetingMode = 'reinforce';
    GS.selectedNode  = null;
    closePopup();
    closeTowerActionPopup();
    updateReinforceButton();
    showWaveBanner('👥 REINFORCEMENTS: Tap on or near the road to deploy 2 militia!');
  }
}

function cancelReinforceTargeting() {
  if (GS.targetingMode === 'reinforce') {
    GS.targetingMode = null;
  }
  updateReinforceButton();
}

function castReinforcements(lx, ly) {
  if (GS.reinforceSpellCd > 0) return;
  GS.reinforceSpellCd = GS.reinforceSpellMaxCd;
  cancelReinforceTargeting();

  // Spawn 2 militia units
  const m1 = new Militia(lx - 10, ly);
  const m2 = new Militia(lx + 10, ly);
  GS.soldiers.push(m1, m2);

  spawnSparkBurst(lx, ly, '#38bdf8', 22);
  GS.floats.push(new FloatingText('⚔️ MILITIA DEPLOYED!', lx, ly - 22, '#93c5fd', 1.2, 0, -35));
  SoundtrackManager.playReinforceSfx();
  updateReinforceButton();
}

function updateReinforceButton() {
  const btn = document.getElementById('spell-reinforce-btn');
  const overlay = document.getElementById('reinforce-spell-cd-overlay');
  const cdText = document.getElementById('reinforce-spell-cd-text');
  if (!btn || !overlay || !cdText) return;

  if (GS.reinforceSpellCd > 0) {
    overlay.classList.add('active');
    cdText.textContent = `${Math.ceil(GS.reinforceSpellCd)}s`;
    btn.disabled = true;
    btn.classList.remove('targeting');
  } else {
    overlay.classList.remove('active');
    btn.disabled = false;
    if (GS.targetingMode === 'reinforce') {
      btn.classList.add('targeting');
    } else {
      btn.classList.remove('targeting');
    }
  }
}

function updateSpellButton() {
  const btn = document.getElementById('spell-meteor-btn');
  const overlay = document.getElementById('spell-cd-overlay');
  const cdText = document.getElementById('spell-cd-text');
  if (!btn || !overlay || !cdText) return;

  if (GS.spellCooldown > 0) {
    overlay.classList.add('active');
    cdText.textContent = `${Math.ceil(GS.spellCooldown)}s`;
    btn.disabled = true;
    btn.classList.remove('targeting');
  } else {
    overlay.classList.remove('active');
    btn.disabled = false;
    if (GS.targetingMode === 'meteor') {
      btn.classList.add('targeting');
    } else {
      btn.classList.remove('targeting');
    }
  }
}

/* =========================================================================
   RENDERING
   ========================================================================= */

/** Grass background with deterministic texture dabs. */
function drawBackground(ctx) {
  const W = GS.canvas.width, H = GS.canvas.height;
  const s = GS.scale;

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#2e6e3e');
  grad.addColorStop(1, '#1e4e2c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  const rng = mulberry32(42);
  for (let i = 0; i < 500; i++) {
    const gx = rng() * W;
    const gy = rng() * H;
    if (isOnPath(gx / s, gy / s)) continue;
    ctx.fillStyle = `rgba(${50 + (rng()*45|0)}, ${115 + (rng()*35|0)}, ${50 + (rng()*22|0)}, ${0.22 + rng()*0.18})`;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 4*s + rng()*7*s, 2*s + rng()*2.5*s, rng()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw the winding dirt road. */
function drawRoad(ctx) {
  if (GS.waypoints.length < 2) return;
  const s   = GS.scale;
  const pts = GS.waypoints.map(wp => [wp.x * s, wp.y * s]);

  ctx.save();
  ctx.lineCap  = 'round';
  ctx.lineJoin = 'round';

  // Dark outer border
  ctx.strokeStyle = '#5a3a08';
  ctx.lineWidth   = (ROAD_WIDTH + 10) * s;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // Main road
  const roadGrad = ctx.createLinearGradient(0, 0, GS.canvas.width, GS.canvas.height);
  roadGrad.addColorStop(0,   '#a07830');
  roadGrad.addColorStop(0.5, '#8B6914');
  roadGrad.addColorStop(1,   '#7a5a10');
  ctx.strokeStyle = roadGrad;
  ctx.lineWidth   = ROAD_WIDTH * s;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  // Centre highlight
  ctx.strokeStyle = 'rgba(200,160,60,0.22)';
  ctx.lineWidth   = (ROAD_WIDTH * 0.42) * s;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  ctx.restore();

  // Corner stones at turns
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, (ROAD_WIDTH / 2 + 4) * s, 0, Math.PI*2);
    ctx.fillStyle = '#9e7220';
    ctx.fill();
    ctx.restore();
  }

  // Direction arrows along each segment
  for (let i = 0; i < pts.length - 1; i++) {
    drawPathArrow(ctx, pts[i], pts[i+1], s);
  }
}

function drawPathArrow(ctx, from, to, s) {
  const dx  = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  if (len < 40 * s) return; // too short to bother
  // Draw arrow at 40% of segment
  const t   = 0.4;
  const mx  = from[0] + dx * t;
  const my  = from[1] + dy * t;
  const ang = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(255,255,136,0.35)';
  ctx.beginPath();
  ctx.moveTo(10*s,  0);
  ctx.lineTo(-6*s, -7*s);
  ctx.lineTo(-6*s,  7*s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Draw all build node pads (empty = stone circle, occupied = tower). */
function drawBuildNodes(ctx) {
  const s   = GS.scale;
  const now = performance.now() / 1000;

  for (const node of GS.buildNodes) {
    const px = node.x * s;
    const py = node.y * s;
    const nr = NODE_RADIUS * s;

    if (node.tower !== null) {
      // Occupied: tower is drawn separately in the main render pass
      continue;
    }

    // Pulsing glow when this node is selected
    const isSelected = (GS.selectedNode === node.id);
    const pulseAmt   = isSelected ? (0.5 + 0.5 * Math.sin(now * 5)) : 0;

    // Stone pad
    ctx.save();
    ctx.globalAlpha = 0.72 + pulseAmt * 0.25;
    ctx.shadowColor = isSelected ? '#ffdd44' : '#aaaaaa';
    ctx.shadowBlur  = isSelected ? (8 + pulseAmt * 12) * s : 4 * s;

    // Outer ring
    ctx.strokeStyle = isSelected ? '#ffdd44' : '#888877';
    ctx.lineWidth   = 2 * s;
    ctx.fillStyle   = '#5a5a4a';
    ctx.beginPath();
    ctx.arc(px, py, nr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Stone texture ring
    ctx.strokeStyle = '#6a6a5a';
    ctx.lineWidth   = 1 * s;
    ctx.beginPath();
    ctx.arc(px, py, nr * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Cross pattern
    ctx.strokeStyle = isSelected ? '#ffdd88' : '#8a8a7a';
    ctx.lineWidth   = 1.5 * s;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(px - nr * 0.45, py); ctx.lineTo(px + nr * 0.45, py);
    ctx.moveTo(px, py - nr * 0.45); ctx.lineTo(px, py + nr * 0.45);
    ctx.stroke();

    ctx.restore();
  }
}

/* =========================================================================
   MAIN GAME LOOP
   ========================================================================= */
function gameLoop(timestamp) {
  if (!GS.running) return;
  const speed = GS.gameSpeed || 1.0;
  // Clamp dt to avoid spiral-of-death on tab resume / slow devices
  let dt = (timestamp - GS.lastTime) / 1000;
  if (dt > MAX_DT) dt = MAX_DT;
  dt *= speed;
  GS.lastTime = timestamp;

  if (!GS.paused) update(dt);

  render();
  GS.rafId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  processSpawns(dt);

  // Screen shake timer
  if (GS.shakeDuration > 0) {
    GS.shakeDuration = Math.max(0, GS.shakeDuration - dt);
  }

  // Spell cooldown timer
  if (GS.spellCooldown > 0) {
    GS.spellCooldown = Math.max(0, GS.spellCooldown - dt);
    updateSpellButton();
  }
  if (GS.reinforceSpellCd > 0) {
    GS.reinforceSpellCd = Math.max(0, GS.reinforceSpellCd - dt);
    updateReinforceButton();
  }
  // Clean up dead/expired temporary militia
  for (let i = GS.soldiers.length - 1; i >= 0; i--) {
    const s = GS.soldiers[i];
    if (s.isMilitia && (s.dead || s.lifeTimer <= 0)) {
      GS.soldiers.splice(i, 1);
    }
  }

  // Update enemies
  for (const e of GS.enemies) {
    e.update(dt);
    if (e.reached) {
      onEnemyReached(e);
      e.reached = false;
      GS.enemiesAlive--;
    } else if (e.dead && !e._counted) {
      e._counted = true;
      GS.enemiesAlive--;
    }
  }
  GS.enemies = GS.enemies.filter(e => !e.dead && !e.reached);

  // Update towers
  for (const t of GS.towers) t.update(dt);

  // Update soldiers (spawned by barracks)
  for (const sol of GS.soldiers) sol.update(dt);
  GS.soldiers = GS.soldiers.filter(sol => {
    // Remove soldiers whose barracks was sold
    const barracksTower = GS.towers.find(t => t === sol.barracks);
    return !!barracksTower;
  });

  // Update hero
  if (GS.hero) GS.hero.update(dt);

  // Hero spell cooldown
  if (GS.heroSpellCd > 0) {
    GS.heroSpellCd = Math.max(0, GS.heroSpellCd - dt);
    updateHeroSpellButton();
  }

  // Update projectiles
  for (const p of GS.projectiles) p.update(dt);
  GS.projectiles = GS.projectiles.filter(p => !p.done);

  // Update meteors
  for (const m of GS.meteors) m.update(dt);
  GS.meteors = GS.meteors.filter(m => !m.done);

  // Update craters
  for (const c of GS.craters) {
    c.life -= dt;
    if (c.life < 4) c.alpha = (c.life / 4) * 0.75;
  }
  GS.craters = GS.craters.filter(c => c.life > 0);

  // Update spark particles
  for (const sp of GS.sparks) sp.update(dt);
  GS.sparks = GS.sparks.filter(sp => !sp.done);
  // Cap sparks to avoid performance issues on low-end mobile
  if (GS.sparks.length > 80) GS.sparks.splice(0, GS.sparks.length - 80);

  // Update floats
  for (const f of GS.floats) f.update(dt);
  GS.floats = GS.floats.filter(f => !f.done);
  // Cap floating texts
  if (GS.floats.length > 30) GS.floats.splice(0, GS.floats.length - 30);

  checkWaveComplete();

  // Safeguard: sync enemiesAlive once spawn queue drains
  if (GS.waveActive && GS.spawnQueue.length === 0) {
    GS.enemiesAlive = GS.enemies.length;
  }
}

function render() {
  const ctx = GS.ctx;

  ctx.save();
  if (GS.shakeDuration > 0) {
    const sx = (Math.random() - 0.5) * GS.shakeMagnitude * GS.scale;
    const sy = (Math.random() - 0.5) * GS.shakeMagnitude * GS.scale;
    ctx.translate(sx, sy);
  }

  ctx.clearRect(0, 0, GS.canvas.width, GS.canvas.height);

  drawBackground(ctx);
  drawRoad(ctx);
  drawCraters(ctx);
  drawBuildNodes(ctx);

  // Draw towers; show range ring for inspected node's tower
  for (const node of GS.buildNodes) {
    if (node.tower === null) continue;
    const showRange = (GS.inspectedNode === node.id);
    node.tower.draw(ctx, showRange);
  }

  // Draw projectiles
  for (const p of GS.projectiles) p.draw(ctx);

  // Draw soldiers
  for (const sol of GS.soldiers) sol.draw(ctx);

  // Draw enemies
  for (const e of GS.enemies) e.draw(ctx);

  // Draw meteors & fiery shockwaves
  for (const m of GS.meteors) m.draw(ctx);

  // Draw spark particles
  for (const sp of GS.sparks) sp.draw(ctx);

  // Draw floating texts
  for (const f of GS.floats) f.draw(ctx);

  // Draw hero (on top of battlefield units)
  if (GS.hero) GS.hero.draw(ctx);

  // Targeting reticle (if targeting meteor)
  if (GS.targetingMode === 'meteor') {
    const aim = GS.meteorAimPos || { x: GS.logW / 2, y: GS.logH / 2 };
    drawMeteorReticle(ctx, aim.x, aim.y);
  }

  // Tower Range Preview when a shop card or build node is selected
  if (GS.previewShopTower) {
    const pType = GS.previewShopTower;
    const pDef  = TOWER_TYPES[pType];
    const pRng  = (pType === 'barracks' ? 110 : (pDef ? pDef.range : 130));
    const rCol  = pType === 'archer' ? 'rgba(76, 175, 80, 0.85)'
                : pType === 'mage' ? 'rgba(186, 104, 200, 0.85)'
                : pType === 'cannon' ? 'rgba(255, 112, 67, 0.85)'
                : 'rgba(68, 136, 255, 0.85)';
    const fCol  = pType === 'archer' ? 'rgba(76, 175, 80, 0.12)'
                : pType === 'mage' ? 'rgba(186, 104, 200, 0.12)'
                : pType === 'cannon' ? 'rgba(255, 112, 67, 0.12)'
                : 'rgba(68, 136, 255, 0.12)';

    // If an empty build node is selected, render range circle at that specific node!
    if (GS.selectedNode !== null) {
      const node = GS.buildNodes.find(n => n.id === GS.selectedNode);
      if (node) {
        const nx = node.x * GS.scale;
        const ny = node.y * GS.scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(nx, ny, pRng * GS.scale, 0, Math.PI * 2);
        ctx.strokeStyle = rCol;
        ctx.lineWidth = 2.5 * GS.scale;
        ctx.setLineDash([7 * GS.scale, 5 * GS.scale]);
        ctx.stroke();
        ctx.fillStyle = fCol;
        ctx.fill();
        ctx.setLineDash([]);
        ctx.font = `bold ${Math.max(11, 12 * GS.scale)}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 6;
        const typeLabel = pType === 'barracks' ? 'Rally Range' : 'Attack Range';
        ctx.fillText(`🎯 ${pDef ? pDef.label : pType} ${typeLabel}: ${pRng}px`, nx, ny - pRng * GS.scale - 8 * GS.scale);
        ctx.restore();
      }
    } else {
      // If no specific node is selected, render soft preview rings around all empty build pads
      ctx.save();
      for (const node of GS.buildNodes) {
        if (node.tower === null) {
          const nx = node.x * GS.scale;
          const ny = node.y * GS.scale;
          ctx.beginPath();
          ctx.arc(nx, ny, pRng * GS.scale, 0, Math.PI * 2);
          ctx.strokeStyle = rCol;
          ctx.lineWidth = 1.3 * GS.scale;
          ctx.setLineDash([5 * GS.scale, 5 * GS.scale]);
          ctx.stroke();
          ctx.fillStyle = fCol;
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  ctx.restore();
}

/* =========================================================================
   UI HELPERS
   ========================================================================= */
function updateHUD() {
  document.getElementById('hud-gold').textContent  = GS.gold;
  document.getElementById('hud-lives').textContent = GS.lives;
  const maxWaveStr = GS.endlessMode ? '∞' : WAVE_DEFS.length;
  document.getElementById('hud-wave').textContent  = `${GS.wave}/${maxWaveStr}`;

  const scoreEl = document.getElementById('hud-score');
  if (scoreEl) scoreEl.textContent = GS.score.toLocaleString();

  const hudHiEl = document.getElementById('hud-high-score');
  if (hudHiEl) hudHiEl.textContent = Math.max(GS.score, ProfileManager.highScore).toLocaleString();

  const killsEl = document.getElementById('hud-kills');
  if (killsEl) killsEl.textContent = GS.killsThisRun;

  // Top-HUD incoming wave info & threat indicator
  const nextTextEl = document.getElementById('hud-next-text');
  if (nextTextEl) {
    if (GS.waveActive) {
      nextTextEl.textContent = `${GS.enemiesAlive} enemies active`;
      nextTextEl.style.color = '#ff8a80';
    } else {
      const nextW = GS.wave + 1;
      if (nextW === 5) {
        nextTextEl.textContent = '⚠️ W5: Mid-Boss Titan!';
        nextTextEl.style.color = '#ffb74d';
      } else if (nextW === 10) {
        nextTextEl.textContent = '☠️ W10: Ancient Behemoths!';
        nextTextEl.style.color = '#ff5252';
      } else if (nextW > 10) {
        nextTextEl.textContent = `W${nextW}: Endless Horde`;
        nextTextEl.style.color = '#ce93d8';
      } else {
        const info = WAVE_INFO[nextW - 1];
        nextTextEl.textContent = `W${nextW}: ${info ? info.name : 'Incoming Horde'}`;
        nextTextEl.style.color = '#fff';
      }
    }
  }

  updateTowerActionPopupIfOpen();
}

function updateWaveButton() {
  const btn = document.getElementById('btn-wave');
  if (GS.waveActive) {
    btn.textContent = `⚔️ Wave ${GS.wave} in progress…`;
    btn.disabled    = true;
  } else if (!GS.endlessMode && GS.wave >= WAVE_DEFS.length) {
    btn.textContent = '🏆 All 10 Waves Complete!';
    btn.disabled    = true;
  } else {
    const nextWave = GS.wave + 1;
    let waveLabel = `⚔️ Start Wave ${nextWave}`;
    if (nextWave === 5) waveLabel = '⚠️ Start Wave 5 [BOSS]';
    else if (nextWave === 10) waveLabel = '☠️ Start Wave 10 [FINAL BOSS]';
    else if (nextWave > 10) waveLabel = `⚔️ Start Endless Wave ${nextWave}`;
    btn.textContent = waveLabel;
    btn.disabled    = false;
  }
}

function showOverlay(type, title, msg, btnText) {
  const overlay     = document.getElementById('overlay');
  const cardEl      = document.getElementById('overlay-card');
  const badgeEl     = document.getElementById('overlay-badge');
  const titleEl     = document.getElementById('overlay-title');
  const msgEl       = document.getElementById('overlay-msg');
  const btnEl       = document.getElementById('overlay-btn');
  const wavesEl     = document.getElementById('os-waves');
  const killsEl     = document.getElementById('os-kills');
  const scoreEl     = document.getElementById('os-score');
  const hiEl        = document.getElementById('os-highscore');
  const newHiEl     = document.getElementById('os-new-high');
  const lifeKillsEl = document.getElementById('os-lifetime-kills');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = msg;
  if (btnEl) btnEl.textContent = btnText;

  if (wavesEl) wavesEl.textContent = `${GS.wave} / ${GS.endlessMode ? '∞' : WAVE_DEFS.length}`;
  if (killsEl) killsEl.textContent = GS.killsThisRun;
  if (scoreEl) scoreEl.textContent = GS.score.toLocaleString();
  if (hiEl) hiEl.textContent = ProfileManager.highScore.toLocaleString();
  if (lifeKillsEl) lifeKillsEl.textContent = ProfileManager.totalKills.toLocaleString();

  const isNewRecord = (GS.score > 0 && GS.score >= ProfileManager.highScore);
  if (newHiEl) {
    if (isNewRecord) newHiEl.classList.remove('hidden');
    else newHiEl.classList.add('hidden');
  }

  const endlessBtn = document.getElementById('overlay-endless-btn');
  if (endlessBtn) {
    if (type === 'victory') {
      endlessBtn.classList.remove('hidden');
    } else {
      endlessBtn.classList.add('hidden');
    }
  }

  if (cardEl) {
    if (type === 'victory') {
      cardEl.className = 'victory-mode';
      if (badgeEl) badgeEl.textContent = '🏆';
    } else {
      cardEl.className = 'defeat-mode';
      if (badgeEl) badgeEl.textContent = '💀';
    }
  }

  overlay.classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

let waveBannerTimeout = null;
function showWaveBanner(text) {
  const el = document.getElementById('wave-banner');
  el.textContent = text;
  el.classList.add('visible');
  if (waveBannerTimeout) clearTimeout(waveBannerTimeout);
  waveBannerTimeout = setTimeout(() => el.classList.remove('visible'), 2400);
}

function updateHeroSpellButton() {
  const btn = document.getElementById('spell-hero-btn');
  const overlay = document.getElementById('hero-spell-cd-overlay');
  const cdText = document.getElementById('hero-spell-cd-text');
  if (!btn || !overlay || !cdText) return;
  if (GS.heroSpellCd > 0) {
    overlay.classList.add('active');
    cdText.textContent = `${Math.ceil(GS.heroSpellCd)}s`;
    btn.disabled = true;
  } else {
    overlay.classList.remove('active');
    btn.disabled = false;
  }
}

/* =========================================================================
   LAYOUT / RESIZE
   ========================================================================= */
function resizeWrapper() {
  const wrapper = document.getElementById('game-wrapper');
  const vw      = window.innerWidth;
  const vh      = window.innerHeight;
  const dpr     = window.devicePixelRatio || 1;

  let wrapW, wrapH;
  if (vw / vh > WRAPPER_RATIO) {
    // Viewport wider than 16:9 — constrain by height
    wrapH = vh;
    wrapW = Math.floor(vh * WRAPPER_RATIO);
  } else {
    // Viewport taller than 16:9 — constrain by width
    wrapW = vw;
    wrapH = Math.floor(vw / WRAPPER_RATIO);
  }

  wrapper.style.width  = wrapW + 'px';
  wrapper.style.height = wrapH + 'px';

  // Canvas sits between HUD and bottom panel
  const canvasH = wrapH - HUD_H - BOTTOM_H;
  const canvas  = GS.canvas;

  canvas.style.width  = wrapW + 'px';
  canvas.style.height = canvasH + 'px';
  canvas.width        = wrapW * dpr;
  canvas.height       = canvasH * dpr;

  // Logical coordinate system
  GS.logW  = CANVAS_BASE_W;
  GS.logH  = CANVAS_BASE_H;
  GS.scale = Math.min(canvas.width / GS.logW, canvas.height / GS.logH);

  computeWaypoints();
  computeBuildNodes();

  // Sync existing tower positions to node positions
  // (needed if towers were placed before resize changes scale)
  for (const node of GS.buildNodes) {
    if (node.tower) {
      node.tower.x = node.x;
      node.tower.y = node.y;
    }
  }
}

/* =========================================================================
   INPUT HANDLING  (mouse + touch)
   ========================================================================= */

/** Convert a client-space event point to logical canvas coordinates. */
function clientToLogical(clientX, clientY) {
  const rect = GS.canvas.getBoundingClientRect();
  const rx   = (clientX - rect.left)  * (GS.canvas.width  / rect.width);
  const ry   = (clientY - rect.top)   * (GS.canvas.height / rect.height);
  return { x: rx / GS.scale, y: ry / GS.scale };
}


/* =========================================================================
   BOTTOM SELECTION & INFO BOX CONTROLLER
   ========================================================================= */
function selectUnit(unit, type) {
  GS.selectedUnit = unit;
  GS.selectedUnitType = type;
  updateUnitInfoBox();
  const box = document.getElementById('unit-info-box');
  if (box) box.classList.remove('hidden');
}

function clearUnitSelection() {
  GS.selectedUnit = null;
  GS.selectedUnitType = null;
  const box = document.getElementById('unit-info-box');
  if (box) box.classList.add('hidden');
}

function updateUnitInfoBox() {
  const box = document.getElementById('unit-info-box');
  if (!box || !GS.selectedUnit) return;

  const u = GS.selectedUnit;
  if (u.dead || (u.reached !== undefined && u.reached)) {
    clearUnitSelection();
    return;
  }

  const iconEl = document.getElementById('unit-info-icon');
  const nameEl = document.getElementById('unit-info-name');
  const typeEl = document.getElementById('unit-info-type');
  const barEl  = document.getElementById('unit-info-hp-bar');
  const hpEl   = document.getElementById('unit-info-hp-text');
  const statEl = document.getElementById('unit-info-stats');

  const curHp = Math.max(0, Math.ceil(u.hp));
  const maxHp = u.maxHp || 100;
  const pct = clamp(curHp / maxHp * 100, 0, 100);

  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct > 50 ? 'linear-gradient(90deg, #44cc44, #88ff44)' :
                             pct > 25 ? 'linear-gradient(90deg, #ffaa00, #ffdd44)' :
                             'linear-gradient(90deg, #ee3333, #ff6644)';
  }
  if (hpEl) hpEl.textContent = `${curHp} / ${maxHp}`;

  if (GS.selectedUnitType === 'hero') {
    if (iconEl) iconEl.textContent = '🛡️';
    if (nameEl) nameEl.textContent = ProfileManager.profileName || 'Commander Hero';
    if (typeEl) {
      typeEl.textContent = 'HERO';
      typeEl.style.color = '#38bdf8';
      typeEl.style.borderColor = '#0284c7';
    }
    const cdText = (u.spellCd <= 0) ? 'Ready' : (Math.ceil(u.spellCd) + 's');
    if (statEl) statEl.textContent = `⚔️ DMG: 28 | 💖 Regen: 4 HP/s | 🛡️ Aura: +20% Tower Spd | 🌀 Whirl: ${cdText}`;
  } else if (GS.selectedUnitType === 'soldier') {
    if (iconEl) iconEl.textContent = '⚔️';
    if (nameEl) nameEl.textContent = 'Royal Footman';
    if (typeEl) {
      if (u.isMilitia) {
        typeEl.textContent = 'MILITIA';
        typeEl.style.color = '#38bdf8';
        typeEl.style.borderColor = '#0284c7';
      } else {
        typeEl.textContent = 'SOLDIER';
      }
      typeEl.style.color = '#4ade80';
      typeEl.style.borderColor = '#16a34a';
    }
    if (statEl) {
      if (u.isMilitia) {
        statEl.textContent = `⚔️ ATK: ${u.damage || 11} | ⏱️ Timer: ${Math.ceil(u.lifeTimer)}s`;
      } else {
        statEl.textContent = `⚔️ ATK: ${u.damage || 10} | 🛡️ Barracks Guard`;
      }
    }
  } else if (GS.selectedUnitType === 'enemy') {
    let name = 'Enemy Raider';
    let icon = '👹';
    let badge = 'ENEMY';
    let color = '#fbbf24';

    if (u.type === 'heavy_troll') {
      name = 'Ancient Behemoth (BOSS)';
      icon = '👑';
      badge = 'BOSS';
      color = '#ef4444';
    } else if (u.type === 'elite_orc') {
      name = 'Elite Orc Chieftain';
      icon = '🧌';
      badge = 'ELITE';
      color = '#f97316';
    } else if (u.type === 'orc') {
      name = 'Armored Orc';
      icon = '👺';
      badge = 'HEAVY';
      color = '#fb923c';
    } else if (u.type === 'wolf') {
      name = 'Dire Wolf';
      icon = '🐺';
      badge = 'FAST';
      color = '#38bdf8';
    } else {
      name = 'Goblin Scout';
      icon = '👹';
      badge = 'SCOUT';
      color = '#a3e635';
    }

    if (iconEl) iconEl.textContent = icon;
    if (nameEl) nameEl.textContent = name;
    if (typeEl) {
      typeEl.textContent = badge;
      typeEl.style.color = color;
      typeEl.style.borderColor = color;
    }
    const armorTxt = u.armor ? ` | 🛡️ Armor: ${Math.round(u.armor * 100)}%` : '';
    if (statEl) statEl.textContent = `⚔️ ATK: ${u.damage || 15} | 🏃 SPD: ${Math.round(u.speed)}${armorTxt}`;
  }
}

/** Handle a canvas click/tap at logical coords. */
function onCanvasClick(lx, ly) {
  if (GS.phase !== 'playing') return;
  if (GS.paused) return;

  // 1. If currently targeting meteor, cast the strike!
  if (GS.targetingMode === 'meteor') {
    castMeteorStrike(lx, ly);
    return;
  }
  // 1b. Reinforce Spell: check road placement
  if (GS.targetingMode === 'reinforce') {
    const pt = getClosestPointOnRoad(lx, ly);
    if (pt.dist > (ROAD_WIDTH / 2) + 45) {
      GS.floats.push(new FloatingText('Deploy militia on the road!', lx, ly - 20, '#f87171', 1.1));
      return;
    }
    castReinforcements(pt.x, pt.y);
    return;
  }

  // 1c. Barracks Rally Point targeting
  if (GS.targetingMode === 'rally' && GS.rallyTower) {
    GS.rallyTower.setRallyPoint(lx, ly);
    SoundtrackManager.playReinforceSfx();
    GS.floats.push(new FloatingText('🚩 Rally Point Set!', GS.rallyTower.rallyX, GS.rallyTower.rallyY - 15, '#38bdf8', 1.2));
    GS.targetingMode = null;
    GS.rallyTower = null;
    return;
  }

  // 2. Hero interaction
  if (GS.hero && !GS.hero.dead) {
    const heroD = dist(lx, ly, GS.hero.x, GS.hero.y);
    if (heroD < GS.hero.radius + 12) {
      // Clicked on hero — select hero & show info
      GS.heroSelected = !GS.heroSelected;
      closePopup();
      closeTowerActionPopup();
      if (GS.heroSelected) {
        selectUnit(GS.hero, 'hero');
      } else {
        clearUnitSelection();
      }
      return;
    }
  }

  // 3. Enemy Hit-Testing (Prioritize boss / frontmost enemies)
  let hitEnemy = null;
  for (let i = GS.enemies.length - 1; i >= 0; i--) {
    const e = GS.enemies[i];
    if (!e.dead && !e.reached && dist(lx, ly, e.x, e.y) < e.radius + 10) {
      hitEnemy = e;
      break;
    }
  }
  if (hitEnemy) {
    GS.heroSelected = false;
    closePopup();
    closeTowerActionPopup();
    selectUnit(hitEnemy, 'enemy');
    return;
  }

  // 4. Soldier Hit-Testing
  let hitSoldier = null;
  for (let i = GS.soldiers.length - 1; i >= 0; i--) {
    const s = GS.soldiers[i];
    if (!s.dead && dist(lx, ly, s.x, s.y) < s.radius + 10) {
      hitSoldier = s;
      break;
    }
  }
  if (hitSoldier) {
    GS.heroSelected = false;
    closePopup();
    closeTowerActionPopup();
    selectUnit(hitSoldier, 'soldier');
    return;
  }

  // 5. If Hero is selected, ordering hero to move to location and immediately deselect!
  if (GS.hero && !GS.hero.dead && GS.heroSelected) {
    let nearNode = false;
    for (const node of GS.buildNodes) {
      if (dist(lx, ly, node.x, node.y) < NODE_RADIUS + 6) {
        nearNode = true;
        break;
      }
    }
    if (!nearNode) {
      GS.hero.targetX = lx;
      GS.hero.targetY = ly;
      GS.floats.push(new FloatingText('⚔️ March!', lx, ly - 12, '#38bdf8', 1.0, 0, -25));
      // Deselect immediately so subsequent clicks don't get trapped in a loop!
      GS.heroSelected = false;
      clearUnitSelection();
      return;
    }
  }

  // 6. Check distance to each build node
  let closest    = null;
  let closestDst = Infinity;

  for (const node of GS.buildNodes) {
    const d = dist(lx, ly, node.x, node.y);
    if (d < NODE_RADIUS + 6 && d < closestDst) {
      closestDst = d;
      closest    = node;
    }
  }

  if (closest) {
    if (closest.tower === null) {
      if (GS.previewShopTower) {
        // Build the currently previewed shop tower on this node!
        buildOnNode(closest.id, GS.previewShopTower);
        GS.previewShopTower = null;
        if (typeof updateShopButtonSelection === 'function') updateShopButtonSelection();
      } else {
        // Empty node → open build popup
        clearUnitSelection();
        closeTowerActionPopup();
        openPopup(closest.id);
      }
    } else {
      // Occupied → open Tower Action Popup (Upgrade / Sell)
      clearUnitSelection();
      closePopup();
      if (GS.inspectedNode === closest.id) {
        closeTowerActionPopup();
      } else {
        openTowerActionPopup(closest.id);
      }
    }
  } else {
    // Clicked elsewhere → close popups & unselect preview
    clearUnitSelection();
    closePopup();
    closeTowerActionPopup();
    if (GS.previewShopTower) {
      GS.previewShopTower = null;
      if (typeof updateShopButtonSelection === 'function') updateShopButtonSelection();
    }
  }
}

// ── Mouse events ──
GS.canvas = document.getElementById('canvas');
GS.ctx    = GS.canvas.getContext('2d');

GS.canvas.addEventListener('click', e => {
  const { x, y } = clientToLogical(e.clientX, e.clientY);
  onCanvasClick(x, y);
});

GS.canvas.addEventListener('mousemove', e => {
  const { x, y } = clientToLogical(e.clientX, e.clientY);
  if (GS.targetingMode === 'meteor' || GS.targetingMode === 'reinforce' || GS.targetingMode === 'rally') {
    GS.meteorAimPos = { x, y };
  }
});

// ── Touch events ──
let touchStartX = 0, touchStartY = 0, touchMoved = false;

GS.canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  touchMoved = false;
  const t    = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  if (GS.targetingMode === 'meteor' || GS.targetingMode === 'reinforce' || GS.targetingMode === 'rally') {
    const { x, y } = clientToLogical(t.clientX, t.clientY);
    GS.meteorAimPos = { x, y };
  }
}, { passive: false });

GS.canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t  = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.hypot(dx, dy) > 6) touchMoved = true;
  if (GS.targetingMode === 'meteor') {
    const { x, y } = clientToLogical(t.clientX, t.clientY);
    GS.meteorAimPos = { x, y };
  }
}, { passive: false });

GS.canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (!touchMoved || GS.targetingMode === 'meteor' || GS.targetingMode === 'reinforce' || GS.targetingMode === 'rally') {
    // Treat as tap / target drop
    const t        = e.changedTouches[0];
    const { x, y } = clientToLogical(t.clientX, t.clientY);
    onCanvasClick(x, y);
  }
}, { passive: false });

/* =========================================================================
   BOTTOM PANEL SHOP & BUILD POPUP BUTTONS (Range Preview & Build)
   ========================================================================= */
function updateShopButtonSelection() {
  document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.type === GS.previewShopTower);
  });
}

document.querySelectorAll('.tower-btn').forEach(btn => {
  const type = btn.dataset.type;
  const handler = (e) => {
    if (e) e.stopPropagation();
    if (GS.previewShopTower === type) {
      GS.previewShopTower = null;
    } else {
      GS.previewShopTower = type;
      // Close tower action popup if open
      closeTowerActionPopup();
    }
    updateShopButtonSelection();
  };
  btn.addEventListener('click', handler);
  btn.addEventListener('touchend', e => { e.preventDefault(); handler(e); }, { passive: false });
});

document.querySelectorAll('.popup-tower-btn').forEach(btn => {
  const handler = () => {
    if (GS.selectedNode === null) return;
    buildOnNode(GS.selectedNode, btn.dataset.type);
    GS.previewShopTower = null;
    updateShopButtonSelection();
  };
  btn.addEventListener('click',    handler);
  btn.addEventListener('touchend', e => { e.preventDefault(); handler(); }, { passive: false });
  // Preview range on hover / touch over popup buttons
  btn.addEventListener('pointerenter', () => {
    GS.previewShopTower = btn.dataset.type;
    updateShopButtonSelection();
  });
  btn.addEventListener('pointerleave', () => {
    if (GS.selectedNode === null) {
      GS.previewShopTower = null;
      updateShopButtonSelection();
    }
  });
});

document.getElementById('popup-cancel').addEventListener('click', closePopup);
document.getElementById('popup-cancel').addEventListener('touchend', e => { e.preventDefault(); closePopup(); }, { passive: false });

/* =========================================================================
   TOWER ACTION POPUP BUTTONS (Upgrade & Sell)
   ========================================================================= */
const btnUpgrade = document.getElementById('btn-tower-upgrade');
if (btnUpgrade) {
  const handleUpgrade = () => {
    if (GS.inspectedNode === null) return;
    const node = GS.buildNodes.find(n => n.id === GS.inspectedNode);
    if (node && node.tower) {
      const ok = node.tower.upgrade();
      if (ok) openTowerActionPopup(node.id);
    }
  };
  btnUpgrade.addEventListener('click', handleUpgrade);
  btnUpgrade.addEventListener('touchend', e => { e.preventDefault(); handleUpgrade(); }, { passive: false });
}

const btnSell = document.getElementById('btn-tower-sell');
if (btnSell) {
  const handleSell = () => {
    if (GS.inspectedNode === null) return;
    const node = GS.buildNodes.find(n => n.id === GS.inspectedNode);
    if (node && node.tower) {
      const refund = node.tower.getSellRefund();
      GS.gold += refund;
      SoundtrackManager.playSellSfx();
      GS.floats.push(new FloatingText(`+${refund}🪙`, node.x, node.y - 28, '#ffea00', 1.15, 0, -35));
      GS.floats.push(new FloatingText('SOLD!', node.x, node.y - 44, '#ffaa44', 1.0, 0, -25));
      spawnSparkBurst(node.x, node.y, '#ffaa33', 18);
      // Remove soldiers owned by this barracks
      if (node.tower.type === 'barracks' && node.tower._soldiers) {
        GS.soldiers = GS.soldiers.filter(s => s.barracks !== node.tower);
      }
      GS.towers = GS.towers.filter(t => t !== node.tower);
      node.tower = null;
      closeTowerActionPopup();
      updateHUD();
    }
  };
  btnSell.addEventListener('click', handleSell);
  btnSell.addEventListener('touchend', e => { e.preventDefault(); handleSell(); }, { passive: false });
}


// Barracks Rally Point button in action popup
const btnTowerRally = document.getElementById('btn-tower-rally');
if (btnTowerRally) {
  const startRally = () => {
    if (!GS.inspectedNode) return;
    const node = GS.buildNodes.find(n => n.id === GS.inspectedNode);
    if (!node || !node.tower || node.tower.type !== 'barracks') return;
    const tower = node.tower;
    closeTowerActionPopup();
    GS.targetingMode = 'rally';
    GS.rallyTower = tower;
    showWaveBanner('🚩 BARRACKS RALLY: Tap or drag flag on road within blue circle!');
  };
  btnTowerRally.addEventListener('click', startRally);
  btnTowerRally.addEventListener('touchend', e => { e.preventDefault(); startRally(); }, { passive: false });
}

const tapClose = document.getElementById('tap-close');
if (tapClose) {
  tapClose.addEventListener('click', closeTowerActionPopup);
  tapClose.addEventListener('touchend', e => { e.preventDefault(); closeTowerActionPopup(); }, { passive: false });
}

/* =========================================================================
   SPECIAL HERO SPELL BUTTON (Meteor Strike)
   ========================================================================= */
const spellMeteorBtn = document.getElementById('spell-meteor-btn');
if (spellMeteorBtn) {
  spellMeteorBtn.addEventListener('click', toggleMeteorTargeting);
  spellMeteorBtn.addEventListener('touchend', e => { e.preventDefault(); toggleMeteorTargeting(); }, { passive: false });
}

// Hotkeys: 'M' or '1' to activate Meteor, 'Escape' to cancel/close
window.addEventListener('keydown', e => {
  if (GS.phase !== 'playing') return;
  if (e.key === 'm' || e.key === 'M' || e.key === '1') {
    toggleMeteorTargeting();
  } else if (e.key === '3' || e.key === 'r' || e.key === 'R') {
    toggleReinforceTargeting();
  } else if (e.key === 'Escape') {
    if (GS.targetingMode) {
      cancelMeteorTargeting();
      cancelReinforceTargeting();
    }

    if (GS.targetingMode) cancelMeteorTargeting();
    closePopup();
    closeTowerActionPopup();
  }
});

// Close popups when clicking outside
document.getElementById('game-wrapper').addEventListener('click', e => {
  const bPopup = document.getElementById('build-popup');
  const tPopup = document.getElementById('tower-action-popup');
  const mBtn   = document.getElementById('spell-meteor-btn');
  const hBtn   = document.getElementById('spell-hero-btn');
  const bPanel = document.getElementById('bottom-panel');
  if (
    e.target !== GS.canvas &&
    bPopup && !bPopup.contains(e.target) &&
    tPopup && !tPopup.contains(e.target) &&
    mBtn && !mBtn.contains(e.target) &&
    hBtn && !hBtn.contains(e.target) &&
    bPanel && !bPanel.contains(e.target)
  ) {
    closePopup();
    closeTowerActionPopup();
  }
});

/* =========================================================================
   WAVE BUTTON
   ========================================================================= */
const btnWave = document.getElementById('btn-wave');
btnWave.addEventListener('click', () => {
  if (GS.phase === 'playing' && !GS.waveActive) {
    SoundtrackManager.playWaveStartSfx();
    startWave();
  }
});
btnWave.addEventListener('touchend', e => {
  e.preventDefault();
  if (GS.phase === 'playing' && !GS.waveActive) {
    SoundtrackManager.playWaveStartSfx();
    startWave();
  }
}, { passive: false });

/* =========================================================================
   PAUSE BUTTON & PAUSE MODAL OVERLAY
   ========================================================================= */

function restartLevel() {
  closePauseModal();
  clearUnitSelection();
  hideOverlay();
  closePopup();
  closeTowerActionPopup();
  cancelMeteorTargeting();
  cancelReinforceTargeting();

  // Reset to Wave 1 completely
  startGame(1);
  showWaveBanner('⚔️ Level Restarted from Wave 1!');
}

function openPauseModal() {
  if (GS.phase !== 'playing') return;
  GS.paused = true;
  const modal = document.getElementById('modal-pause');
  if (modal) modal.classList.remove('hidden');
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = '▶ Resume';
}

function closePauseModal() {
  const modal = document.getElementById('modal-pause');
  if (modal) modal.classList.add('hidden');
  GS.paused = false;
  const btn = document.getElementById('btn-pause');
  if (btn) btn.textContent = '⏸ Pause';
}

const btnPause = document.getElementById('btn-pause');
if (btnPause) {
  const togglePause = () => {
    if (GS.phase !== 'playing') return;
    if (GS.paused) closePauseModal();
    else openPauseModal();
  };
  btnPause.addEventListener('click', togglePause);
  btnPause.addEventListener('touchend', e => { e.preventDefault(); togglePause(); }, { passive: false });
}

// Pause modal buttons

// Pause restart button
const btnPauseRestart = document.getElementById('btn-pause-restart');
if (btnPauseRestart) {
  btnPauseRestart.addEventListener('click', restartLevel);
  btnPauseRestart.addEventListener('touchend', e => { e.preventDefault(); restartLevel(); }, { passive: false });
}

// Reinforce spell button
const spellReinforceBtn = document.getElementById('spell-reinforce-btn');
if (spellReinforceBtn) {
  spellReinforceBtn.addEventListener('click', toggleReinforceTargeting);
  spellReinforceBtn.addEventListener('touchend', e => { e.preventDefault(); toggleReinforceTargeting(); }, { passive: false });
}

const btnPauseResume = document.getElementById('btn-pause-resume');
if (btnPauseResume) {
  btnPauseResume.addEventListener('click', () => closePauseModal());
  btnPauseResume.addEventListener('touchend', e => { e.preventDefault(); closePauseModal(); }, { passive: false });
}

const btnPauseSettings = document.getElementById('btn-pause-settings');
if (btnPauseSettings) {
  const openSettingsFromPause = () => {
    // 1. Hide pause modal
    const modalPause = document.getElementById('modal-pause');
    if (modalPause) modalPause.classList.add('hidden');

    // 2. Open settings modal
    const modalSettings = document.getElementById('modal-settings');
    if (modalSettings) modalSettings.classList.remove('hidden');

    // 3. Sync volume sliders with active audio state
    SoundtrackManager.updateSliderInputs();

    // 4. Update close button to return to pause menu
    const btnCloseSettings = document.getElementById('btn-close-settings');
    if (btnCloseSettings) btnCloseSettings.textContent = '⬅ Back to Pause Menu';
  };
  btnPauseSettings.addEventListener('click', openSettingsFromPause);
  btnPauseSettings.addEventListener('touchend', e => { e.preventDefault(); openSettingsFromPause(); }, { passive: false });
}

const btnPauseMenu = document.getElementById('btn-pause-menu');
if (btnPauseMenu) {
  const returnFromPause = () => {
    closePauseModal();
    returnToMainMenu();
  };
  btnPauseMenu.addEventListener('click', returnFromPause);
  btnPauseMenu.addEventListener('touchend', e => { e.preventDefault(); returnFromPause(); }, { passive: false });
}

// Unit info close button
const btnUnitInfoClose = document.getElementById('unit-info-close');
if (btnUnitInfoClose) {
  btnUnitInfoClose.addEventListener('click', () => clearUnitSelection());
  btnUnitInfoClose.addEventListener('touchend', e => { e.preventDefault(); clearUnitSelection(); }, { passive: false });
}

/* =========================================================================
   AUDIO & MULTI-SCREEN CONTROLLERS
   ========================================================================= */

// Audio buttons (both in Top HUD and Main Menu)
function setupAudioButtons() {
  const hudBtn  = document.getElementById('btn-audio');
  const menuBtn = document.getElementById('btn-menu-audio');

  const addMuteHandlers = (btn) => {
    if (!btn) return;
    btn.addEventListener('click', () => SoundtrackManager.toggleMute());
    btn.addEventListener('touchend', e => {
      e.preventDefault();
      SoundtrackManager.toggleMute();
    }, { passive: false });
  };

  addMuteHandlers(hudBtn);
  addMuteHandlers(menuBtn);
}

/* =========================================================================
   PROFILE SYSTEM  (localStorage persistence)
   ========================================================================= */
const ProfileManager = {
  profileName: 'Commander Adam',
  maxWave: 1,
  highScore: 0,
  totalKills: 0,

  load() {
    const savedName = localStorage.getItem('fantasyDefense_profileName');
    if (savedName && savedName.trim()) this.profileName = savedName.trim();

    const savedWave = localStorage.getItem('fantasyDefense_maxWave');
    if (savedWave) this.maxWave = Math.max(1, parseInt(savedWave, 10) || 1);

    const savedScore = localStorage.getItem('fantasyDefense_highScore');
    if (savedScore) this.highScore = parseInt(savedScore, 10) || 0;

    const savedKills = localStorage.getItem('fantasyDefense_totalKills');
    if (savedKills) this.totalKills = parseInt(savedKills, 10) || 0;

    this.render();
  },

  save(newName) {
    if (newName && newName.trim()) {
      this.profileName = newName.trim().slice(0, 20);
      localStorage.setItem('fantasyDefense_profileName', this.profileName);
      this.render();
    }
  },

  recordWave(waveNum) {
    if (waveNum > this.maxWave) {
      this.maxWave = Math.min(WAVE_DEFS.length, waveNum);
      localStorage.setItem('fantasyDefense_maxWave', this.maxWave);
      this.render();
    }
  },

  recordKill() {
    this.totalKills++;
    // Batch localStorage writes: only persist every 5 kills to reduce I/O overhead
    if (this.totalKills % 5 === 0) {
      localStorage.setItem('fantasyDefense_totalKills', this.totalKills);
    }
    // Throttle DOM render — only update menu stats every 10 kills during play
    if (this.totalKills % 10 === 0) this.render();
  },

  updateHighScore(currentScore) {
    if (currentScore > this.highScore) {
      this.highScore = currentScore;
      localStorage.setItem('fantasyDefense_highScore', this.highScore);
      this.render();
      return true;
    }
    return false;
  },

  reset() {
    localStorage.removeItem('fantasyDefense_profileName');
    localStorage.removeItem('fantasyDefense_maxWave');
    localStorage.removeItem('fantasyDefense_highScore');
    localStorage.removeItem('fantasyDefense_totalKills');
    localStorage.removeItem('fantasyDefense_muted');
    localStorage.removeItem('fantasyDefense_volume');
    localStorage.removeItem('fantasyDefense_speed');
    this.profileName = 'Commander Adam';
    this.maxWave = 1;
    this.highScore = 0;
    this.totalKills = 0;
    this.render();
  },

  render() {
    const nameEl = document.getElementById('menu-profile-name');
    if (nameEl) nameEl.textContent = this.profileName;

    const statWaveEl = document.getElementById('menu-stat-wave');
    if (statWaveEl) statWaveEl.textContent = this.maxWave;

    const statScoreEl = document.getElementById('menu-stat-score');
    if (statScoreEl) statScoreEl.textContent = this.highScore.toLocaleString();

    const statKillsEl = document.getElementById('menu-stat-kills');
    if (statKillsEl) statKillsEl.textContent = this.totalKills.toLocaleString();

    const hudHiEl = document.getElementById('hud-high-score');
    if (hudHiEl) hudHiEl.textContent = this.highScore.toLocaleString();
  }
};

/* =========================================================================
   SUB-MODALS NAVIGATION (Multi-Screen Architecture)
   ========================================================================= */
function openSubModal(modalId) {
  closeAllSubModals();
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('hidden');
}

function closeAllSubModals() {
  document.querySelectorAll('.menu-submodal').forEach(m => m.classList.add('hidden'));
}

/* ── Wave Select Modal ── */
const WAVE_INFO = [
  { name: 'Scout Incursion',       info: '10 Goblins · Fast & light' },
  { name: 'Orc Vanguard',          info: '12 Goblins, 5 Orcs · Armored' },
  { name: 'Mountain Beast',        info: '14 Goblins, 8 Orcs, 1 Troll' },
  { name: 'Armored Siege',         info: '16 Goblins, 12 Orcs, 2 Trolls' },
  { name: 'Mid-Boss Titan Siege',  info: '⚠️ 18 Gobs, 10 Orcs, 3 Elites, 1 Behemoth!' },
  { name: 'Crimson Legion',        info: '16 Gobs, 14 Orcs, 6 Elite Champions' },
  { name: 'Mountain Stampede',     info: '18 Gobs, 14 Orcs, 3 Mountain Trolls' },
  { name: 'Elite Phalanx',         info: '20 Gobs, 14 Elites, 2 Heavy Titans' },
  { name: 'Dread Vanguard',        info: '24 Gobs, 16 Orcs, 10 Elites, 3 Trolls' },
  { name: 'The Cataclysmic Siege', info: '☠️ 28 Gobs, 18 Elites, 4 Trolls, 2 Titans!' }
];

function renderWaveSelectGrid() {
  const container = document.getElementById('wave-select-grid');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 1; i <= WAVE_DEFS.length; i++) {
    const card = document.createElement('div');
    const isUnlocked = (i <= ProfileManager.maxWave || i === 1);
    const isSelected = (GS.selectedStartingWave === i);

    card.className = `wave-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="wave-card-num">Wave ${i}</div>
      <div class="wave-card-name">${WAVE_INFO[i-1].name}</div>
      <div class="wave-card-info">${WAVE_INFO[i-1].info}</div>
      <div style="font-size:9px; color:${isUnlocked ? '#7fd000' : '#ff9900'}; margin-top:2px;">
        ${isUnlocked ? '✓ Ready' : '🔒 Unlocks Wave ' + i}
      </div>
    `;

    card.addEventListener('click', () => {
      GS.selectedStartingWave = i;
      renderWaveSelectGrid();
    });

    container.appendChild(card);
  }
}

/* ── Deploy Transition from Menu to Active Gameplay ── */
function deployToGame(startingWave = 1) {
  SoundtrackManager.init();
  SoundtrackManager.play();

  closeAllSubModals();
  const menu = document.getElementById('main-menu');
  if (menu) {
    menu.classList.add('fade-out');
    setTimeout(() => {
      menu.classList.add('hidden');
    }, 550);
  }

  startGame(startingWave);
}

function returnToMainMenu() {
  clearUnitSelection();
  closePauseModal();
  hideOverlay();
  closePopup();
  closeTowerActionPopup();
  cancelMeteorTargeting();
  GS.running = false;
  GS.phase   = 'menu';
  GS.endlessMode = false;
  GS.previewShopTower = null;
  if (typeof updateShopButtonSelection === 'function') updateShopButtonSelection();
  if (GS.rafId) cancelAnimationFrame(GS.rafId);

  ProfileManager.load();
  const menu = document.getElementById('main-menu');
  if (menu) {
    menu.classList.remove('hidden');
    void menu.offsetWidth; // force reflow
    menu.classList.remove('fade-out');
  }
}

/* =========================================================================
   SETUP MENU SCREEN INTERACTIONS
   ========================================================================= */

/* =========================================================================
   GLOBAL AUDIO FEEDBACK FOR ALL BUTTONS & UI TOGGLES
   ========================================================================= */
function setupGlobalButtonAudio() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('button, .tower-btn, .speed-btn, .fx-btn, .wave-card, .popup-tower-btn, #menu-profile-pill, #unit-info-close, .profile-edit-btn');
    if (btn) {
      SoundtrackManager.playUiClickSfx();
    }
  });
}

function setupMenuEvents() {
  // Helper: add both click and touchend to a button
  const addBtn = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', handler);
    el.addEventListener('touchend', e => { e.preventDefault(); handler(); }, { passive: false });
  };

  // Main Menu Navigation Buttons
  const btnPlay = document.getElementById('btn-menu-play');
  if (btnPlay) {
    const playHandler = () => { renderWaveSelectGrid(); openSubModal('modal-wave-select'); };
    btnPlay.addEventListener('click', playHandler);
    btnPlay.addEventListener('touchend', e => { e.preventDefault(); playHandler(); }, { passive: false });
  }

  const btnSettings = document.getElementById('btn-menu-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      openSubModal('modal-settings');
    });
  }

  const btnCredits = document.getElementById('btn-menu-credits');
  if (btnCredits) {
    btnCredits.addEventListener('click', () => {
      openSubModal('modal-credits');
    });
  }

  const btnExit = document.getElementById('btn-menu-exit');
  if (btnExit) {
    btnExit.addEventListener('click', () => {
      openSubModal('modal-exit');
    });
  }

  // Profile Edit Pill & Button
  const profilePill = document.getElementById('menu-profile-pill');
  if (profilePill) {
    profilePill.addEventListener('click', () => {
      const input = document.getElementById('input-profile-name');
      if (input) input.value = ProfileManager.profileName;
      openSubModal('modal-profile');
      if (input) setTimeout(() => input.focus(), 150);
    });
  }

  const btnSaveProfile = document.getElementById('btn-save-profile');
  if (btnSaveProfile) {
    btnSaveProfile.addEventListener('click', () => {
      const input = document.getElementById('input-profile-name');
      if (input && input.value.trim()) {
        ProfileManager.save(input.value.trim());
      }
      closeAllSubModals();
    });
  }

  const btnCloseProfile = document.getElementById('btn-close-profile');
  if (btnCloseProfile) {
    btnCloseProfile.addEventListener('click', closeAllSubModals);
  }

  // Wave Deploy Button
  const btnDeploy = document.getElementById('btn-deploy-wave');
  if (btnDeploy) {
    const deployHandler = () => deployToGame(GS.selectedStartingWave || 1);
    btnDeploy.addEventListener('click', deployHandler);
    btnDeploy.addEventListener('touchend', e => { e.preventDefault(); deployHandler(); }, { passive: false });
  }
  const btnCloseWaves = document.getElementById('btn-close-waves');
  if (btnCloseWaves) {
    btnCloseWaves.addEventListener('click', closeAllSubModals);
    btnCloseWaves.addEventListener('touchend', e => { e.preventDefault(); closeAllSubModals(); }, { passive: false });
  }

  // Settings Controls
  const volumeSlider = document.getElementById('setting-volume');
  if (volumeSlider) {
    volumeSlider.value = Math.round(SoundtrackManager.volume * 100);
    const volLabel = document.getElementById('setting-volume-label');
    if (volLabel) volLabel.textContent = `${volumeSlider.value}%`;

    volumeSlider.addEventListener('input', (e) => {
      SoundtrackManager.setVolume(parseFloat(e.target.value));
    });
  }

  // Game Speed Buttons
  const savedSpeed = localStorage.getItem('fantasyDefense_speed');
  if (savedSpeed) GS.gameSpeed = parseFloat(savedSpeed) || 1.0;

  document.querySelectorAll('.speed-btn').forEach(btn => {
    const sp = parseFloat(btn.dataset.speed);
    if (sp === GS.gameSpeed) btn.classList.add('active');
    else btn.classList.remove('active');

    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      GS.gameSpeed = sp;
      localStorage.setItem('fantasyDefense_speed', GS.gameSpeed);
    });
  });

  // Graphics FX Buttons
  document.querySelectorAll('.fx-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fx-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      GS.graphicsMode = btn.dataset.fx;
    });
  });

  const btnCloseSettings = document.getElementById('btn-close-settings');
  if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeAllSubModals);

  // Credits Back Button
  const btnCloseCredits = document.getElementById('btn-close-credits');
  if (btnCloseCredits) btnCloseCredits.addEventListener('click', closeAllSubModals);

  // Exit Modal Buttons
  const btnCancelExit = document.getElementById('btn-cancel-exit');
  if (btnCancelExit) btnCancelExit.addEventListener('click', closeAllSubModals);

  const btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      ProfileManager.reset();
      SoundtrackManager.musicVolume = 0.5;
      SoundtrackManager.sfxVolume = 0.7;
      SoundtrackManager.muted = false;
      SoundtrackManager.updateAudioIcons();
      SoundtrackManager.updateSliderInputs();
      if (volumeSlider) volumeSlider.value = 50;
      const volLabel = document.getElementById('setting-volume-label');
      if (volLabel) volLabel.textContent = '50%';
      closeAllSubModals();
      showWaveBanner('Progress Reset Completed');
    });
  }

  // Overlay Menu Button
  const overlayMenuBtn = document.getElementById('overlay-menu-btn');
  if (overlayMenuBtn) {
    overlayMenuBtn.addEventListener('click', returnToMainMenu);
    overlayMenuBtn.addEventListener('touchend', e => { e.preventDefault(); returnToMainMenu(); }, { passive: false });
  }
}

/* =========================================================================
   OVERLAY BUTTON  (Start / Restart)
   ========================================================================= */
const overlayBtn = document.getElementById('overlay-btn');
overlayBtn.addEventListener('click', () => {
  hideOverlay();
  startGame(GS.selectedStartingWave || 1);
});
overlayBtn.addEventListener('touchend', e => {
  e.preventDefault();
  hideOverlay();
  startGame(GS.selectedStartingWave || 1);
}, { passive: false });

const overlayEndlessBtn = document.getElementById('overlay-endless-btn');
if (overlayEndlessBtn) {
  const startEndless = () => {
    hideOverlay();
    GS.endlessMode = true;
    GS.phase = 'playing';
    GS.running = true;
    GS.lastTime = performance.now();
    if (GS.rafId) cancelAnimationFrame(GS.rafId);
    GS.rafId = requestAnimationFrame(gameLoop);
    updateHUD();
    updateWaveButton();
    showWaveBanner('⚔️ ENDLESS MODE ENGAGED! Infinite hordes await!');
  };
  overlayEndlessBtn.addEventListener('click', startEndless);
  overlayEndlessBtn.addEventListener('touchend', e => { e.preventDefault(); startEndless(); }, { passive: false });
}

/* =========================================================================
   GAME INITIALIZATION
   ========================================================================= */
function startGame(startingWave = 1) {
  const chosenWave = Math.max(1, Math.min(WAVE_DEFS.length, startingWave));

  // If jumping to later waves, reward extra starting gold
  GS.gold         = STARTING_GOLD + (chosenWave - 1) * 70;
  GS.lives        = STARTING_LIVES;
  GS.wave         = chosenWave - 1; // startWave() will advance to chosenWave
  GS.waveActive   = false;
  GS.score        = 0;
  GS.killsThisRun = 0;
  GS.wavesCleared = 0;
  GS.spawnQueue   = [];
  GS.spawnTimer   = 0;
  GS.enemiesAlive = 0;
  GS.enemies      = [];
  GS.soldiers     = [];
  GS.towers       = [];
  GS.projectiles  = [];
  GS.floats       = [];
  GS.heroSelected = false;
  GS.heroSpellCd  = 0;
  GS.endlessMode  = false;
  GS.previewShopTower = null;
  if (GS.buildNodes && GS.buildNodes.length) {
    GS.buildNodes.forEach(n => { n.tower = null; });
  }
  GS.selectedNode  = null;
  GS.inspectedNode = null;
  GS.spellCooldown = 0;
  GS.reinforceSpellCd = 0;
  updateReinforceButton();
  GS.targetingMode = null;
  GS.meteorAimPos  = null;
  GS.meteors       = [];
  GS.craters       = [];
  GS.sparks        = [];
  GS.shakeDuration = 0;
  GS.shakeMagnitude = 0;
  GS.paused        = false;
  GS.phase         = 'playing';
  GS.running       = true;
  document.getElementById('btn-pause').textContent = '⏸ Pause';
  document.getElementById('build-popup').classList.add('hidden');
  closeTowerActionPopup();
  updateSpellButton();

  resizeWrapper();  // re-computes waypoints + buildNodes (clears tower refs via fresh compute)

  // Create hero unit
  GS.hero = new Hero();
  updateHeroSpellButton();

  updateHUD();
  updateWaveButton();
  SoundtrackManager.play();
  GS.lastTime = performance.now();
  if (GS.rafId) cancelAnimationFrame(GS.rafId);
  GS.rafId = requestAnimationFrame(gameLoop);
}

/* =========================================================================
   DRAW TOWER ICONS  (small canvases in bottom panel + popup)
   ========================================================================= */
function drawTowerIcons() {
  // Bottom panel icons
  [['icon-archer', 14, drawArcherTower],
   ['icon-mage',   12, drawMageTower],
   ['icon-cannon', 14, (c,sz,s) => drawCannonTower(c, sz, s, -Math.PI/6)]
  ].forEach(([id, sz, fn]) => {
    const c = document.getElementById(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    fn(ctx, sz, 1);
  });

  // Popup icons (slightly larger)
  [['popup-icon-archer', 17, drawArcherTower],
   ['popup-icon-mage',   15, drawMageTower],
   ['popup-icon-cannon', 17, (c,sz,s) => drawCannonTower(c, sz, s, -Math.PI/6)]
  ].forEach(([id, sz, fn]) => {
    const c = document.getElementById(id);
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    fn(ctx, sz, 1);
  });
}

/* =========================================================================
   RESIZE OBSERVER
   ========================================================================= */
const ro = new ResizeObserver(() => resizeWrapper());
ro.observe(document.getElementById('game-wrapper'));
window.addEventListener('resize', resizeWrapper, { passive: true });
window.addEventListener('orientationchange', () => {
  // Give browser time to update layout before recomputing
  setTimeout(resizeWrapper, 150);
}, { passive: true });

/* =========================================================================
   VISIBILITY CHANGE HANDLER
   Pause game when browser tab is hidden; resume when visible again.
   Prevents dt spikes causing ghost physics on mobile when re-focusing.
   ========================================================================= */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Reset lastTime so we don't get a huge dt spike on resume
    if (GS.running && !GS.paused) {
      GS.lastTime = performance.now();
    }
  } else {
    // Reset lastTime again on focus to absorb any remaining gap
    GS.lastTime = performance.now();
  }
}, { passive: true });

/* =========================================================================
   BOOT
   ========================================================================= */
drawTowerIcons();
resizeWrapper();
ProfileManager.load();
SoundtrackManager.setup();
setupAudioButtons();
setupMenuEvents();
setupGlobalButtonAudio();

// Hero HUD click to select hero
const heroHudEl = document.getElementById('hero-hud');
if (heroHudEl) {
  heroHudEl.addEventListener('click', () => {
    if (GS.phase === 'playing' && GS.hero && !GS.hero.dead) {
      GS.heroSelected = !GS.heroSelected;
    }
  });
}

// Hero whirlwind spell button
const heroSpellBtn = document.getElementById('spell-hero-btn');
if (heroSpellBtn) {
  heroSpellBtn.addEventListener('click', () => {
    if (GS.hero) GS.hero.castWhirlwind();
  });
  heroSpellBtn.addEventListener('touchend', e => {
    e.preventDefault();
    if (GS.hero) GS.hero.castWhirlwind();
  }, { passive: false });
}

// Hotkey '2' for whirlwind
window.addEventListener('keydown', e => {
  if (GS.phase !== 'playing') return;
  if (e.key === '2') {
    if (GS.hero) GS.hero.castWhirlwind();
  }
});

// Render preview frame on canvas
if (GS.waypoints.length) render();
