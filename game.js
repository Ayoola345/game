const canvas = document.getElementById('gameCanvas');
const pauseBtn = document.getElementById('pauseBtn');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const levelListPanel = document.getElementById('levelList');
const levelsContainer = document.getElementById('levelsContainer');

const pausePanel = document.getElementById('pausePanel');
const resumeBtn = document.getElementById('resumeBtn');
const backToMenuFromPause = document.getElementById('backToMenuFromPause');

const gameOverPanel = document.getElementById('gameOverPanel');
const gameOverText = document.getElementById('gameOverText');
const retryBtn = document.getElementById('retryBtn');
const goToMenuBtn = document.getElementById('goToMenuBtn');

const btnAdventure = document.getElementById('btnAdventure');
const btnInfinity = document.getElementById('btnInfinity');
const backToMenuFromList = document.getElementById('backToMenuFromList');

const hudMode = document.getElementById('hudMode');
const hudInfo = document.getElementById('hudInfo');
const hudLives = document.getElementById('hudLives');
const hudHigh = document.getElementById('hudHigh');
const gameHudMode = document.getElementById('gameHudMode');
const gameHudScore = document.getElementById('gameHudScore');
const gameHudLives = document.getElementById('gameHudLives');
const powerupStatus = document.getElementById('powerupStatus');
const missionOverlay = document.getElementById('missionOverlay');
const missionOverlayKicker = document.getElementById('missionOverlayKicker');
const missionOverlayTitle = document.getElementById('missionOverlayTitle');
const missionOverlayInfo = document.getElementById('missionOverlayInfo');
const missionLaunchBtn = document.getElementById('missionLaunchBtn');
const missionBackBtn = document.getElementById('missionBackBtn');

const bossBar = document.createElement('div');
bossBar.className = 'boss-bar';
bossBar.innerHTML = '<div class="inner"></div>';
document.querySelector('.game-area').appendChild(bossBar);

/* ---------------- Images (optional) ----------------
 Place optional sprites in images/:
  spaceship.png, meteor1.png, meteor2.png, meteor3.png, boss.png
*/
const spaceshipImg = new Image(); spaceshipImg.src = 'images/spaceship.png';
const backgroundImg = new Image(); backgroundImg.src = 'images/background-space.png';
const meteorImgs = [new Image(), new Image(), new Image()];
meteorImgs[0].src = 'images/meteor1.png';
meteorImgs[1].src = 'images/meteor2.png';
meteorImgs[2].src = 'images/meteor3.png';
const bossImg = new Image(); bossImg.src = 'images/boss.png';

/* ---------------- LocalStorage keys ---------------- */
const LS_UNLOCK = 'space_shooter_unlocked_level';    // stores highest unlocked level (1..50)
const LS_INFTY_HIGH = 'space_shooter_infty_high';    // infinity high score

/* ---------------- State ---------------- */
canvas.width = 400; canvas.height = 600;

let mode = null;                 // 'adventure' | 'infinity'
let advLevel = 1;                // current adventure level to play
let unlockedLevel = Number(localStorage.getItem(LS_UNLOCK) || 1);
let missionBackToMenu = false;

let bullets = [], meteors = [], particles = [], bossBullets = [], powerUps = [];
let player = null;
let boss = null;

let score = 0;
let inftyHigh = Number(localStorage.getItem(LS_INFTY_HIGH) || 0);
hudHigh.textContent = `${inftyHigh}`;

let lives = 3;
let gameStarted = false;
let gamePaused = false;
let gameOver = false;
let playerInvulnerableUntil = 0;
let rapidFireUntil = 0;
let shieldUntil = 0;

/* timing state (timestamp-based spawn & firing) */
let lastSpawnTime = 0;       // when last spawn happened
let spawnInterval = 800;     // current spawn interval (ms)
let spawnCount = 0;          // how many spawned in current level (adventure)
let spawnTarget = 0;         // target count for normal level

let lastAutoFire = 0;
const AUTO_FIRE_MS = 220;

let lastBossShoot = 0;
let bossShootInterval = 700;

/* pause bookkeeping */
let pausedAt = 0;            // timestamp when paused

/* input */
const keys = { ArrowLeft:false, ArrowRight:false, ArrowUp:false, ArrowDown:false };

/* starfield presets for stage-based backgrounds */
const STAGE_PRESETS = [
  { name:'Blue', range:[1,9], starColor:'#8fd7ff', speed:0.5, density:70 },
  { name:'Purple', range:[10,19], starColor:'#d9a3ff', speed:0.9, density:80 },
  { name:'Green', range:[20,29], starColor:'#a7ffcc', speed:1.2, density:90 },
  { name:'Orange', range:[30,39], starColor:'#ffcd8a', speed:1.6, density:100 },
  { name:'Red', range:[40,49], starColor:'#ff8a8a', speed:2.0, density:110 },
  { name:'Final', range:[50,50], starColor:'#fff9c4', speed:2.8, density:140 }
];

