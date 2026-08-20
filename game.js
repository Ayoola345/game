const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menu = document.getElementById('menu');
const levelListPanel = document.getElementById('levelList');
const levelsContainer = document.getElementById('levelsContainer');
const levelStartPanel = document.getElementById('levelStart');
const levelStartTitle = document.getElementById('levelStartTitle');
const levelStartInfo = document.getElementById('levelStartInfo');
const startLevelBtn = document.getElementById('startLevelBtn');
const cancelStartBtn = document.getElementById('cancelStartBtn');

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

const bossBar = document.createElement('div');
bossBar.className = 'boss-bar';
bossBar.innerHTML = '<div class="inner"></div>';
document.body.appendChild(bossBar);

/* ---------------- Images (optional) ----------------
 Place optional sprites in images/:
  spaceship.png, meteor1.png, meteor2.png, meteor3.png, boss.png
*/
const spaceshipImg = new Image(); spaceshipImg.src = 'images/spaceship.png';
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

let bullets = [], meteors = [], particles = [], bossBullets = [];
let player = null;
let boss = null;

let score = 0;
let inftyHigh = Number(localStorage.getItem(LS_INFTY_HIGH) || 0);
hudHigh.textContent = `High: ${inftyHigh}`;

let lives = 3;
let gameStarted = false;
let gamePaused = false;
let gameOver = false;

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
    const base = 6 + Math.floor(lv * 0.9);
    const variance = (lv % 3 === 0) ? 2 : 1;
    const meteorsToSpawn = base + variance;
    const meteorSpeed = parseFloat((1.0 + lv * 0.07 + (lv%5)*0.03).toFixed(2));
    const spawnInt = Math.max(220, Math.round(900 - lv * 11));
    return { type:'normal', level:lv, meteorsToSpawn, meteorSpeed, spawnInterval: spawnInt };
  }
}

/* ---------------- Helpers ---------------- */
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function rectsOverlap(a,b){ return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

/* ---------------- Sound (simple) ---------------- */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq=440, time=0.06, type='sine', gain=0.04){
  try{
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
  [menu, levelListPanel, levelStartPanel, pausePanel, gameOverPanel].forEach(p => p.classList.add('hidden'));
  if(panel) panel.classList.remove('hidden');
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
    left.innerHTML = `<div class="level-number">Level ${i}</div><div class="level-meta">${cfg.type==='boss' ? 'Boss Level' : cfg.meteorsToSpawn + ' meteors • speed '+cfg.meteorSpeed}</div>`;
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
  levelStartTitle.textContent = cfg.type==='boss' ? `Level ${lv} — Boss` : `Level ${lv}`;
  levelStartInfo.textContent = cfg.type==='boss' ? `Boss fight. You will have 3 lives.` : `Destroy ${cfg.meteorsToSpawn} meteors. You will have 3 lives.`;
  showPanel(levelStartPanel);
  lives = 3; hudLives.textContent = `Lives: ${lives}`;
  // set starfield stage
  const preset = STAGE_PRESETS[Math.min(STAGE_PRESETS.length-1, Math.floor((lv-1)/10))];
  starfield.setTarget({ starColor:preset.starColor, speed:preset.speed, density:preset.density });
}

/* ---------------- Start adventure level play ---------------- */
function startAdventureLevel(){
  const cfg = getLevelConfig(advLevel);
  // reset arrays and timing
  bullets = []; meteors = []; particles = []; bossBullets = []; boss = null;
  score = 0; spawnCount = 0; spawnTarget = cfg.type==='normal' ? cfg.meteorsToSpawn : 0;
  spawnInterval = cfg.type==='normal' ? cfg.spawnInterval : 999999;
  lastSpawnTime = performance.now();
  lastAutoFire = performance.now();
  lastBossShoot = performance.now();
  bossShootInterval = cfg.bossShootInterval || 700;

  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };

  if(cfg.type === 'boss'){
    boss = { x: canvas.width/2 - 100, y: 36, width:200, height:100, hp: cfg.bossHp, maxHp: cfg.bossHp, speedX: cfg.bossSpeedX || 1, shootInterval: cfg.bossShootInterval };
    showBossBar(1);
  } else {
    boss = null;
    // spawn first meteor immediately
    spawnMeteor({ speed: cfg.meteorSpeed }); spawnCount++;
    lastSpawnTime = performance.now();
  }

  mode = 'adventure';
  gameStarted = true;
  gamePaused = false;
  gameOver = false;

  hudMode.textContent = `Mode: Adventure (L${advLevel})`;
  hudInfo.textContent = `Score: ${score}`;
  hudLives.textContent = `Lives: ${lives}`;
  showPanel(null);
}

