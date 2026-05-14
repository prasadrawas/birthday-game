// ============================================================
// Run to Midnight Kiss — game.js
// ============================================================

(function () {
  'use strict';

  // --- Canvas Setup ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  // Design resolution — all game logic uses these coordinates
  const W = 900;
  const H = 506;
  const GROUND_Y = H - 60;  // ground surface y-coordinate

  // Resize canvas buffer to fill window, scale context to design resolution
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    canvas.width = winW * dpr;
    canvas.height = winH * dpr;
    canvas.style.width = winW + 'px';
    canvas.style.height = winH + 'px';
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Apply scaling before each render so 900x506 coords fill the screen
  function applyCanvasScale() {
    var scaleX = canvas.width / W;
    var scaleY = canvas.height / H;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  }

  // --- Game States ---
  const State = {
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER',
    INTRO_CUTSCENE: 'INTRO_CUTSCENE',
    VICTORY_CUTSCENE: 'VICTORY_CUTSCENE',
    VICTORY: 'VICTORY',
    LEVEL_TRANSITION: 'LEVEL_TRANSITION'
  };

  // --- Game Object ---
  const game = {
    state: State.TITLE,
    score: 0,
    distance: 0,
    speed: 5,            // current scroll speed (pixels per frame)
    baseSpeed: 5,
    level: 0,            // 0-5 index
    totalLevels: 6,
    levelDistance: 0,     // distance within current level
    levelLength: 9000,   // distance units per level (~30+ seconds each)
    health: 3,
    maxHealth: 3,
    loveMeter: 0,
    maxLoveMeter: 100,
    countdownTotal: 10 * 60, // 10 minutes in seconds (6 levels need more time)
    countdownRemaining: 10 * 60,
    lastTimestamp: 0,
    accumulatedTime: 0,
    shieldActive: false,
    shieldTimer: 0,
    dazeActive: false,
    dazeTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    transitionTimer: 0,
    transitionDuration: 2,  // seconds
    particles: [],
    obstacles: [],
    collectibles: [],
    frameCount: 0,
    screenShake: 0,
    finalStretch: false,
    loveBurstActive: false,
    loveBurstTimer: 0,
    // Villain system
    villainActive: false,
    villainId: -1,        // index into villains array
    villainX: 0,
    villainHealth: 0,
    villainMaxHealth: 0,
    villainAttackTimer: 0,
    villainPhase: 0,      // 0=approaching, 1=convo, 2=fighting, 3=defeated-walk, 4=done
    villainConvoIndex: 0,
    villainConvoTimer: 0,
    villainDefeatedWalkTimer: 0,
    villainStompCooldown: 0,
    villainsDefeated: [false, false, false],
    // Thought bubble state
    thoughtText: '',
    thoughtTimer: 0,
    thoughtIndex: 0,
    thoughtCooldown: 0
  };

  // --- Level Definitions ---
  // Route: Pategaon → Paithan → Dhorkin → Bidkin → Kanchanwadi → Aurangabad
  const levels = [
    { name: 'Pategaon',      speedMult: 1.0 },
    { name: 'Paithan',       speedMult: 1.1 },
    { name: 'Dhorkin',       speedMult: 1.2 },
    { name: 'Bidkin',        speedMult: 1.25 },
    { name: 'Kanchanwadi',   speedMult: 1.15 },
    { name: 'Aurangabad',    speedMult: 1.1 }
  ];

  // --- Villain Definitions ---
  const villains = [
    {
      id: 0,
      name: "ARYA'S BROTHER (Adi)",
      label: "ARYA'S BROTHER (ADI)",
      level: 5,          // Aurangabad
      triggerProgress: 0.25,
      health: 7,
      attackInterval: 1.2,
      projectile: 'cricket_ball',
      preConvo: [
        { speaker: 'villain', text: "Hey! Where do you think you're going?!" },
        { speaker: 'prasad',  text: "Adi! Let me pass, I need to see Arya!" },
        { speaker: 'villain', text: "My sister? On her birthday? No way, bro!" },
        { speaker: 'prasad',  text: "Come on man, don't do this..." },
        { speaker: 'villain', text: "You'll have to get past me first!" }
      ],
      postConvo: [
        { speaker: 'villain', text: "Okay okay... you win. Go!" },
        { speaker: 'prasad',  text: "Thanks Adi! You're the best!" },
        { speaker: 'villain', text: "Just make her happy, idiot!" }
      ]
    },
    {
      id: 1,
      name: "ARYA'S MOTHER",
      label: "ARYA'S MOTHER",
      level: 5,          // Aurangabad
      triggerProgress: 0.5,
      health: 10,
      attackInterval: 0.9,
      projectile: 'rolling_pin',
      preConvo: [
        { speaker: 'villain', text: "And where are YOU going at this hour?!" },
        { speaker: 'prasad',  text: "Aunty! Please, I need to see Arya!" },
        { speaker: 'villain', text: "It's almost midnight! Decent boys stay home!" },
        { speaker: 'prasad',  text: "But it's her birthday! I promised!" },
        { speaker: 'villain', text: "Hmph! Over my rolling pin!" }
      ],
      postConvo: [
        { speaker: 'villain', text: "...you really do care about her." },
        { speaker: 'prasad',  text: "More than anything, aunty!" },
        { speaker: 'villain', text: "Fine. But bring her home by 1 AM!" }
      ]
    },
    {
      id: 2,
      name: "ARYA'S FATHER",
      label: "ARYA'S FATHER",
      level: 5,          // Aurangabad
      triggerProgress: 0.75,
      health: 15,
      attackInterval: 0.6,
      projectile: 'chappal',
      preConvo: [
        { speaker: 'villain', text: "STOP RIGHT THERE!" },
        { speaker: 'prasad',  text: "Uncle... please..." },
        { speaker: 'villain', text: "You think you can see my daughter?!" },
        { speaker: 'prasad',  text: "I crossed 6 cities to be here!" },
        { speaker: 'villain', text: "Then you'll cross ME too! Come on!" }
      ],
      postConvo: [
        { speaker: 'villain', text: "...you've got guts, I'll give you that." },
        { speaker: 'prasad',  text: "I love her, uncle. I really do." },
        { speaker: 'villain', text: "Fine... go. Make her smile." }
      ]
    }
  ];

  // --- Player Object ---
  const player = {
    x: 120,
    y: GROUND_Y,
    w: 40,
    h: 60,
    vy: 0,
    gravity: 0.65,
    jumpForce: -13,
    jumpCutMultiplier: 0.4,  // release jump early = short hop
    isGrounded: true,
    jumpsLeft: 2,
    maxJumps: 2,
    coyoteTime: 0,           // frames left to still jump after leaving ground
    coyoteMax: 5,             // grace frames
    state: 'run',             // run, jump, slide, hit, daze
    slideTimer: 0,
    slideDuration: 30,        // frames
    hitTimer: 0,
    hitDuration: 40,          // frames of knockback/stun
    hitBounceVy: -6,          // small upward bounce on hit
    dazeTimer: 0,
    dazeTapCount: 0,
    dazeTapsNeeded: 5,        // taps to break out of daze
    animFrame: 0,
    animTimer: 0
  };

  // --- Input State ---
  const input = {
    jumpPressed: false,
    slidePressed: false,
    jumpJustPressed: false,
    slideJustPressed: false,
    pauseJustPressed: false,
    anyKeyPressed: false
  };

  // Raw key tracking for edge detection
  const keysDown = {};

  // --- Input Handlers ---
  function onKeyDown(e) {
    if (keysDown[e.code]) return; // ignore repeats
    keysDown[e.code] = true;

    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      input.jumpPressed = true;
      input.jumpJustPressed = true;
      e.preventDefault();
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      input.slidePressed = true;
      input.slideJustPressed = true;
      e.preventDefault();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      input.pauseJustPressed = true;
    }
    input.anyKeyPressed = true;
  }

  function onKeyUp(e) {
    keysDown[e.code] = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      input.jumpPressed = false;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      input.slidePressed = false;
    }
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // --- Mobile Touch Controls ---
  const btnJump = document.getElementById('btnJump');
  const btnSlide = document.getElementById('btnSlide');

  if (btnJump) {
    btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      input.jumpPressed = true;
      input.jumpJustPressed = true;
      input.anyKeyPressed = true;
    });
    btnJump.addEventListener('touchend', (e) => {
      e.preventDefault();
      input.jumpPressed = false;
    });
  }

  if (btnSlide) {
    btnSlide.addEventListener('touchstart', (e) => {
      e.preventDefault();
      input.slidePressed = true;
      input.slideJustPressed = true;
      input.anyKeyPressed = true;
    });
    btnSlide.addEventListener('touchend', (e) => {
      e.preventDefault();
      input.slidePressed = false;
    });
  }

  // Canvas click for menus
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchend', onCanvasTouch);

  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleMenuClick(mx, my);
  }

  function onCanvasTouch(e) {
    if (e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (t.clientX - rect.left) * scaleX;
    const my = (t.clientY - rect.top) * scaleY;
    handleMenuClick(mx, my);
  }

  // --- Menu Button Handling ---
  // Buttons are defined as {x, y, w, h, action} during rendering
  let menuButtons = [];

  function handleMenuClick(mx, my) {
    for (const btn of menuButtons) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        btn.action();
        return;
      }
    }
    // Clicking anywhere on title screen starts game
    if (game.state === State.TITLE) {
      startGame();
    }
  }

  // --- Game Actions ---
  // --- Auto-Play Mode ---
  let autoPlay = false;

  function startAutoPlay() {
    startGame();
    autoPlay = true; // set AFTER startGame which resets it
    // Don't skip intro — let mom scene play
  }

  function runAutoPlay() {
    const p = player;

    // Make auto-play invincible so it always wins
    game.invincible = true;
    game.invincibleTimer = 1;
    game.health = game.maxHealth;

    // Daze — mash to break free
    if (p.state === 'daze') {
      input.jumpJustPressed = true;
      input.slideJustPressed = true;
      return;
    }

    // Don't act during hit stun
    if (p.state === 'hit') return;

    // Scale look-ahead with speed
    const lookAhead = 80 + game.speed * 18;
    let nearestGround = null;
    let nearestAir = null;
    let nearestGroundDist = Infinity;
    let nearestAirDist = Infinity;

    // Find nearest threats
    for (const obs of game.obstacles) {
      const dist = obs.x - (p.x + p.w);
      if (dist > -5 && dist < lookAhead) {
        if (obs.type === 'air') {
          if (dist < nearestAirDist) {
            nearestAirDist = dist;
            nearestAir = obs;
          }
        } else {
          if (dist < nearestGroundDist) {
            nearestGroundDist = dist;
            nearestGround = obs;
          }
        }
      }
    }

    // Reaction zone — tighter = more precise timing
    const jumpZone = 40 + game.speed * 10;
    const slideZone = 40 + game.speed * 12;

    // Priority: slide for air obstacles, jump for ground ones
    // If both are close, prioritize whichever is nearer
    if (nearestAir && nearestAirDist < slideZone) {
      // Need to slide — only if grounded and not already sliding
      if (p.isGrounded && p.state !== 'slide' && !p.vy) {
        input.slideJustPressed = true;
        input.slidePressed = true;
        return;
      }
    }

    if (nearestGround && nearestGroundDist < jumpZone) {
      // Need to jump — only if we can
      if (p.state !== 'slide' && p.jumpsLeft > 0) {
        input.jumpJustPressed = true;
        return;
      }
    }

    // Villain fight — keep jumping to stomp
    if (game.villainActive && game.villainPhase === 2) {
      if (p.jumpsLeft > 0) {
        input.jumpJustPressed = true;
      }
      return;
    }
    // During villain convo or approach, do nothing
    if (game.villainActive && game.villainPhase < 2) {
      return;
    }

    // Collect high items by jumping
    for (const c of game.collectibles) {
      const dist = c.x - (p.x + p.w);
      if (dist > 10 && dist < jumpZone && c.y < GROUND_Y - 50 && p.isGrounded) {
        input.jumpJustPressed = true;
        return;
      }
    }
  }

  // --- Intro Cutscene: Prasad's Mom conversation ---
  const introConvo = [
    { speaker: 'prasad', text: "Wait... 12 AM... IT'S HER BIRTHDAY!" },
    { speaker: 'prasad', text: "I have to wish her before anyone else!" },
    { speaker: 'prasad', text: "If someone else wishes her first... she'll kill me!" },
    { speaker: 'mom',    text: "Prasad! Where are you going at this hour?!" },
    { speaker: 'prasad', text: "Uh... just stepping out for a bit, Aai!" },
    { speaker: 'mom',    text: "Stepping out? It's midnight!" },
    { speaker: 'prasad', text: "I... need some fresh air!" },
    { speaker: 'mom',    text: "Fresh air?! You never go for walks!" },
    { speaker: 'prasad', text: "I need to buy... medicine! Headache!" },
    { speaker: 'mom',    text: "Medicine? At midnight? Everything is closed!" },
    { speaker: 'prasad', text: "24-hour shop! Near the highway! Bye Aai!" },
    { speaker: 'mom',    text: "PRASAD!! Come back here—!" },
    { speaker: 'prasad', text: "(I have to reach Arya before anyone else!)" }
  ];

  const intro = {
    convoIndex: 0,
    convoTimer: 0,
    phase: 0,       // 0=conversation, 1=prasad runs off, 2=done
    runTimer: 0,
    prasadX: 0,
    momX: 0
  };

  function startIntro() {
    intro.convoIndex = 0;
    intro.convoTimer = 0;
    intro.phase = 0;
    intro.runTimer = 0;
    intro.prasadX = W / 2 - 80;
    intro.momX = W / 2 + 30;
  }

  function updateIntro(dt) {
    game.frameCount++;

    if (intro.phase === 0) {
      // Conversation phase
      intro.convoTimer += dt;
      if (intro.convoTimer > 4.0) {
        intro.convoTimer = 0;
        intro.convoIndex++;
        if (intro.convoIndex >= introConvo.length) {
          intro.phase = 1;
          intro.runTimer = 0;
        }
      }
    } else if (intro.phase === 1) {
      // Prasad runs off screen to the right
      intro.prasadX += 4;
      intro.runTimer += dt;
      if (intro.runTimer > 2) {
        intro.phase = 2;
        // Actually start the game
        beginGameplay();
      }
    }
  }

  function renderIntro() {
    // Night background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0520');
    grad.addColorStop(0.6, '#1a0a3a');
    grad.addColorStop(1, '#251540');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 50) % W;
      const sy = (i * 97 + 20) % (H * 0.5);
      ctx.globalAlpha = 0.2 + Math.sin(game.frameCount * 0.03 + i) * 0.2;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // House — simple silhouette with door
    ctx.fillStyle = '#1a1228';
    ctx.fillRect(W / 2 - 120, GROUND_Y - 120, 240, 120);
    // Roof
    ctx.fillStyle = '#251838';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 130, GROUND_Y - 120);
    ctx.lineTo(W / 2, GROUND_Y - 170);
    ctx.lineTo(W / 2 + 130, GROUND_Y - 120);
    ctx.closePath();
    ctx.fill();
    // Door (open, light spilling out)
    ctx.fillStyle = '#443320';
    ctx.fillRect(W / 2 - 15, GROUND_Y - 55, 30, 55);
    ctx.fillStyle = 'rgba(255,200,100,0.15)';
    ctx.fillRect(W / 2 - 13, GROUND_Y - 53, 26, 53);
    // Windows with warm light
    ctx.fillStyle = 'rgba(255,200,100,0.4)';
    ctx.fillRect(W / 2 - 90, GROUND_Y - 100, 30, 25);
    ctx.fillRect(W / 2 + 60, GROUND_Y - 100, 30, 25);
    // Window glow
    ctx.fillStyle = 'rgba(255,200,100,0.06)';
    ctx.fillRect(W / 2 - 95, GROUND_Y - 105, 40, 35);
    ctx.fillRect(W / 2 + 55, GROUND_Y - 105, 40, 35);
    // Ground
    ctx.fillStyle = '#151020';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // Draw Prasad's Mom — appears from convo line 3 onward (when she hears him)
    if (intro.convoIndex >= 3 || intro.phase >= 1) {
      drawPrasadMom(intro.momX, GROUND_Y);
      drawNpcLabel(intro.momX, GROUND_Y - 78, 'AAI (Mom)');
    }

    // Draw Prasad
    const walkFrame = intro.phase === 1 ? Math.floor(game.frameCount / 6) % 4 : 0;
    drawPrasad(intro.prasadX, GROUND_Y, intro.phase === 1 ? 'run' : 'run', walkFrame);
    // Prasad label
    drawNpcLabel(intro.prasadX, GROUND_Y - 75, 'PRASAD');

    // Conversation bubble
    if (intro.phase === 0 && intro.convoIndex < introConvo.length) {
      const d = introConvo[intro.convoIndex];
      const fadeIn = Math.min(intro.convoTimer / 0.3, 1);
      ctx.globalAlpha = fadeIn;
      if (d.speaker === 'prasad') {
        drawSpeechBubble(intro.prasadX, GROUND_Y - 80, d.text, 'left');
      } else {
        drawSpeechBubble(intro.momX, GROUND_Y - 85, d.text, 'right');
      }
      ctx.globalAlpha = 1;
    }

    // Mom yelling as Prasad runs
    if (intro.phase === 1 && intro.runTimer < 1.5) {
      ctx.globalAlpha = Math.max(0, 1 - intro.runTimer / 1.5);
      drawSpeechBubble(intro.momX, GROUND_Y - 85, 'PRASAD!! Come back!', 'right');
      ctx.globalAlpha = 1;
    }

    // Clock display
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 60, 12, 120, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('12:00 AM', W / 2, 30);

    // Location text
    ctx.fillStyle = '#888';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('Pategaon — Home', W / 2, H - 15);

    // "Her Birthday!" flashing text (first 3 lines)
    if (intro.convoIndex < 3 && intro.phase === 0) {
      var bFlash = 0.6 + Math.sin(game.frameCount * 0.1) * 0.4;
      ctx.fillStyle = 'rgba(255,105,180,' + bFlash + ')';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.fillText("It's Arya's Birthday!", W / 2, 60);
    }
  }

  // Prasad's Mom — home saree, concerned look, hands on hips
  function drawPrasadMom(x, groundY) {
    ctx.save();
    ctx.translate(x, groundY);

    // Legs / lower saree
    ctx.fillStyle = '#4a7a5a';
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.lineTo(10, -5);
    ctx.closePath();
    ctx.fill();

    // Feet — small sandals
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(-8, -2, 7, 4);
    ctx.fillRect(2, -2, 7, 4);

    // Body — saree blouse
    ctx.fillStyle = '#4a7a5a';
    ctx.beginPath(); roundRect(ctx, -12, -38, 24, 35, 4); ctx.fill();
    ctx.strokeStyle = '#3a6a4a';
    ctx.lineWidth = 2;
    ctx.beginPath(); roundRect(ctx, -12, -38, 24, 35, 4); ctx.stroke();

    // Saree border (gold)
    ctx.fillStyle = '#d4aa00';
    ctx.fillRect(-12, -38, 24, 3);
    ctx.fillRect(-12, -6, 24, 2);

    // Pallu over shoulder
    ctx.fillStyle = 'rgba(74,122,90,0.6)';
    ctx.beginPath();
    ctx.moveTo(8, -36);
    ctx.quadraticCurveTo(18, -25, 14, -5);
    ctx.lineTo(11, -5);
    ctx.quadraticCurveTo(15, -25, 7, -34);
    ctx.closePath();
    ctx.fill();

    // Arms — hands on hips (scolding pose)
    ctx.fillStyle = '#c68642';
    // Left arm on hip
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.lineTo(-18, -20);
    ctx.lineTo(-16, -12);
    ctx.lineTo(-12, -15);
    ctx.closePath();
    ctx.fill();
    // Right arm on hip
    ctx.beginPath();
    ctx.moveTo(12, -30);
    ctx.lineTo(18, -20);
    ctx.lineTo(16, -12);
    ctx.lineTo(12, -15);
    ctx.closePath();
    ctx.fill();
    // Hands
    ctx.beginPath(); ctx.arc(-17, -12, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(17, -12, 3, 0, Math.PI * 2); ctx.fill();

    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.ellipse(0, -50, 13, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -50, 13, 14, 0, 0, Math.PI * 2); ctx.stroke();

    // Hair — loose bun (night time)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -58, 12, 7, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -63, 6, 0, Math.PI * 2); ctx.fill();
    // Side hair
    ctx.fillRect(-13, -55, 3, 12);
    ctx.fillRect(10, -55, 3, 12);

    // Bindi
    ctx.fillStyle = '#ff2222';
    ctx.beginPath(); ctx.arc(0, -58, 2, 0, Math.PI * 2); ctx.fill();

    // Eyes — big, concerned/suspicious
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -50, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -50, 4.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath(); ctx.arc(-5, -49, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -49, 2.5, 0, Math.PI * 2); ctx.fill();
    // Eye shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-6, -51, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -51, 1.2, 0, Math.PI * 2); ctx.fill();
    // Eye outlines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(-5, -50, 4.5, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(5, -50, 4.5, 5, 0, 0, Math.PI * 2); ctx.stroke();

    // Eyebrows — raised, suspicious
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-9, -56); ctx.quadraticCurveTo(-5, -59, -1, -56); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9, -56); ctx.quadraticCurveTo(5, -59, 1, -56); ctx.stroke();

    // Nose
    ctx.fillStyle = '#b0723a';
    ctx.beginPath(); ctx.ellipse(0, -45, 1.5, 1, 0, 0, Math.PI); ctx.fill();

    // Mouth — open, scolding
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -42, 3.5, 2.5, 0, 0, Math.PI); ctx.stroke();
    ctx.fillStyle = '#8b5e3c';
    ctx.beginPath(); ctx.ellipse(0, -42, 2, 1, 0, 0, Math.PI); ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(255,100,120,0.2)';
    ctx.beginPath(); ctx.ellipse(-8, -46, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -46, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function startGame() {
    autoPlay = false;
    game.state = State.INTRO_CUTSCENE;
    startIntro();
    // Reset all game state ahead of time
    game.frameCount = 0;
    game.score = 0;
    game.distance = 0;
    game.level = 0;
    game.levelDistance = 0;
    game.speed = game.baseSpeed * levels[0].speedMult;
    game.health = game.maxHealth;
    game.loveMeter = 0;
    game.countdownRemaining = game.countdownTotal;
    game.shieldActive = false;
    game.dazeActive = false;
    game.invincible = false;
    game.loveBurstActive = false;
    game.loveBurstTimer = 0;
    game.screenShake = 0;
    game.finalStretch = false;
    game.villainActive = false;
    game.villainId = -1;
    game.villainX = 0;
    game.villainHealth = 0;
    game.villainAttackTimer = 0;
    game.villainPhase = 0;
    game.villainConvoIndex = 0;
    game.villainConvoTimer = 0;
    game.villainDefeatedWalkTimer = 0;
    game.villainStompCooldown = 0;
    game.villainsDefeated = [false, false, false];
    game.thoughtText = '';
    game.thoughtTimer = 0;
    game.thoughtIndex = 0;
    game.thoughtCooldown = 5; // initial delay before first thought
    game.obstacles = [];
    game.collectibles = [];
    game.particles = [];
    game.frameCount = 0;
    game.accumulatedTime = 0;
    resetParallaxOffsets();
    resetObstacleSpawner();
    resetCollectibleSpawner();

    player.y = GROUND_Y;
    player.vy = 0;
    player.isGrounded = true;
    player.jumpsLeft = player.maxJumps;
    player.coyoteTime = 0;
    player.state = 'run';
    player.h = 60;
    player.slideTimer = 0;
    player.hitTimer = 0;
    player.dazeTimer = 0;
    player.dazeTapCount = 0;
    player.animFrame = 0;
  }

  function beginGameplay() {
    game.state = State.PLAYING;
    game.lastTimestamp = performance.now();
    game.accumulatedTime = 0;
  }

  function pauseGame() {
    if (game.state === State.PLAYING) {
      game.state = State.PAUSED;
    }
  }

  function resumeGame() {
    if (game.state === State.PAUSED) {
      game.state = State.PLAYING;
      game.lastTimestamp = performance.now();
    }
  }

  function gameOver() {
    game.state = State.GAME_OVER;
    sfx.gameOver();
  }

  // --- Victory Cutscene ---
  const cutscene = {
    phase: 0,
    timer: 0,
    prasadX: 0,
    aryaX: 0,
    fatherX: 0,
    fatherAlpha: 1,
    dialogueIndex: -1,
    dialogueTimer: 0,
    showPlayAgain: false
  };

  const dialogues = [
    { speaker: 'prasad', text: 'ARYA!! Happy Birthday!!' },
    { speaker: 'arya',   text: 'Prasad?! You came all the way here?!' },
    { speaker: 'prasad', text: "I had to wish you first! Before anyone!" },
    { speaker: 'arya',   text: "You're the first one... at 12 AM!" },
    { speaker: 'prasad', text: 'I ran through 6 cities for this!' },
    { speaker: 'arya',   text: "You idiot... you beautiful idiot..." }
  ];

  function victory() {
    game.state = State.VICTORY_CUTSCENE;
    // Setup cutscene positions
    cutscene.phase = 0; // 0=walk forward + father fades, 1=arya enters, 2=dialogues, 3=kiss, 4=done
    cutscene.timer = 0;
    cutscene.prasadX = player.x + player.w / 2;
    cutscene.fatherX = game.villainX > 0 ? game.villainX : cutscene.prasadX + 80;
    cutscene.fatherAlpha = 1;
    cutscene.aryaX = W + 50; // offscreen right
    cutscene.dialogueIndex = -1;
    cutscene.dialogueTimer = 0;
    cutscene.showPlayAgain = false;
    sfx.levelUp();
  }

  // --- Clear Input Edges (call at end of each frame) ---
  function clearInputEdges() {
    input.jumpJustPressed = false;
    input.slideJustPressed = false;
    input.pauseJustPressed = false;
    input.anyKeyPressed = false;
  }

  // --- Update ---
  function update(dt) {
    game.frameCount++;

    switch (game.state) {
      case State.TITLE:
        // Title screen waits for input
        break;

      case State.PLAYING:
        updatePlaying(dt);
        break;

      case State.PAUSED:
        if (input.pauseJustPressed) resumeGame();
        break;

      case State.LEVEL_TRANSITION:
        game.transitionTimer -= dt;
        if (game.transitionTimer <= 0) {
          game.state = State.PLAYING;
        }
        break;

      case State.GAME_OVER:
      case State.VICTORY:
        // Wait for restart click
        break;

      case State.INTRO_CUTSCENE:
        updateIntro(dt);
        break;

      case State.VICTORY_CUTSCENE:
        updateCutscene(dt);
        break;
    }
  }

  function updatePlaying(dt) {
    // Pause check
    if (input.pauseJustPressed) {
      pauseGame();
      return;
    }

    // --- Auto-Play AI ---
    if (autoPlay) {
      runAutoPlay();
    }

    // --- Countdown Timer ---
    game.countdownRemaining -= dt;
    if (game.countdownRemaining <= 0) {
      game.countdownRemaining = 0;
      gameOver();
      return;
    }

    // --- Player State Machine ---
    updatePlayer(dt);

    // --- Distance & Level Progression ---
    game.distance += game.speed * dt * 60;
    game.levelDistance += game.speed * dt * 60;

    // Gradual speed ramp within each level (up to 20% faster at end)
    const levelProgress = game.levelDistance / game.levelLength;
    const rampMult = 1 + levelProgress * 0.2;
    game.speed = game.baseSpeed * levels[game.level].speedMult * rampMult;

    // Final stretch flag (last 15% of level)
    game.finalStretch = levelProgress > 0.85;

    // --- Villain encounters ---
    for (let vi = 0; vi < villains.length; vi++) {
      const v = villains[vi];
      if (game.level === v.level && !game.villainActive && !game.villainsDefeated[vi] && levelProgress > v.triggerProgress) {
        game.villainActive = true;
        game.villainId = vi;
        game.villainPhase = 0; // approaching
        game.villainX = W + 50;
        game.villainHealth = v.health;
        game.villainMaxHealth = v.health;
        game.villainAttackTimer = 2;
        game.villainConvoIndex = 0;
        game.villainConvoTimer = 0;
        game.villainDefeatedWalkTimer = 0;
        game.villainStompCooldown = 0;
        break;
      }
    }
    if (game.villainActive) {
      updateVillain(dt);
    }

    // Check if current level has any villain that must be defeated
    const levelNeedsVillain = villains.some(function (v) {
      return v.level === game.level && !game.villainsDefeated[v.id];
    });

    if (game.levelDistance >= game.levelLength) {
      if (levelNeedsVillain) {
        game.levelDistance = game.levelLength - 1;
        // DON'T return — let rest of update run
      } else {
        game.levelDistance = 0;
        game.level++;
        game.finalStretch = false;
        if (game.level >= game.totalLevels) {
          victory();
          spawnParticle(W / 2, H / 2, 'firework', 30);
          return;
        }
        game.speed = game.baseSpeed * levels[game.level].speedMult;
        game.state = State.LEVEL_TRANSITION;
        game.transitionTimer = game.transitionDuration;
        game.obstacles = [];
        game.collectibles = [];
        resetParallaxOffsets();
        sfx.levelUp();
        // Reset thoughts for new level
        game.thoughtIndex = 0;
        game.thoughtTimer = 0;
        game.thoughtCooldown = 3;
        return;
      }
    }

    // --- Parallax scroll ---
    updateParallax(dt);

    // --- Score ---
    game.score += Math.round(game.speed * dt * 10);

    // --- Obstacles ---
    updateObstacles(dt);

    // --- Collectibles ---
    updateCollectibles(dt);

    // --- Particles ---
    updateParticles(dt);

    // Running dust (every ~10 frames while grounded)
    if (player.isGrounded && player.state === 'run' && game.frameCount % 10 === 0) {
      spawnParticle(player.x + player.w / 2, GROUND_Y, 'dust', 2);
    }

    // Sweat drops when speed is high
    if (game.speed > game.baseSpeed * 1.2 && game.frameCount % 20 === 0) {
      spawnParticle(player.x + player.w / 2, player.y - player.h + 10, 'sweat', 1);
    }

    // Kanchanwadi level petals (ambient)
    if (game.level === 4 && game.frameCount % 40 === 0) {
      spawnParticle(W + 10, Math.random() * GROUND_Y * 0.6, 'petal', 1);
    }

    // --- Love Burst (love meter full → burst of invincibility + speed) ---
    if (game.loveMeter >= game.maxLoveMeter && !game.loveBurstActive) {
      game.loveBurstActive = true;
      game.loveBurstTimer = 5; // 5 seconds
      game.invincible = true;
      game.invincibleTimer = 5;
      game.loveMeter = 0;
      spawnParticle(player.x + player.w / 2, player.y - player.h / 2, 'heartParticle', 15);
      spawnParticle(player.x + player.w / 2, player.y - player.h / 2, 'sparkle', 10);
      sfx.victory(); // celebratory sound
    }
    if (game.loveBurstActive) {
      game.loveBurstTimer -= dt;
      // Emit hearts while active
      if (game.frameCount % 8 === 0) {
        spawnParticle(player.x + player.w / 2, player.y - player.h / 2, 'heartParticle', 2);
      }
      if (game.loveBurstTimer <= 0) {
        game.loveBurstActive = false;
      }
    }

    // --- Difficulty ramp with overall time elapsed ---
    const timeElapsed = game.countdownTotal - game.countdownRemaining;
    const difficultyMult = 1 + timeElapsed / game.countdownTotal * 0.3; // up to 30% harder
    obstacleSpawner.baseInterval = 1.2 / difficultyMult;

    // --- Prasad's thoughts about Arya ---
    updateThoughts(dt);

    // --- Timer warning beeps (last 30 seconds, every 2 seconds) ---
    if (game.countdownRemaining < 30) {
      const warnSec = Math.floor(game.countdownRemaining / 2);
      if (warnSec !== lastWarningSecond && warnSec >= 0) {
        lastWarningSecond = warnSec;
        sfx.timerWarning();
      }
    }

    // --- Timers ---
    if (game.invincible) {
      game.invincibleTimer -= dt;
      if (game.invincibleTimer <= 0) game.invincible = false;
    }
    if (game.shieldActive) {
      game.shieldTimer -= dt;
      if (game.shieldTimer <= 0) game.shieldActive = false;
    }
  }

  // ============================================================
  // Obstacle System
  // ============================================================

  // Obstacle types per level — each has: name, w, h, y (relative to ground), type
  // type: 'ground' = jump over, 'air' = slide under, 'tall' = must slide (fills jump space)
  const obstaclePool = [
    // Level 0: Pategaon (small village — rural obstacles)
    [
      { name: 'barrier',     w: 35, h: 40, yOff: 0,  type: 'ground' },
      { name: 'luggage',     w: 45, h: 30, yOff: 0,  type: 'ground' },
      { name: 'cow',         w: 60, h: 45, yOff: 0,  type: 'ground' },
      { name: 'signboard',   w: 40, h: 30, yOff: 45, type: 'air' },
      { name: 'flower_pot',  w: 28, h: 30, yOff: 0,  type: 'ground' }
    ],
    // Level 1: Paithan (historic town — temple town vibes)
    [
      { name: 'rickshaw',    w: 70, h: 50, yOff: 0,  type: 'ground' },
      { name: 'vendor_cart', w: 55, h: 40, yOff: 0,  type: 'ground' },
      { name: 'banner',      w: 50, h: 25, yOff: 50, type: 'air' },
      { name: 'cow',         w: 60, h: 45, yOff: 0,  type: 'ground' },
      { name: 'stray_dog',   w: 35, h: 28, yOff: 0,  type: 'ground' }
    ],
    // Level 2: Dhorkin (highway stretch)
    [
      { name: 'cone',        w: 25, h: 35, yOff: 0,  type: 'ground' },
      { name: 'tire',        w: 30, h: 30, yOff: 0,  type: 'ground' },
      { name: 'truck',       w: 80, h: 55, yOff: 0,  type: 'ground' },
      { name: 'low_sign',    w: 60, h: 25, yOff: 40, type: 'air' },
      { name: 'barrel',      w: 30, h: 38, yOff: 0,  type: 'ground' }
    ],
    // Level 3: Bidkin (industrial outskirts)
    [
      { name: 'barrel',      w: 30, h: 38, yOff: 0,  type: 'ground' },
      { name: 'cone',        w: 25, h: 35, yOff: 0,  type: 'ground' },
      { name: 'pothole',     w: 40, h: 15, yOff: 0,  type: 'ground' },
      { name: 'scooter',     w: 50, h: 42, yOff: 0,  type: 'ground' },
      { name: 'low_sign',    w: 60, h: 25, yOff: 40, type: 'air' }
    ],
    // Level 4: Kanchanwadi (approaching city — park/residential)
    [
      { name: 'bench',       w: 55, h: 32, yOff: 0,  type: 'ground' },
      { name: 'bush',        w: 45, h: 30, yOff: 0,  type: 'ground' },
      { name: 'low_branch',  w: 55, h: 20, yOff: 50, type: 'air' },
      { name: 'gate',        w: 40, h: 55, yOff: 0,  type: 'ground' },
      { name: 'flower_pot',  w: 28, h: 30, yOff: 0,  type: 'ground' }
    ],
    // Level 5: Aurangabad (city + boss encounter)
    [
      { name: 'vendor_cart', w: 55, h: 40, yOff: 0,  type: 'ground' },
      { name: 'rickshaw',    w: 70, h: 50, yOff: 0,  type: 'ground' },
      { name: 'banner',      w: 50, h: 25, yOff: 50, type: 'air' },
      { name: 'scooter',     w: 50, h: 42, yOff: 0,  type: 'ground' },
      { name: 'barrier',     w: 35, h: 40, yOff: 0,  type: 'ground' }
    ]
  ];

  // Spawning state
  const obstacleSpawner = {
    timer: 0,
    minGap: 80,       // minimum distance in pixels between obstacles
    baseInterval: 1.2, // seconds between spawns (adjusted by speed)
    lastSpawnX: -999
  };

  function resetObstacleSpawner() {
    obstacleSpawner.timer = 1.5; // initial delay before first obstacle
    obstacleSpawner.lastSpawnX = -999;
  }

  function updateObstacles(dt) {
    const spd = game.speed;

    // --- Spawn new obstacles ---
    obstacleSpawner.timer -= dt;
    if (obstacleSpawner.timer <= 0) {
      spawnObstacle();
      // Interval decreases slightly with speed, with randomness
      const interval = obstacleSpawner.baseInterval / (spd / game.baseSpeed);
      obstacleSpawner.timer = interval * (0.7 + Math.random() * 0.6);
    }

    // --- Move & cull obstacles ---
    for (let i = game.obstacles.length - 1; i >= 0; i--) {
      const obs = game.obstacles[i];
      obs.x -= spd;

      // Remove if off screen left
      if (obs.x + obs.w < -20) {
        game.obstacles.splice(i, 1);
        continue;
      }

      // --- Collision detection ---
      if (!obs.hit) {
        checkObstacleCollision(obs);
      }
    }
  }

  function spawnObstacle() {
    const pool = obstaclePool[game.level] || obstaclePool[0];
    const template = pool[Math.floor(Math.random() * pool.length)];

    // Calculate y position
    let y;
    if (template.type === 'air') {
      y = GROUND_Y - template.yOff - template.h;
    } else {
      y = GROUND_Y - template.h;
    }

    const obs = {
      x: W + 20 + Math.random() * 60,
      y: y,
      w: template.w,
      h: template.h,
      name: template.name,
      type: template.type,
      hit: false
    };

    // Enforce minimum gap from last obstacle
    const lastObs = game.obstacles[game.obstacles.length - 1];
    if (lastObs) {
      const gap = obs.x - (lastObs.x + lastObs.w);
      if (gap < obstacleSpawner.minGap) {
        obs.x = lastObs.x + lastObs.w + obstacleSpawner.minGap + Math.random() * 40;
      }
    }

    game.obstacles.push(obs);
  }

  function checkObstacleCollision(obs) {
    const p = player;
    if (p.state === 'hit' || p.state === 'daze') return;

    // Player hitbox
    const px = p.x;
    const py = p.y - p.h;
    const pw = p.w;
    const ph = p.h;

    // Shrink hitboxes slightly for forgiving collisions
    const shrink = 6;
    const pLeft = px + shrink;
    const pRight = px + pw - shrink;
    const pTop = py + shrink;
    const pBottom = py + ph - shrink / 2;

    const oLeft = obs.x + 4;
    const oRight = obs.x + obs.w - 4;
    const oTop = obs.y + 4;
    const oBottom = obs.y + obs.h - 2;

    // AABB overlap check
    if (pRight > oLeft && pLeft < oRight && pBottom > oTop && pTop < oBottom) {
      obs.hit = true;
      hitPlayer();
    }
  }

  function renderObstacles() {
    for (const obs of game.obstacles) {
      ctx.globalAlpha = obs.hit ? 0.3 : 1;
      const drawFn = obstacleDrawers[obs.name];
      if (drawFn) {
        drawFn(obs.x, obs.y, obs.w, obs.h);
      } else {
        // Fallback
        ctx.fillStyle = '#cc4444';
        ctx.beginPath();
        roundRect(ctx, obs.x, obs.y, obs.w, obs.h, 4);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // --- Obstacle Drawing Functions ---
  const obstacleDrawers = {
    // ============ Level 0: Bus Stand ============
    barrier: function (x, y, w, h) {
      // Queue barrier / railing
      // Poles
      ctx.fillStyle = '#888';
      ctx.fillRect(x + 2, y, 4, h);
      ctx.fillRect(x + w - 6, y, 4, h);
      // Rails
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.3);
      ctx.lineTo(x + w - 4, y + h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.65);
      ctx.lineTo(x + w - 4, y + h * 0.65);
      ctx.stroke();
      // Pole caps
      ctx.fillStyle = '#bbb';
      ctx.beginPath();
      ctx.arc(x + 4, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 4, y, 4, 0, Math.PI * 2);
      ctx.fill();
    },

    luggage: function (x, y, w, h) {
      // Stacked suitcases
      // Bottom suitcase
      ctx.fillStyle = '#6a3a2a';
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 3);
      ctx.fill();
      ctx.strokeStyle = '#4a2a1a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.4, w, h * 0.6, 3);
      ctx.stroke();
      // Buckle straps
      ctx.fillStyle = '#c8a050';
      ctx.fillRect(x + w * 0.3, y + h * 0.4, 2, h * 0.6);
      ctx.fillRect(x + w * 0.65, y + h * 0.4, 2, h * 0.6);
      // Top bag
      ctx.fillStyle = '#4a6a8a';
      ctx.beginPath();
      roundRect(ctx, x + 5, y, w - 12, h * 0.45, 3);
      ctx.fill();
      ctx.strokeStyle = '#3a5a7a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x + 5, y, w - 12, h * 0.45, 3);
      ctx.stroke();
      // Handle
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y, 6, Math.PI, Math.PI * 2);
      ctx.stroke();
    },

    rickshaw: function (x, y, w, h) {
      // Auto-rickshaw
      const bx = x, by = y;
      // Body
      ctx.fillStyle = '#22aa44';
      ctx.beginPath();
      roundRect(ctx, bx + 10, by + 5, w - 15, h - 15, 5);
      ctx.fill();
      ctx.strokeStyle = '#118833';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, bx + 10, by + 5, w - 15, h - 15, 5);
      ctx.stroke();
      // Roof
      ctx.fillStyle = '#118833';
      ctx.beginPath();
      ctx.moveTo(bx + 12, by + 5);
      ctx.lineTo(bx + 20, by - 3);
      ctx.lineTo(bx + w - 10, by - 3);
      ctx.lineTo(bx + w - 5, by + 5);
      ctx.closePath();
      ctx.fill();
      // Windshield
      ctx.fillStyle = 'rgba(150,200,255,0.5)';
      ctx.fillRect(bx + 12, by + 8, 14, 14);
      // Front nose
      ctx.fillStyle = '#22aa44';
      ctx.beginPath();
      ctx.moveTo(bx, by + h - 15);
      ctx.lineTo(bx + 10, by + 10);
      ctx.lineTo(bx + 10, by + h - 10);
      ctx.closePath();
      ctx.fill();
      // Headlight
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(bx + 5, by + h - 18, 3, 0, Math.PI * 2);
      ctx.fill();
      // Wheels
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(bx + 8, by + h - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + w - 12, by + h - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(bx + 8, by + h - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx + w - 12, by + h - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    },

    signboard: function (x, y, w, h) {
      // Hanging signboard (air obstacle)
      // Chains
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 10);
      ctx.lineTo(x + 5, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w - 5, y - 10);
      ctx.lineTo(x + w - 5, y);
      ctx.stroke();
      // Board
      ctx.fillStyle = '#cc8833';
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = '#aa6622';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 3);
      ctx.stroke();
      // Text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CAUTION', x + w / 2, y + h / 2 + 3);
    },

    cow: function (x, y, w, h) {
      // Sitting/standing cow
      // Body
      ctx.fillStyle = '#d4c4a0';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.42, h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a09070';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.42, h * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#d4c4a0';
      ctx.beginPath();
      ctx.ellipse(x + 12, y + h * 0.3, 10, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a09070';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + 12, y + h * 0.3, 10, 9, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      // Horns
      ctx.strokeStyle = '#8a7a60';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + h * 0.2);
      ctx.quadraticCurveTo(x + 2, y, x + 5, y + h * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 16, y + h * 0.2);
      ctx.quadraticCurveTo(x + 22, y, x + 19, y + h * 0.12);
      ctx.stroke();
      // Eye
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + 9, y + h * 0.28, 2, 0, Math.PI * 2);
      ctx.fill();
      // Spots
      ctx.fillStyle = '#b09878';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5, y + h * 0.45, 8, 5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.7, y + h * 0.55, 6, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#c4b490';
      ctx.fillRect(x + 15, y + h * 0.75, 5, h * 0.25);
      ctx.fillRect(x + 25, y + h * 0.75, 5, h * 0.25);
      ctx.fillRect(x + w - 20, y + h * 0.75, 5, h * 0.25);
      ctx.fillRect(x + w - 12, y + h * 0.75, 5, h * 0.25);
    },

    // ============ Level 1: Paithan ============
    vendor_cart: function (x, y, w, h) {
      // Street vendor push-cart
      // Cart body
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(x + 5, y + 8, w - 10, h - 18);
      ctx.strokeStyle = '#5a3a2a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 5, y + 8, w - 10, h - 18);
      // Items on cart (colorful fruits)
      const fruitColors = ['#ff4444', '#ffaa22', '#44cc44', '#ff8844'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = fruitColors[i % fruitColors.length];
        ctx.beginPath();
        ctx.arc(x + 12 + i * 7, y + 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      // Umbrella
      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      ctx.arc(x + w / 2, y, w * 0.45, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#aa2222';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + w / 2, y, w * 0.45, Math.PI, Math.PI * 2);
      ctx.stroke();
      // Umbrella pole
      ctx.fillStyle = '#666';
      ctx.fillRect(x + w / 2 - 1, y, 2, 12);
      // Wheels
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x + 12, y + h - 3, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 12, y + h - 3, 5, 0, Math.PI * 2);
      ctx.fill();
    },

    pothole: function (x, y, w, h) {
      // Road pothole
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Cracked edges
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Cracks radiating out
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 + Math.cos(angle) * w * 0.35, y + h / 2 + Math.sin(angle) * h * 0.35);
        ctx.lineTo(x + w / 2 + Math.cos(angle) * w * 0.6, y + h / 2 + Math.sin(angle) * h * 0.7);
        ctx.stroke();
      }
      // Water puddle highlight
      ctx.fillStyle = 'rgba(100,150,200,0.2)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2 - 3, y + h / 2 - 2, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    banner: function (x, y, w, h) {
      // Low-hanging advertising banner (air obstacle)
      ctx.fillStyle = '#dd3355';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#bb2244';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
      // Banner text
      ctx.fillStyle = '#ffee88';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SALE!', x + w / 2, y + h / 2 + 3);
      // Ropes
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y - 15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w + 5, y - 15);
      ctx.stroke();
      // Tattered bottom edge
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#dd3355';
        ctx.beginPath();
        ctx.moveTo(x + i * (w / 5), y + h);
        ctx.lineTo(x + i * (w / 5) + w / 10, y + h + 5);
        ctx.lineTo(x + (i + 1) * (w / 5), y + h);
        ctx.fill();
      }
    },

    scooter: function (x, y, w, h) {
      // Parked scooter
      // Body
      ctx.fillStyle = '#3366aa';
      ctx.beginPath();
      roundRect(ctx, x + 10, y + 8, w - 18, h * 0.5, 5);
      ctx.fill();
      ctx.strokeStyle = '#2255aa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x + 10, y + 8, w - 18, h * 0.5, 5);
      ctx.stroke();
      // Seat
      ctx.fillStyle = '#333';
      ctx.beginPath();
      roundRect(ctx, x + 14, y + 4, w - 26, 8, 3);
      ctx.fill();
      // Handlebar
      ctx.strokeStyle = '#777';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 6);
      ctx.lineTo(x + 8, y + 14);
      ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.fillRect(x + 3, y + 3, 10, 4);
      // Headlight
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(x + 8, y + 18, 3, 0, Math.PI * 2);
      ctx.fill();
      // Wheels
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + 10, y + h - 5, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 10, y + h - 5, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(x + 10, y + h - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 10, y + h - 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    },

    stray_dog: function (x, y, w, h) {
      // Stray dog
      // Body
      ctx.fillStyle = '#b08050';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.4, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6030';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.4, h * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Head
      ctx.fillStyle = '#b08050';
      ctx.beginPath();
      ctx.ellipse(x + 8, y + h * 0.38, 7, 6, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6030';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x + 8, y + h * 0.38, 7, 6, -0.2, 0, Math.PI * 2);
      ctx.stroke();
      // Ear
      ctx.fillStyle = '#9a7040';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + h * 0.25, 3, 5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Eye
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + 6, y + h * 0.35, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Nose
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x + 2, y + h * 0.38, 1.5, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = '#b08050';
      ctx.fillRect(x + 10, y + h * 0.7, 4, h * 0.3);
      ctx.fillRect(x + 17, y + h * 0.7, 4, h * 0.3);
      ctx.fillRect(x + w - 12, y + h * 0.72, 4, h * 0.28);
      ctx.fillRect(x + w - 7, y + h * 0.72, 4, h * 0.28);
      // Tail
      ctx.strokeStyle = '#b08050';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w - 3, y + h * 0.5);
      ctx.quadraticCurveTo(x + w + 4, y + h * 0.3, x + w + 2, y + h * 0.15);
      ctx.stroke();
    },

    // ============ Level 2: Dhorkin ============
    cone: function (x, y, w, h) {
      // Traffic cone
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 3, y);
      ctx.lineTo(x + 2, y + h);
      ctx.lineTo(x + w - 2, y + h);
      ctx.lineTo(x + w / 2 + 3, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#cc4400';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // White stripes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 5, y + h * 0.35, w - 10, 4);
      ctx.fillRect(x + 3, y + h * 0.6, w - 6, 4);
      // Base
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(x - 1, y + h - 5, w + 2, 5);
      ctx.strokeStyle = '#cc4400';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y + h - 5, w + 2, 5);
      // Top
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + w / 2, y, 3, 0, Math.PI * 2);
      ctx.fill();
    },

    tire: function (x, y, w, h) {
      // Fallen tire on highway
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w * 0.25, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Hub
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w * 0.12, h * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tread lines
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(x + w / 2 + Math.cos(a) * w * 0.28, y + h / 2 + Math.sin(a) * h * 0.28);
        ctx.lineTo(x + w / 2 + Math.cos(a) * w * 0.46, y + h / 2 + Math.sin(a) * h * 0.46);
        ctx.stroke();
      }
    },

    truck: function (x, y, w, h) {
      // Cargo truck (large obstacle)
      // Cargo container
      ctx.fillStyle = '#5a6a7a';
      ctx.beginPath();
      roundRect(ctx, x + 15, y, w - 20, h * 0.65, 3);
      ctx.fill();
      ctx.strokeStyle = '#4a5a6a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, x + 15, y, w - 20, h * 0.65, 3);
      ctx.stroke();
      // Container ridges
      ctx.strokeStyle = '#4a5a6a';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const rx = x + 15 + i * (w - 20) / 4;
        ctx.beginPath();
        ctx.moveTo(rx, y + 2);
        ctx.lineTo(rx, y + h * 0.63);
        ctx.stroke();
      }
      // Cabin
      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.2, 20, h * 0.45, 3);
      ctx.fill();
      ctx.strokeStyle = '#aa2222';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.2, 20, h * 0.45, 3);
      ctx.stroke();
      // Cabin window
      ctx.fillStyle = 'rgba(150,200,255,0.5)';
      ctx.fillRect(x + 3, y + h * 0.24, 14, 12);
      // Bumper
      ctx.fillStyle = '#555';
      ctx.fillRect(x - 2, y + h * 0.6, w + 4, 4);
      // Wheels
      ctx.fillStyle = '#1a1a1a';
      for (const wx of [x + 10, x + 30, x + w - 20, x + w - 8]) {
        ctx.beginPath();
        ctx.arc(wx, y + h - 4, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#444';
      for (const wx of [x + 10, x + 30, x + w - 20, x + w - 8]) {
        ctx.beginPath();
        ctx.arc(wx, y + h - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Headlights
      ctx.fillStyle = '#ffee88';
      ctx.beginPath();
      ctx.arc(x + 2, y + h * 0.55, 3, 0, Math.PI * 2);
      ctx.fill();
    },

    low_sign: function (x, y, w, h) {
      // Low overhead highway sign (air obstacle)
      ctx.fillStyle = '#115522';
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MERGE →', x + w / 2, y + h / 2 + 3);
      // Support bars
      ctx.fillStyle = '#555';
      ctx.fillRect(x + 3, y - 8, 3, 10);
      ctx.fillRect(x + w - 6, y - 8, 3, 10);
    },

    barrel: function (x, y, w, h) {
      // Construction barrel
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.strokeStyle = '#cc6600';
      ctx.lineWidth = 2;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, 4);
      ctx.stroke();
      // White stripes
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 2, y + h * 0.2, w - 4, 5);
      ctx.fillRect(x + 2, y + h * 0.5, w - 4, 5);
      ctx.fillRect(x + 2, y + h * 0.8, w - 4, 5);
      // Rim highlights
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);
    },

    // ============ Level 4: Kanchanwadi ============
    bench: function (x, y, w, h) {
      // Park bench
      // Seat
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.35, w, 7, 2);
      ctx.fill();
      ctx.strokeStyle = '#4a3018';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x, y + h * 0.35, w, 7, 2);
      ctx.stroke();
      // Backrest
      ctx.fillStyle = '#6a4a2a';
      ctx.beginPath();
      roundRect(ctx, x + 3, y, w - 6, 7, 2);
      ctx.fill();
      ctx.strokeStyle = '#4a3018';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x + 3, y, w - 6, 7, 2);
      ctx.stroke();
      // Slats on backrest
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const sx = x + 8 + i * 12;
        ctx.beginPath();
        ctx.moveTo(sx, y + 1);
        ctx.lineTo(sx, y + 6);
        ctx.stroke();
      }
      // Legs (iron)
      ctx.fillStyle = '#444';
      ctx.fillRect(x + 4, y + h * 0.35, 4, h * 0.65);
      ctx.fillRect(x + w - 8, y + h * 0.35, 4, h * 0.65);
      // Armrests
      ctx.fillStyle = '#555';
      ctx.beginPath();
      roundRect(ctx, x + 1, y + 5, 6, h * 0.32, 2);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, x + w - 7, y + 5, 6, h * 0.32, 2);
      ctx.fill();
    },

    bush: function (x, y, w, h) {
      // Decorative bush
      ctx.fillStyle = '#1a5a1a';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.5, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#166616';
      ctx.beginPath();
      ctx.ellipse(x + w * 0.35, y + h * 0.45, w * 0.3, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w * 0.65, y + h * 0.45, w * 0.3, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0e4a0e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.5, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Small flowers
      ctx.fillStyle = '#ff88aa';
      for (let i = 0; i < 4; i++) {
        const fx = x + 8 + i * 10;
        const fy = y + h * 0.3 + (i % 2) * 8;
        ctx.beginPath();
        ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    low_branch: function (x, y, w, h) {
      // Low hanging branch (air obstacle)
      // Branch
      ctx.strokeStyle = '#4a2a10';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y + h / 2);
      ctx.quadraticCurveTo(x + w * 0.4, y + h * 0.3, x + w, y + h * 0.6);
      ctx.stroke();
      ctx.strokeStyle = '#3a1a05';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + h * 0.4);
      ctx.lineTo(x + w * 0.2, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.6, y + h * 0.45);
      ctx.lineTo(x + w * 0.7, y + h);
      ctx.stroke();
      // Leaves clusters
      ctx.fillStyle = '#1a5a1a';
      const leafPos = [[0.15, 0.2], [0.35, 0.15], [0.55, 0.25], [0.75, 0.35], [0.9, 0.45]];
      for (const [lx, ly] of leafPos) {
        ctx.beginPath();
        ctx.ellipse(x + w * lx, y + h * ly, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#166616';
      for (const [lx, ly] of leafPos) {
        ctx.beginPath();
        ctx.ellipse(x + w * lx + 3, y + h * ly + 2, 6, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    flower_pot: function (x, y, w, h) {
      // Decorative flower pot
      // Pot (terracotta)
      ctx.fillStyle = '#cc6633';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h * 0.4);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - 3, y + h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#aa4422';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Pot rim
      ctx.fillStyle = '#dd7744';
      ctx.fillRect(x + 1, y + h * 0.37, w - 2, 5);
      // Soil
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + 4, y + h * 0.4, w - 8, 4);
      // Plant
      ctx.fillStyle = '#228822';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h * 0.2, w * 0.35, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a6a1a';
      ctx.beginPath();
      ctx.ellipse(x + w / 2 - 4, y + h * 0.15, 5, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w / 2 + 4, y + h * 0.15, 5, 6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Flower
      ctx.fillStyle = '#ff5588';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    },

    gate: function (x, y, w, h) {
      // Wrought-iron park gate
      // Posts
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(x, y, 5, h);
      ctx.fillRect(x + w - 5, y, 5, h);
      // Post caps
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(x + 2.5, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + w - 2.5, y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Bars
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) {
        const bx = x + i * (w / 5);
        ctx.beginPath();
        ctx.moveTo(bx, y + 4);
        ctx.lineTo(bx, y + h);
        ctx.stroke();
        // Pointed tops
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.moveTo(bx - 2, y + 6);
        ctx.lineTo(bx, y);
        ctx.lineTo(bx + 2, y + 6);
        ctx.fill();
      }
      // Horizontal rails
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.3);
      ctx.lineTo(x + w - 4, y + h * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h * 0.7);
      ctx.lineTo(x + w - 4, y + h * 0.7);
      ctx.stroke();
      // Decorative scroll at center
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.5, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  // ============================================================
  // Collectibles System
  // ============================================================

  const collectibleTypes = [
    { name: 'heart',      w: 22, h: 22, weight: 30, effect: 'health' },
    { name: 'golden_heart', w: 24, h: 24, weight: 8, effect: 'love' },
    { name: 'coin',       w: 18, h: 18, weight: 40, effect: 'score' },
    { name: 'chai',       w: 20, h: 24, weight: 10, effect: 'boost' },
    { name: 'rose_shield', w: 22, h: 26, weight: 6, effect: 'shield' },
    { name: 'time_bonus', w: 20, h: 20, weight: 8, effect: 'time' }
  ];

  const collectibleSpawner = {
    timer: 0,
    baseInterval: 2.0
  };

  function resetCollectibleSpawner() {
    collectibleSpawner.timer = 2.5;
  }

  function updateCollectibles(dt) {
    // --- Spawn ---
    collectibleSpawner.timer -= dt;
    if (collectibleSpawner.timer <= 0) {
      spawnCollectible();
      collectibleSpawner.timer = collectibleSpawner.baseInterval * (0.6 + Math.random() * 0.8);
    }

    // --- Move & check pickup ---
    for (let i = game.collectibles.length - 1; i >= 0; i--) {
      const c = game.collectibles[i];
      c.x -= game.speed;
      c.animTimer += dt;

      // Off screen
      if (c.x + c.w < -10) {
        game.collectibles.splice(i, 1);
        continue;
      }

      // Pickup detection
      if (!c.collected) {
        checkCollectiblePickup(c, i);
      }
    }
  }

  function spawnCollectible() {
    // Weighted random selection
    const totalWeight = collectibleTypes.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * totalWeight;
    let template = collectibleTypes[0];
    for (const t of collectibleTypes) {
      r -= t.weight;
      if (r <= 0) { template = t; break; }
    }

    // Varied vertical positions — ground level, low air, high air
    const yOptions = [
      GROUND_Y - template.h - 5,             // ground level
      GROUND_Y - template.h - 40,             // low air
      GROUND_Y - template.h - 80              // high air (need jump)
    ];
    const y = yOptions[Math.floor(Math.random() * yOptions.length)];

    game.collectibles.push({
      x: W + 20 + Math.random() * 80,
      y: y,
      w: template.w,
      h: template.h,
      name: template.name,
      effect: template.effect,
      collected: false,
      animTimer: Math.random() * 6 // offset for animation variety
    });
  }

  function checkCollectiblePickup(c, idx) {
    const p = player;
    if (p.state === 'hit') return;

    // Simple overlap (generous hitbox)
    const px = p.x + 4;
    const py = p.y - p.h + 4;
    const pw = p.w - 8;
    const ph = p.h - 8;

    if (px + pw > c.x && px < c.x + c.w && py + ph > c.y && py < c.y + c.h) {
      // Spawn particles based on type
      const pcx = c.x + c.w / 2, pcy = c.y + c.h / 2;
      if (c.effect === 'score') {
        spawnParticle(pcx, pcy, 'coinBurst', 6);
      } else if (c.effect === 'health' || c.effect === 'love') {
        spawnParticle(pcx, pcy, 'heartParticle', 5);
      } else {
        spawnParticle(pcx, pcy, 'sparkle', 8);
      }
      applyCollectibleEffect(c);
      game.collectibles.splice(idx, 1);
    }
  }

  function applyCollectibleEffect(c) {
    switch (c.effect) {
      case 'health':
        game.health = Math.min(game.health + 1, game.maxHealth);
        sfx.heart();
        break;
      case 'love':
        game.loveMeter = Math.min(game.loveMeter + 15, game.maxLoveMeter);
        game.score += 200;
        sfx.heart();
        break;
      case 'score':
        game.score += 100;
        sfx.coin();
        break;
      case 'boost':
        game.speed += 2;
        setTimeout(function () {
          game.speed = game.baseSpeed * levels[game.level].speedMult;
        }, 3000);
        game.score += 50;
        sfx.boost();
        break;
      case 'shield':
        game.shieldActive = true;
        game.shieldTimer = 8;
        sfx.shield();
        break;
      case 'time':
        game.countdownRemaining = Math.min(game.countdownRemaining + 15, game.countdownTotal);
        game.score += 150;
        sfx.timeBonus();
        break;
    }
  }

  function renderCollectibles() {
    for (const c of game.collectibles) {
      const bob = Math.sin(c.animTimer * 3) * 4;
      const drawFn = collectibleDrawers[c.name];
      if (drawFn) {
        drawFn(c.x, c.y + bob, c.w, c.h, c.animTimer);
      }
    }
  }

  // --- Collectible Drawing Functions ---
  const collectibleDrawers = {
    heart: function (x, y, w, h) {
      ctx.fillStyle = '#ff4466';
      ctx.shadowColor = '#ff4466';
      ctx.shadowBlur = 8;
      drawHeart(x + w / 2, y + h / 2, w * 0.45);
      ctx.shadowBlur = 0;
    },

    golden_heart: function (x, y, w, h, t) {
      const glow = 0.7 + Math.sin(t * 4) * 0.3;
      ctx.globalAlpha = glow;
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 12;
      drawHeart(x + w / 2, y + h / 2, w * 0.48);
      ctx.shadowBlur = 0;
      // Inner sparkle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + w * 0.4, y + h * 0.35, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    coin: function (x, y, w, h, t) {
      // Spinning coin illusion
      const squish = Math.abs(Math.cos(t * 3));
      const cw = w * 0.4 * Math.max(squish, 0.15);
      ctx.fillStyle = '#ffcc00';
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, cw, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cc9900';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, cw, h * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // $ symbol when facing forward
      if (squish > 0.5) {
        ctx.fillStyle = '#aa7700';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('₹', x + w / 2, y + h / 2 + 4);
      }
    },

    chai: function (x, y, w, h) {
      // Chai cup
      // Cup body
      ctx.fillStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 8);
      ctx.lineTo(x + 1, y + h);
      ctx.lineTo(x + w - 1, y + h);
      ctx.lineTo(x + w - 3, y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Tea liquid
      ctx.fillStyle = '#cc8844';
      ctx.fillRect(x + 4, y + 10, w - 8, h - 14);
      // Cup rim
      ctx.fillStyle = '#eee';
      ctx.fillRect(x + 1, y + 6, w - 2, 4);
      // Handle
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w + 2, y + h / 2 + 3, 5, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // Steam
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.3, y + 5);
      ctx.quadraticCurveTo(x + w * 0.3 + 3, y - 3, x + w * 0.3 - 2, y - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w * 0.6, y + 5);
      ctx.quadraticCurveTo(x + w * 0.6 - 2, y - 4, x + w * 0.6 + 3, y - 9);
      ctx.stroke();
    },

    rose_shield: function (x, y, w, h, t) {
      // Rose with shield glow
      const pulse = 0.8 + Math.sin(t * 3) * 0.2;
      // Shield glow ring
      ctx.strokeStyle = `rgba(255,105,180,${pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Stem
      ctx.strokeStyle = '#228822';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + h * 0.55);
      ctx.lineTo(x + w / 2, y + h);
      ctx.stroke();
      // Leaves
      ctx.fillStyle = '#228822';
      ctx.beginPath();
      ctx.ellipse(x + w / 2 - 5, y + h * 0.7, 4, 2, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + w / 2 + 5, y + h * 0.8, 4, 2, 0.5, 0, Math.PI * 2);
      ctx.fill();
      // Rose petals
      ctx.fillStyle = '#ff3366';
      const cx = x + w / 2, cy = y + h * 0.35;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 5, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      // Center
      ctx.fillStyle = '#cc1144';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    },

    time_bonus: function (x, y, w, h, t) {
      // Clock / time pickup
      const pulse = 0.8 + Math.sin(t * 4) * 0.2;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#44ddff';
      ctx.shadowBlur = 8 * pulse;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#44ddff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Clock hands
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 1.5;
      const cx = x + w / 2, cy = y + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 4, cy + 1);
      ctx.stroke();
      // +15 label
      ctx.fillStyle = '#44ddff';
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+15s', x + w / 2, y + h + 8);
    }
  };

  // Utility: draw a heart shape at center cx, cy with radius r
  function drawHeart(cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.7);
    ctx.bezierCurveTo(cx - r * 1.2, cy - r * 0.2, cx - r * 0.6, cy - r, cx, cy - r * 0.4);
    ctx.bezierCurveTo(cx + r * 0.6, cy - r, cx + r * 1.2, cy - r * 0.2, cx, cy + r * 0.7);
    ctx.closePath();
    ctx.fill();
  }

  function updatePlayer(dt) {
    const p = player;

    // --- Hit state (knockback stun) ---
    if (p.state === 'hit') {
      p.hitTimer--;
      // Apply gravity during hit bounce
      p.vy += p.gravity;
      p.y += p.vy;
      if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.isGrounded = true;
      }
      if (p.hitTimer <= 0) {
        p.state = 'run';
        p.h = 60;
        p.isGrounded = p.y >= GROUND_Y;
        p.jumpsLeft = p.isGrounded ? p.maxJumps : 0;
      }
      return; // no input during hit
    }

    // --- Daze state (lovestruck — tap to break free) ---
    if (p.state === 'daze') {
      p.dazeTimer--;
      if (input.jumpJustPressed || input.slideJustPressed) {
        p.dazeTapCount++;
      }
      if (p.dazeTapCount >= p.dazeTapsNeeded || p.dazeTimer <= 0) {
        p.state = 'run';
        p.h = 60;
        p.dazeTapCount = 0;
      }
      return; // limited input during daze
    }

    // --- Slide state ---
    if (p.state === 'slide') {
      p.slideTimer--;
      if (p.slideTimer <= 0) {
        p.state = 'run';
        p.h = 60;
      }
    }

    // --- Coyote time (grace frames after walking off edge) ---
    if (p.isGrounded) {
      p.coyoteTime = p.coyoteMax;
    } else {
      if (p.coyoteTime > 0) p.coyoteTime--;
    }

    // --- Jump input ---
    if (input.jumpJustPressed && p.state !== 'slide') {
      const canCoyoteJump = p.coyoteTime > 0 && p.jumpsLeft === p.maxJumps;
      if (p.jumpsLeft > 0 || canCoyoteJump) {
        p.vy = p.jumpForce;
        p.isGrounded = false;
        p.coyoteTime = 0;
        p.jumpsLeft--;
        p.state = 'jump';
        p.h = 60;
        // Sound: first jump vs double jump
        if (p.jumpsLeft === 0) { sfx.doubleJump(); } else { sfx.jump(); }
      }
    }

    // --- Variable jump height (release early = short hop) ---
    if (!input.jumpPressed && p.vy < 0 && p.state === 'jump') {
      p.vy *= p.jumpCutMultiplier;
    }

    // --- Slide input ---
    if (input.slideJustPressed && p.isGrounded && p.state !== 'slide') {
      p.state = 'slide';
      p.slideTimer = p.slideDuration;
      p.h = 35; // shorter hitbox while sliding
      sfx.slide();
    }

    // --- Fast fall (hold down while airborne) ---
    if (input.slidePressed && !p.isGrounded && p.state === 'jump') {
      p.vy += p.gravity * 0.8; // extra downward pull
    }

    // --- Gravity ---
    if (!p.isGrounded) {
      p.vy += p.gravity;
      p.y += p.vy;

      // Land on ground
      if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.isGrounded = true;
        p.jumpsLeft = p.maxJumps;
        if (p.state === 'jump') {
          p.state = 'run';
          spawnParticle(p.x + p.w / 2, GROUND_Y, 'dust', 4);
        }
      }
    }

    // --- Animation timer ---
    p.animTimer += dt;
    if (p.animTimer > 0.1) {
      p.animTimer = 0;
      p.animFrame = (p.animFrame + 1) % 4;
    }
  }

  // Called by collision system when player gets hit
  function hitPlayer() {
    if (game.invincible || player.state === 'hit') return;

    // Shield absorbs the hit
    if (game.shieldActive) {
      game.shieldActive = false;
      game.shieldTimer = 0;
      spawnParticle(player.x + player.w / 2, player.y - player.h / 2, 'sparkle', 12);
      sfx.shield();
      return;
    }

    game.health--;
    player.state = 'hit';
    player.hitTimer = player.hitDuration;
    player.vy = player.hitBounceVy;
    player.isGrounded = false;
    player.h = 60;
    sfx.hit();
    spawnParticle(player.x + player.w / 2, player.y - player.h / 2, 'hitSpark', 10);

    // Screen shake
    game.screenShake = 12; // frames

    // Love meter penalty
    game.loveMeter = Math.max(0, game.loveMeter - 10);

    // Invincibility frames after hit
    game.invincible = true;
    game.invincibleTimer = 1.5; // seconds

    if (game.health <= 0) {
      gameOver();
    }
  }

  // Called when player enters daze (lovestruck by special obstacle)
  function dazePlayer() {
    if (game.invincible || game.shieldActive || player.state === 'hit' || player.state === 'daze') return;
    player.state = 'daze';
    player.dazeTimer = 120; // ~2 seconds at 60fps
    player.dazeTapCount = 0;
    player.h = 60;
    spawnParticle(player.x + player.w / 2, player.y - player.h, 'heartParticle', 5);
  }

  // --- Render ---
  function render() {
    applyCanvasScale();
    ctx.clearRect(0, 0, W, H);
    menuButtons = []; // reset each frame

    switch (game.state) {
      case State.TITLE:
        renderTitle();
        break;
      case State.PLAYING:
      case State.LEVEL_TRANSITION:
        renderGame();
        break;
      case State.PAUSED:
        renderGame();
        renderPauseOverlay();
        break;
      case State.GAME_OVER:
        renderGame();
        renderGameOverOverlay();
        break;
      case State.INTRO_CUTSCENE:
        renderIntro();
        break;
      case State.VICTORY_CUTSCENE:
        renderCutscene();
        break;
      case State.VICTORY:
        renderGame();
        renderVictoryOverlay();
        break;
    }
  }

  // ============================================================
  // Parallax Background System
  // ============================================================
  // Each level defines layers: { speed, draw(offset, layerIndex) }
  // speed is a multiplier of game.speed (0 = static, 1 = foreground speed)
  // offset is the pixel scroll offset for that layer (wraps via tiling)

  const parallax = {
    offsets: []  // per-layer accumulated scroll offsets
  };

  // Background layer definitions per level
  // Route: Pategaon → Paithan → Dhorkin → Bidkin → Kanchanwadi → Aurangabad
  // Each entry: { speed: number, draw: function(offset) }
  const levelBackgrounds = [
    // --- Level 0: Pategaon (village) ---
    (function () {
      // Seeded pseudo-random for consistent decorations
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: Amber sky gradient (static)
        { speed: 0, draw: function () {
          // Sky gradient — warm amber dusk
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#1a0a2e');
          grad.addColorStop(0.25, '#2d1b4e');
          grad.addColorStop(0.5, '#6b2f4a');
          grad.addColorStop(0.75, '#c4603a');
          grad.addColorStop(1, '#e8a030');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // Scattered stars (upper sky only)
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          for (let i = 0; i < 30; i++) {
            const sx = srand(i + 0.1) * W;
            const sy = srand(i + 0.5) * GROUND_Y * 0.35;
            const sz = 1 + srand(i + 0.9);
            ctx.globalAlpha = 0.2 + srand(i + 0.3) * 0.4;
            ctx.fillRect(sx, sy, sz, sz);
          }
          ctx.globalAlpha = 1;

          // Setting sun glow
          const sunGrad = ctx.createRadialGradient(W * 0.75, GROUND_Y * 0.85, 10, W * 0.75, GROUND_Y * 0.85, 120);
          sunGrad.addColorStop(0, 'rgba(255,200,80,0.6)');
          sunGrad.addColorStop(0.5, 'rgba(255,150,50,0.2)');
          sunGrad.addColorStop(1, 'rgba(255,100,30,0)');
          ctx.fillStyle = sunGrad;
          ctx.fillRect(0, 0, W, GROUND_Y);
        }},

        // Layer 1: Far skyline silhouettes (0.15x)
        { speed: 0.15, draw: function (offset) {
          ctx.fillStyle = '#1a0a20';
          const tileW = 1200;
          const ox = -(offset % tileW);
          for (let t = ox; t < W + tileW; t += tileW) {
            for (let i = 0; i < 10; i++) {
              const bx = t + srand(i + 1) * tileW;
              const bw = 30 + srand(i + 2) * 50;
              const bh = 40 + srand(i + 3) * 80;
              ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
              // Tiny window lights
              ctx.fillStyle = 'rgba(255,200,100,0.3)';
              for (let wy = GROUND_Y - bh + 8; wy < GROUND_Y - 5; wy += 12) {
                for (let wx = bx + 5; wx < bx + bw - 5; wx += 10) {
                  if (srand(wx * 0.1 + wy * 0.2) > 0.5) {
                    ctx.fillRect(wx, wy, 4, 4);
                  }
                }
              }
              ctx.fillStyle = '#1a0a20';
            }
          }
        }},

        // Layer 2: Mid buildings with tin roofs & details (0.4x)
        { speed: 0.4, draw: function (offset) {
          const tileW = 900;
          const ox = -(offset % tileW);
          for (let t = ox; t < W + tileW; t += tileW) {
            // Buildings
            const buildings = [
              { x: 0, w: 80, h: 110, color: '#3a2a4a' },
              { x: 100, w: 60, h: 80, color: '#4a3050' },
              { x: 180, w: 100, h: 130, color: '#352545' },
              { x: 310, w: 70, h: 90, color: '#3e2848' },
              { x: 400, w: 90, h: 105, color: '#432d4d' },
              { x: 520, w: 65, h: 75, color: '#3a2a4a' },
              { x: 610, w: 110, h: 120, color: '#382545' },
              { x: 750, w: 75, h: 95, color: '#402a48' }
            ];
            for (const b of buildings) {
              const bx = t + b.x;
              const by = GROUND_Y - b.h;
              // Main wall
              ctx.fillStyle = b.color;
              ctx.fillRect(bx, by, b.w, b.h);
              // Tin roof (triangle)
              ctx.fillStyle = '#5a4a60';
              ctx.beginPath();
              ctx.moveTo(bx - 4, by);
              ctx.lineTo(bx + b.w / 2, by - 15);
              ctx.lineTo(bx + b.w + 4, by);
              ctx.closePath();
              ctx.fill();
              // Roof edge line
              ctx.strokeStyle = '#6a5a70';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(bx - 4, by);
              ctx.lineTo(bx + b.w / 2, by - 15);
              ctx.lineTo(bx + b.w + 4, by);
              ctx.stroke();
              // Windows
              ctx.fillStyle = 'rgba(255,200,100,0.5)';
              const winCols = Math.floor(b.w / 18);
              const winRows = Math.floor(b.h / 22);
              for (let wy = 0; wy < winRows; wy++) {
                for (let wx = 0; wx < winCols; wx++) {
                  if (srand(bx * 0.01 + wx + wy * 7) > 0.35) {
                    ctx.fillStyle = srand(bx * 0.02 + wx + wy) > 0.5
                      ? 'rgba(255,200,100,0.6)' : 'rgba(255,180,80,0.3)';
                    ctx.fillRect(bx + 8 + wx * 18, by + 10 + wy * 22, 8, 10);
                  }
                }
              }
            }
          }
        }},

        // Layer 3: Bus stand elements — buses, clock tower, signs (0.7x)
        { speed: 0.7, draw: function (offset) {
          const tileW = 1400;
          const ox = -(offset % tileW);
          for (let t = ox; t < W + tileW; t += tileW) {
            // --- Clock tower ---
            const cwx = t + 200;
            // Tower body
            ctx.fillStyle = '#5a4a3a';
            ctx.fillRect(cwx, GROUND_Y - 160, 30, 160);
            ctx.strokeStyle = '#3a2a1a';
            ctx.lineWidth = 2;
            ctx.strokeRect(cwx, GROUND_Y - 160, 30, 160);
            // Clock face
            ctx.fillStyle = '#fffff0';
            ctx.beginPath();
            ctx.arc(cwx + 15, GROUND_Y - 140, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cwx + 15, GROUND_Y - 140, 12, 0, Math.PI * 2);
            ctx.stroke();
            // Clock hands (showing ~11:52)
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cwx + 15, GROUND_Y - 140);
            ctx.lineTo(cwx + 15, GROUND_Y - 149); // minute hand (near 12)
            ctx.stroke();
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cwx + 15, GROUND_Y - 140);
            ctx.lineTo(cwx + 9, GROUND_Y - 138); // hour hand (~11)
            ctx.stroke();
            // Tower top — pointed
            ctx.fillStyle = '#4a3a2a';
            ctx.beginPath();
            ctx.moveTo(cwx - 2, GROUND_Y - 160);
            ctx.lineTo(cwx + 15, GROUND_Y - 180);
            ctx.lineTo(cwx + 32, GROUND_Y - 160);
            ctx.closePath();
            ctx.fill();

            // --- Parked buses ---
            drawBus(t + 500, GROUND_Y, '#cc4422', 'BUS 42');
            drawBus(t + 900, GROUND_Y, '#2266aa', 'BUS 7');
            drawBus(t + 1150, GROUND_Y, '#228844', 'EXPRESS');

            // --- Bus stop shelter ---
            const shx = t + 50;
            // Poles
            ctx.fillStyle = '#666';
            ctx.fillRect(shx, GROUND_Y - 70, 4, 70);
            ctx.fillRect(shx + 60, GROUND_Y - 70, 4, 70);
            // Roof
            ctx.fillStyle = '#556';
            ctx.fillRect(shx - 5, GROUND_Y - 75, 74, 8);
            // Bench
            ctx.fillStyle = '#6a5a4a';
            ctx.fillRect(shx + 8, GROUND_Y - 22, 48, 5);
            ctx.fillRect(shx + 12, GROUND_Y - 17, 4, 17);
            ctx.fillRect(shx + 48, GROUND_Y - 17, 4, 17);
            // Sign
            ctx.fillStyle = '#2255aa';
            ctx.fillRect(shx + 16, GROUND_Y - 65, 32, 14);
            ctx.fillStyle = '#fff';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BUS STOP', shx + 32, GROUND_Y - 55);

            // --- Street lights ---
            for (let i = 0; i < 4; i++) {
              const lx = t + 350 + i * 300;
              drawStreetLight(lx, GROUND_Y);
            }
          }
        }},

        // Layer 4: Ground — dusty road (1.0x)
        { speed: 1.0, draw: function (offset) {
          // Road surface
          const roadGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          roadGrad.addColorStop(0, '#5a4a3a');
          roadGrad.addColorStop(0.3, '#4a3a2a');
          roadGrad.addColorStop(1, '#3a2a1a');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

          // Curb line
          ctx.fillStyle = '#6a5a4a';
          ctx.fillRect(0, GROUND_Y, W, 3);

          // Road texture — pebbles & cracks
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          for (let i = 0; i < 30; i++) {
            const px = ((i * 47 - offset) % W + W) % W;
            const py = GROUND_Y + 8 + srand(i + 5) * (H - GROUND_Y - 15);
            ctx.fillRect(px, py, 2 + srand(i) * 3, 1);
          }

          // Dashed lane marking
          ctx.strokeStyle = 'rgba(255,255,200,0.15)';
          ctx.lineWidth = 2;
          ctx.setLineDash([20, 30]);
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y + 30);
          ctx.lineTo(W, GROUND_Y + 30);
          ctx.stroke();
          ctx.setLineDash([]);
        }}
      ];
    })(),
    // --- Level 1: Paithan (historic town) ---
    (function () {
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: Night sky with moon (static)
        { speed: 0, draw: function () {
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#050520');
          grad.addColorStop(0.5, '#0a1030');
          grad.addColorStop(1, '#152040');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // Stars
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 50; i++) {
            const sx = srand(i + 10.1) * W;
            const sy = srand(i + 10.5) * GROUND_Y * 0.5;
            const sz = 1 + srand(i + 10.9);
            ctx.globalAlpha = 0.15 + srand(i + 10.3) * 0.5;
            ctx.fillRect(sx, sy, sz, sz);
          }
          ctx.globalAlpha = 1;

          // Crescent moon
          const mx = W * 0.15, my = 60;
          ctx.fillStyle = '#ffffdd';
          ctx.beginPath();
          ctx.arc(mx, my, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#050520';
          ctx.beginPath();
          ctx.arc(mx + 8, my - 3, 17, 0, Math.PI * 2);
          ctx.fill();
          // Moon glow
          const moonGlow = ctx.createRadialGradient(mx, my, 15, mx, my, 70);
          moonGlow.addColorStop(0, 'rgba(200,210,255,0.12)');
          moonGlow.addColorStop(1, 'rgba(200,210,255,0)');
          ctx.fillStyle = moonGlow;
          ctx.beginPath();
          ctx.arc(mx, my, 70, 0, Math.PI * 2);
          ctx.fill();
        }},

        // Layer 1: Far city skyline with lit windows (0.15x)
        { speed: 0.15, draw: function (offset) {
          const tileW = 1400;
          const ox = -(offset % tileW);
          ctx.fillStyle = '#0c0c25';
          for (let t = ox; t < W + tileW; t += tileW) {
            for (let i = 0; i < 12; i++) {
              const bx = t + srand(i + 20) * tileW;
              const bw = 25 + srand(i + 21) * 60;
              const bh = 50 + srand(i + 22) * 100;
              ctx.fillStyle = '#0c0c25';
              ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
              // Window grid
              ctx.fillStyle = 'rgba(255,230,150,0.25)';
              for (let wy = GROUND_Y - bh + 6; wy < GROUND_Y - 4; wy += 8) {
                for (let wx = bx + 4; wx < bx + bw - 4; wx += 7) {
                  if (srand(wx * 0.13 + wy * 0.17) > 0.55) {
                    ctx.fillRect(wx, wy, 3, 3);
                  }
                }
              }
            }
          }
        }},

        // Layer 2: Mid-range shops & neon signs (0.45x)
        { speed: 0.45, draw: function (offset) {
          const tileW = 1200;
          const ox = -(offset % tileW);
          for (let t = ox; t < W + tileW; t += tileW) {
            const shops = [
              { x: 0, w: 90, h: 85, wall: '#2a2040', name: 'SAREE PALACE', neon: '#ff44aa' },
              { x: 110, w: 70, h: 70, wall: '#252535', name: 'ELECTRONICS', neon: '#44ddff' },
              { x: 200, w: 80, h: 90, wall: '#2a2535', name: 'SWEETS', neon: '#ffaa22' },
              { x: 310, w: 100, h: 75, wall: '#222840', name: 'JEWELLERS', neon: '#ffdd44' },
              { x: 440, w: 65, h: 80, wall: '#2a2040', name: 'MOBILE', neon: '#44ff88' },
              { x: 530, w: 85, h: 95, wall: '#252535', name: 'TEXTILES', neon: '#ff6644' },
              { x: 640, w: 75, h: 70, wall: '#2a2535', name: 'PHARMACY', neon: '#44ffcc' },
              { x: 740, w: 90, h: 85, wall: '#222840', name: 'GROCERY', neon: '#88ff44' },
              { x: 860, w: 70, h: 75, wall: '#2a2040', name: 'BAKERY', neon: '#ff88cc' },
              { x: 960, w: 95, h: 90, wall: '#252535', name: 'CHAI KING', neon: '#ffcc44' },
              { x: 1080, w: 80, h: 72, wall: '#2a2535', name: 'TAILOR', neon: '#aa88ff' }
            ];
            for (const s of shops) {
              const sx = t + s.x;
              const sy = GROUND_Y - s.h;
              // Shop wall
              ctx.fillStyle = s.wall;
              ctx.fillRect(sx, sy, s.w, s.h);
              ctx.strokeStyle = '#1a1a2a';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx, sy, s.w, s.h);

              // Awning
              ctx.fillStyle = s.neon + '33'; // translucent awning matching neon
              ctx.beginPath();
              ctx.moveTo(sx - 3, sy);
              ctx.lineTo(sx + s.w + 3, sy);
              ctx.lineTo(sx + s.w + 3, sy + 10);
              ctx.lineTo(sx - 3, sy + 10);
              ctx.closePath();
              ctx.fill();

              // Neon sign board
              ctx.fillStyle = '#111';
              ctx.fillRect(sx + 5, sy + 2, s.w - 10, 14);
              // Neon text
              ctx.fillStyle = s.neon;
              ctx.shadowColor = s.neon;
              ctx.shadowBlur = 8;
              ctx.font = 'bold 7px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(s.name, sx + s.w / 2, sy + 12);
              ctx.shadowBlur = 0;

              // Shop window / display
              ctx.fillStyle = 'rgba(100,150,200,0.15)';
              ctx.fillRect(sx + 8, sy + 22, s.w - 16, s.h - 35);
              ctx.strokeStyle = '#3a3a5a';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx + 8, sy + 22, s.w - 16, s.h - 35);

              // Interior light
              ctx.fillStyle = 'rgba(255,220,150,0.08)';
              ctx.fillRect(sx + 9, sy + 23, s.w - 18, s.h - 37);

              // Door
              ctx.fillStyle = '#1a1a2a';
              ctx.fillRect(sx + s.w / 2 - 6, sy + s.h - 28, 12, 28);
            }

            // --- Chai stall ---
            drawChaiStall(t + 1060, GROUND_Y);
          }
        }},

        // Layer 3: Power lines, poles & near details (0.75x)
        { speed: 0.75, draw: function (offset) {
          const tileW = 600;
          const ox = -(offset % tileW);
          for (let t = ox; t < W + tileW; t += tileW) {
            // Power poles
            for (let i = 0; i < 2; i++) {
              const px = t + i * 300 + 50;
              // Pole
              ctx.fillStyle = '#444';
              ctx.fillRect(px, GROUND_Y - 130, 4, 130);
              // Cross arm
              ctx.fillStyle = '#444';
              ctx.fillRect(px - 15, GROUND_Y - 128, 34, 3);
              // Insulators
              ctx.fillStyle = '#668';
              ctx.fillRect(px - 14, GROUND_Y - 132, 4, 6);
              ctx.fillRect(px + 14, GROUND_Y - 132, 4, 6);
            }
            // Wires between poles (sagging catenary)
            ctx.strokeStyle = 'rgba(100,100,120,0.5)';
            ctx.lineWidth = 1;
            for (let w = 0; w < 2; w++) {
              const wy = GROUND_Y - 126 + w * 6;
              ctx.beginPath();
              ctx.moveTo(t + 50, wy);
              ctx.quadraticCurveTo(t + 200, wy + 25, t + 350, wy);
              ctx.stroke();
            }
          }

          // Neon reflections on ground
          ctx.globalAlpha = 0.04;
          const colors = ['#ff44aa', '#44ddff', '#ffaa22', '#ffdd44', '#44ff88'];
          for (let i = 0; i < 8; i++) {
            const rx = ((i * 130 - offset * 0.6) % W + W) % W;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(rx, GROUND_Y + 2, 60, H - GROUND_Y);
          }
          ctx.globalAlpha = 1;
        }},

        // Layer 4: Ground — asphalt city road (1.0x)
        { speed: 1.0, draw: function (offset) {
          // Asphalt
          const roadGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          roadGrad.addColorStop(0, '#2a2a35');
          roadGrad.addColorStop(0.4, '#222230');
          roadGrad.addColorStop(1, '#1a1a28');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

          // Curb / sidewalk edge
          ctx.fillStyle = '#3a3a48';
          ctx.fillRect(0, GROUND_Y, W, 4);

          // Road markings — dashed center line
          ctx.strokeStyle = 'rgba(255,255,200,0.12)';
          ctx.lineWidth = 2;
          ctx.setLineDash([25, 35]);
          ctx.beginPath();
          ctx.moveTo(-offset % 60, GROUND_Y + 28);
          ctx.lineTo(W, GROUND_Y + 28);
          ctx.stroke();
          ctx.setLineDash([]);

          // Wet road reflections (subtle streaks)
          ctx.fillStyle = 'rgba(150,170,200,0.04)';
          for (let i = 0; i < 15; i++) {
            const rx = ((i * 73 - offset) % W + W) % W;
            const ry = GROUND_Y + 6 + srand(i + 40) * 35;
            ctx.fillRect(rx, ry, 30 + srand(i + 41) * 20, 1);
          }

          // Manhole cover (periodic)
          const mhTile = 500;
          const mhx = ((250 - offset) % mhTile + mhTile) % mhTile;
          ctx.fillStyle = '#333340';
          ctx.beginPath();
          ctx.ellipse(mhx, GROUND_Y + 35, 10, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2a2a30';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(mhx, GROUND_Y + 35, 10, 5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }}
      ];
    })(),
    // --- Level 2: Dhorkin (highway) ---
    (function () {
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: Deep starry sky with full moon (static)
        { speed: 0, draw: function () {
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#020210');
          grad.addColorStop(0.6, '#08082a');
          grad.addColorStop(1, '#101838');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // Dense star field
          for (let i = 0; i < 80; i++) {
            const sx = srand(i + 30.1) * W;
            const sy = srand(i + 30.5) * GROUND_Y * 0.65;
            const sz = 0.5 + srand(i + 30.9) * 2;
            ctx.globalAlpha = 0.15 + srand(i + 30.3) * 0.6;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, sz, 0, Math.PI * 2);
            ctx.fill();
          }
          // A few twinkling colored stars
          const starColors = ['#aaccff', '#ffccaa', '#ffaaaa', '#aaffcc'];
          for (let i = 0; i < 8; i++) {
            ctx.globalAlpha = 0.3 + srand(i + 50) * 0.4;
            ctx.fillStyle = starColors[i % 4];
            const sx = srand(i + 50.1) * W;
            const sy = srand(i + 50.5) * GROUND_Y * 0.4;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // Full moon
          const mx = W * 0.8, my = 70;
          // Outer glow
          const moonGlow = ctx.createRadialGradient(mx, my, 20, mx, my, 100);
          moonGlow.addColorStop(0, 'rgba(200,210,240,0.15)');
          moonGlow.addColorStop(1, 'rgba(200,210,240,0)');
          ctx.fillStyle = moonGlow;
          ctx.beginPath();
          ctx.arc(mx, my, 100, 0, Math.PI * 2);
          ctx.fill();
          // Moon disc
          ctx.fillStyle = '#e8e8f0';
          ctx.beginPath();
          ctx.arc(mx, my, 22, 0, Math.PI * 2);
          ctx.fill();
          // Craters
          ctx.fillStyle = 'rgba(180,180,200,0.4)';
          ctx.beginPath(); ctx.arc(mx - 6, my - 5, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 8, my + 3, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx - 2, my + 8, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 4, my - 9, 2, 0, Math.PI * 2); ctx.fill();
        }},

        // Layer 1: Distant mountains (0.1x)
        { speed: 0.1, draw: function (offset) {
          const tileW = 1800;
          const ox = -(offset % tileW);
          // Far mountain range — darker
          ctx.fillStyle = '#0a0a22';
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            ctx.beginPath();
            ctx.moveTo(t, GROUND_Y);
            ctx.lineTo(t + 100, GROUND_Y - 120);
            ctx.lineTo(t + 250, GROUND_Y - 180);
            ctx.lineTo(t + 400, GROUND_Y - 140);
            ctx.lineTo(t + 550, GROUND_Y - 190);
            ctx.lineTo(t + 700, GROUND_Y - 150);
            ctx.lineTo(t + 900, GROUND_Y - 200);
            ctx.lineTo(t + 1100, GROUND_Y - 160);
            ctx.lineTo(t + 1300, GROUND_Y - 185);
            ctx.lineTo(t + 1500, GROUND_Y - 130);
            ctx.lineTo(t + 1700, GROUND_Y - 170);
            ctx.lineTo(t + 1800, GROUND_Y - 110);
            ctx.lineTo(t + 1800, GROUND_Y);
            ctx.closePath();
            ctx.fill();
          }
        }},

        // Layer 2: Nearer mountains with snow caps (0.25x)
        { speed: 0.25, draw: function (offset) {
          const tileW = 1400;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Mountain body
            ctx.fillStyle = '#10103a';
            ctx.beginPath();
            ctx.moveTo(t, GROUND_Y);
            ctx.lineTo(t + 80, GROUND_Y - 90);
            ctx.lineTo(t + 200, GROUND_Y - 150);
            ctx.lineTo(t + 350, GROUND_Y - 100);
            ctx.lineTo(t + 500, GROUND_Y - 140);
            ctx.lineTo(t + 650, GROUND_Y - 90);
            ctx.lineTo(t + 800, GROUND_Y - 130);
            ctx.lineTo(t + 1000, GROUND_Y - 110);
            ctx.lineTo(t + 1150, GROUND_Y - 145);
            ctx.lineTo(t + 1300, GROUND_Y - 80);
            ctx.lineTo(t + 1400, GROUND_Y);
            ctx.closePath();
            ctx.fill();

            // Snow caps on peaks
            ctx.fillStyle = 'rgba(220,225,240,0.25)';
            const peaks = [
              [t + 200, GROUND_Y - 150, 30],
              [t + 500, GROUND_Y - 140, 25],
              [t + 800, GROUND_Y - 130, 22],
              [t + 1150, GROUND_Y - 145, 28]
            ];
            for (const [px, py, pw] of peaks) {
              ctx.beginPath();
              ctx.moveTo(px - pw, py + 20);
              ctx.lineTo(px, py);
              ctx.lineTo(px + pw, py + 20);
              ctx.closePath();
              ctx.fill();
            }
          }
        }},

        // Layer 3: Highway elements — barriers, signs, reflectors (0.75x)
        { speed: 0.75, draw: function (offset) {
          const tileW = 800;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Metal crash barriers (guardrail)
            ctx.fillStyle = '#5a5a6a';
            ctx.fillRect(t, GROUND_Y - 18, tileW, 4);
            ctx.fillRect(t, GROUND_Y - 10, tileW, 4);
            // Barrier posts
            for (let i = 0; i < 10; i++) {
              const bpx = t + i * 80 + 20;
              ctx.fillStyle = '#4a4a5a';
              ctx.fillRect(bpx, GROUND_Y - 22, 4, 22);
              // Reflector
              ctx.fillStyle = '#ff6600';
              ctx.fillRect(bpx, GROUND_Y - 20, 4, 4);
            }

            // Highway signs
            if (t > -200) {
              // Distance sign
              const sx = t + 200;
              ctx.fillStyle = '#115522';
              ctx.beginPath();
              roundRect(ctx, sx, GROUND_Y - 110, 80, 35, 3);
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              roundRect(ctx, sx + 2, GROUND_Y - 108, 76, 31, 2);
              ctx.stroke();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 8px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('PARK  12km', sx + 40, GROUND_Y - 92);
              ctx.font = '7px monospace';
              ctx.fillText('← EXIT 4', sx + 40, GROUND_Y - 82);
              // Sign posts
              ctx.fillStyle = '#555';
              ctx.fillRect(sx + 20, GROUND_Y - 75, 4, 75);
              ctx.fillRect(sx + 56, GROUND_Y - 75, 4, 75);

              // Speed limit sign
              const slx = t + 550;
              // Post
              ctx.fillStyle = '#666';
              ctx.fillRect(slx + 10, GROUND_Y - 90, 4, 90);
              // Circle
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.arc(slx + 12, GROUND_Y - 100, 14, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#cc0000';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(slx + 12, GROUND_Y - 100, 14, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = '#000';
              ctx.font = 'bold 12px monospace';
              ctx.textAlign = 'center';
              ctx.fillText('80', slx + 12, GROUND_Y - 96);
            }

            // Kilometer markers
            for (let i = 0; i < 4; i++) {
              const kmx = t + i * 200 + 100;
              ctx.fillStyle = '#ddd';
              ctx.fillRect(kmx, GROUND_Y - 25, 3, 14);
              ctx.fillStyle = '#ffaa00';
              ctx.fillRect(kmx, GROUND_Y - 25, 3, 4);
            }
          }

          // Headlight streaks from opposing traffic (background ambiance)
          ctx.globalAlpha = 0.06;
          for (let i = 0; i < 5; i++) {
            const hx = ((i * 190 + offset * 0.5) % (W + 100)) - 50;
            ctx.fillStyle = '#ffffcc';
            ctx.fillRect(hx, GROUND_Y - 35, 40, 2);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(hx + 50, GROUND_Y - 35, 20, 2);
          }
          ctx.globalAlpha = 1;
        }},

        // Layer 4: Ground — dark highway asphalt (1.0x)
        { speed: 1.0, draw: function (offset) {
          // Multi-lane highway surface
          const roadGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          roadGrad.addColorStop(0, '#1a1a24');
          roadGrad.addColorStop(0.3, '#161620');
          roadGrad.addColorStop(1, '#101018');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

          // Shoulder line (solid white)
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, GROUND_Y + 3);
          ctx.lineTo(W, GROUND_Y + 3);
          ctx.stroke();

          // Lane markings — dashed
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 2;
          ctx.setLineDash([30, 40]);
          const dashOffset = -(offset % 70);
          ctx.beginPath();
          ctx.moveTo(dashOffset, GROUND_Y + 22);
          ctx.lineTo(W + 70, GROUND_Y + 22);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(dashOffset, GROUND_Y + 42);
          ctx.lineTo(W + 70, GROUND_Y + 42);
          ctx.stroke();
          ctx.setLineDash([]);

          // Road texture — fine grain
          ctx.fillStyle = 'rgba(255,255,255,0.02)';
          for (let i = 0; i < 40; i++) {
            const gx = ((i * 37 - offset) % W + W) % W;
            const gy = GROUND_Y + 5 + srand(i + 60) * (H - GROUND_Y - 10);
            ctx.fillRect(gx, gy, 1 + srand(i + 61) * 3, 1);
          }

          // Cat-eye road reflectors
          for (let i = 0; i < 15; i++) {
            const cx = ((i * 65 - offset) % W + W) % W;
            ctx.fillStyle = 'rgba(255,200,50,0.4)';
            ctx.fillRect(cx, GROUND_Y + 21, 4, 2);
            ctx.fillRect(cx, GROUND_Y + 41, 4, 2);
          }
        }}
      ];
    })(),
    // --- Level 3: Bidkin (industrial outskirts) ---
    (function () {
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: Smoky dusk sky (static)
        { speed: 0, draw: function () {
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#0a0810');
          grad.addColorStop(0.4, '#1a1525');
          grad.addColorStop(0.7, '#2a2030');
          grad.addColorStop(1, '#3a2a35');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // Hazy stars (fewer, dimmer due to light pollution)
          for (let i = 0; i < 20; i++) {
            const sx = srand(i + 200) * W;
            const sy = srand(i + 201) * GROUND_Y * 0.3;
            ctx.globalAlpha = 0.1 + srand(i + 202) * 0.2;
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx, sy, 1.5, 1.5);
          }
          ctx.globalAlpha = 1;

          // Industrial haze glow on horizon
          const hazeGrad = ctx.createLinearGradient(0, GROUND_Y * 0.6, 0, GROUND_Y);
          hazeGrad.addColorStop(0, 'rgba(60,40,30,0)');
          hazeGrad.addColorStop(1, 'rgba(60,40,30,0.3)');
          ctx.fillStyle = hazeGrad;
          ctx.fillRect(0, GROUND_Y * 0.6, W, GROUND_Y * 0.4);
        }},

        // Layer 1: Far factory silhouettes & chimneys (0.15x)
        { speed: 0.15, draw: function (offset) {
          ctx.fillStyle = '#0e0a18';
          const tileW = 1400;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Factory blocks
            for (let i = 0; i < 6; i++) {
              const fx = t + srand(i + 210) * tileW;
              const fw = 60 + srand(i + 211) * 80;
              const fh = 50 + srand(i + 212) * 60;
              ctx.fillRect(fx, GROUND_Y - fh, fw, fh);
              // Chimney
              ctx.fillRect(fx + fw * 0.3, GROUND_Y - fh - 40, 8, 40);
              // Smoke puff (static)
              ctx.fillStyle = 'rgba(60,50,50,0.3)';
              ctx.beginPath();
              ctx.arc(fx + fw * 0.3 + 4, GROUND_Y - fh - 45, 10, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(fx + fw * 0.3 + 10, GROUND_Y - fh - 52, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#0e0a18';
            }
          }
        }},

        // Layer 2: Mid warehouses & storage tanks (0.4x)
        { speed: 0.4, draw: function (offset) {
          const tileW = 1000;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Warehouses
            const warehouses = [
              { x: 0, w: 100, h: 70 },
              { x: 150, w: 80, h: 55 },
              { x: 300, w: 120, h: 80 },
              { x: 480, w: 90, h: 60 },
              { x: 620, w: 110, h: 75 },
              { x: 780, w: 85, h: 65 },
              { x: 900, w: 100, h: 70 }
            ];
            for (const wh of warehouses) {
              const wx = t + wh.x;
              ctx.fillStyle = '#1a1520';
              ctx.fillRect(wx, GROUND_Y - wh.h, wh.w, wh.h);
              // Corrugated roof
              ctx.fillStyle = '#252030';
              ctx.beginPath();
              ctx.moveTo(wx - 3, GROUND_Y - wh.h);
              ctx.lineTo(wx + wh.w / 2, GROUND_Y - wh.h - 12);
              ctx.lineTo(wx + wh.w + 3, GROUND_Y - wh.h);
              ctx.closePath();
              ctx.fill();
              // Loading door
              ctx.fillStyle = '#2a2535';
              ctx.fillRect(wx + wh.w * 0.3, GROUND_Y - wh.h * 0.6, wh.w * 0.35, wh.h * 0.6);
              // Security light
              ctx.fillStyle = 'rgba(255,200,100,0.4)';
              ctx.beginPath();
              ctx.arc(wx + wh.w * 0.5, GROUND_Y - wh.h + 5, 3, 0, Math.PI * 2);
              ctx.fill();
            }

            // Storage tanks
            for (let i = 0; i < 3; i++) {
              const tx = t + 100 + i * 350;
              ctx.fillStyle = '#201a28';
              ctx.beginPath();
              ctx.ellipse(tx, GROUND_Y - 45, 20, 45, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#2a2530';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.ellipse(tx, GROUND_Y - 45, 20, 45, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }},

        // Layer 3: Near details — pipes, fences, lights (0.7x)
        { speed: 0.7, draw: function (offset) {
          const tileW = 700;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Chain-link fence
            ctx.strokeStyle = 'rgba(100,100,110,0.4)';
            ctx.lineWidth = 0.5;
            for (let fy = GROUND_Y - 30; fy < GROUND_Y; fy += 6) {
              ctx.beginPath();
              ctx.moveTo(t, fy);
              ctx.lineTo(t + tileW, fy);
              ctx.stroke();
            }
            // Fence posts
            for (let i = 0; i < 8; i++) {
              const fp = t + i * 90;
              ctx.fillStyle = '#555';
              ctx.fillRect(fp, GROUND_Y - 35, 3, 35);
            }
            // Warning signs
            ctx.fillStyle = '#cc8800';
            ctx.fillRect(t + 200, GROUND_Y - 45, 20, 15);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 6px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠', t + 210, GROUND_Y - 35);

            // Sodium vapor lamps (orange glow)
            for (let i = 0; i < 3; i++) {
              const lx = t + 100 + i * 250;
              ctx.fillStyle = '#444';
              ctx.fillRect(lx, GROUND_Y - 90, 3, 90);
              ctx.fillRect(lx - 8, GROUND_Y - 90, 19, 3);
              const glow = ctx.createRadialGradient(lx + 2, GROUND_Y - 80, 2, lx + 2, GROUND_Y - 60, 40);
              glow.addColorStop(0, 'rgba(255,180,80,0.2)');
              glow.addColorStop(1, 'rgba(255,180,80,0)');
              ctx.fillStyle = glow;
              ctx.fillRect(lx - 40, GROUND_Y - 90, 80, 70);
              ctx.fillStyle = 'rgba(255,200,100,0.7)';
              ctx.beginPath();
              ctx.arc(lx + 2, GROUND_Y - 87, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }},

        // Layer 4: Ground — rough industrial road (1.0x)
        { speed: 1.0, draw: function (offset) {
          const roadGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          roadGrad.addColorStop(0, '#2a2530');
          roadGrad.addColorStop(0.4, '#222028');
          roadGrad.addColorStop(1, '#1a1820');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
          ctx.fillStyle = '#3a3540';
          ctx.fillRect(0, GROUND_Y, W, 3);
          // Rough patches
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < 20; i++) {
            const px = ((i * 53 - offset) % W + W) % W;
            const py = GROUND_Y + 8 + srand(i + 220) * 35;
            ctx.fillRect(px, py, 15 + srand(i + 221) * 10, 2);
          }
          // Oil stains
          ctx.fillStyle = 'rgba(40,30,50,0.3)';
          for (let i = 0; i < 5; i++) {
            const ox2 = ((i * 200 - offset) % W + W) % W;
            ctx.beginPath();
            ctx.ellipse(ox2, GROUND_Y + 25, 12, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }}
      ];
    })(),

    // --- Level 4: Kanchanwadi (residential/park) ---
    (function () {
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: Magical night sky (static)
        { speed: 0, draw: function () {
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#060618');
          grad.addColorStop(0.4, '#0c1030');
          grad.addColorStop(0.8, '#141840');
          grad.addColorStop(1, '#1a2248');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // Stars
          for (let i = 0; i < 60; i++) {
            const sx = srand(i + 70.1) * W;
            const sy = srand(i + 70.5) * GROUND_Y * 0.55;
            const sz = 0.5 + srand(i + 70.9) * 1.8;
            ctx.globalAlpha = 0.2 + srand(i + 70.3) * 0.5;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, sz, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // Large glowing moon (near midnight)
          const mx = W * 0.5, my = 55;
          const moonGlow = ctx.createRadialGradient(mx, my, 18, mx, my, 110);
          moonGlow.addColorStop(0, 'rgba(220,220,255,0.18)');
          moonGlow.addColorStop(1, 'rgba(220,220,255,0)');
          ctx.fillStyle = moonGlow;
          ctx.beginPath();
          ctx.arc(mx, my, 110, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#eeeef8';
          ctx.beginPath();
          ctx.arc(mx, my, 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(200,200,220,0.3)';
          ctx.beginPath(); ctx.arc(mx - 5, my - 3, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 6, my + 4, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 1, my + 8, 2, 0, Math.PI * 2); ctx.fill();
        }},

        // Layer 1: Distant tree silhouettes (0.15x)
        { speed: 0.15, draw: function (offset) {
          const tileW = 1600;
          const ox = -(offset % tileW);
          ctx.fillStyle = '#0a0e28';
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            for (let i = 0; i < 14; i++) {
              const tx = t + srand(i + 80) * tileW;
              const th = 80 + srand(i + 81) * 100;
              const tw = 30 + srand(i + 82) * 40;
              // Trunk
              ctx.fillRect(tx + tw / 2 - 3, GROUND_Y - th * 0.4, 6, th * 0.4);
              // Canopy
              ctx.beginPath();
              ctx.arc(tx + tw / 2, GROUND_Y - th * 0.5, tw / 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(tx + tw / 2 - 8, GROUND_Y - th * 0.4, tw / 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.beginPath();
              ctx.arc(tx + tw / 2 + 8, GROUND_Y - th * 0.4, tw / 2.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }},

        // Layer 2: Fairy-light trees & lamp posts (0.5x)
        { speed: 0.5, draw: function (offset) {
          const tileW = 1000;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Decorated trees with fairy lights
            const trees = [
              { x: 50, h: 140, canopy: 35 },
              { x: 250, h: 120, canopy: 30 },
              { x: 450, h: 155, canopy: 38 },
              { x: 650, h: 130, canopy: 32 },
              { x: 850, h: 145, canopy: 36 }
            ];
            for (const tree of trees) {
              const tx = t + tree.x;
              const by = GROUND_Y;

              // Trunk
              ctx.fillStyle = '#2a1a10';
              ctx.fillRect(tx - 5, by - tree.h * 0.45, 10, tree.h * 0.45);
              ctx.strokeStyle = '#1a0a05';
              ctx.lineWidth = 1;
              ctx.strokeRect(tx - 5, by - tree.h * 0.45, 10, tree.h * 0.45);

              // Canopy layers (lush, multiple overlapping circles)
              ctx.fillStyle = '#0e2a12';
              const cy = by - tree.h * 0.55;
              const cr = tree.canopy;
              ctx.beginPath(); ctx.arc(tx, cy - 10, cr, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#0c2410';
              ctx.beginPath(); ctx.arc(tx - cr * 0.6, cy + 5, cr * 0.75, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(tx + cr * 0.6, cy + 5, cr * 0.75, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#0a2010';
              ctx.beginPath(); ctx.arc(tx, cy + 10, cr * 0.6, 0, Math.PI * 2); ctx.fill();

              // Fairy lights on tree
              const lightColors = ['#ffee55', '#ff88aa', '#88ddff', '#aaffaa', '#ffaa55'];
              for (let li = 0; li < 15; li++) {
                const angle = srand(li + tx * 0.01) * Math.PI * 2;
                const dist = srand(li + tx * 0.02 + 1) * cr * 0.9;
                const lx = tx + Math.cos(angle) * dist;
                const ly = cy - 5 + Math.sin(angle) * dist * 0.7;
                const lc = lightColors[li % lightColors.length];
                ctx.fillStyle = lc;
                ctx.shadowColor = lc;
                ctx.shadowBlur = 6;
                ctx.beginPath();
                ctx.arc(lx, ly, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.shadowBlur = 0;

              // Light string curves (connecting lights visually)
              ctx.strokeStyle = 'rgba(255,255,255,0.08)';
              ctx.lineWidth = 0.5;
              ctx.beginPath();
              ctx.arc(tx, cy - 5, cr * 0.5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(tx, cy - 5, cr * 0.75, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Lamp posts (ornate park style)
            for (let i = 0; i < 3; i++) {
              const lx = t + 150 + i * 330;
              drawParkLamp(lx, GROUND_Y);
            }

            // Flower beds at base of trees
            for (const tree of trees) {
              const fx = t + tree.x;
              drawFlowerBed(fx, GROUND_Y);
            }
          }
        }},

        // Layer 3: Fireflies & near foliage (0.8x)
        { speed: 0.8, draw: function (offset) {
          // Bushes along path
          const tileW = 600;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            for (let i = 0; i < 6; i++) {
              const bx = t + i * 100 + 20;
              const bw = 25 + srand(i + 90) * 20;
              const bh = 12 + srand(i + 91) * 10;
              ctx.fillStyle = '#0c2810';
              ctx.beginPath();
              ctx.ellipse(bx, GROUND_Y - 2, bw / 2, bh, 0, Math.PI, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#0a2410';
              ctx.beginPath();
              ctx.ellipse(bx, GROUND_Y - 2, bw / 2 - 4, bh - 3, 0, Math.PI, Math.PI * 2);
              ctx.fill();
            }
          }

          // Fireflies (animated with frameCount)
          for (let i = 0; i < 12; i++) {
            const baseX = srand(i + 100) * W;
            const baseY = GROUND_Y * 0.4 + srand(i + 101) * GROUND_Y * 0.5;
            const wobbleX = Math.sin(game.frameCount * 0.02 + i * 2.1) * 15;
            const wobbleY = Math.cos(game.frameCount * 0.015 + i * 1.7) * 10;
            const fx = ((baseX + wobbleX - offset * 0.3) % (W + 40) + W + 40) % (W + 40) - 20;
            const fy = baseY + wobbleY;
            const pulse = 0.3 + Math.sin(game.frameCount * 0.05 + i * 3) * 0.3;
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#ccff66';
            ctx.shadowColor = '#ccff66';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(fx, fy, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.globalAlpha = 1;
        }},

        // Layer 4: Ground — cobblestone path (1.0x)
        { speed: 1.0, draw: function (offset) {
          // Path surface
          const pathGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          pathGrad.addColorStop(0, '#3a3530');
          pathGrad.addColorStop(0.3, '#33302a');
          pathGrad.addColorStop(1, '#2a2520');
          ctx.fillStyle = pathGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

          // Path edge — stone curb
          ctx.fillStyle = '#4a4540';
          ctx.fillRect(0, GROUND_Y, W, 3);

          // Cobblestone pattern
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = 0.5;
          const stoneW = 20;
          const stoneH = 12;
          for (let row = 0; row < 4; row++) {
            const rowOff = row % 2 === 0 ? 0 : stoneW / 2;
            const ry = GROUND_Y + 6 + row * stoneH;
            for (let col = -1; col < Math.ceil(W / stoneW) + 1; col++) {
              const cx = ((col * stoneW + rowOff - offset) % W + W) % W;
              ctx.strokeRect(cx, ry, stoneW - 1, stoneH - 1);
            }
          }

          // Fallen leaves / petals
          const petalColors = ['#cc5577', '#dd7799', '#ffaacc', '#bb4466'];
          for (let i = 0; i < 12; i++) {
            const px = ((i * 83 - offset) % W + W) % W;
            const py = GROUND_Y + 5 + srand(i + 110) * (H - GROUND_Y - 10);
            ctx.fillStyle = petalColors[i % petalColors.length];
            ctx.globalAlpha = 0.3 + srand(i + 111) * 0.3;
            ctx.beginPath();
            ctx.ellipse(px, py, 3, 1.5, srand(i + 112) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // Moonlight patches on path
          ctx.fillStyle = 'rgba(200,210,240,0.03)';
          for (let i = 0; i < 4; i++) {
            const mx = ((i * 250 + 100 - offset * 0.2) % W + W) % W;
            ctx.beginPath();
            ctx.ellipse(mx, GROUND_Y + 25, 50, 15, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }}
      ];
    })(),

    // --- Level 5: Aurangabad (city — final level + boss) ---
    (function () {
      function srand(seed) { return ((Math.sin(seed * 127.1) * 43758.5453) % 1 + 1) % 1; }

      return [
        // Layer 0: City night sky (static)
        { speed: 0, draw: function () {
          const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
          grad.addColorStop(0, '#050515');
          grad.addColorStop(0.4, '#0a0a28');
          grad.addColorStop(0.8, '#151535');
          grad.addColorStop(1, '#1a1a40');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, GROUND_Y);

          // City glow on horizon
          const cityGlow = ctx.createRadialGradient(W * 0.5, GROUND_Y, 50, W * 0.5, GROUND_Y, 250);
          cityGlow.addColorStop(0, 'rgba(255,200,100,0.08)');
          cityGlow.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = cityGlow;
          ctx.fillRect(0, GROUND_Y * 0.3, W, GROUND_Y * 0.7);

          // Stars (fewer, city light pollution)
          for (let i = 0; i < 25; i++) {
            const sx = srand(i + 300) * W;
            const sy = srand(i + 301) * GROUND_Y * 0.4;
            ctx.globalAlpha = 0.1 + srand(i + 302) * 0.25;
            ctx.fillStyle = '#fff';
            ctx.fillRect(sx, sy, 1.5, 1.5);
          }
          ctx.globalAlpha = 1;

          // Moon
          const mx = W * 0.85, my = 50;
          ctx.fillStyle = '#dde';
          ctx.beginPath();
          ctx.arc(mx, my, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#050515';
          ctx.beginPath();
          ctx.arc(mx + 5, my - 2, 12, 0, Math.PI * 2);
          ctx.fill();
        }},

        // Layer 1: Aurangabad skyline — Bibi Ka Maqbara silhouette, towers (0.15x)
        { speed: 0.15, draw: function (offset) {
          ctx.fillStyle = '#0a0a20';
          const tileW = 1800;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Bibi Ka Maqbara dome silhouette
            const bx = t + 400;
            ctx.beginPath();
            ctx.moveTo(bx, GROUND_Y);
            ctx.lineTo(bx, GROUND_Y - 80);
            ctx.lineTo(bx + 20, GROUND_Y - 80);
            ctx.quadraticCurveTo(bx + 50, GROUND_Y - 140, bx + 80, GROUND_Y - 80);
            ctx.lineTo(bx + 100, GROUND_Y - 80);
            ctx.lineTo(bx + 100, GROUND_Y);
            ctx.closePath();
            ctx.fill();
            // Minarets
            ctx.fillRect(bx - 5, GROUND_Y - 100, 6, 100);
            ctx.fillRect(bx + 99, GROUND_Y - 100, 6, 100);
            // Minaret caps
            ctx.beginPath();
            ctx.arc(bx - 2, GROUND_Y - 100, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(bx + 102, GROUND_Y - 100, 5, 0, Math.PI * 2);
            ctx.fill();

            // City buildings
            for (let i = 0; i < 12; i++) {
              const bxx = t + srand(i + 310) * tileW;
              const bw = 25 + srand(i + 311) * 50;
              const bh = 40 + srand(i + 312) * 90;
              ctx.fillRect(bxx, GROUND_Y - bh, bw, bh);
              // Windows
              ctx.fillStyle = 'rgba(255,200,100,0.2)';
              for (let wy = GROUND_Y - bh + 6; wy < GROUND_Y - 4; wy += 8) {
                for (let wx = bxx + 4; wx < bxx + bw - 4; wx += 7) {
                  if (srand(wx * 0.1 + wy * 0.2) > 0.55) ctx.fillRect(wx, wy, 3, 3);
                }
              }
              ctx.fillStyle = '#0a0a20';
            }
          }
        }},

        // Layer 2: Mid buildings, shops, gates (0.45x)
        { speed: 0.45, draw: function (offset) {
          const tileW = 1200;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            const buildings = [
              { x: 0, w: 85, h: 90, color: '#1a1535', name: 'HOTEL' },
              { x: 110, w: 70, h: 75, color: '#181430', name: 'MEDICAL' },
              { x: 200, w: 95, h: 100, color: '#1a1535', name: 'MALL' },
              { x: 320, w: 65, h: 70, color: '#181430', name: 'BANK' },
              { x: 410, w: 80, h: 85, color: '#1a1535', name: 'SWEET' },
              { x: 520, w: 75, h: 80, color: '#181430', name: 'CINEMA' },
              { x: 620, w: 90, h: 95, color: '#1a1535', name: 'TEMPLE' },
              { x: 740, w: 70, h: 72, color: '#181430', name: 'SCHOOL' },
              { x: 840, w: 85, h: 88, color: '#1a1535', name: 'MARKET' },
              { x: 950, w: 80, h: 78, color: '#181430', name: 'CLINIC' },
              { x: 1060, w: 90, h: 92, color: '#1a1535', name: 'LODGE' }
            ];
            for (const b of buildings) {
              const bx = t + b.x;
              ctx.fillStyle = b.color;
              ctx.fillRect(bx, GROUND_Y - b.h, b.w, b.h);
              ctx.strokeStyle = '#111';
              ctx.lineWidth = 1;
              ctx.strokeRect(bx, GROUND_Y - b.h, b.w, b.h);
              // Sign
              ctx.fillStyle = '#222';
              ctx.fillRect(bx + 5, GROUND_Y - b.h + 3, b.w - 10, 12);
              const neonColors = ['#ff44aa', '#44ddff', '#ffaa22', '#44ff88', '#ffdd44', '#ff6644'];
              ctx.fillStyle = neonColors[Math.floor(srand(bx * 0.01) * neonColors.length)];
              ctx.shadowColor = ctx.fillStyle;
              ctx.shadowBlur = 5;
              ctx.font = 'bold 7px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(b.name, bx + b.w / 2, GROUND_Y - b.h + 12);
              ctx.shadowBlur = 0;
              // Windows
              ctx.fillStyle = 'rgba(255,200,100,0.35)';
              for (let row = 0; row < 3; row++) {
                for (let col = 0; col < Math.floor(b.w / 16); col++) {
                  ctx.fillRect(bx + 6 + col * 16, GROUND_Y - b.h + 20 + row * 20, 8, 10);
                }
              }
            }

            // Decorative gate/arch (Aurangabad gates)
            const gx = t + 600;
            ctx.fillStyle = '#2a2040';
            ctx.fillRect(gx, GROUND_Y - 110, 8, 110);
            ctx.fillRect(gx + 52, GROUND_Y - 110, 8, 110);
            ctx.beginPath();
            ctx.moveTo(gx, GROUND_Y - 110);
            ctx.quadraticCurveTo(gx + 30, GROUND_Y - 140, gx + 60, GROUND_Y - 110);
            ctx.fill();
          }
        }},

        // Layer 3: Street lights, vehicles, neon (0.75x)
        { speed: 0.75, draw: function (offset) {
          const tileW = 500;
          const ox = -(offset % tileW);
          for (let t = ox - tileW; t < W + tileW; t += tileW) {
            // Street lights (modern)
            for (let i = 0; i < 3; i++) {
              const lx = t + 80 + i * 170;
              ctx.fillStyle = '#333';
              ctx.fillRect(lx, GROUND_Y - 95, 3, 95);
              ctx.fillRect(lx - 10, GROUND_Y - 95, 23, 3);
              const glow = ctx.createRadialGradient(lx + 2, GROUND_Y - 85, 2, lx + 2, GROUND_Y - 55, 45);
              glow.addColorStop(0, 'rgba(255,240,200,0.25)');
              glow.addColorStop(1, 'rgba(255,240,200,0)');
              ctx.fillStyle = glow;
              ctx.fillRect(lx - 45, GROUND_Y - 95, 90, 75);
              ctx.fillStyle = 'rgba(255,240,200,0.8)';
              ctx.beginPath();
              ctx.arc(lx + 2, GROUND_Y - 92, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // Neon reflections
          ctx.globalAlpha = 0.03;
          const colors2 = ['#ff44aa', '#44ddff', '#ffaa22', '#44ff88'];
          for (let i = 0; i < 6; i++) {
            const rx = ((i * 170 - offset * 0.5) % W + W) % W;
            ctx.fillStyle = colors2[i % colors2.length];
            ctx.fillRect(rx, GROUND_Y + 2, 50, H - GROUND_Y);
          }
          ctx.globalAlpha = 1;
        }},

        // Layer 4: Ground — city road (1.0x)
        { speed: 1.0, draw: function (offset) {
          const roadGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
          roadGrad.addColorStop(0, '#252535');
          roadGrad.addColorStop(0.4, '#202030');
          roadGrad.addColorStop(1, '#181828');
          ctx.fillStyle = roadGrad;
          ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
          ctx.fillStyle = '#353545';
          ctx.fillRect(0, GROUND_Y, W, 3);
          // Lane markings
          ctx.strokeStyle = 'rgba(255,255,200,0.12)';
          ctx.lineWidth = 2;
          ctx.setLineDash([25, 35]);
          ctx.beginPath();
          ctx.moveTo(-(offset % 60), GROUND_Y + 28);
          ctx.lineTo(W, GROUND_Y + 28);
          ctx.stroke();
          ctx.setLineDash([]);
          // Reflections
          ctx.fillStyle = 'rgba(200,200,255,0.03)';
          for (let i = 0; i < 10; i++) {
            const rx = ((i * 97 - offset) % W + W) % W;
            ctx.fillRect(rx, GROUND_Y + 8 + srand(i + 330) * 30, 25, 1);
          }
        }}
      ];
    })()
  ];

  // Placeholder background drawers for any missing level
  const placeholderBgColors = ['#1a0a2e', '#0a1628', '#0a0a2a', '#0a1a0a', '#0a1a1a', '#1a0a28'];
  const placeholderGroundColors = ['#2a2a3a', '#1a1a28', '#1a1a1a', '#1a2a1a', '#1a1a2a', '#2a1a2a'];

  function getDefaultLayers(levelIdx) {
    const skyColor = placeholderBgColors[levelIdx] || '#0a0a1a';
    const groundColor = placeholderGroundColors[levelIdx] || '#2a2a3a';
    return [
      // Layer 0: Sky (static)
      { speed: 0, draw: function () {
        ctx.fillStyle = skyColor;
        ctx.fillRect(0, 0, W, H);
        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 40; i++) {
          const sx = (i * 137 + 50) % W;
          const sy = (i * 97 + 20) % (GROUND_Y * 0.4);
          ctx.fillRect(sx, sy, (i % 3) + 1, (i % 3) + 1);
        }
      }},
      // Layer 1: Far buildings (slow)
      { speed: 0.2, draw: function (offset) {
        ctx.fillStyle = lighten(skyColor, 15);
        for (let i = 0; i < 8; i++) {
          const bx = ((i * 160 - offset) % (W + 160)) - 80;
          const bw = 60 + (i * 37 % 40);
          const bh = 60 + (i * 53 % 50);
          ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
        }
      }},
      // Layer 2: Mid buildings (medium)
      { speed: 0.5, draw: function (offset) {
        ctx.fillStyle = lighten(skyColor, 25);
        for (let i = 0; i < 6; i++) {
          const bx = ((i * 200 - offset) % (W + 200)) - 100;
          const bw = 50 + (i * 43 % 50);
          const bh = 40 + (i * 67 % 60);
          ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
        }
      }},
      // Layer 3: Near details (fast)
      { speed: 0.8, draw: function (offset) {
        ctx.fillStyle = lighten(skyColor, 35);
        for (let i = 0; i < 10; i++) {
          const px = ((i * 120 - offset) % (W + 120)) - 60;
          ctx.fillRect(px, GROUND_Y - 10, 3, 10);
        }
      }},
      // Layer 4: Ground (full speed)
      { speed: 1.0, draw: function (offset) {
        // Ground fill
        ctx.fillStyle = groundColor;
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        // Ground line
        ctx.strokeStyle = lighten(groundColor, 20);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, GROUND_Y);
        ctx.lineTo(W, GROUND_Y);
        ctx.stroke();
        // Ground texture — scrolling dashes
        ctx.strokeStyle = lighten(groundColor, 10);
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
          const gx = ((i * 60 - offset) % (W + 60)) - 30;
          ctx.beginPath();
          ctx.moveTo(gx, GROUND_Y + 15 + (i % 3) * 12);
          ctx.lineTo(gx + 20, GROUND_Y + 15 + (i % 3) * 12);
          ctx.stroke();
        }
      }}
    ];
  }

  function updateParallax(dt) {
    const layers = getLayers();
    // Ensure offsets array matches layer count
    while (parallax.offsets.length < layers.length) parallax.offsets.push(0);

    for (let i = 0; i < layers.length; i++) {
      parallax.offsets[i] += game.speed * layers[i].speed * dt * 60;
    }
  }

  function renderParallax() {
    const layers = getLayers();
    for (let i = 0; i < layers.length; i++) {
      layers[i].draw(parallax.offsets[i]);
    }
  }

  function getLayers() {
    return levelBackgrounds[game.level] || getDefaultLayers(game.level);
  }

  function resetParallaxOffsets() {
    parallax.offsets = [];
  }

  // Utility: lighten a hex color by amount (0-255)
  function lighten(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  // --- Background Element Helpers ---
  function drawBus(x, groundY, color, label) {
    const bw = 120;
    const bh = 55;
    const by = groundY - bh;

    // Bus body
    ctx.fillStyle = color;
    ctx.beginPath();
    roundRect(ctx, x, by, bw, bh, 6);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, x, by, bw, bh, 6);
    ctx.stroke();

    // Windows stripe
    ctx.fillStyle = 'rgba(150,200,255,0.5)';
    ctx.fillRect(x + 10, by + 8, bw - 30, 18);
    // Window dividers
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const wx = x + 10 + i * 18;
      ctx.beginPath();
      ctx.moveTo(wx, by + 8);
      ctx.lineTo(wx, by + 26);
      ctx.stroke();
    }

    // Door
    ctx.fillStyle = '#333';
    ctx.fillRect(x + bw - 18, by + 15, 12, bh - 20);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + bw - 18, by + 15, 12, bh - 20);

    // Bumper
    ctx.fillStyle = '#666';
    ctx.fillRect(x - 3, groundY - 12, bw + 6, 5);

    // Wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x + 25, groundY - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + bw - 25, groundY - 3, 8, 0, Math.PI * 2);
    ctx.fill();
    // Hubcaps
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(x + 25, groundY - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + bw - 25, groundY - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Route label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + bw / 2 - 5, by + 42);

    // Headlights
    ctx.fillStyle = 'rgba(255,255,150,0.7)';
    ctx.beginPath();
    ctx.arc(x + 3, by + bh - 15, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStreetLight(x, groundY) {
    // Pole
    ctx.fillStyle = '#555';
    ctx.fillRect(x, groundY - 100, 4, 100);

    // Arm
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 8, groundY - 100, 20, 4);

    // Lamp housing
    ctx.fillStyle = '#666';
    ctx.beginPath();
    roundRect(ctx, x - 6, groundY - 104, 16, 8, 2);
    ctx.fill();

    // Light glow
    const glowGrad = ctx.createRadialGradient(x + 2, groundY - 90, 2, x + 2, groundY - 70, 50);
    glowGrad.addColorStop(0, 'rgba(255,220,130,0.25)');
    glowGrad.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x - 50, groundY - 100, 100, 80);

    // Light bulb
    ctx.fillStyle = 'rgba(255,230,150,0.8)';
    ctx.beginPath();
    ctx.arc(x + 2, groundY - 96, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParkLamp(x, groundY) {
    // Ornate pole
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x - 2, groundY - 110, 4, 110);
    // Decorative base
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(x - 10, groundY);
    ctx.lineTo(x + 10, groundY);
    ctx.lineTo(x + 5, groundY - 12);
    ctx.lineTo(x - 5, groundY - 12);
    ctx.closePath();
    ctx.fill();
    // Lamp arms (double)
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, groundY - 105);
    ctx.quadraticCurveTo(x - 18, groundY - 108, x - 20, groundY - 95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, groundY - 105);
    ctx.quadraticCurveTo(x + 18, groundY - 108, x + 20, groundY - 95);
    ctx.stroke();
    // Lamp housings
    for (const lx of [x - 20, x + 20]) {
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(lx - 6, groundY - 95);
      ctx.lineTo(lx + 6, groundY - 95);
      ctx.lineTo(lx + 4, groundY - 88);
      ctx.lineTo(lx - 4, groundY - 88);
      ctx.closePath();
      ctx.fill();
      // Warm glow
      const glow = ctx.createRadialGradient(lx, groundY - 85, 3, lx, groundY - 70, 45);
      glow.addColorStop(0, 'rgba(255,220,130,0.3)');
      glow.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 50, groundY - 100, 100, 80);
      // Bulb
      ctx.fillStyle = 'rgba(255,230,160,0.9)';
      ctx.beginPath();
      ctx.arc(lx, groundY - 88, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFlowerBed(cx, groundY) {
    // Small cluster of flowers at base
    const colors = ['#ff6688', '#ffaacc', '#ff4466', '#ee88aa', '#ffccdd'];
    for (let i = 0; i < 7; i++) {
      const fx = cx - 15 + i * 5;
      const fy = groundY - 3;
      // Stem
      ctx.strokeStyle = '#1a4a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - 6 - (i % 3) * 2);
      ctx.stroke();
      // Flower head
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.arc(fx, fy - 7 - (i % 3) * 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawChaiStall(x, groundY) {
    // Cart body
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(x, groundY - 45, 55, 45);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, groundY - 45, 55, 45);

    // Cart roof (tarp)
    ctx.fillStyle = '#cc4422';
    ctx.beginPath();
    ctx.moveTo(x - 5, groundY - 45);
    ctx.lineTo(x + 60, groundY - 45);
    ctx.lineTo(x + 58, groundY - 55);
    ctx.lineTo(x - 3, groundY - 55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#aa3318';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Counter top
    ctx.fillStyle = '#6a4a3a';
    ctx.fillRect(x - 2, groundY - 30, 59, 3);

    // Chai sign
    ctx.fillStyle = '#ffcc44';
    ctx.shadowColor = '#ffcc44';
    ctx.shadowBlur = 6;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHAI', x + 27, groundY - 47);
    ctx.shadowBlur = 0;

    // Cups on counter
    ctx.fillStyle = '#ddd';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + 8 + i * 14, groundY - 35, 6, 5);
    }

    // Steam wisps
    ctx.strokeStyle = 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const sx = x + 10 + i * 14;
      ctx.beginPath();
      ctx.moveTo(sx, groundY - 36);
      ctx.quadraticCurveTo(sx + 3, groundY - 42, sx - 1, groundY - 48);
      ctx.stroke();
    }

    // Wheels
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x + 10, groundY - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 45, groundY - 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function renderGame() {
    // Screen shake
    ctx.save();
    if (game.screenShake > 0) {
      const intensity = game.screenShake * 0.5;
      ctx.translate(
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity
      );
      game.screenShake--;
    }

    // Parallax background layers
    renderParallax();

    // Obstacles
    renderObstacles();

    // Collectibles
    renderCollectibles();

    // Villain
    if (game.villainActive || game.villainPhase === 4) renderVillainScene();

    // Particles (behind player)
    renderParticles();

    // Player character
    renderPlayerCharacter();

    // Thought bubble
    renderThoughtBubble();

    ctx.restore(); // end screen shake transform

    // HUD (not affected by shake)
    renderHUD();

    // Level transition overlay
    if (game.state === State.LEVEL_TRANSITION) {
      renderLevelTransition();
    }

    // Daze visual effect — swirling hearts/stars above head
    if (player.state === 'daze') {
      const cx = player.x + player.w / 2;
      const cy = player.y - player.h - 15;
      for (let i = 0; i < 3; i++) {
        const angle = game.frameCount * 0.08 + i * Math.PI * 2 / 3;
        const dx = Math.cos(angle) * 15;
        const dy = Math.sin(angle) * 6;
        ctx.fillStyle = i % 2 === 0 ? '#ff69b4' : '#ffcc00';
        if (i % 2 === 0) {
          drawHeart(cx + dx, cy + dy, 4);
        } else {
          drawStar(cx + dx, cy + dy, 4);
        }
      }
    }
  }

  // --- Prasad Chibi Character Drawing ---
  function drawPrasad(x, y, state, animFrame) {
    // x, y = bottom-center of character
    // Character is ~40w x 60h standing
    ctx.save();
    ctx.translate(x, y);

    const isSlide = state === 'slide';
    const isJump = state === 'jump';

    if (isSlide) {
      // Rotate and shift for sliding pose
      ctx.translate(10, -12);
      ctx.rotate(Math.PI / 2.5);
    }

    const bounce = (!isSlide && !isJump) ? Math.sin(animFrame * Math.PI / 2) * 2 : 0;
    const legSwing = (!isSlide && !isJump) ? Math.sin(animFrame * Math.PI / 2) * 0.3 : 0;

    // --- Legs (behind body) ---
    drawLegs(legSwing, bounce);

    // --- Body / Shirt ---
    drawBody(bounce);

    // --- Arms ---
    drawArms(animFrame, bounce, isSlide, isJump);

    // --- Head ---
    drawHead(bounce, animFrame);

    ctx.restore();
  }

  function drawLegs(legSwing, bounce) {
    ctx.save();
    ctx.translate(0, -bounce);

    // Left leg
    ctx.save();
    ctx.translate(-6, -4);
    ctx.rotate(legSwing);
    // Pant leg — dark jeans
    ctx.fillStyle = '#2a3a5c';
    ctx.beginPath();
    roundRect(ctx, -5, -2, 10, 18, 3);
    ctx.fill();
    ctx.strokeStyle = '#1a2a4c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -5, -2, 10, 18, 3);
    ctx.stroke();
    // Shoe
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    roundRect(ctx, -6, 14, 13, 6, 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -6, 14, 13, 6, 2);
    ctx.stroke();
    // Shoe accent stripe
    ctx.fillStyle = '#ff4466';
    ctx.fillRect(-4, 16, 9, 2);
    ctx.restore();

    // Right leg
    ctx.save();
    ctx.translate(6, -4);
    ctx.rotate(-legSwing);
    ctx.fillStyle = '#2a3a5c';
    ctx.beginPath();
    roundRect(ctx, -5, -2, 10, 18, 3);
    ctx.fill();
    ctx.strokeStyle = '#1a2a4c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -5, -2, 10, 18, 3);
    ctx.stroke();
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath();
    roundRect(ctx, -6, 14, 13, 6, 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -6, 14, 13, 6, 2);
    ctx.stroke();
    ctx.fillStyle = '#ff4466';
    ctx.fillRect(-4, 16, 9, 2);
    ctx.restore();

    ctx.restore();
  }

  function drawBody(bounce) {
    ctx.save();
    ctx.translate(0, -bounce);

    // Shirt — casual blue-grey tee
    ctx.fillStyle = '#4a7a9a';
    ctx.beginPath();
    roundRect(ctx, -12, -24, 24, 22, 4);
    ctx.fill();

    // Shirt outline
    ctx.strokeStyle = '#3a6080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, -12, -24, 24, 22, 4);
    ctx.stroke();

    // Shirt collar (V-neck)
    ctx.strokeStyle = '#3a6080';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -24);
    ctx.lineTo(0, -18);
    ctx.lineTo(5, -24);
    ctx.stroke();

    // Shirt wrinkle details
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-4, -16);
    ctx.lineTo(-2, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.lineTo(3, -12);
    ctx.stroke();

    ctx.restore();
  }

  function drawArms(animFrame, bounce, isSlide, isJump) {
    ctx.save();
    ctx.translate(0, -bounce);

    const armSwing = (!isSlide && !isJump) ? Math.sin(animFrame * Math.PI / 2) * 0.35 : 0;

    // Left arm
    ctx.save();
    ctx.translate(-13, -22);
    ctx.rotate(-0.2 + armSwing);
    // Upper arm (sleeve)
    ctx.fillStyle = '#4a7a9a';
    ctx.beginPath();
    roundRect(ctx, -4, 0, 8, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#3a6080';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -4, 0, 8, 10, 2);
    ctx.stroke();
    // Forearm (skin)
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    roundRect(ctx, -3, 9, 6, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -3, 9, 6, 10, 2);
    ctx.stroke();
    // Bracelet on left wrist
    ctx.fillStyle = '#ff4466';
    ctx.fillRect(-3, 16, 6, 3);
    ctx.strokeStyle = '#cc2244';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, 16, 6, 3);
    // Hand
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.arc(0, 21, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 21, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Right arm
    ctx.save();
    ctx.translate(13, -22);
    ctx.rotate(0.2 - armSwing);
    ctx.fillStyle = '#4a7a9a';
    ctx.beginPath();
    roundRect(ctx, -4, 0, 8, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#3a6080';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -4, 0, 8, 10, 2);
    ctx.stroke();
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    roundRect(ctx, -3, 9, 6, 10, 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, -3, 9, 6, 10, 2);
    ctx.stroke();
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.arc(0, 21, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 21, 3.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawHead(bounce, animFrame) {
    ctx.save();
    ctx.translate(0, -bounce);
    const headY = -28;

    // --- Hair back layer (behind head) ---
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, headY - 2, 17, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Head shape (face) ---
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.ellipse(0, headY, 14, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face outline
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, headY, 14, 15, 0, 0, Math.PI * 2);
    ctx.stroke();

    // --- Hair top ---
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, headY - 8, 15, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Hair swoop / side part
    ctx.beginPath();
    ctx.moveTo(-14, headY - 4);
    ctx.quadraticCurveTo(-16, headY - 14, -4, headY - 17);
    ctx.quadraticCurveTo(6, headY - 18, 14, headY - 10);
    ctx.quadraticCurveTo(16, headY - 4, 14, headY);
    ctx.quadraticCurveTo(10, headY - 6, 0, headY - 8);
    ctx.quadraticCurveTo(-8, headY - 6, -14, headY - 2);
    ctx.closePath();
    ctx.fill();
    // Hair shine
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(-4, headY - 14, 5, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // --- Ears ---
    ctx.fillStyle = '#c68642';
    // Left ear
    ctx.beginPath();
    ctx.ellipse(-13, headY + 2, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-13, headY + 2, 3, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Right ear
    ctx.beginPath();
    ctx.ellipse(13, headY + 2, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(13, headY + 2, 3, 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // --- Eyes (big chibi style) ---
    // Left eye white
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-5, headY - 1, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right eye white
    ctx.beginPath();
    ctx.ellipse(5, headY - 1, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris (dark brown)
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.ellipse(-5, headY, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, headY, 3.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-5, headY + 1, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, headY + 1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine (top-left sparkle)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, headY - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, headY - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Secondary smaller shine
    ctx.beginPath();
    ctx.arc(-3.5, headY + 2, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6.5, headY + 2, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Eye outlines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-5, headY - 1, 5, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(5, headY - 1, 5, 6, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eyebrows (thick, expressive)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-9, headY - 8);
    ctx.quadraticCurveTo(-5, headY - 10, -1, headY - 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1, headY - 8);
    ctx.quadraticCurveTo(5, headY - 10, 9, headY - 8);
    ctx.stroke();

    // --- Nose (small chibi) ---
    ctx.fillStyle = '#b0723a';
    ctx.beginPath();
    ctx.ellipse(0, headY + 5, 1.5, 1, 0, 0, Math.PI);
    ctx.fill();

    // --- Mouth (small smile) ---
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, headY + 8, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // --- Beard / stubble ---
    ctx.fillStyle = 'rgba(26,26,46,0.25)';
    ctx.beginPath();
    ctx.moveTo(-8, headY + 6);
    ctx.quadraticCurveTo(-10, headY + 12, -4, headY + 14);
    ctx.quadraticCurveTo(0, headY + 15, 4, headY + 14);
    ctx.quadraticCurveTo(10, headY + 12, 8, headY + 6);
    ctx.quadraticCurveTo(4, headY + 8, 0, headY + 8);
    ctx.quadraticCurveTo(-4, headY + 8, -8, headY + 6);
    ctx.closePath();
    ctx.fill();
    // Stubble dots
    ctx.fillStyle = 'rgba(26,26,46,0.3)';
    const stubblePoints = [
      [-6, headY + 10], [-3, headY + 11], [0, headY + 12],
      [3, headY + 11], [6, headY + 10], [-5, headY + 8],
      [5, headY + 8], [-2, headY + 13], [2, headY + 13]
    ];
    for (const [sx, sy] of stubblePoints) {
      ctx.beginPath();
      ctx.arc(sx, sy, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Blush (cheeks) ---
    ctx.fillStyle = 'rgba(255,100,120,0.2)';
    ctx.beginPath();
    ctx.ellipse(-8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, headY + 4, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function renderPlayerCharacter() {
    const p = player;
    const cx = p.x + p.w / 2; // center x
    const by = p.y;            // bottom y

    // Invincibility flash — skip every other frame
    if (game.invincible && Math.floor(game.frameCount / 3) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    drawPrasad(cx, by, p.state, p.animFrame);

    ctx.globalAlpha = 1;

    // Shield glow
    if (game.shieldActive) {
      ctx.strokeStyle = 'rgba(255,105,180,0.6)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.ellipse(cx, by - 30, 24, 34, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Love Burst aura
    if (game.loveBurstActive) {
      const pulse = 0.4 + Math.sin(game.frameCount * 0.15) * 0.2;
      ctx.fillStyle = `rgba(255,105,180,${pulse})`;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.ellipse(cx, by - 30, 28, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // --- Prasad's Thoughts about Arya ---
  const levelThoughts = [
    // Level 0: Pategaon
    [
      "Someone else might wish her first!",
      "Her phone must be blowing up already...",
      "I HAVE to be the first one!",
      "What if her best friend texts her at 12:01?!",
      "Run faster, Prasad... RUN!"
    ],
    // Level 1: Paithan
    [
      "She's probably staring at her phone...",
      "If someone wishes her before me...",
      "She'll never let me hear the end of it!",
      "I can already see her angry text...",
      "'You didn't even wish me first?!' — NO WAY!"
    ],
    // Level 2: Dhorkin
    [
      "Halfway there... nobody better text her!",
      "Her cousins are probably already typing...",
      "I need to be there IN PERSON, not just a text!",
      "A text won't cut it. I need to say it to her face!",
      "What if she checks her phone and I'm not first..."
    ],
    // Level 3: Bidkin
    [
      "Almost to the city... hold on Arya!",
      "Don't check your phone yet, please...",
      "I'm coming with the first wish, IN PERSON!",
      "Her family is probably already celebrating...",
      "I'll make it... I HAVE to make it!"
    ],
    // Level 4: Kanchanwadi
    [
      "I can see the city lights!",
      "Please don't look at your phone, Arya...",
      "What if 50 people already wished her?!",
      "No... a text is nothing. I'M coming!",
      "Just a little more... don't give up!"
    ],
    // Level 5: Aurangabad
    [
      "I'm here! Almost there!",
      "Her family won't stop me!",
      "Nothing can stop me now!",
      "Arya, your FIRST wish is coming!",
      "This is it... I'm going to make it!"
    ]
  ];

  function updateThoughts(dt) {
    // Don't show during villain encounter
    if (game.villainActive) {
      game.thoughtTimer = 0;
      return;
    }

    // Cooldown between thoughts
    if (game.thoughtCooldown > 0) {
      game.thoughtCooldown -= dt;
      return;
    }

    // Active thought fading out
    if (game.thoughtTimer > 0) {
      game.thoughtTimer -= dt;
      return;
    }

    // Spawn new thought every ~8-12 seconds
    if (game.thoughtCooldown <= 0 && game.thoughtTimer <= 0) {
      const thoughts = levelThoughts[game.level] || levelThoughts[0];
      game.thoughtText = thoughts[game.thoughtIndex % thoughts.length];
      game.thoughtIndex++;
      game.thoughtTimer = 3.5; // visible for 3.5 seconds
      game.thoughtCooldown = 6 + Math.random() * 4; // wait 6-10 seconds before next
    }
  }

  function renderThoughtBubble() {
    if (game.thoughtTimer <= 0) return;

    const fadeIn = Math.min((3.5 - game.thoughtTimer) / 0.4, 1); // fade in over 0.4s
    const fadeOut = Math.min(game.thoughtTimer / 0.5, 1); // fade out over 0.5s
    const alpha = Math.min(fadeIn, fadeOut);

    ctx.globalAlpha = alpha * 0.95;

    const px = player.x + player.w / 2;
    const py = player.y - player.h - 15;

    // Measure text
    ctx.font = 'italic 12px "Segoe UI", sans-serif';
    const textW = ctx.measureText(game.thoughtText).width;
    const padX = 12;
    const padY = 8;
    const bw = textW + padX * 2;
    const bh = 24;
    const bx = px - bw / 2 + 15;
    const by = py - bh - 12;

    // Cloud-style thought bubble (rounded with circles)
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Thought bubble trail (small circles leading to head)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(px + 8, py - 8, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 12, py - 14, 3, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#555';
    ctx.font = 'italic 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.thoughtText, bx + bw / 2, by + bh - 7);

    // Small heart at end of thought
    ctx.fillStyle = 'rgba(255,105,180,0.5)';
    drawHeart(bx + bw - 6, by + 6, 4);

    ctx.globalAlpha = 1;
  }

  function renderHUD() {
    ctx.save();

    // === Top-left: Clock Timer ===
    const startSeconds = 0; // 12:00:00 AM (midnight)
    const elapsed = game.countdownTotal - game.countdownRemaining;
    const currentSeconds = startSeconds + elapsed;
    const hrs = Math.floor(currentSeconds / 3600) % 24;
    const mins = Math.floor((currentSeconds % 3600) / 60);
    const secs = Math.floor(currentSeconds % 60);
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const h12 = hrs % 12 || 12;
    const timeStr = `${h12}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} ${ampm}`;

    // Timer background panel
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    roundRect(ctx, 6, 6, 155, 28, 6);
    ctx.fill();

    // Clock icon
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(22, 20, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 20);
    ctx.lineTo(22, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 20);
    ctx.lineTo(27, 20);
    ctx.stroke();

    // Time text
    let timerColor = '#fff';
    if (game.countdownRemaining < 60) {
      timerColor = game.frameCount % 20 < 10 ? '#ff3333' : '#ff8888';
    } else if (game.countdownRemaining < 120) {
      timerColor = '#ffaa00';
    }
    ctx.fillStyle = timerColor;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(timeStr, 35, 25);

    // === Top-right: Health Hearts ===
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    roundRect(ctx, W - 100, 6, 94, 28, 6);
    ctx.fill();

    for (let i = 0; i < game.maxHealth; i++) {
      const hx = W - 92 + i * 28;
      const hy = 20;
      if (i < game.health) {
        ctx.fillStyle = '#ff4466';
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur = 4;
        drawHeart(hx, hy, 9);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#333';
        drawHeart(hx, hy, 9);
      }
    }

    // === Top-center: Level name & progress ===
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 110, 6, 220, 38, 6);
    ctx.fill();

    // Level name
    ctx.fillStyle = '#ffb6c1';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${levels[game.level].name}  (${game.level + 1}/${game.totalLevels})`, W / 2, 22);

    // Distance progress bar
    const barW = 190;
    const barH = 10;
    const barX = W / 2 - barW / 2;
    const barY = 30;
    const progress = Math.min(game.levelDistance / game.levelLength, 1);

    // Bar background
    ctx.fillStyle = '#1a1a2a';
    ctx.beginPath();
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    // Bar fill with gradient
    if (progress > 0.01) {
      const barGrad = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      barGrad.addColorStop(0, '#ff69b4');
      barGrad.addColorStop(1, '#ff9ecc');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      roundRect(ctx, barX, barY, barW * progress, barH, 4);
      ctx.fill();
    }

    // Bar border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.stroke();

    // Runner icon on progress bar
    const runnerX = barX + barW * progress - 4;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(runnerX, barY + barH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Heart icon at end of bar (destination)
    ctx.fillStyle = '#ff69b4';
    drawHeart(barX + barW + 6, barY + barH / 2, 5);

    // === Bottom-left: Score ===
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    roundRect(ctx, 6, H - 34, 110, 28, 6);
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`★ ${game.score}`, 14, H - 15);

    // === Bottom-center: Love Meter ===
    if (game.loveMeter > 0) {
      const lmW = 120;
      const lmH = 10;
      const lmX = W / 2 - lmW / 2;
      const lmY = H - 25;

      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      roundRect(ctx, lmX - 5, lmY - 6, lmW + 10, lmH + 12, 6);
      ctx.fill();

      // Label
      ctx.fillStyle = '#ff69b4';
      ctx.font = '9px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOVE', W / 2, lmY - 1);

      // Bar background
      ctx.fillStyle = '#1a1a2a';
      ctx.beginPath();
      roundRect(ctx, lmX, lmY + 2, lmW, lmH, 4);
      ctx.fill();

      // Bar fill
      const loveProg = Math.min(game.loveMeter / game.maxLoveMeter, 1);
      if (loveProg > 0.01) {
        const loveGrad = ctx.createLinearGradient(lmX, 0, lmX + lmW * loveProg, 0);
        loveGrad.addColorStop(0, '#ff3366');
        loveGrad.addColorStop(1, '#ff69b4');
        ctx.fillStyle = loveGrad;
        ctx.beginPath();
        roundRect(ctx, lmX, lmY + 2, lmW * loveProg, lmH, 4);
        ctx.fill();
      }
    }

    // === Shield indicator ===
    if (game.shieldActive) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      roundRect(ctx, W - 100, H - 34, 94, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#ff69b4';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`SHIELD ${Math.ceil(game.shieldTimer)}s`, W - 14, H - 15);
    }

    // === Love Burst indicator ===
    if (game.loveBurstActive) {
      const lbFlash = 0.7 + Math.sin(game.frameCount * 0.12) * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      roundRect(ctx, W - 120, H - 34, 114, 28, 6);
      ctx.fill();
      ctx.fillStyle = `rgba(255,105,180,${lbFlash})`;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`LOVE BURST ${Math.ceil(game.loveBurstTimer)}s`, W - 14, H - 15);
    }

    // === Daze indicator ===
    if (player.state === 'daze') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      roundRect(ctx, W / 2 - 70, H / 2 + 50, 140, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO BREAK FREE!', W / 2, H / 2 + 70);
      // Tap progress dots
      for (let i = 0; i < player.dazeTapsNeeded; i++) {
        ctx.fillStyle = i < player.dazeTapCount ? '#ff69b4' : '#555';
        ctx.beginPath();
        ctx.arc(W / 2 - 30 + i * 15, H / 2 + 85, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === Final stretch indicator ===
    if (game.finalStretch) {
      const flashAlpha = 0.5 + Math.sin(game.frameCount * 0.1) * 0.3;
      ctx.fillStyle = `rgba(255,105,180,${flashAlpha})`;
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ALMOST THERE!', W / 2, 62);
    }

    // === Villain fight hint ===
    if (game.villainActive && game.villainPhase === 2) {
      const hintAlpha = 0.6 + Math.sin(game.frameCount * 0.08) * 0.3;
      ctx.fillStyle = `rgba(255,68,68,${hintAlpha})`;
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JUMP ON THEM TO GET PAST!', W / 2, 62);
    }

    // === Auto-play indicator ===
    if (autoPlay) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      roundRect(ctx, W / 2 - 50, H - 50, 100, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#88ff88';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('AUTO PLAY', W / 2, H - 34);
    }

    ctx.restore();
  }

  function renderTitle() {
    // --- Background: Split night scene ---
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a0520');
    grad.addColorStop(0.5, '#1a0a3a');
    grad.addColorStop(1, '#2a1040');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Stars (twinkling with frameCount)
    for (let i = 0; i < 70; i++) {
      const sx = (i * 137 + 50) % W;
      const sy = (i * 97 + 30) % (H * 0.5);
      const size = (i % 3) + 0.5;
      const twinkle = 0.2 + Math.sin(game.frameCount * 0.03 + i * 1.3) * 0.3;
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = i % 7 === 0 ? '#aaccff' : '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    const mx = W * 0.82, my = 60;
    const moonGlow = ctx.createRadialGradient(mx, my, 15, mx, my, 80);
    moonGlow.addColorStop(0, 'rgba(220,220,255,0.15)');
    moonGlow.addColorStop(1, 'rgba(220,220,255,0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(mx, my, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eeeef8';
    ctx.beginPath();
    ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.fill();

    // Ground
    ctx.fillStyle = '#1a1228';
    ctx.fillRect(0, H - 80, W, 80);
    ctx.fillStyle = '#221838';
    ctx.fillRect(0, H - 80, W, 3);

    // --- Prasad on the left side ---
    drawPrasad(180, H - 80, 'run', Math.floor(game.frameCount / 10) % 4);

    // --- Arya silhouette on the right ---
    drawAryaSilhouette(W - 180, H - 80);

    // --- Connecting heart trail between them ---
    for (let i = 0; i < 5; i++) {
      const t = (game.frameCount * 0.01 + i * 0.2) % 1;
      const hx = 220 + (W - 400) * t;
      const hy = H - 120 + Math.sin(t * Math.PI) * -30;
      ctx.globalAlpha = 0.15 + (1 - t) * 0.3;
      ctx.fillStyle = '#ff69b4';
      drawHeart(hx, hy, 4 + t * 3);
    }
    ctx.globalAlpha = 1;

    // --- Title text with shadow ---
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff69b4';
    ctx.font = 'bold 44px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Run to Midnight Kiss', W / 2, 120);
    ctx.shadowBlur = 0;

    // Title outline
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeText('Run to Midnight Kiss', W / 2, 120);

    // Subtitle
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '17px "Segoe UI", sans-serif';
    ctx.fillText("It's midnight! Race to wish Arya before anyone else!", W / 2, 155);

    // Clock display
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('12:00 AM', W / 2, 190);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText("It's her birthday! Wish her before anyone else!", W / 2, 210);

    // --- START button (animated pulse) ---
    const pulse = 1 + Math.sin(game.frameCount * 0.05) * 0.03;
    const btnW = 200 * pulse;
    const btnH = 52;
    const btnX = (W - btnW) / 2;
    const btnY = 270;

    // Button glow
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 15;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#ff69b4');
    btnGrad.addColorStop(1, '#cc3377');
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 14);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Button border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 14);
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillText('START', W / 2, btnY + 35);

    menuButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: startGame });

    // --- AUTO PLAY button ---
    const abW = 140;
    const abH = 36;
    const abX = (W - abW) / 2;
    const abY = btnY + btnH + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    roundRect(ctx, abX, abY, abW, abH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    roundRect(ctx, abX, abY, abW, abH, 10);
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText('AUTO PLAY', W / 2, abY + 24);

    menuButtons.push({ x: abX, y: abY, w: abW, h: abH, action: startAutoPlay });

    // --- Controls hint ---
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 200, 345, 400, 60, 8);
    ctx.fill();

    ctx.fillStyle = '#bbb';
    ctx.font = '13px monospace';
    ctx.fillText('Space / ↑  =  Jump  (double jump!)', W / 2, 365);
    ctx.fillText('↓  =  Slide    |    Esc  =  Pause', W / 2, 385);
    ctx.fillStyle = '#888';
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.fillText('Collect hearts, coins, chai & roses along the way!', W / 2, 400);

    // --- Story blurb at bottom ---
    ctx.fillStyle = '#7a6a8a';
    ctx.font = 'italic 12px "Segoe UI", sans-serif';
    ctx.fillText('Pategaon → Paithan → Dhorkin → Bidkin → Kanchanwadi → Aurangabad', W / 2, H - 25);
    ctx.fillText("Wish her first. Her family won't make it easy.", W / 2, H - 10);
  }

  // Arya silhouette for title screen
  function drawAryaSilhouette(x, groundY) {
    ctx.save();
    ctx.translate(x, groundY);

    // Dress
    ctx.fillStyle = '#cc3366';
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.lineTo(12, -4);
    ctx.lineTo(10, -20);
    ctx.lineTo(-10, -20);
    ctx.closePath();
    ctx.fill();

    // Body / torso
    ctx.fillStyle = '#cc3366';
    ctx.beginPath();
    roundRect(ctx, -9, -30, 18, 14, 3);
    ctx.fill();

    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.ellipse(0, -40, 12, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -40, 12, 13, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Hair — long flowing
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, -48, 13, 10, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Side hair
    ctx.fillRect(-13, -45, 4, 30);
    ctx.fillRect(9, -45, 4, 30);
    // Hair back
    ctx.beginPath();
    ctx.moveTo(-13, -40);
    ctx.quadraticCurveTo(-15, -20, -10, -10);
    ctx.lineTo(-13, -40);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(13, -40);
    ctx.quadraticCurveTo(15, -20, 10, -10);
    ctx.lineTo(13, -40);
    ctx.fill();

    // Eyes (looking toward Prasad — left)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-4, -41, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -41, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a0a';
    ctx.beginPath();
    ctx.ellipse(-5, -40, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(3, -40, 2.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sparkle
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-6, -42, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -42, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(255,100,120,0.25)';
    ctx.beginPath();
    ctx.ellipse(-7, -37, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7, -37, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -36, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Bindi
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(0, -48, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dupatta / scarf accent
    ctx.fillStyle = 'rgba(255,150,200,0.5)';
    ctx.beginPath();
    ctx.moveTo(10, -25);
    ctx.quadraticCurveTo(20, -15, 15, 0);
    ctx.lineTo(12, -4);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.fill();

    // Shoes
    ctx.fillStyle = '#aa2244';
    ctx.beginPath();
    roundRect(ctx, -8, -2, 7, 4, 1);
    ctx.fill();
    ctx.beginPath();
    roundRect(ctx, 2, -2, 7, 4, 1);
    ctx.fill();

    ctx.restore();
  }

  function renderPauseOverlay() {
    // Dimmed backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    // Center panel
    ctx.fillStyle = 'rgba(20,10,40,0.85)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 150, H / 2 - 90, 300, 200, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,105,180,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, W / 2 - 150, H / 2 - 90, 300, 200, 16);
    ctx.stroke();

    // Pause icon (two bars)
    ctx.fillStyle = '#ff69b4';
    ctx.fillRect(W / 2 - 14, H / 2 - 70, 10, 30);
    ctx.fillRect(W / 2 + 4, H / 2 - 70, 10, 30);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, H / 2 - 20);

    // Stats while paused
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    ctx.fillText(`Score: ${game.score}  |  Level: ${game.level + 1}/${game.totalLevels}`, W / 2, H / 2 + 5);

    // Resume button
    const btnW = 170;
    const btnH = 45;
    const btnX = (W - btnW) / 2;
    const btnY = H / 2 + 25;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#ff69b4');
    btnGrad.addColorStop(1, '#cc3377');
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('RESUME', W / 2, btnY + 30);

    menuButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: resumeGame });

    ctx.fillStyle = '#666';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText('Esc / P to resume', W / 2, btnY + 65);
  }

  function renderGameOverOverlay() {
    // Dark red-tinted overlay
    ctx.fillStyle = 'rgba(20,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    // Center panel
    ctx.fillStyle = 'rgba(30,5,15,0.9)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 180, H / 2 - 130, 360, 280, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,68,100,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, W / 2 - 180, H / 2 - 130, 360, 280, 16);
    ctx.stroke();

    // Sad Prasad (small chibi with sad eyes)
    ctx.save();
    ctx.translate(W / 2, H / 2 - 65);
    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Hair
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.ellipse(0, -10, 19, 12, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Sad eyes (closed downward)
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-6, -2, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(6, -2, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Tear drops
    ctx.fillStyle = '#66aaff';
    ctx.beginPath();
    ctx.ellipse(-9, 6, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, 8, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Sad mouth
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 14, 4, Math.PI + 0.3, -0.3);
    ctx.stroke();
    ctx.restore();

    // Title
    ctx.fillStyle = '#ff4466';
    ctx.shadowColor = '#ff4466';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("TOO LATE!", W / 2, H / 2 - 15);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText("Someone else wished Arya first...", W / 2, H / 2 + 15);

    // Stats
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${game.score}`, W / 2, H / 2 + 45);
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`Reached: ${levels[Math.min(game.level, 5)].name} (Level ${game.level + 1})`, W / 2, H / 2 + 65);

    // Broken heart
    ctx.fillStyle = '#444';
    drawHeart(W / 2, H / 2 + 85, 10);
    ctx.strokeStyle = '#ff4466';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 1, H / 2 + 75);
    ctx.lineTo(W / 2 + 2, H / 2 + 95);
    ctx.stroke();

    // Retry button
    const btnW = 180;
    const btnH = 48;
    const btnX = (W - btnW) / 2;
    const btnY = H / 2 + 100;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#ff4466');
    btnGrad.addColorStop(1, '#cc2244');
    ctx.fillStyle = btnGrad;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('TRY AGAIN', W / 2, btnY + 32);

    menuButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: startGame });
  }

  // ============================================================
  // Victory Cutscene
  // ============================================================

  function updateCutscene(dt) {
    game.frameCount++;
    cutscene.timer += dt;

    switch (cutscene.phase) {
      case 0:
        // Phase 0: Prasad walks forward, father fades out
        cutscene.prasadX += 1.5;
        cutscene.fatherAlpha -= dt * 0.5;
        if (cutscene.fatherAlpha <= 0) {
          cutscene.fatherAlpha = 0;
        }
        if (cutscene.timer > 3) {
          cutscene.phase = 1;
          cutscene.timer = 0;
          cutscene.prasadX = W / 2 - 60;
        }
        break;

      case 1:
        // Phase 1: Arya walks in from right toward Prasad
        cutscene.aryaX -= 2;
        if (cutscene.aryaX <= W / 2 + 60) {
          cutscene.aryaX = W / 2 + 60;
        }
        if (cutscene.timer > 2.5) {
          cutscene.phase = 2;
          cutscene.timer = 0;
          cutscene.dialogueIndex = 0;
          cutscene.dialogueTimer = 0;
        }
        break;

      case 2:
        // Phase 2: Dialogues — each shows for ~2.5 seconds
        cutscene.dialogueTimer += dt;
        if (cutscene.dialogueTimer > 4.0) {
          cutscene.dialogueTimer = 0;
          cutscene.dialogueIndex++;
          if (cutscene.dialogueIndex >= dialogues.length) {
            cutscene.phase = 3;
            cutscene.timer = 0;
          }
        }
        // Walk closer during dialogues
        if (cutscene.prasadX < W / 2 - 20) cutscene.prasadX += 0.3;
        if (cutscene.aryaX > W / 2 + 20) cutscene.aryaX -= 0.3;
        break;

      case 3:
        // Phase 3: They come together for the kiss
        if (cutscene.prasadX < W / 2 - 8) cutscene.prasadX += 0.8;
        if (cutscene.aryaX > W / 2 + 8) cutscene.aryaX -= 0.8;
        if (cutscene.timer > 2) {
          cutscene.phase = 4;
          cutscene.timer = 0;
          sfx.victory();
        }
        break;

      case 4:
        // Phase 4: Kiss — hearts burst, hold, then show play again
        if (cutscene.timer > 3 && !cutscene.showPlayAgain) {
          cutscene.showPlayAgain = true;
        }
        break;
    }
  }

  function renderCutscene() {
    // Draw the game background
    renderParallax();

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,10,0.3)';
    ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = '#252535';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // --- Father (fading out in phase 0) ---
    if (cutscene.fatherAlpha > 0 && cutscene.phase <= 0) {
      ctx.globalAlpha = cutscene.fatherAlpha;
      drawFatherDefeated(cutscene.fatherX, GROUND_Y);
      ctx.globalAlpha = 1;
    }

    // --- Prasad walking ---
    const walkFrame = Math.floor(game.frameCount / 8) % 4;
    drawPrasad(cutscene.prasadX, GROUND_Y, 'run', walkFrame);
    if (cutscene.phase < 4) drawNpcLabel(cutscene.prasadX, GROUND_Y - 75, 'PRASAD');

    // --- Arya (visible from phase 1+) ---
    if (cutscene.phase >= 1) {
      drawAryaSilhouette(cutscene.aryaX, GROUND_Y);
      if (cutscene.phase < 4) drawNpcLabel(cutscene.aryaX, GROUND_Y - 75, 'ARYA');
    }

    // --- Kiss effect (phase 4) ---
    if (cutscene.phase === 4) {
      // Big heart above them
      const pulse = 14 + Math.sin(game.frameCount * 0.06) * 4;
      ctx.fillStyle = '#ff3366';
      ctx.shadowColor = '#ff3366';
      ctx.shadowBlur = 30;
      drawHeart(W / 2, GROUND_Y - 90, pulse);
      ctx.shadowBlur = 0;

      // Orbiting hearts
      for (let i = 0; i < 8; i++) {
        const a = game.frameCount * 0.03 + i * Math.PI / 4;
        const r = 25 + Math.sin(game.frameCount * 0.04 + i) * 8;
        const hx = W / 2 + Math.cos(a) * r;
        const hy = GROUND_Y - 65 + Math.sin(a) * r * 0.4;
        ctx.globalAlpha = 0.5 + Math.sin(game.frameCount * 0.05 + i * 1.5) * 0.3;
        ctx.fillStyle = i % 3 === 0 ? '#ffcc00' : '#ff69b4';
        drawHeart(hx, hy, 3 + (i % 3));
      }
      ctx.globalAlpha = 1;

      // Sparkles
      for (let i = 0; i < 6; i++) {
        const sx = W / 2 - 40 + (i * 67 % 80);
        const sy = GROUND_Y - 80 + Math.sin(game.frameCount * 0.07 + i * 2) * 20;
        ctx.globalAlpha = 0.3 + Math.sin(game.frameCount * 0.1 + i) * 0.3;
        ctx.fillStyle = '#ffee88';
        drawStar(sx, sy, 3);
      }
      ctx.globalAlpha = 1;

      // "KISS!" text
      const kissAlpha = 0.6 + Math.sin(game.frameCount * 0.08) * 0.4;
      ctx.fillStyle = `rgba(255,105,180,${kissAlpha})`;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 15;
      ctx.font = 'bold 28px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💕 KISS! 💕', W / 2, GROUND_Y - 110);
      ctx.shadowBlur = 0;
    }

    // --- Dialogue bubbles (phase 2+) ---
    if (cutscene.phase >= 2 && cutscene.dialogueIndex >= 0 && cutscene.dialogueIndex < dialogues.length) {
      const d = dialogues[cutscene.dialogueIndex];
      const fadeIn = Math.min(cutscene.dialogueTimer / 0.3, 1);
      ctx.globalAlpha = fadeIn;

      if (d.speaker === 'prasad') {
        drawSpeechBubble(cutscene.prasadX, GROUND_Y - 80, d.text, 'left');
      } else {
        drawSpeechBubble(cutscene.aryaX, GROUND_Y - 80, d.text, 'right');
      }
      ctx.globalAlpha = 1;
    }

    // --- Clock at top ---
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 80, 10, 160, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('12:00 AM', W / 2, 32);

    // --- Happy Birthday text (phase 3+) ---
    if (cutscene.phase >= 3) {
      ctx.fillStyle = '#ffcc44';
      ctx.shadowColor = '#ffcc44';
      ctx.shadowBlur = 10;
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.fillText('Happy Birthday, Arya!', W / 2, 70);
      ctx.shadowBlur = 0;
    }

    // --- Score display (phase 4) ---
    if (cutscene.phase === 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      roundRect(ctx, W / 2 - 90, H - 75, 180, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffcc44';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Score: ${game.score}`, W / 2, H - 50);
    }

    // --- Play Again button (after phase 4 wait) ---
    if (cutscene.showPlayAgain) {
      const btnW = 180;
      const btnH = 45;
      const btnX = (W - btnW) / 2;
      const btnY = H - 60;
      const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
      btnGrad.addColorStop(0, '#ff69b4');
      btnGrad.addColorStop(1, '#cc3377');
      ctx.fillStyle = btnGrad;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      roundRect(ctx, btnX, btnY, btnW, btnH, 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PLAY AGAIN', W / 2, btnY + 30);
      menuButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: startGame });
    }
  }

  // Draw a speech bubble with pointer
  // Draw NPC name label above character
  function drawNpcLabel(x, y, name) {
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    var tw = ctx.measureText(name).width;
    var lw = tw + 10;
    var lh = 16;
    var lx = x - lw / 2;
    var ly = y - lh;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    roundRect(ctx, lx, ly, lw, lh, 4);
    ctx.fill();
    ctx.fillStyle = '#ffcc44';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y - 4);
  }

  function drawSpeechBubble(x, y, text, side) {
    ctx.font = '14px "Segoe UI", sans-serif';
    const textW = ctx.measureText(text).width;
    const padX = 14;
    const padY = 10;
    const bw = textW + padX * 2;
    const bh = 28;
    const bx = side === 'left' ? x - bw / 2 - 10 : x - bw / 2 + 10;
    const by = y - bh;

    // Bubble body
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Bubble border
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();

    // Pointer triangle (pointing down to character)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    if (side === 'left') {
      ctx.moveTo(bx + bw * 0.4, by + bh);
      ctx.lineTo(bx + bw * 0.35, by + bh + 10);
      ctx.lineTo(bx + bw * 0.5, by + bh);
    } else {
      ctx.moveTo(bx + bw * 0.5, by + bh);
      ctx.lineTo(bx + bw * 0.65, by + bh + 10);
      ctx.lineTo(bx + bw * 0.6, by + bh);
    }
    ctx.fill();

    // Text
    ctx.fillStyle = '#333';
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, bx + bw / 2, by + bh - 8);
  }

  function renderVictoryOverlay() {
    // Golden/pink warm overlay
    ctx.fillStyle = 'rgba(10,0,15,0.65)';
    ctx.fillRect(0, 0, W, H);

    // Center panel
    ctx.fillStyle = 'rgba(25,10,30,0.85)';
    ctx.beginPath();
    roundRect(ctx, W / 2 - 200, H / 2 - 140, 400, 310, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,105,180,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, W / 2 - 200, H / 2 - 140, 400, 310, 16);
    ctx.stroke();

    // Animated floating hearts background
    for (let i = 0; i < 15; i++) {
      const hx = W / 2 - 180 + (i * 53 % 360);
      const hy = H / 2 - 120 + ((game.frameCount * 0.5 + i * 40) % 290);
      ctx.globalAlpha = 0.1 + (i % 4) * 0.05;
      ctx.fillStyle = i % 3 === 0 ? '#ffcc00' : '#ff69b4';
      drawHeart(hx, hy, 4 + (i % 3) * 2);
    }
    ctx.globalAlpha = 1;

    // --- Prasad & Arya close together (kiss scene) ---
    const coupleY = H / 2 - 45;

    // Draw Prasad facing right
    drawPrasad(W / 2 - 12, coupleY, 'run', 0);
    // Draw Arya facing left (close to Prasad)
    drawAryaSilhouette(W / 2 + 12, coupleY);

    // Kiss hearts bursting from between them
    const kissX = W / 2;
    const kissY = coupleY - 45;
    for (let i = 0; i < 6; i++) {
      const angle = game.frameCount * 0.03 + i * Math.PI / 3;
      const dist = 12 + Math.sin(game.frameCount * 0.05 + i) * 6;
      const hx = kissX + Math.cos(angle) * dist;
      const hy = kissY + Math.sin(angle) * dist * 0.6;
      ctx.globalAlpha = 0.5 + Math.sin(game.frameCount * 0.06 + i * 2) * 0.3;
      ctx.fillStyle = i % 2 === 0 ? '#ff3366' : '#ff69b4';
      drawHeart(hx, hy, 4 + (i % 3));
    }
    ctx.globalAlpha = 1;

    // Big pulsing heart above them
    const bigPulse = 14 + Math.sin(game.frameCount * 0.06) * 3;
    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 25;
    drawHeart(kissX, kissY - 25, bigPulse);
    ctx.shadowBlur = 0;

    // Father in background (defeated, accepting)
    ctx.globalAlpha = 0.6;
    drawFatherDefeated(W / 2 + 100, coupleY + 5);
    ctx.globalAlpha = 1;

    // Title
    ctx.fillStyle = '#ff69b4';
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 25;
    ctx.font = 'bold 38px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MIDNIGHT KISS!', W / 2, H / 2 + 10);
    ctx.shadowBlur = 0;

    // Clock showing midnight
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('FIRST WISH! Happy Birthday Arya!', W / 2, H / 2 + 35);

    // Subtitle
    ctx.fillStyle = '#ffb6c1';
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillText('Prasad ran 6 cities to wish her first!', W / 2, H / 2 + 60);

    // Stats
    ctx.fillStyle = '#ffcc44';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`Final Score: ${game.score}`, W / 2, H / 2 + 85);
    const lovePercent = Math.round(game.loveMeter / game.maxLoveMeter * 100);
    ctx.fillStyle = '#ff69b4';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillText(`Love Meter: ${lovePercent}%`, W / 2, H / 2 + 105);

    // Play Again button
    const btnW = 190;
    const btnH = 48;
    const btnX = (W - btnW) / 2;
    const btnY = H / 2 + 115;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, '#ff69b4');
    btnGrad.addColorStop(1, '#cc3377');
    ctx.fillStyle = btnGrad;
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('PLAY AGAIN', W / 2, btnY + 32);

    menuButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: startGame });
  }

  function renderLevelTransition() {
    const alpha = Math.min(game.transitionTimer / game.transitionDuration, 1);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.fillRect(0, 0, W, H);

    // Level name with glow
    ctx.fillStyle = '#ff69b4';
    ctx.shadowColor = '#ff69b4';
    ctx.shadowBlur = 15 * alpha;
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = alpha;
    ctx.fillText(levels[game.level].name, W / 2, H / 2 - 15);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffb6c1';
    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillText(`Level ${game.level + 1} of ${game.totalLevels}`, W / 2, H / 2 + 20);

    // Encouragement text
    const encouragements = ['Be the first to wish her!', 'Keep going!', 'No one has wished her yet!', 'You can still be first!', 'Almost to the city!', "Wish her before anyone else!"];
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 14px "Segoe UI", sans-serif';
    ctx.fillText(encouragements[game.level] || 'Go!', W / 2, H / 2 + 50);

    ctx.globalAlpha = 1;
  }

  // --- Utility: Rounded Rectangle ---
  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ============================================================
  // ============================================================
  // Villain System — Adi, Mom, Father
  // ============================================================

  function updateVillain(dt) {
    if (!game.villainActive) return;
    const p = player;
    const v = villains[game.villainId];
    // During convo, stand further apart; during fight, closer
    const convoSpacing = 120; // pixels apart during conversation
    const fightSpacing = 0;   // centered on player during fight
    const spacing = (game.villainPhase <= 1 || game.villainPhase === 3) ? convoSpacing : fightSpacing;
    const targetX = p.x + p.w / 2 - 25 + spacing;

    switch (game.villainPhase) {
      case 0: // Approaching
        game.villainX -= 5;
        if (game.villainX <= targetX) {
          game.villainX = targetX;
          game.villainPhase = 1; // start convo
          game.villainConvoIndex = 0;
          game.villainConvoTimer = 0;
          game.speed = 0;
        }
        break;

      case 1: // Pre-fight conversation
        game.speed = 0;
        game.villainConvoTimer += dt;
        if (game.villainConvoTimer > 4.0) {
          game.villainConvoTimer = 0;
          game.villainConvoIndex++;
          if (game.villainConvoIndex >= v.preConvo.length) {
            game.villainPhase = 2; // start fighting
            game.villainAttackTimer = 1.5;
          }
        }
        break;

      case 2: // Fighting
        game.speed = 0;

        // Villain dodges — faster and wider movement for harder villains
        var dodgeSpeed = 0.03 + game.villainId * 0.015; // faster dodge per villain
        var dodgeRange = 25 + game.villainId * 15;       // wider dodge per villain
        game.villainX = targetX + Math.sin(game.frameCount * dodgeSpeed) * dodgeRange;
        // Father also does quick random jerks
        if (game.villainId === 2 && game.frameCount % 60 < 5) {
          game.villainX += (Math.random() - 0.5) * 40;
        }

        // Throw projectiles — more and faster for harder villains
        game.villainAttackTimer -= dt;
        if (game.villainAttackTimer <= 0) {
          game.villainAttackTimer = v.attackInterval + Math.random() * 0.4;
          // Number of projectiles scales with villain
          var projCount = 1 + Math.floor(game.villainId * 0.5);
          for (var pi = 0; pi < projCount; pi++) {
            game.obstacles.push({
              x: game.villainX + 50 + pi * 15,
              y: GROUND_Y - 25 - Math.random() * 35,
              w: 25, h: 15,
              name: v.projectile,
              type: 'ground',
              hit: false,
              bossProjectile: true,
              projVx: -5 - Math.random() * 3 - game.villainId // faster projectiles per villain
            });
          }
          sfx.slide();
        }

        // Move projectiles manually (speed is 0)
        for (let i = game.obstacles.length - 1; i >= 0; i--) {
          var obs = game.obstacles[i];
          if (obs.bossProjectile) {
            obs.x += obs.projVx;
            if (obs.x < -50) game.obstacles.splice(i, 1);
          }
        }

        // Stomp cooldown — prevent instant re-stomps
        if (game.villainStompCooldown > 0) {
          game.villainStompCooldown -= dt;
        }

        // Stomp detection — smaller hitbox for harder fights
        var headCX = game.villainX + 25;
        var headCY = GROUND_Y - 55;
        var headR = 20 - game.villainId * 2; // 20, 18, 16 — smaller for harder villains
        var playerCX = p.x + p.w / 2;
        var playerFeetY = p.y;

        if (!p.isGrounded && p.vy > 0 && (!game.villainStompCooldown || game.villainStompCooldown <= 0)) {
          var dx = playerCX - headCX;
          var dy = playerFeetY - headCY;
          if (dx * dx + dy * dy < headR * headR) {
            game.villainHealth--;
            game.villainStompCooldown = 0.5; // half second before next stomp registers
            p.vy = p.jumpForce;
            p.isGrounded = false;
            p.jumpsLeft = 1;
            game.screenShake = 10;
            spawnParticle(headCX, headCY, 'hitSpark', 8);
            sfx.hit();
            if (game.villainHealth <= 0) {
              game.villainPhase = 3; // defeated → post convo
              game.villainConvoIndex = 0;
              game.villainConvoTimer = 0;
              game.obstacles = [];
              spawnParticle(headCX, headCY, 'sparkle', 12);
            }
          }
        }
        break;

      case 3: // Post-defeat conversation
        game.speed = 0;
        game.villainConvoTimer += dt;
        if (game.villainConvoTimer > 4.0) {
          game.villainConvoTimer = 0;
          game.villainConvoIndex++;
          if (game.villainConvoIndex >= v.postConvo.length) {
            game.villainPhase = 4; // walk away
            game.villainDefeatedWalkTimer = 0;
          }
        }
        break;

      case 4: // Defeated villain walks away, Prasad walks forward
        game.speed = 0;
        game.villainX += 3; // villain walks off right
        game.villainDefeatedWalkTimer += dt;
        if (game.villainDefeatedWalkTimer > 2.5) {
          // Done — mark defeated, resume game
          game.villainsDefeated[game.villainId] = true;
          game.villainActive = false;
          game.speed = game.baseSpeed * levels[game.level].speedMult;
          // If this was the final villain (father), trigger victory
          if (game.villainId === 2) {
            spawnParticle(W / 2, H / 2, 'firework', 30);
            victory();
          }
        }
        break;
    }
  }

  function renderVillainScene() {
    if (!game.villainActive) return;
    const v = villains[game.villainId];

    // Draw villain character
    if (game.villainPhase === 4) {
      var walkAlpha = Math.max(0, 1 - game.villainDefeatedWalkTimer / 2);
      ctx.globalAlpha = walkAlpha;
    }
    drawVillainCharacter(game.villainId, game.villainX, GROUND_Y, game.villainPhase);
    ctx.globalAlpha = 1;

    // NPC labels above characters (during convo and fight)
    if (game.villainPhase >= 1 && game.villainPhase <= 3) {
      drawNpcLabel(game.villainX + 25, GROUND_Y - 85, v.name);
      drawNpcLabel(player.x + player.w / 2, GROUND_Y - 75, 'PRASAD');
    }

    // Health bar during fight
    if (game.villainPhase === 2) {
      var barW = 60, barH = 6;
      var barX = game.villainX - 5, barY = GROUND_Y - 100;
      ctx.fillStyle = '#333';
      ctx.fillRect(barX, barY, barW, barH);
      var hpR = game.villainHealth / game.villainMaxHealth;
      ctx.fillStyle = hpR > 0.5 ? '#ff4444' : '#ff8800';
      ctx.fillRect(barX, barY, barW * hpR, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(v.label, game.villainX + 25, barY - 5);
    }

    // Conversation bubbles — position based on speaker, well separated
    var prasadBubbleX = player.x + player.w / 2 - 30;
    var villainBubbleX = game.villainX + 25 + 30;

    if (game.villainPhase === 1 && game.villainConvoIndex < v.preConvo.length) {
      var cd = v.preConvo[game.villainConvoIndex];
      var fadeIn = Math.min(game.villainConvoTimer / 0.4, 1);
      ctx.globalAlpha = fadeIn;
      if (cd.speaker === 'prasad') {
        drawSpeechBubble(prasadBubbleX, GROUND_Y - 95, cd.text, 'left');
      } else {
        drawSpeechBubble(villainBubbleX, GROUND_Y - 100, cd.text, 'right');
      }
      ctx.globalAlpha = 1;
    }
    if (game.villainPhase === 3 && game.villainConvoIndex < v.postConvo.length) {
      var cd2 = v.postConvo[game.villainConvoIndex];
      var fadeIn2 = Math.min(game.villainConvoTimer / 0.4, 1);
      ctx.globalAlpha = fadeIn2;
      if (cd2.speaker === 'prasad') {
        drawSpeechBubble(prasadBubbleX, GROUND_Y - 95, cd2.text, 'left');
      } else {
        drawSpeechBubble(villainBubbleX, GROUND_Y - 100, cd2.text, 'right');
      }
      ctx.globalAlpha = 1;
    }
  }

  // --- Villain Character Drawings ---
  function drawVillainCharacter(id, x, groundY, phase) {
    if (id === 0) drawAdi(x, groundY, phase);
    else if (id === 1) drawMom(x, groundY, phase);
    else drawFather(x, groundY, phase);
  }

  // Adi — young brother, sporty, cap, t-shirt
  function drawAdi(x, groundY, phase) {
    ctx.save();
    ctx.translate(x + 25, groundY);
    // Legs
    ctx.fillStyle = '#3a4a6a';
    ctx.fillRect(-6, -3, 6, 16);
    ctx.fillRect(2, -3, 6, 16);
    // Shoes — sneakers
    ctx.fillStyle = '#333';
    ctx.fillRect(-7, 11, 9, 5);
    ctx.fillRect(1, 11, 9, 5);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(-5, 13, 5, 2);
    ctx.fillRect(3, 13, 5, 2);
    // Body — sporty t-shirt
    ctx.fillStyle = '#e84040';
    ctx.beginPath(); roundRect(ctx, -12, -30, 24, 28, 4); ctx.fill();
    ctx.strokeStyle = '#c03030';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); roundRect(ctx, -12, -30, 24, 28, 4); ctx.stroke();
    // Jersey number
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('7', 0, -12);
    // Arms
    ctx.fillStyle = '#c68642';
    ctx.fillRect(-14, -26, 5, 14);
    ctx.fillRect(9, -26, 5, 14);
    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.ellipse(0, -40, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -40, 12, 13, 0, 0, Math.PI * 2); ctx.stroke();
    // Cap
    ctx.fillStyle = '#2255cc';
    ctx.beginPath();
    ctx.ellipse(0, -48, 13, 5, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-14, -48, 12, 4); // brim
    // Hair peaking from cap
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-11, -43, 3, 6);
    ctx.fillRect(8, -43, 3, 6);
    // Eyes — big, mischievous
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -40, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -40, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(-4, -39, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -39, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-5, -41, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -41, 1, 0, Math.PI * 2); ctx.fill();
    // Eyebrows — cocky raised
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -46); ctx.lineTo(-1, -45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -46); ctx.lineTo(1, -45); ctx.stroke();
    // Smirk
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(2, -34, 3, 0, Math.PI * 0.8); ctx.stroke();
    // Angry tint during fight
    if (phase === 2) {
      ctx.fillStyle = 'rgba(255,0,0,0.04)';
      ctx.beginPath(); ctx.ellipse(0, -40, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Mom — saree, bun hair, rolling pin ready
  function drawMom(x, groundY, phase) {
    ctx.save();
    ctx.translate(x + 25, groundY);
    // Saree lower
    ctx.fillStyle = '#8b2252';
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(10, -4);
    ctx.closePath();
    ctx.fill();
    // Shoes — small sandals
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(-7, -2, 6, 3);
    ctx.fillRect(2, -2, 6, 3);
    // Saree body
    ctx.fillStyle = '#8b2252';
    ctx.beginPath(); roundRect(ctx, -11, -32, 22, 30, 4); ctx.fill();
    ctx.strokeStyle = '#6b1242';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); roundRect(ctx, -11, -32, 22, 30, 4); ctx.stroke();
    // Saree border / pallu
    ctx.fillStyle = '#d4aa00';
    ctx.fillRect(-11, -32, 22, 3);
    ctx.fillRect(-11, -5, 22, 2);
    // Pallu draping over shoulder
    ctx.fillStyle = 'rgba(139,34,82,0.6)';
    ctx.beginPath();
    ctx.moveTo(8, -30);
    ctx.quadraticCurveTo(16, -20, 12, -5);
    ctx.lineTo(10, -5);
    ctx.quadraticCurveTo(14, -20, 6, -28);
    ctx.closePath();
    ctx.fill();
    // Arms
    ctx.fillStyle = '#c68642';
    ctx.fillRect(-13, -28, 5, 14);
    ctx.fillRect(8, -28, 5, 14);
    // Rolling pin in hand (during fight)
    if (phase === 2 || phase === 1) {
      ctx.fillStyle = '#8b6914';
      ctx.save();
      ctx.translate(12, -20);
      ctx.rotate(Math.sin(game.frameCount * 0.08) * 0.3);
      ctx.fillRect(-2, -15, 4, 22);
      ctx.fillRect(-4, -15, 8, 3);
      ctx.fillRect(-4, 5, 8, 3);
      ctx.restore();
    }
    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.ellipse(0, -42, 12, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -42, 12, 13, 0, 0, Math.PI * 2); ctx.stroke();
    // Hair bun
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -50, 11, 6, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -55, 6, 0, Math.PI * 2); ctx.fill();
    // Bindi
    ctx.fillStyle = '#ff2222';
    ctx.beginPath(); ctx.arc(0, -49, 1.8, 0, Math.PI * 2); ctx.fill();
    // Eyes — sharp, stern
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-4, -42, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -42, 3.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(-4, -41, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -41, 2, 0, Math.PI * 2); ctx.fill();
    // Angry eyebrows
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-8, -48); ctx.lineTo(-1, -46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -48); ctx.lineTo(1, -46); ctx.stroke();
    // Pursed lips
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-3, -35); ctx.lineTo(3, -35); ctx.stroke();
    // Nose ring
    ctx.fillStyle = '#d4aa00';
    ctx.beginPath(); ctx.arc(-2, -38, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Father — tall, stern, kurta, mustache (reuse from before)
  function drawFather(x, groundY, phase) {
    ctx.save();
    ctx.translate(x + 25, groundY);
    // Legs
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(-8, -5, 8, 20);
    ctx.fillRect(2, -5, 8, 20);
    ctx.fillStyle = '#222';
    ctx.fillRect(-10, 13, 12, 5);
    ctx.fillRect(0, 13, 12, 5);
    // Body — kurta
    ctx.fillStyle = '#eee8d5';
    ctx.beginPath(); roundRect(ctx, -16, -40, 32, 38, 4); ctx.fill();
    ctx.strokeStyle = '#ccc0a0';
    ctx.lineWidth = 2;
    ctx.beginPath(); roundRect(ctx, -16, -40, 32, 38, 4); ctx.stroke();
    // Arms crossed in fight
    if (phase === 2) {
      ctx.fillStyle = '#c68642';
      ctx.beginPath(); roundRect(ctx, -18, -32, 8, 20, 3); ctx.fill();
      ctx.beginPath(); roundRect(ctx, 10, -32, 8, 20, 3); ctx.fill();
      ctx.beginPath(); roundRect(ctx, -12, -22, 24, 7, 3); ctx.fill();
    }
    // Head
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.ellipse(0, -50, 16, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -50, 16, 17, 0, 0, Math.PI * 2); ctx.stroke();
    // Hair
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -60, 14, 8, 0, Math.PI * 0.8, Math.PI * 2.2); ctx.fill();
    ctx.fillRect(-15, -55, 4, 15);
    ctx.fillRect(11, -55, 4, 15);
    // Angry eyebrows
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-10, -56); ctx.lineTo(-3, -53); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -56); ctx.lineTo(3, -53); ctx.stroke();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(-5, -50, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, -50, 4, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0a00';
    ctx.beginPath(); ctx.arc(-5, -49, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -49, 2.5, 0, Math.PI * 2); ctx.fill();
    // Mustache
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(-8, -43); ctx.quadraticCurveTo(-4, -40, 0, -43);
    ctx.quadraticCurveTo(4, -40, 8, -43); ctx.quadraticCurveTo(4, -42, 0, -42);
    ctx.quadraticCurveTo(-4, -42, -8, -43);
    ctx.fill();
    // Frown
    ctx.strokeStyle = '#8b5e3c';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -38, 4, Math.PI + 0.3, -0.3); ctx.stroke();
    // Rage tint
    if (phase === 2) {
      ctx.fillStyle = 'rgba(255,0,0,0.05)';
      ctx.beginPath(); ctx.ellipse(0, -50, 16, 17, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // Defeated father for victory cutscene
  function drawFatherDefeated(x, groundY) {
    ctx.save();
    ctx.translate(x + 25, groundY);
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(-10, -8, 28, 8);
    ctx.fillStyle = '#eee8d5';
    ctx.beginPath(); roundRect(ctx, -10, -30, 25, 24, 4); ctx.fill();
    ctx.fillStyle = '#c68642';
    ctx.beginPath(); ctx.ellipse(0, -38, 14, 15, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(0, -47, 12, 7, 0.2, Math.PI * 0.8, Math.PI * 2.2); ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(-4, -38, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, -38, 3, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.moveTo(-7, -33); ctx.quadraticCurveTo(0, -30, 7, -33); ctx.quadraticCurveTo(0, -32, -7, -33); ctx.fill();
    ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(1, -29, 3, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.restore();
  }

  // Projectile drawers
  obstacleDrawers.chappal = function (x, y, w, h) {
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); roundRect(ctx, x, y, w, h, 4); ctx.stroke();
    ctx.strokeStyle = '#6b3410'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.quadraticCurveTo(x + w * 0.5, y - 5, x + w * 0.7, y); ctx.stroke();
  };

  obstacleDrawers.cricket_ball = function (x, y, w, h) {
    ctx.fillStyle = '#cc2222';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.3, 0.5, 2.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w * 0.3, 3.5, 5.5); ctx.stroke();
  };

  obstacleDrawers.rolling_pin = function (x, y, w, h) {
    ctx.fillStyle = '#b08050';
    ctx.beginPath(); roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.fill();
    ctx.strokeStyle = '#8a6030'; ctx.lineWidth = 1.5;
    ctx.beginPath(); roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4); ctx.stroke();
    ctx.fillStyle = '#8a6030';
    ctx.fillRect(x, y + h / 2 - 2, 4, 4);
    ctx.fillRect(x + w - 4, y + h / 2 - 2, 4, 4);
  };

  // ============================================================
  // Particle System
  // ============================================================

  function spawnParticle(x, y, type, count) {
    count = count || 1;
    for (let i = 0; i < count; i++) {
      const p = particleTemplates[type](x, y);
      game.particles.push(p);
    }
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const p = game.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.shrink) p.size *= (1 - dt * p.shrink);
      if (p.life <= 0) {
        game.particles.splice(i, 1);
      }
    }
  }

  function renderParticles() {
    for (const p of game.particles) {
      ctx.globalAlpha = p.alpha * (p.baseAlpha || 1);
      ctx.fillStyle = p.color;
      if (p.type === 'heart') {
        drawHeart(p.x, p.y, p.size);
      } else if (p.type === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'star') {
        drawStar(p.x, p.y, p.size);
      } else if (p.type === 'petal') {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.4, p.rotation || 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // square / default
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const outerX = x + Math.cos(angle) * r;
      const outerY = y + Math.sin(angle) * r;
      const innerAngle = angle + Math.PI / 5;
      const innerX = x + Math.cos(innerAngle) * r * 0.4;
      const innerY = y + Math.sin(innerAngle) * r * 0.4;
      if (i === 0) ctx.moveTo(outerX, outerY);
      else ctx.lineTo(outerX, outerY);
      ctx.lineTo(innerX, innerY);
    }
    ctx.closePath();
    ctx.fill();
  }

  const particleTemplates = {
    // Dust puff when landing / sliding
    dust: function (x, y) {
      return {
        x: x + (Math.random() - 0.5) * 20,
        y: y - Math.random() * 5,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 1.5,
        gravity: 0.02,
        size: 3 + Math.random() * 4,
        color: '#8a7a6a',
        type: 'circle',
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5,
        alpha: 1,
        baseAlpha: 0.5,
        shrink: 1.5
      };
    },

    // Sweat drops when running fast
    sweat: function (x, y) {
      return {
        x: x + (Math.random() - 0.5) * 10,
        y: y,
        vx: -1 - Math.random() * 2,
        vy: -2 - Math.random() * 2,
        gravity: 0.15,
        size: 2 + Math.random() * 2,
        color: '#88ccff',
        type: 'circle',
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        alpha: 1,
        baseAlpha: 0.7,
        shrink: 0
      };
    },

    // Sparkle (for collectibles, shield)
    sparkle: function (x, y) {
      return {
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        gravity: 0,
        size: 2 + Math.random() * 3,
        color: ['#ffee55', '#ff88aa', '#88ddff', '#aaffaa', '#ffaa55'][Math.floor(Math.random() * 5)],
        type: 'star',
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        alpha: 1,
        baseAlpha: 0.9,
        shrink: 2
      };
    },

    // Flower petals (park level ambiance)
    petal: function (x, y) {
      return {
        x: x,
        y: y,
        vx: -0.5 - Math.random() * 1,
        vy: 0.5 + Math.random() * 1,
        gravity: 0.01,
        size: 3 + Math.random() * 3,
        color: ['#ff88aa', '#ffaacc', '#ff6688', '#ffccdd'][Math.floor(Math.random() * 4)],
        type: 'petal',
        rotation: Math.random() * Math.PI,
        life: 2 + Math.random() * 2,
        maxLife: 4,
        alpha: 1,
        baseAlpha: 0.6,
        shrink: 0
      };
    },

    // Heart particles (love meter, victory)
    heartParticle: function (x, y) {
      return {
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -1.5 - Math.random() * 2,
        gravity: 0,
        size: 3 + Math.random() * 4,
        color: ['#ff3366', '#ff69b4', '#ff88aa', '#ffcc00'][Math.floor(Math.random() * 4)],
        type: 'heart',
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        alpha: 1,
        baseAlpha: 0.8,
        shrink: 1
      };
    },

    // Firework burst (victory)
    firework: function (x, y) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      return {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.05,
        size: 2 + Math.random() * 2,
        color: ['#ff4466', '#ffcc00', '#44ddff', '#ff69b4', '#88ff44', '#ffaa44'][Math.floor(Math.random() * 6)],
        type: 'circle',
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        alpha: 1,
        baseAlpha: 1,
        shrink: 1
      };
    },

    // Coin collect burst
    coinBurst: function (x, y) {
      return {
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: -2 - Math.random() * 2,
        gravity: 0.08,
        size: 2 + Math.random() * 2,
        color: '#ffcc00',
        type: 'star',
        life: 0.3 + Math.random() * 0.3,
        maxLife: 0.6,
        alpha: 1,
        baseAlpha: 1,
        shrink: 2
      };
    },

    // Hit impact
    hitSpark: function (x, y) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      return {
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0,
        size: 2 + Math.random() * 3,
        color: ['#ff4444', '#ff8844', '#ffcc44'][Math.floor(Math.random() * 3)],
        type: 'circle',
        life: 0.2 + Math.random() * 0.2,
        maxLife: 0.4,
        alpha: 1,
        baseAlpha: 1,
        shrink: 3
      };
    }
  };

  // ============================================================
  // Audio System — Web Audio API procedural sounds
  // ============================================================

  let audioCtx = null;
  let audioUnlocked = false;

  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    audioUnlocked = true;
  }

  // Unlock audio on first user interaction
  function unlockAudio() {
    ensureAudio();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  }
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  // Helper: play a tone with envelope
  function playTone(freq, duration, type, volume, detune) {
    if (!audioCtx || !audioUnlocked) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    if (detune) osc.detune.value = detune;
    gain.gain.setValueAtTime(volume || 0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  }

  // Helper: noise burst (for percussive sounds)
  function playNoise(duration, volume) {
    if (!audioCtx || !audioUnlocked) return;
    const bufSize = audioCtx.sampleRate * duration;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(volume || 0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    src.connect(gain);
    gain.connect(audioCtx.destination);
    src.start();
  }

  const sfx = {
    jump: function () {
      playTone(400, 0.12, 'sine', 0.12);
      playTone(600, 0.1, 'sine', 0.08);
      setTimeout(function () { playTone(800, 0.08, 'sine', 0.06); }, 50);
    },

    doubleJump: function () {
      playTone(500, 0.1, 'sine', 0.1);
      setTimeout(function () { playTone(900, 0.1, 'triangle', 0.08); }, 60);
      setTimeout(function () { playTone(1100, 0.08, 'sine', 0.06); }, 120);
    },

    slide: function () {
      playNoise(0.15, 0.06);
      playTone(200, 0.12, 'sawtooth', 0.04);
    },

    coin: function () {
      playTone(988, 0.08, 'square', 0.08);
      setTimeout(function () { playTone(1319, 0.12, 'square', 0.06); }, 70);
    },

    heart: function () {
      playTone(523, 0.1, 'sine', 0.1);
      setTimeout(function () { playTone(659, 0.1, 'sine', 0.08); }, 80);
      setTimeout(function () { playTone(784, 0.15, 'sine', 0.06); }, 160);
    },

    hit: function () {
      playTone(150, 0.2, 'sawtooth', 0.15);
      playNoise(0.15, 0.12);
      setTimeout(function () { playTone(100, 0.3, 'sine', 0.08); }, 50);
    },

    boost: function () {
      for (let i = 0; i < 5; i++) {
        setTimeout(function () {
          playTone(400 + i * 150, 0.08, 'sine', 0.07);
        }, i * 40);
      }
    },

    shield: function () {
      playTone(440, 0.15, 'triangle', 0.1);
      setTimeout(function () { playTone(660, 0.15, 'triangle', 0.08); }, 100);
      setTimeout(function () { playTone(880, 0.2, 'sine', 0.06); }, 200);
    },

    timeBonus: function () {
      playTone(800, 0.1, 'square', 0.06);
      setTimeout(function () { playTone(1000, 0.08, 'square', 0.05); }, 60);
      setTimeout(function () { playTone(1200, 0.12, 'sine', 0.06); }, 120);
    },

    timerWarning: function () {
      playTone(440, 0.15, 'square', 0.1);
      setTimeout(function () { playTone(440, 0.15, 'square', 0.08); }, 250);
    },

    levelUp: function () {
      const notes = [523, 659, 784, 1047];
      notes.forEach(function (n, i) {
        setTimeout(function () {
          playTone(n, 0.2, 'sine', 0.1);
        }, i * 120);
      });
    },

    victory: function () {
      const melody = [523, 659, 784, 880, 1047, 1175, 1319, 1568];
      melody.forEach(function (n, i) {
        setTimeout(function () {
          playTone(n, 0.3, 'sine', 0.1);
          playTone(n * 0.5, 0.3, 'triangle', 0.05);
        }, i * 150);
      });
    },

    gameOver: function () {
      const notes = [400, 350, 300, 200];
      notes.forEach(function (n, i) {
        setTimeout(function () {
          playTone(n, 0.3, 'sawtooth', 0.08);
        }, i * 200);
      });
      setTimeout(function () { playTone(100, 0.6, 'sine', 0.1); }, 800);
    }
  };

  // Timer warning tracking
  let lastWarningSecond = -1;

  // --- Main Game Loop (fixed timestep at 60fps) ---
  const FIXED_DT = 1 / 60;

  function gameLoop(timestamp) {
    if (game.lastTimestamp === 0) game.lastTimestamp = timestamp;

    const elapsed = (timestamp - game.lastTimestamp) / 1000; // seconds
    game.lastTimestamp = timestamp;

    // Cap elapsed to prevent spiral of death
    const cappedElapsed = Math.min(elapsed, 0.1);
    game.accumulatedTime += cappedElapsed;

    // Fixed timestep updates
    while (game.accumulatedTime >= FIXED_DT) {
      update(FIXED_DT);
      clearInputEdges();
      game.accumulatedTime -= FIXED_DT;
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  // --- Start ---
  requestAnimationFrame(gameLoop);

})();