const starfield = {
  stars: [],
  params:{color:'#8fd7ff', speed:0.6, density:80},
  target:{color:'#8fd7ff', speed:0.6, density:80},
  init(density=80){
    this.stars = [];
    for(let i=0;i<density;i++){
      this.stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, z: 0.2 + Math.random()*0.9, size: 0.6 + Math.random()*1.6, color:this.params.color });
    }
  },
  setTarget(preset){
    this.target.color = preset.starColor; this.target.speed = preset.speed; this.target.density = preset.density;
    if(this.stars.length < preset.density){
      let toAdd = preset.density - this.stars.length;
      while(toAdd-->0) this.stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height*Math.random(), z:0.2 + Math.random()*0.9, size:0.6+Math.random()*1.6, color:this.target.color });
    }
  },
  lerpHex(a,b,t){
    const pa = parseInt(a.slice(1),16), pb = parseInt(b.slice(1),16);
    const ra=(pa>>16)&255,ga=(pa>>8)&255,ba=pa&255;
    const rb=(pb>>16)&255,gb=(pb>>8)&255,bb=pb&255;
    const rr=Math.round(ra+(rb-ra)*t), rg=Math.round(ga+(gb-ga)*t), rb2=Math.round(ba+(bb-ba)*t);
    return '#' + ((1<<24) + (rr<<16) + (rg<<8) + rb2).toString(16).slice(1);
  },
  update(dt){
    this.params.speed += (this.target.speed - this.params.speed) * 0.02;
    this.params.density = Math.round(this.params.density + (this.target.density - this.params.density) * 0.03);
    this.params.color = this.lerpHex(this.params.color, this.target.color, 0.02);
    for(let s of this.stars){
      s.y += this.params.speed * s.z * (dt/16);
      s.x += Math.sin((s.y + s.x) * 0.0007) * 0.2;
      s.color = this.params.color;
      if(s.y > canvas.height + 2) s.y = -2 - Math.random()*20;
    }
    if(this.stars.length !== this.params.density){
      if(this.stars.length < this.params.density) this.stars.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, z:0.2+Math.random()*0.9, size:0.6+Math.random()*1.6, color:this.params.color });
      else this.stars.splice(0,1);
    }
  },
  draw(){
    for(let s of this.stars){
      ctx.globalAlpha = 0.6 * s.z; ctx.fillStyle = s.color; ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.max(1,s.size), Math.max(1,s.size));
    }
    ctx.globalAlpha = 1;
  }
};

/* ---------------- Level config generator ---------------- */
function getLevelConfig(lv){
  if(lv % 10 === 0){
    return { type:'boss', level:lv, bossHp: Math.round(30 + lv*1.8), bossShootInterval: Math.max(360, 1100 - lv*10), bossSpeedX: 1 + lv/40 };
  } else {
    const meteorsToSpawn = 8 + Math.floor(lv * 1.15);
    const meteorsPerWave = Math.min(4, 1 + Math.floor((lv - 1) / 12));
    const meteorSpeed = parseFloat((1.1 + lv * 0.08).toFixed(2));
    const spawnInt = Math.max(220, Math.round(900 - lv * 11));
    return { type:'normal', level:lv, meteorsToSpawn, meteorsPerWave, meteorSpeed, spawnInterval: spawnInt };
  }
}

/* ---------------- Helpers ---------------- */
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rectsOverlap(a,b){ return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

/* ---------------- Sound (simple) ---------------- */
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function playTone(freq=440, time=0.06, type='sine', gain=0.04){
  if(!AudioContextClass) return;
  try{
    if(!audioCtx) audioCtx = new AudioContextClass();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + time);
    setTimeout(()=> o.stop(), time*1000 + 10);
  } catch(e){}
}
function sfxShoot(){ playTone(950,0.04,'sawtooth',0.03); }
function sfxExplode(){ playTone(120,0.16,'triangle',0.06); }
function sfxBossHit(){ playTone(260,0.09,'square',0.06); }

/* ---------------- Reset & UI helpers ---------------- */
function setUnlocked(n){ unlockedLevel = Math.max(1, Math.min(50, n)); localStorage.setItem(LS_UNLOCK, unlockedLevel); }
function getUnlocked(){ return Number(localStorage.getItem(LS_UNLOCK) || 1); }

function showPanel(panel){
  [menu, levelListPanel, pausePanel, gameOverPanel].forEach(p => p.classList.add('hidden'));
  if(panel) panel.classList.remove('hidden');
}

function setMobileView(view){
  document.body.classList.toggle('game-active', view === 'game');
  document.body.classList.toggle('level-select-active', view === 'levels');
  window.scrollTo(0, 0);
}

function updateGameHud(){
  gameHudMode.textContent = hudMode.textContent;
  gameHudScore.textContent = hudInfo.textContent;
  gameHudLives.textContent = `${lives} ${lives === 1 ? 'life' : 'lives'}`;
}

/* ---------------- Build level list (vertical scroll) ---------------- */
function buildLevelList(){
  levelsContainer.innerHTML = '';
  const unlocked = getUnlocked();
  for(let i=1;i<=50;i++){
    const cfg = getLevelConfig(i);
    const item = document.createElement('div');
    item.className = 'level-item ' + (i<=unlocked ? 'unlocked' : 'locked');
    const left = document.createElement('div');
    left.innerHTML = `<div class="level-number">Level ${i}</div><div class="level-meta">${cfg.type==='boss' ? 'Boss Level' : cfg.meteorsToSpawn + ' meteors · up to ' + cfg.meteorsPerWave + ' per wave · speed ' + cfg.meteorSpeed}</div>`;
    left.style.display='flex'; left.style.flexDirection='column';
    const actions = document.createElement('div'); actions.className='level-actions';
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = i<=unlocked ? 'Play' : 'Locked';
    btn.disabled = i>unlocked;
    btn.addEventListener('click', ()=> openLevelStart(i));
    actions.appendChild(btn);
    item.appendChild(left); item.appendChild(actions);
    if(i>unlocked) item.classList.add('locked');
    levelsContainer.appendChild(item);
  }
}

