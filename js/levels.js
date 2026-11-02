/* ============================================================
   倾汤 · 锅盔回声  —  levels.js
   世界数据：灰烬滩 → 漏雨廊 → 骨钟道 → 大汤殿
   ============================================================ */
W.LEVEL = null;

W.buildLevel = function () {
  const L = {
    w: 7400, h: 1180,
    spawn: { x: 180, y: 480 },
    zones: [
      { id: 'ash', name: '第 一 章 · 灰 烬 滩', x0: 0, x1: 1850, drone: 'ash',
        sky: ['#141c24', '#0a1017'], fog: 'rgba(120,140,160,0.05)', accent: '#c8b28a' },
      { id: 'rain', name: '第 二 章 · 漏 雨 廊', x0: 1850, x1: 3950, drone: 'rain',
        sky: ['#0d1a22', '#061016'], fog: 'rgba(90,150,180,0.06)', accent: '#7fb8c9' },
      { id: 'bone', name: '第 三 章 · 骨 钟 道', x0: 3950, x1: 5900, drone: 'bone',
        sky: ['#191518', '#0b0a0d'], fog: 'rgba(180,170,150,0.05)', accent: '#cfc0a0' },
      { id: 'hall', name: '终 章 · 大 汤 殿', x0: 5900, x1: 7400, drone: 'boss',
        sky: ['#1a1013', '#08060a'], fog: 'rgba(200,110,90,0.07)', accent: '#d98a6a' }
    ],
    solids: [], oneways: [], hazards: [], decor: [], lights: [],
    fires: [], enemies: [], items: [], npcs: [], triggers: [], lore: []
  };

  const S = (x, y, w, h, t) => L.solids.push({ x, y, w, h, type: t || 'stone' });
  const O = (x, y, w, t) => L.oneways.push({ x, y, w, h: 16, type: t || 'wood' });

  /* ============ 第一章 · 灰烬滩 ============ */
  // 地面
  S(-200, 640, 900, 400, 'sand');
  S(700, 640, 260, 400, 'sand');
  S(960, 700, 320, 340, 'sand');   // 下沉
  S(1280, 640, 700, 400, 'sand');
  // 起始区高台
  S(-200, 700, 260, 40, 'stone');
  O(120, 520, 150);
  O(330, 440, 130);
  O(520, 520, 140);
  // 断桥
  O(860, 560, 120, 'wood');
  S(1000, 690, 90, 20, 'bone');
  // 石阶上去
  S(1180, 600, 80, 40, 'stone');
  S(1330, 560, 90, 40, 'stone');
  S(1500, 500, 110, 40, 'stone');
  // 一道断崖
  S(1700, 640, 150, 400, 'sand');
  S(1500, 300, 200, 30, 'stone');

  // decor
  const dir1 = [[60, 640, 'deadTree'], [400, 640, 'rock'], [760, 640, 'grave'], [1100, 700, 'rock'],
    [1420, 640, 'grave'], [1650, 640, 'deadTree'], [300, 640, 'grave']];
  dir1.forEach(([x, y, k]) => L.decor.push({ x, y, kind: k, zone: 'ash' }));

  L.fires.push({
    id: 'fire_ash', x: 240, y: 640, name: '灰烬滩 · 熄灶',
    lit: true, zone: 'ash',
    lore: ['灶还在，火没了。', '她在锅盔里听见自己心跳的回声。']
  });

  L.npcs.push({
    id: 'shell', x: 560, y: 520, name: '壳', zone: 'ash', w: 46, h: 62,
    color: '#6f7f74',
    lines: [
      { who: '壳', t: '……啊，又一位扣着锅的。你把锅当帽子，' },
      { who: '壳', t: '我把壳当房子。我们其实一样，都靠一层壳活着。' },
      { who: '倾汤', t: '（锅里的回声在问她：这是朋友吗？）' },
      { who: '壳', t: '别敲了，孩子。你每敲一次，底下那口大锅就……' },
      { who: '壳', t: '……算了。往东走，走到骨钟那儿。听不见就别硬听。' },
      { who: '壳', t: '[提示] L 键敲锅。回声会照出敌人、暗路，和别人的心跳。但整个滩子都会听见你。' }
    ]
  });

  L.items.push({ id: 'soup1', type: 'soup', x: 700, y: 560, zone: 'ash', taken: false });
  L.items.push({ id: 'lore1', type: 'lore', x: 1000, y: 630, zone: 'ash', taken: false,
    title: '半融的陶片',
    text: '「汤要熬够七天。' + '\n' + '第一天放海。第七天放她。」\n\n—— 刻字的人没有留下名字。' });

  // 敌人：溺行者
  L.enemies.push({ type: 'drown', x: 1240, y: 560, zone: 'ash' });
  L.enemies.push({ type: 'drown', x: 1560, y: 540, zone: 'ash' });
  L.enemies.push({ type: 'drown', x: 820, y: 560, zone: 'ash', pat: [700, 940] });

  // 火光
  L.lights.push({ x: 240, y: 600, r: 220, c: '255,170,90', i: 0.5, flicker: 1 });

  /* ============ 第二章 · 漏雨廊 ============ */
  S(1850, 720, 500, 340, 'stone');      // 廊底
  S(1850, 400, 60, 320, 'wall');
  S(2200, 660, 130, 40, 'stone');
  S(2380, 570, 130, 30, 'stone');
  S(2560, 470, 130, 30, 'stone');
  S(2740, 380, 160, 30, 'stone');
  S(2950, 470, 130, 30, 'stone');
  S(3130, 570, 140, 30, 'stone');
  S(3320, 660, 200, 40, 'stone');
  S(3560, 610, 240, 450, 'stone');
  O(2130, 560, 90);
  O(2480, 380, 110);
  O(3040, 300, 130);
  O(3400, 520, 120);
  // 隐藏平台：只有回声照亮时才显示/可站立
  L.decor.push({ x: 2000, y: 300, kind: 'pipe', zone: 'rain' });
  L.decor.push({ x: 2500, y: 200, kind: 'pipe', zone: 'rain' });
  L.decor.push({ x: 2900, y: 150, kind: 'pipe', zone: 'rain' });
  L.oneways.push({ x: 2270, y: 300, w: 110, h: 14, type: 'ghost', hidden: true, revealed: false, zone: 'rain' });
  L.oneways.push({ x: 2620, y: 230, w: 120, h: 14, type: 'ghost', hidden: true, revealed: false, zone: 'rain' });
  L.oneways.push({ x: 2860, y: 190, w: 100, h: 14, type: 'ghost', hidden: true, revealed: false, zone: 'rain' });
  L.oneways.push({ x: 3300, y: 300, w: 130, h: 14, type: 'ghost', hidden: true, revealed: false, zone: 'rain' });

  L.fires.push({
    id: 'fire_rain', x: 1900, y: 720, name: '漏雨廊 · 滴水灶',
    lit: true, zone: 'rain',
    lore: ['雨水从天上漏下来，落进锅里。', '她把雨水也一起喝了。她从不挑。']
  });

  L.npcs.push({
    id: 'rain', x: 3650, y: 610, name: '拾唾者', zone: 'rain', w: 44, h: 66,
    color: '#4e6470',
    lines: [
      { who: '拾唾者', t: '上面！上面！你没看见吗——那三块木板就悬在半空。' },
      { who: '倾汤', t: '……我看不见。' },
      { who: '拾唾者', t: '啊。锅。对。' },
      { who: '拾唾者', t: '那你敲啊。敲一下，它们就亮起来了。' },
      { who: '拾唾者', t: '不过话说回来，它们亮了，那些东西也就知道你在这儿了。' },
      { who: '拾唾者', t: '这世界就这样：想看见，就得被看见。' }
    ]
  });

  L.items.push({ id: 'soup2', type: 'soup', x: 2860, y: 150, zone: 'rain' });
  // 幽灵平台顶端：回声碎片（集齐 3 枚提升体力上限）
  L.items.push({ id: 'shard1', type: 'shard', x: 2640, y: 180, zone: 'rain',
    title: '回声碎片 · 一', text: '一片薄薄的、会震的东西。贴着耳朵，能听见很远的地方。' });
  L.items.push({ id: 'shard2', type: 'shard', x: 3330, y: 250, zone: 'rain',
    title: '回声碎片 · 二', text: '她想起来了：这是锅盔敲碎过一次留下的。' });
  L.items.push({ id: 'lore2', type: 'lore', x: 3600, y: 600, zone: 'rain',
    title: '廊柱上的刻痕',
    text: '「我们不是被淹死的。\n我们是被熬死的。\n区别在于：熬死的，还有味道。」' });

  L.enemies.push({ type: 'leaper', x: 2260, y: 640, zone: 'rain' });
  L.enemies.push({ type: 'archer', x: 2700, y: 350, zone: 'rain' });
  L.enemies.push({ type: 'leaper', x: 3000, y: 460, zone: 'rain' });
  L.enemies.push({ type: 'archer', x: 3250, y: 540, zone: 'rain' });
  L.enemies.push({ type: 'drown', x: 3450, y: 560, zone: 'rain' });
  L.enemies.push({ type: 'leaper', x: 3480, y: 560, zone: 'rain' });

  L.lights.push({ x: 1900, y: 690, r: 210, c: '255,170,90', i: 0.45, flicker: 1 });
  L.lights.push({ x: 3600, y: 590, r: 200, c: '160,210,240', i: 0.28, flicker: 0.4 });

  /* ============ 第三章 · 骨钟道 ============ */
  S(3800, 700, 400, 360, 'bone');
  S(4250, 660, 120, 40, 'bone');
  S(4440, 600, 120, 30, 'bone');
  S(4620, 540, 120, 30, 'bone');
  S(4800, 620, 140, 40, 'bone');
  S(5000, 700, 300, 360, 'bone');
  S(5360, 640, 200, 420, 'bone');
  S(5600, 700, 300, 360, 'bone');
  O(4150, 560, 110);
  O(4380, 470, 120);
  O(4900, 470, 130);
  O(5200, 560, 120);
  // 骨钟（装饰+机关）
  L.decor.push({ x: 4000, y: 700, kind: 'bell', zone: 'bone' });
  L.decor.push({ x: 4760, y: 620, kind: 'bellSmall', zone: 'bone' });
  L.decor.push({ x: 5450, y: 640, kind: 'bonePile', zone: 'bone' });
  L.decor.push({ x: 3900, y: 700, kind: 'grave', zone: 'bone' });
  L.decor.push({ x: 5100, y: 700, kind: 'bonePile', zone: 'bone' });

  L.fires.push({
    id: 'fire_bone', x: 3850, y: 700, name: '骨钟道 · 冷灶',
    lit: true, zone: 'bone',
    lore: ['骨头上还挂着一点点汤。', '她舔了一下。是咸的。她想起来了——']
  });

  L.npcs.push({
    id: 'bell', x: 4180, y: 560, name: '敲钟人', zone: 'bone', w: 50, h: 70,
    color: '#8a7f6b',
    lines: [
      { who: '敲钟人', t: '钟不是用来听的，是用来回答的。' },
      { who: '敲钟人', t: '你敲一下，它就回一下。你敲一千下，它还是只回一下。' },
      { who: '倾汤', t: '……那为什么还要敲？' },
      { who: '敲钟人', t: '因为回那一下的，可能是你自己。' },
      { who: '敲钟人', t: '也可能不是。这就是全部乐趣了，孩子。' },
      { who: '敲钟人', t: '[提示] 重击 K 可以挡下飞来的东西。锅盖是最好的盾，因为锅盖底下是你。' }
    ]
  });

  L.items.push({ id: 'key1', type: 'key', x: 5230, y: 480, zone: 'bone', taken: false,
    title: '锈钥匙 · 汤殿门', text: '汤殿的门锁着。锁上刻着一个碗的图案。' });
  L.items.push({ id: 'shard3', type: 'shard', x: 5230, y: 420, zone: 'bone',
    title: '回声碎片 · 三', text: '三片拼起来，是一口很小的锅的形状。' });
  L.items.push({ id: 'lore3', type: 'lore', x: 4090, y: 690, zone: 'bone',
    title: '钟内壁的字',
    text: '「第七天，她说：孩子，别掀锅盖。\n我问她为什么。\n她说：掀开就不是汤了。」\n\n下面还有一行小字，被指甲划掉了。' });

  L.enemies.push({ type: 'knight', x: 4300, y: 600, zone: 'bone', pat: [4250, 4620] });
  L.enemies.push({ type: 'archer', x: 4700, y: 480, zone: 'bone' });
  L.enemies.push({ type: 'drown', x: 4900, y: 620, zone: 'bone' });
  L.enemies.push({ type: 'knight', x: 5150, y: 640, zone: 'bone', pat: [5000, 5300] });
  L.enemies.push({ type: 'leaper', x: 5450, y: 660, zone: 'bone' });
  L.enemies.push({ type: 'archer', x: 5620, y: 620, zone: 'bone' });

  // 门（需要钥匙）
  L.gates = [{ id: 'hallGate', x: 5860, y: 520, w: 44, h: 260, open: false }];
  L.lights.push({ x: 3850, y: 670, r: 200, c: '255,170,90', i: 0.42, flicker: 1 });
  L.lights.push({ x: 4000, y: 640, r: 180, c: '180,170,140', i: 0.16, flicker: 0.2 });

  /* ============ 终章 · 大汤殿 ============ */
  S(5900, 780, 1500, 400, 'temple');
  S(5900, 300, 60, 300, 'pillar');   // 悬柱：底部离地留出通行空间
  // Boss 战竞技场：地面必须完全平坦，否则 Boss 会被装饰平台卡住
  // 原先这三块碰撞平台已改为纯装饰（不参与碰撞）
  L.decor.push({ x: 6305, y: 640, kind: 'ledge', zone: 'hall' });
  L.decor.push({ x: 6655, y: 560, kind: 'ledge', zone: 'hall' });
  L.decor.push({ x: 7055, y: 640, kind: 'ledge', zone: 'hall' });
  S(7340, 300, 60, 480, 'pillar');
  L.decor.push({ x: 6150, y: 780, kind: 'pot', zone: 'hall' });
  L.decor.push({ x: 6700, y: 780, kind: 'potSmall', zone: 'hall' });
  L.decor.push({ x: 7200, y: 780, kind: 'potSmall', zone: 'hall' });

  L.fires.push({
    id: 'fire_hall', x: 5960, y: 780, name: '大汤殿 · 最后一口灶',
    lit: true, zone: 'hall',
    lore: ['这口灶是热的。', '锅里的汤在轻轻晃。像有人在下面呼吸。']
  });

  L.bossSpawn = { x: 6900, y: 560 };
  L.lights.push({ x: 5960, y: 760, r: 230, c: '255,170,90', i: 0.5, flicker: 1 });
  L.lights.push({ x: 6800, y: 400, r: 420, c: '255,120,90', i: 0.3, flicker: 0.7 });

  // 结局触发器
  L.triggers.push({ id: 'bossArena', x: 6250, y: 600, w: 60, h: 180, once: true });
  L.triggers.push({ id: 'zoneRain', x: 1840, y: 0, w: 40, h: 1180, once: true });
  L.triggers.push({ id: 'zoneBone', x: 3940, y: 0, w: 40, h: 1180, once: true });
  L.triggers.push({ id: 'zoneHall', x: 5880, y: 0, w: 40, h: 1180, once: true });

  L.height = 1180;
  return L;
};