/* ---------------- Spawn helpers ---------------- */
function spawnMeteor(spec={}){
  const size = spec.size || (26 + Math.floor(Math.random()*40));
  const x = spec.x !== undefined ? spec.x : Math.random() * (canvas.width - size);
  const speed = spec.speed !== undefined ? spec.speed : (1 + Math.random()*0.9);
  const img = meteorImgs[Math.floor(Math.random()*meteorImgs.length)];
  meteors.push({ x, y:-size-6, width:size, height:size, speed, rotation:Math.random()*Math.PI*2, rotationSpeed:(Math.random()*0.08)-0.04, image: img });
}

/* ---------------- Boss shooting ---------------- */
function bossShoot(now){
  if(!boss) return;
  if(!lastBossShoot) lastBossShoot = now;
  if(now - lastBossShoot >= boss.shootInterval){
    lastBossShoot = now;
    const shots = 3 + Math.floor(Math.random()*2);
    for(let s=0;s<shots;s++){
      const bx = boss.x + boss.width * ((s+1)/(shots+1)) + (Math.random()*16-8);
      const vy = 3 + Math.random()*2;
      const vx = (player.x + player.width/2 - bx) / 80 + (Math.random()*2-1)*0.6;
      bossBullets.push({ x:bx, y:boss.y + boss.height, width:6, height:12, vx, vy });
    }
  }
}

/* ---------------- Auto fire ---------------- */
function autoFire(now){
  if(!lastAutoFire) lastAutoFire = now;
  if(now - lastAutoFire >= AUTO_FIRE_MS){
    lastAutoFire = now;
    bullets.push({ x: player.x + player.width/2 - 3, y: player.y + 8, width:6, height:12, speed:10 });
    sfxShoot();
  }
}

/* ---------------- Particles ---------------- */
function spawnParticles(x,y,color='orange',count=10){
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const sp = 1 + Math.random()*2.4;
    particles.push({ x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:24 + Math.random()*18, color, size:2 + Math.random()*2 });
  }
}

/* ---------------- Boss bar ---------------- */
function showBossBar(pct){ bossBar.style.display='block'; bossBar.querySelector('.inner').style.width = `${Math.max(0,pct*100)}%`; }
function hideBossBar(){ bossBar.style.display='none'; }

/* ---------------- Pause / Resume helpers ---------------- */
function pauseGame(){
  if(!gameStarted || gamePaused) return;
  gamePaused = true;
  pausedAt = performance.now();
  showPanel(pausePanel);
}
function resumeGame(){
  if(!gameStarted || !gamePaused) return;
  const now = performance.now();
  const delta = now - pausedAt;
  // shift timers forward so we continue where left off
  lastSpawnTime += delta;
  lastAutoFire += delta;
  lastBossShoot += delta;
  gamePaused = false;
  showPanel(null);
}

/* ---------------- Game over handlers ---------------- */
function onAdventureFail(reason=''){
  stopAll();
  gameStarted = false; gameOver = true;
  gameOverText.textContent = `Final Score: ${score} ${reason ? '('+reason+')' : ''}`;
  showPanel(gameOverPanel);
}
function onInfinityFail(){
  stopAll();
  gameStarted = false; gameOver = true;
  gameOverText.textContent = `Final Score: ${score}`;
  showPanel(gameOverPanel);
}

/* ---------------- Stop all timers (cleanup) ---------------- */
function stopAll(){
  // No setInterval timers to clear because we use timestamp-based loop; just reset state where appropriate
  lastSpawnTime = 0; lastAutoFire = 0; lastBossShoot = 0;
}

/* ---------------- Infinity start ---------------- */
function startInfinity(){
  // reset state
  bullets = []; meteors = []; particles = []; bossBullets = []; boss = null;
  score = 0; lives = 3; spawnCount = 0; spawnTarget = 0;
  spawnInterval = 900; lastSpawnTime = performance.now();
  lastAutoFire = performance.now();
  lastBossShoot = performance.now();
  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };
  // starfield cycling speed can be set based on difficulty; use initial
  starfield.setTarget({ starColor: STAGE_PRESETS[0].starColor, speed: STAGE_PRESETS[0].speed, density: STAGE_PRESETS[0].density });
  mode = 'infinity'; gameStarted = true; gamePaused = false; gameOver = false;
  hudMode.textContent = 'Mode: Infinity'; hudInfo.textContent = `Score: ${score}`; hudLives.textContent = `Lives: ${lives}`;
  showPanel(null);
}