/* ---------------- Open Start overlay for a level ---------------- */
function openLevelStart(lv){
  advLevel = lv;
  const cfg = getLevelConfig(lv);
  hudMode.textContent = `Adventure · L${lv}`;
  showMissionBriefing(
    'MISSION BRIEFING',
    `Level ${lv}`,
    getMissionObjective(cfg),
    'Launch mission',
    'Back to levels'
  );
  lives = 3; hudLives.textContent = `${lives} / 3`;
  updateGameHud();
  // set starfield stage
  const preset = STAGE_PRESETS[Math.min(STAGE_PRESETS.length-1, Math.floor((lv-1)/10))];
  starfield.setTarget({ starColor:preset.starColor, speed:preset.speed, density:preset.density });
}

function getMissionObjective(cfg){
  return cfg.type === 'boss'
    ? 'Defeat the boss. You will have 3 lives.'
    : `Destroy ${cfg.meteorsToSpawn} meteors across ${Math.ceil(cfg.meteorsToSpawn / cfg.meteorsPerWave)} waves, with up to ${cfg.meteorsPerWave} falling at once. You will have 3 lives.`;
}

function showMissionBriefing(kicker, title, description, launchLabel, backLabel, backToMenu = false){
  setMobileView('game');
  showPanel(null);
  if(window.innerWidth > 760){
    document.querySelector('.game-area').scrollIntoView({ block: 'center', behavior: 'auto' });
  }
  missionOverlayKicker.textContent = kicker;
  missionOverlayTitle.textContent = title;
  missionOverlayInfo.textContent = description;
  missionLaunchBtn.innerHTML = `${launchLabel} <span aria-hidden="true">→</span>`;
  missionBackBtn.textContent = backLabel;
  missionBackToMenu = backToMenu;
  missionOverlay.hidden = false;
  requestAnimationFrame(() => missionLaunchBtn.focus({ preventScroll: true }));
}

/* ---------------- Start adventure level play ---------------- */
function startAdventureLevel(){
  const cfg = getLevelConfig(advLevel);
  // reset arrays and timing
  bullets = []; meteors = []; particles = []; bossBullets = []; powerUps = []; boss = null;
  score = 0; spawnCount = 0; spawnTarget = cfg.type==='normal' ? cfg.meteorsToSpawn : 0;
  spawnInterval = cfg.type==='normal' ? cfg.spawnInterval : 999999;
  lastSpawnTime = performance.now();
  lastAutoFire = performance.now();
  lastBossShoot = performance.now();
  bossShootInterval = cfg.bossShootInterval || 700;
  playerInvulnerableUntil = 0;
  rapidFireUntil = 0; shieldUntil = 0;
  updatePowerupStatus(performance.now());
  pauseBtn.textContent = 'Ⅱ';

  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };

  if(cfg.type === 'boss'){
    boss = { x: canvas.width/2 - 100, y: 36, width:200, height:100, hp: cfg.bossHp, maxHp: cfg.bossHp, speedX: cfg.bossSpeedX || 1, shootInterval: cfg.bossShootInterval };
    showBossBar(1);
  } else {
    boss = null;
    spawnAdventureWave(cfg);
    lastSpawnTime = performance.now();
  }

  mode = 'adventure';
  gameStarted = true;
  gamePaused = false;
  gameOver = false;

  hudMode.textContent = `Adventure · L${advLevel}`;
  hudInfo.textContent = `${score}`;
  hudLives.textContent = `${lives} / 3`;
  pauseBtn.hidden = false;
  setMobileView('game');
  updateGameHud();
  lastTs = performance.now();
  missionOverlay.hidden = true;
  showPanel(null);
}

/* ---------------- Spawn helpers ---------------- */
function spawnMeteor(spec={}){
  const swift = spec.swift !== undefined ? spec.swift : Math.random() < 0.18;
  const size = spec.size || (swift ? 22 + Math.floor(Math.random()*15) : 26 + Math.floor(Math.random()*40));
  const x = spec.x !== undefined ? spec.x : Math.random() * (canvas.width - size);
  const speed = spec.speed !== undefined ? spec.speed : (swift ? 2.6 + Math.random()*1.2 : 1 + Math.random()*0.9);
  const img = meteorImgs[Math.floor(Math.random()*meteorImgs.length)];
  meteors.push({ x, y:-size-6, width:size, height:size, speed, drift:swift ? (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random()*0.9) : (Math.random()-0.5)*0.45, swift, rotation:Math.random()*Math.PI*2, rotationSpeed:(Math.random()*0.08)-0.04, image: img });
}

/* ---------------- Auto fire ---------------- */
function autoFire(now){
  if(!lastAutoFire) lastAutoFire = now;
  const fireInterval = now < rapidFireUntil ? AUTO_FIRE_MS * 0.45 : AUTO_FIRE_MS;
  if(now - lastAutoFire >= fireInterval){
    lastAutoFire = now;
    firePlayerShots(now);
  }
}