/* 剧情文本 */
W.STORY = {
  intro: [
    { who: '', t: '七天前，海被熬成了一锅汤。' },
    { who: '', t: '八天前，她还是个会唱歌的孩子。' },
    { who: '', t: '现在她头顶扣着一口锅，走在釜底的灰里。' },
    { who: '', t: '锅里有一点声音，一直在回。' },
    { who: '倾汤', t: '……还有人吗？' },
    { who: '', t: '（L 敲锅。回声会把世界画给你看。）' }
  ],
  bossIntro: [
    { who: '', t: '大汤殿的门缓缓打开。' },
    { who: '', t: '殿中坐着一个没有嘴的东西，正用勺子搅着什么。' },
    { who: '汤主 · 无口', t: '你来了。' },
    { who: '汤主 · 无口', t: '我一直在等汤凉。' },
    { who: '倾汤', t: '你是谁？' },
    { who: '汤主 · 无口', t: '我是这锅汤。' },
    { who: '汤主 · 无口', t: '而你——你是我留在锅沿上，' },
    { who: '汤主 · 无口', t: '最后一滴没有煮化的东西。' }
  ],
  ending: [
    { who: '', t: '锅盔从她头上滑落。' },
    { who: '', t: '第一次，她真正看见了这个世界。' },
    { who: '', t: '灰烬底下全是汤。汤里有无数张脸。' },
    { who: '', t: '每一张都在笑。' },
    { who: '倾汤', t: '……原来回声，是你们在回答我。' },
    { who: '', t: '她把锅重新扣回头上。' },
    { who: '', t: '这样好一点。这样，他们还在。' },
    { who: '', t: '—— 「倾汤 · 锅盔回声」 完 ——' }
  ],
  endingB: [
    { who: '', t: '她拒绝了。她没有掀开锅。' },
    { who: '汤主 · 无口', t: '……好。那就再熬一锅。' },
    { who: '', t: '铃响了很久。灰烬滩上的灶，重新热了起来。' },
    { who: '', t: '没有人知道那算不算结局。' },
    { who: '', t: '—— 「倾汤 · 苦汤不凉」 完 ——' }
  ],

  /* ===== 隐藏彩蛋：对着汤主敲锅 ===== */
  easterHint: [
    { who: '', t: '（锅里的回声忽然变得很吵。）' },
    { who: '倾汤', t: '……你不是没有嘴。' },
    { who: '倾汤', t: '你是没有回声。' },
    { who: '', t: '（她从没有这样敲过。把所有力气，都敲进这一下。）' }
  ],
  easterKill: [
    { who: '', t: '——当。' },
    { who: '', t: '那不是金属声。' },
    { who: '', t: '那是一口锅里，装着的一整个海，终于回了一声。' },
    { who: '汤主 · 无口', t: '……你也听得见？' },
    { who: '倾汤', t: '我一直听得见。' },
    { who: '倾汤', t: '只是我一直以为，那是我自己的心跳。' },
    { who: '', t: '汤主慢慢散开了。摊在殿里的，不是汤。' },
    { who: '', t: '是一片很浅很浅的、退了潮的海。' }
  ],
  easterAfter: [
    { who: '', t: '她蹲下来，把手伸进水里。' },
    { who: '', t: '水面安安静静，什么也没回。' },
    { who: '倾汤', t: '……这次换我了。' },
    { who: '', t: '她抬起手，在水面上轻轻叩了一下。' },
    { who: '', t: '很久以后，很远的地方，传来一声。' },
    { who: '', t: '—— 「倾汤 · 一记回声」 完 ——' }
  ]
};