/* ---------------- Level clear handler (adventure) ---------------- */
function levelCleared(){
  // unlock next
  const nxt = advLevel + 1;
  if(nxt <= 50 && nxt > getUnlocked()) setUnlocked(nxt);
  buildLevelList();
  showPanel(levelListPanel);
  gameStarted = false;
  hideBossBar();
  stopAll();
}

/* ---------------- Spawning logic for adventure normal levels ---------------- */
function handleSpawning(now, cfg){
  // for adventure normal: spawn based on spawnInterval until spawnCount >= target
  if(cfg.type === 'normal'){
    if(!lastSpawnTime) lastSpawnTime = now;
    if(spawnCount < cfg.meteorsToSpawn){
      if(now - lastSpawnTime >= cfg.spawnInterval){
        spawnMeteor({ speed: cfg.meteorSpeed });
        spawnCount++;
        lastSpawnTime = now;
      }
    }
  } else {
    // boss levels do not spawn meteors
  }
}

/* ---------------- Main loop ---------------- */
let lastTs = performance.now();
function loop(ts = performance.now()){
  const dt = ts - lastTs; lastTs = ts;

  // update/draw background
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  starfield.update(dt); starfield.draw();

  if(!gameStarted){
    requestAnimationFrame(loop); return;
  }

  if(!gamePaused){
    // input movement
    if(keys.ArrowLeft && player.x > 0) player.x -= player.speed;
    if(keys.ArrowRight && player.x + player.width < canvas.width) player.x += player.speed;
    if(keys.ArrowUp && player.y > 0) player.y -= player.speed;
    if(keys.ArrowDown && player.y + player.height < canvas.height) player.y += player.speed;

    // Auto-fire
    autoFire(ts);

    // Spawning: depends on mode
    if(mode === 'infinity'){
      // increase difficulty slowly: decrease spawnInterval over time (but keep it safe)
      if(!lastSpawnTime) lastSpawnTime = ts;
      if(ts - lastSpawnTime >= spawnInterval){
        // spawn
        spawnMeteor({ speed: 1 + Math.random()*1.6 });
        lastSpawnTime = ts;
        // accelerate spawn gradually
        spawnInterval = Math.max(220, spawnInterval * 0.996);
      }
    } else if(mode === 'adventure'){
      const cfg = getLevelConfig(advLevel);
      handleSpawning(ts, cfg);
      // boss shoot
      if(boss){
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
      b.y -= b.speed;
      if(b.y + b.height < 0) bullets.splice(i,1);
    }

    // update meteors
    for(let i = meteors.length-1; i>=0; i--){
      const m = meteors[i];
      m.y += m.speed;
      m.rotation += m.rotationSpeed;
      if(m.y > canvas.height + 8){
        meteors.splice(i,1);
        if(mode === 'infinity'){ lives--; if(lives <= 0){ onInfinityFail(); requestAnimationFrame(loop); return; } }
        else { onAdventureFail('A meteor passed!'); requestAnimationFrame(loop); return; }
      }
    }

    // update boss bullets
    for(let i = bossBullets.length-1; i>=0; i--){
      const bb = bossBullets[i];
      bb.x += bb.vx; bb.y += bb.vy;
      if(bb.y > canvas.height + 20 || bb.x < -50 || bb.x > canvas.width + 50) bossBullets.splice(i,1);
    }

    // update particles
    for(let i = particles.length-1; i>=0; i--){
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life--;
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
          if(mode === 'infinity' && score > inftyHigh){ inftyHigh = score; localStorage.setItem(LS_INFTY_HIGH, inftyHigh); hudHigh.textContent = `High: ${inftyHigh}`; }
          spawnParticles(m.x + m.width/2, m.y + m.height/2, 'orange', 10); sfxExplode();
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
        if(mode === 'infinity'){ lives--; if(lives<=0){ onInfinityFail(); requestAnimationFrame(loop); return; } } else { onAdventureFail('Hit by boss!'); requestAnimationFrame(loop); return; }
      }
    }

    // meteors -> player
    for(let i = meteors.length-1; i>=0; i--){
      const m = meteors[i];
      if(rectsOverlap({x:player.x,y:player.y,width:player.width,height:player.height},{x:m.x,y:m.y,width:m.width,height:m.height})){
        spawnParticles(player.x + player.width/2, player.y + player.height/2, 'red', 18);
        meteors.splice(i,1);
        if(mode === 'infinity'){ lives--; if(lives<=0){ onInfinityFail(); requestAnimationFrame(loop); return; } } else { onAdventureFail('You were hit!'); requestAnimationFrame(loop); return; }
      }
    }

    // For adventure normal levels: if spawnCount >= target and no meteors -> level cleared
    if(mode === 'adventure'){
      const cfg = getLevelConfig(advLevel);
      if(cfg.type === 'normal'){
        if(spawnCount >= cfg.meteorsToSpawn && meteors.length === 0){
          // clear level
          setTimeout(()=> levelCleared(), 200);
        }
      }
    }

  } // end not paused

  /* ---------------- Draw ---------------- */
  // meteors
  for(let m of meteors){
    ctx.save(); ctx.translate(m.x + m.width/2, m.y + m.height/2); ctx.rotate(m.rotation);
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
    if(spaceshipImg.complete && spaceshipImg.naturalWidth) ctx.drawImage(spaceshipImg, player.x, player.y, player.width, player.height);
    else { ctx.fillStyle = '#0ff'; ctx.fillRect(player.x, player.y, player.width, player.height); }
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
  hudInfo.textContent = `Score: ${score}`;
  hudLives.textContent = `Lives: ${lives}`;
  hudHigh.textContent = `High: ${inftyHigh}`;

  requestAnimationFrame(loop);
}

/* ---------------- Level clear & game over functions ---------------- */
function levelCleared(){
  const next = advLevel + 1;
  if(next <= 50 && next > getUnlocked()) setUnlocked(next);
  buildLevelList();
  showPanel(levelListPanel);
  gameStarted = false; hideBossBar(); stopAll();
}

function onAdventureFail(reason=''){
  stopAll(); gameStarted = false; gameOver = true;
  gameOverText.textContent = `Final Score: ${score} ${reason ? '('+reason+')' : ''}`;
  showPanel(gameOverPanel);
}
function onInfinityFail(){
  stopAll(); gameStarted = false; gameOver = true;
  gameOverText.textContent = `Final Score: ${score}`;
  showPanel(gameOverPanel);
}

/* ---------------- UI wiring ---------------- */
btnAdventure.addEventListener('click', ()=> {
  mode = 'adventure';
  buildLevelList();
  showPanel(levelListPanel);
  hudMode.textContent = 'Mode: Adventure';
});
btnInfinity.addEventListener('click', ()=> {
  mode = 'infinity';
  startInfinity();
});

backToMenuFromList.addEventListener('click', ()=> { resetBase(); showPanel(menu); });

startLevelBtn.addEventListener('click', ()=> {
  startAdventureLevel();
});
cancelStartBtn.addEventListener('click', ()=> { buildLevelList(); showPanel(levelListPanel); });

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
  if(e.code === 'Space'){ if(gameStarted && !gamePaused && !gameOver){ bullets.push({ x: player.x + player.width/2 - 3, y: player.y + 8, width:6, height:12, speed:10 }); sfxShoot(); } }
});
document.addEventListener('keyup', (e)=> { if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) keys[e.code]=false; });

window.addEventListener('blur', ()=> { if(gameStarted && !gameOver && !gamePaused){ pauseGame(); } });

/* ---------------- Helpers / init ---------------- */
function resetBase(){
  bullets = []; meteors = []; particles = []; bossBullets = []; boss = null;
  score = 0; lives = 3; gameStarted = false; gamePaused = false; gameOver = false;
  player = { x: canvas.width/2 - 22, y: canvas.height - 80, width:44, height:56, speed:4.4 };
  starfield.init(80); hideBossBar();
  hudHigh.textContent = `High: ${inftyHigh}`;
}
function stopAll(){ lastSpawnTime = 0; lastAutoFire = 0; lastBossShoot = 0; }
function setUnlocked(n){ localStorage.setItem(LS_UNLOCK, n); unlockedLevel = n; }
function getUnlocked(){ return Number(localStorage.getItem(LS_UNLOCK) || 1); }

/* ---------------- Build list initially & start loop ---------------- */
setUnlocked(getUnlocked());
buildLevelList();
showPanel(menu);
resetBase();
requestAnimationFrame(loop);