function firePlayerShots(now){
  const center = player.x + player.width/2;
  const offsets = now < rapidFireUntil ? [-8, 8] : [0];
  for(const offset of offsets){
    bullets.push({ x:center + offset - 3, y:player.y + 8, width:6, height:12, speed:10 });
  }
  sfxShoot();
}

/* ---------------- Particles ---------------- */
function spawnParticles(x,y,color='orange',count=10){
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const sp = 1 + Math.random()*2.4;
    particles.push({ x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:24 + Math.random()*18, color, size:2 + Math.random()*2 });
  }
}

function spawnPowerUp(x, y){
  const available = [
    { type:'rapid', color:'#8cf5d2' },
    { type:'shield', color:'#8cc8ff' }
  ];
  if(lives < 3) available.push({ type:'life', color:'#ff8fa3' });
  if(Math.random() < 0.2){
    const powerUp = available[Math.floor(Math.random() * available.length)];
    powerUps.push({ ...powerUp, x:x - 12, y:y - 12, width:24, height:24, speed:1.6 });
  }
}

function collectPowerUp(powerUp, now){
  if(powerUp.type === 'rapid'){
    rapidFireUntil = Math.max(rapidFireUntil, now) + 8000;
    playTone(740, 0.12, 'sine', 0.06);
  } else if(powerUp.type === 'shield'){
    shieldUntil = Math.max(shieldUntil, now) + 7000;
    playTone(620, 0.12, 'sine', 0.06);
  } else {
    lives = Math.min(3, lives + 1);
    hudLives.textContent = `${lives} / 3`;
    playTone(880, 0.14, 'triangle', 0.06);
  }
  updatePowerupStatus(now);
}

function updatePowerupStatus(now){
  const active = [];
  if(now < rapidFireUntil) active.push(`Rapid fire ${Math.ceil((rapidFireUntil - now) / 1000)}s`);
  if(now < shieldUntil) active.push(`Shield ${Math.ceil((shieldUntil - now) / 1000)}s`);
  powerupStatus.textContent = active.length ? active.join(' · ') : 'No active power-up';
  powerupStatus.classList.toggle('active', active.length > 0);
}

/* ---------------- Boss bar ---------------- */
function showBossBar(pct){ bossBar.style.display='block'; bossBar.querySelector('.inner').style.width = `${Math.max(0,pct*100)}%`; }
function hideBossBar(){ bossBar.style.display='none'; }

/* ---------------- Pause / Resume helpers ---------------- */
function pauseGame(){
  if(!gameStarted || gamePaused) return;
  gamePaused = true;
  pausedAt = performance.now();
  pauseBtn.textContent = '▶';
  pauseBtn.setAttribute('aria-label', 'Resume game');
  pauseBtn.title = 'Resume game';
  Object.keys(keys).forEach(key => { keys[key] = false; });
  showPanel(pausePanel);
}
function resumeGame(){
  if(!gameStarted || !gamePaused) return;
  const now = performance.now();
  const delta = now - pausedAt;
  lastSpawnTime += delta;
  lastAutoFire += delta;
  lastBossShoot += delta;
  if(rapidFireUntil) rapidFireUntil += delta;
  if(shieldUntil) shieldUntil += delta;
  gamePaused = false;
  pauseBtn.textContent = 'Ⅱ';
  pauseBtn.setAttribute('aria-label', 'Pause game');
  pauseBtn.title = 'Pause game';
  missionOverlay.hidden = true;
  lastTs = now;
  showPanel(null);
}
pauseBtn.addEventListener('click', () => {
  if (!gameStarted || gameOver) return;

  if (gamePaused) {
    resumeGame();
  } else {
    pauseGame();
  }
});

/* ---------------- Game over handlers ---------------- */
/* ---------------- Infinity start ---------------- */
function startInfinity(){
  // reset state
  bullets = []; meteors = []; particles = []; bossBullets = []; powerUps = []; boss = null;
  score = 0; lives = 3; spawnCount = 0; spawnTarget = 0;
  spawnInterval = 900; lastSpawnTime = performance.now();
  lastAutoFire = performance.now();
  lastBossShoot = performance.now();
  playerInvulnerableUntil = 0;
  rapidFireUntil = 0; shieldUntil = 0;
  updatePowerupStatus(performance.now());
  pauseBtn.textContent = 'Ⅱ';
  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };
  // starfield cycling speed can be set based on difficulty; use initial
  starfield.setTarget({ starColor: STAGE_PRESETS[0].starColor, speed: STAGE_PRESETS[0].speed, density: STAGE_PRESETS[0].density });
  mode = 'infinity'; gameStarted = true; gamePaused = false; gameOver = false;
  missionOverlay.hidden = true;
  hudMode.textContent = 'Infinity';
  hudInfo.textContent = `${score}`;
  hudLives.textContent = `${lives} / 3`;
  pauseBtn.hidden = false;
  setMobileView('game');
  updateGameHud();
  lastTs = performance.now();
  showPanel(null);
}

/* ---------------- Spawning logic for adventure normal levels ---------------- */
function handleSpawning(now, cfg){
  // for adventure normal: spawn based on spawnInterval until spawnCount >= target
  if(cfg.type === 'normal'){
    if(!lastSpawnTime) lastSpawnTime = now;
    if(spawnCount < cfg.meteorsToSpawn){
      if(now - lastSpawnTime >= cfg.spawnInterval){
        spawnAdventureWave(cfg);
        lastSpawnTime = now;
      }
    }
  } else {
    // boss levels do not spawn meteors
  }
}

function spawnAdventureMeteor(cfg, x){
  const swift = Math.random() < Math.min(0.32, 0.04 + cfg.level * 0.005);
  spawnMeteor({ speed: cfg.meteorSpeed + (swift ? 0.9 : 0), swift, x });
}

function spawnAdventureWave(cfg){
  const waveSize = Math.min(cfg.meteorsPerWave, cfg.meteorsToSpawn - spawnCount);
  const laneWidth = canvas.width / (waveSize + 1);
  for(let i = 0; i < waveSize; i++){
    const x = clamp(laneWidth * (i + 1) - 32 + (Math.random() * 20 - 10), 0, canvas.width - 65);
    spawnAdventureMeteor(cfg, x);
  }
  spawnCount += waveSize;
}

/* ---------------- Main loop ---------------- */
let lastTs = performance.now();
function loop(ts = performance.now()){
  const dt = ts - lastTs; lastTs = ts;
  const frameScale = Math.min(dt, 50) / (1000/60);
  const effectTime = gamePaused ? pausedAt : ts;

  // update/draw background
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  if(backgroundImg.complete && backgroundImg.naturalWidth){
    ctx.globalAlpha = 0.38;
    ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }
  starfield.update(Math.min(dt, 50)); starfield.draw();

  if(!gameStarted){
    requestAnimationFrame(loop); return;
  }

  if(!gamePaused){
    // input movement
    if(keys.ArrowLeft) player.x -= player.speed * frameScale;
    if(keys.ArrowRight) player.x += player.speed * frameScale;
    if(keys.ArrowUp) player.y -= player.speed * frameScale;
    if(keys.ArrowDown) player.y += player.speed * frameScale;
    player.x = clamp(player.x, 0, canvas.width - player.width);
    player.y = clamp(player.y, 0, canvas.height - player.height);

    // Auto-fire
    autoFire(ts);

    // Spawning: depends on mode
    if(mode === 'infinity'){
      // increase difficulty slowly: decrease spawnInterval over time (but keep it safe)
      if(!lastSpawnTime) lastSpawnTime = ts;
      if(ts - lastSpawnTime >= spawnInterval){
        const difficulty = (900 - spawnInterval) / 900;
        const swift = Math.random() < Math.min(0.42, 0.14 + difficulty * 0.22);
        const speed = swift
          ? 2.8 + Math.random()*1.3 + difficulty*0.8
          : 1 + Math.random()*1.6 + difficulty*0.45;
        spawnMeteor({ speed, swift });
        lastSpawnTime = ts;
        // accelerate spawn gradually
        spawnInterval = Math.max(220, spawnInterval * 0.996);
      }
    } else if(mode === 'adventure'){
      const cfg = getLevelConfig(advLevel);
      handleSpawning(ts, cfg);
      // boss shoot
      if(boss){
        boss.x += boss.speedX * frameScale;
        if(boss.x <= 0 || boss.x + boss.width >= canvas.width){
          boss.speedX *= -1;
          boss.x = clamp(boss.x, 0, canvas.width - boss.width);
        }
        if(!lastBossShoot) lastBossShoot = ts;
        if(ts - lastBossShoot >= boss.shootInterval){
          lastBossShoot = ts;
          // boss fires a spread
          const shots = 3 + Math.floor(Math.random()*2);
          for(let s=0;s<shots;s++){
            const bx = boss.x + boss.width * ((s+1)/(shots+1)) + (Math.random()*16-8);
            const vy = 3 + Math.random()*2;
            const vx = (player.x + player.width/2 - bx) / 80 + (Math.random()*2-1)*0.6;
            bossBullets.push({ x:bx, y:boss.y + boss.height, width:6, height:12, vx, vy });
          }
        }
      }
    }

    // update bullets
    for(let i = bullets.length-1; i>=0; i--){
      const b = bullets[i];
      b.y -= b.speed * frameScale;
      if(b.y + b.height < 0) bullets.splice(i,1);
    }

    // update meteors
    for(let i = meteors.length-1; i>=0; i--){
      const m = meteors[i];
      m.y += m.speed * frameScale;
      m.x += m.drift * frameScale;
      if(m.x <= 0 || m.x + m.width >= canvas.width){
        m.drift *= -1;
        m.x = clamp(m.x, 0, canvas.width - m.width);
      }
      m.rotation += m.rotationSpeed * frameScale;
      if(m.y > canvas.height + 8){
        meteors.splice(i,1);
        handlePlayerHit('A meteor passed!', ts);
        if(gameOver){ requestAnimationFrame(loop); return; }
      }
    }

    // update and collect falling power-ups
    for(let i = powerUps.length-1; i >= 0; i--){
      const powerUp = powerUps[i];
      powerUp.y += powerUp.speed * frameScale;
      if(powerUp.y > canvas.height + powerUp.height){
        powerUps.splice(i, 1);
      } else if(rectsOverlap(player, powerUp)){
        collectPowerUp(powerUp, ts);
        powerUps.splice(i, 1);
      }
    }

    // update boss bullets
    for(let i = bossBullets.length-1; i>=0; i--){
      const bb = bossBullets[i];
      bb.x += bb.vx * frameScale; bb.y += bb.vy * frameScale;
      if(bb.y > canvas.height + 20 || bb.x < -50 || bb.x > canvas.width + 50) bossBullets.splice(i,1);
    }

    // update particles
    for(let i = particles.length-1; i>=0; i--){
      const p = particles[i];
      p.x += p.vx * frameScale; p.y += p.vy * frameScale; p.vy += 0.06 * frameScale; p.life -= frameScale;
      if(p.life <= 0) particles.splice(i,1);
    }

    // collisions: bullets->meteors
    for(let bi = bullets.length-1; bi>=0; bi--){
      const b = bullets[bi];
      let removed = false;
      for(let mi = meteors.length-1; mi>=0; mi--){
        const m = meteors[mi];
        if(rectsOverlap({x:b.x,y:b.y,width:b.width,height:b.height},{x:m.x,y:m.y,width:m.width,height:m.height})){
          const pts = Math.round((m.width/8) * 5);
          score += pts;
          if(mode === 'infinity' && score > inftyHigh){ inftyHigh = score; localStorage.setItem(LS_INFTY_HIGH, inftyHigh); hudHigh.textContent = `${inftyHigh}`; }
          spawnParticles(m.x + m.width/2, m.y + m.height/2, 'orange', 10); sfxExplode();
          spawnPowerUp(m.x + m.width/2, m.y + m.height/2);
          meteors.splice(mi,1);
          bullets.splice(bi,1);
          removed = true;
          break;
        }
      }
      if(removed) continue;
    }

    // bullets -> boss
    if(boss){
      for(let bi = bullets.length-1; bi>=0; bi--){
        const b = bullets[bi];
        if(rectsOverlap({x:b.x,y:b.y,width:b.width,height:b.height},{x:boss.x,y:boss.y,width:boss.width,height:boss.height})){
          bullets.splice(bi,1);
          boss.hp--;
          spawnParticles(b.x, b.y, 'yellow', 6); sfxBossHit();
          showBossBar(boss.hp / boss.maxHp);
          if(boss.hp <= 0){
            spawnParticles(boss.x + boss.width/2, boss.y + boss.height/2, 'white', 20);
            boss = null;
            hideBossBar();
            // level cleared
            levelCleared(); requestAnimationFrame(loop);
            return;
          }
        }
      }
    }

    // boss bullets -> player
    for(let i = bossBullets.length-1; i>=0; i--){
      const bb = bossBullets[i];
      if(rectsOverlap({x:player.x,y:player.y,width:player.width,height:player.height},{x:bb.x,y:bb.y,width:bb.width,height:bb.height})){
        spawnParticles(player.x + player.width/2, player.y + player.height/2, 'red', 14);
        bossBullets.splice(i,1);
        handlePlayerHit('Hit by the boss!', ts);
        if(gameOver){ requestAnimationFrame(loop); return; }
      }
    }

    // meteors -> player
    for(let i = meteors.length-1; i>=0; i--){
      const m = meteors[i];
      if(rectsOverlap({x:player.x,y:player.y,width:player.width,height:player.height},{x:m.x,y:m.y,width:m.width,height:m.height})){
        spawnParticles(player.x + player.width/2, player.y + player.height/2, 'red', 18);
        meteors.splice(i,1);
        handlePlayerHit('Hit by a meteor!', ts);
        if(gameOver){ requestAnimationFrame(loop); return; }
      }
    }

    // For adventure normal levels: if spawnCount >= target and no meteors -> level cleared
    if(mode === 'adventure'){
      const cfg = getLevelConfig(advLevel);
      if(cfg.type === 'normal'){
        if(spawnCount >= cfg.meteorsToSpawn && meteors.length === 0){
          levelCleared();
          requestAnimationFrame(loop);
          return;
        }
      }
    }

  } // end not paused

  /* ---------------- Draw ---------------- */
  // meteors
  for(let m of meteors){
    ctx.save(); ctx.translate(m.x + m.width/2, m.y + m.height/2); ctx.rotate(m.rotation);
    if(m.swift){
      ctx.shadowColor = '#ffae62';
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(255, 142, 72, 0.5)';
      ctx.beginPath();
      ctx.ellipse(0, -m.height * 0.64, m.width * 0.19, m.height * 0.48, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if(m.image && m.image.complete && m.image.naturalWidth) ctx.drawImage(m.image, -m.width/2, -m.height/2, m.width, m.height);
    else { ctx.fillStyle = '#a55'; ctx.fillRect(-m.width/2, -m.height/2, m.width, m.height); }
    ctx.restore();
  }

  // boss
  if(boss){
    if(bossImg.complete && bossImg.naturalWidth) ctx.drawImage(bossImg, boss.x, boss.y, boss.width, boss.height);
    else { ctx.fillStyle = '#b22'; ctx.fillRect(boss.x, boss.y, boss.width, boss.height); }
  }

  // player
  if(player){
    if(effectTime < shieldUntil){
      ctx.save();
      ctx.strokeStyle = 'rgba(140, 200, 255, 0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#8cc8ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(player.x + player.width/2, player.y + player.height/2, player.width * 0.72, player.height * 0.68, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if(ts >= playerInvulnerableUntil || Math.floor(ts / 90) % 2 === 0){
      if(spaceshipImg.complete && spaceshipImg.naturalWidth) ctx.drawImage(spaceshipImg, player.x, player.y, player.width, player.height);
      else { ctx.fillStyle = '#0ff'; ctx.fillRect(player.x, player.y, player.width, player.height); }
    }
  }

  // power-ups
  for(const powerUp of powerUps){
    ctx.save();
    ctx.fillStyle = powerUp.color;
    ctx.shadowColor = powerUp.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(powerUp.x + powerUp.width/2, powerUp.y + powerUp.height/2, powerUp.width/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#07111b';
    ctx.strokeStyle = '#07111b';
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    const centerX = powerUp.x + powerUp.width/2;
    const centerY = powerUp.y + powerUp.height/2;
    if(powerUp.type === 'shield'){
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX + 7, centerY - 5);
      ctx.lineTo(centerX + 6, centerY + 2);
      ctx.quadraticCurveTo(centerX + 4, centerY + 7, centerX, centerY + 9);
      ctx.quadraticCurveTo(centerX - 4, centerY + 7, centerX - 6, centerY + 2);
      ctx.lineTo(centerX - 7, centerY - 5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.stroke();
    } else if(powerUp.type === 'life'){
      ctx.fillStyle = '#7b1933';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY + 7);
      ctx.bezierCurveTo(centerX - 12, centerY, centerX - 6, centerY - 9, centerX, centerY - 4);
      ctx.bezierCurveTo(centerX + 6, centerY - 9, centerX + 12, centerY, centerX, centerY + 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.stroke();
    } else {
      ctx.translate(centerX, centerY);
      ctx.rotate(-Math.PI/4);
      ctx.fillRect(-2.2, -8, 4.4, 12);
      ctx.beginPath();
      ctx.moveTo(-2.2, 4);
      ctx.lineTo(0, 8);
      ctx.lineTo(2.2, 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -5, 2.2, Math.PI, 0);
      ctx.fill();
      ctx.translate(-5.3, 5.3);
      ctx.rotate(-0.2);
      ctx.fillRect(-1.6, -6, 3.2, 9);
      ctx.beginPath();
      ctx.moveTo(-1.6, 3);
      ctx.lineTo(0, 6);
      ctx.lineTo(1.6, 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -3.8, 1.6, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  // bullets
  for(let b of bullets){
    ctx.fillStyle = 'rgba(255,220,120,0.9)'; ctx.fillRect(b.x-1, b.y+6, b.width+2, b.height-2);
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.height);
    grad.addColorStop(0,'white'); grad.addColorStop(0.6,'rgba(255,230,110,1)'); grad.addColorStop(1,'rgba(255,160,40,0.9)');
    ctx.fillStyle = grad; ctx.fillRect(b.x,b.y,b.width,b.height);
  }

  // boss bullets
  for(let bb of bossBullets){ ctx.fillStyle = '#ffb0b0'; ctx.fillRect(bb.x, bb.y, bb.width, bb.height); }

  // particles
  for(let p of particles){ ctx.globalAlpha = Math.max(0, p.life/40); ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,p.size,p.size); ctx.globalAlpha = 1; }

  // HUD DOM update
  hudInfo.textContent = `${score}`;
  hudLives.textContent = `${lives} / 3`;
  hudHigh.textContent = `${inftyHigh}`;
  updateGameHud();
  updatePowerupStatus(effectTime);

  requestAnimationFrame(loop);
}

/* ---------------- Level clear & game over functions ---------------- */
function levelCleared(){
  if(!gameStarted) return;
  const next = advLevel + 1;
  advLevel = next;
  if(next <= 50 && next > getUnlocked()) setUnlocked(next);
  powerUps = [];
  rapidFireUntil = 0; shieldUntil = 0;
  updatePowerupStatus(performance.now());
  gameStarted = false;
  gamePaused = false;
  pauseBtn.hidden = true;
  if(next <= 50){
    const cfg = getLevelConfig(next);
    hudMode.textContent = `Adventure · L${next}`;
    lives = 3;
    hudLives.textContent = `${lives} / 3`;
    updateGameHud();
    const preset = STAGE_PRESETS[Math.min(STAGE_PRESETS.length-1, Math.floor((next-1)/10))];
    starfield.setTarget({ starColor:preset.starColor, speed:preset.speed, density:preset.density });
    showMissionBriefing(
      'MISSION COMPLETE · NEXT UP',
      `Level ${next}`,
      getMissionObjective(cfg),
      'Launch next level',
      'Main menu',
      true
    );
  } else {
    showMissionBriefing(
      'CAMPAIGN COMPLETE',
      'You cleared all 50 levels!',
      'Incredible flying, pilot. Ready for another run?',
      'Play Infinity',
      'Main menu',
      true
    );
  }
  hideBossBar(); stopAll();
}

function onAdventureFail(reason=''){
  powerUps = [];
  rapidFireUntil = 0; shieldUntil = 0;
  updatePowerupStatus(performance.now());
  stopAll(); gameStarted = false; gamePaused = false; gameOver = true;
  pauseBtn.hidden = true; hideBossBar();
  gameOverText.textContent = `Final Score: ${score} ${reason ? '('+reason+')' : ''}`;
  showPanel(gameOverPanel);
}
function onInfinityFail(){
  powerUps = [];
  rapidFireUntil = 0; shieldUntil = 0;
  updatePowerupStatus(performance.now());
  stopAll(); gameStarted = false; gamePaused = false; gameOver = true;
  pauseBtn.hidden = true; hideBossBar();
  gameOverText.textContent = `Final Score: ${score}`;
  showPanel(gameOverPanel);
}

function handlePlayerHit(reason, now){
  if(now < playerInvulnerableUntil || now < shieldUntil || gameOver) return;
  lives = Math.max(0, lives - 1);
  hudLives.textContent = `${lives} / 3`;
  updateGameHud();
  playerInvulnerableUntil = now + 1100;
  if(lives === 0){
    if(mode === 'infinity') onInfinityFail();
    else onAdventureFail(reason);
  }
}

/* ---------------- UI wiring ---------------- */
btnAdventure.addEventListener('click', ()=> {
  mode = 'adventure';
  setMobileView('levels');
  buildLevelList();
  showPanel(levelListPanel);
  hudMode.textContent = 'Adventure';
});
btnInfinity.addEventListener('click', ()=> {
  mode = 'infinity';
  startInfinity();
});

backToMenuFromList.addEventListener('click', ()=> { resetBase(); showPanel(menu); });

missionLaunchBtn.addEventListener('click', () => {
  if(advLevel > 50) startInfinity();
  else startAdventureLevel();
});
missionBackBtn.addEventListener('click', () => {
  missionOverlay.hidden = true;
  if(missionBackToMenu || advLevel > 50){
    resetBase();
    showPanel(menu);
  } else {
    setMobileView('levels');
    buildLevelList();
    showPanel(levelListPanel);
  }
});

resumeBtn.addEventListener('click', ()=> {
  resumeGame();
});

backToMenuFromPause.addEventListener('click', ()=> {
  stopAll(); resetBase(); showPanel(menu); buildLevelList();
});

retryBtn.addEventListener('click', ()=> {
  gameOver = false;
  if(mode === 'infinity') { resetBase(); startInfinity(); }
  else { resetBase(); openLevelStart(advLevel); }
});
goToMenuBtn.addEventListener('click', ()=> { stopAll(); resetBase(); showPanel(menu); buildLevelList(); });

document.addEventListener('keydown', (e)=> {
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){ keys[e.code] = true; e.preventDefault(); }
  if(e.code === 'KeyP'){ if(gameStarted && !gameOver){ if(!gamePaused) pauseGame(); else resumeGame(); } }
  if(e.code === 'Space' && gameStarted && !gamePaused && !gameOver){
    e.preventDefault();
    if(!e.repeat) firePlayerShots(performance.now());
  }
});
document.addEventListener('keyup', (e)=> { if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) keys[e.code]=false; });
/* ---------------- Mobile touch controls ---------------- */
canvas.addEventListener('pointerdown', (e) => {
  if (!gameStarted || gamePaused || gameOver || !player) return;

  canvas.setPointerCapture(e.pointerId);
  movePlayerWithTouch(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (!gameStarted || gamePaused || gameOver || !player) return;
  if (!canvas.hasPointerCapture(e.pointerId)) return;

  movePlayerWithTouch(e);
});

canvas.addEventListener('pointerup', (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointercancel', (e) => {
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
});

function movePlayerWithTouch(e) {
  const rect = canvas.getBoundingClientRect();

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const touchX = (e.clientX - rect.left) * scaleX;
  const touchY = (e.clientY - rect.top) * scaleY;

  player.x = clamp(
    touchX - player.width / 2,
    0,
    canvas.width - player.width
  );

  player.y = clamp(
    touchY - player.height / 2,
    0,
    canvas.height - player.height
  );
}

window.addEventListener('blur', ()=> { if(gameStarted && !gameOver && !gamePaused){ pauseGame(); } });

/* ---------------- Helpers / init ---------------- */
function resetBase(){
  bullets = []; meteors = []; particles = []; bossBullets = []; powerUps = []; boss = null;
  score = 0; lives = 3; gameStarted = false; gamePaused = false; gameOver = false;
  playerInvulnerableUntil = 0;
  rapidFireUntil = 0; shieldUntil = 0;
  pauseBtn.hidden = true;
  pauseBtn.textContent = 'Ⅱ';
  pauseBtn.setAttribute('aria-label', 'Pause game');
  pauseBtn.title = 'Pause game';
  missionBackToMenu = false;
  missionOverlay.hidden = true;
  setMobileView('menu');
  Object.keys(keys).forEach(key => { keys[key] = false; });
  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };
  starfield.init(80); hideBossBar();
  hudMode.textContent = 'Select mission';
  hudInfo.textContent = '0';
  hudLives.textContent = '—';
  hudHigh.textContent = `${inftyHigh}`;
  updateGameHud();
  updatePowerupStatus(0);
}
function stopAll(){ lastSpawnTime = 0; lastAutoFire = 0; lastBossShoot = 0; }

/* ---------------- Build list initially & start loop ---------------- */
setUnlocked(getUnlocked());
buildLevelList();
showPanel(menu);
resetBase();
requestAnimationFrame(loop);
