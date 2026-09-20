/* ==========================================================
   通信のしくみを体験する ― IPアドレスとネットワーク教材
   ステージ管理・判定・パケットアニメーションを行うスクリプト
   教師が内容を変更しやすいよう、各STEPは STAGES 配列にまとめてある
   ========================================================== */

/* ---------- DOM要素の取得 ---------- */
const stageTitleEl   = document.getElementById('stageTitle');
const stageBadgeEl   = document.getElementById('stageBadge');
const diagramHintEl  = document.getElementById('diagramHint');
const infoCardEl     = document.getElementById('infoCard');
const questionCardEl = document.getElementById('questionCard');
const questionPromptEl = document.getElementById('questionPrompt');
const questionOptionsEl = document.getElementById('questionOptions');
const feedbackEl     = document.getElementById('feedback');
const actionCardEl   = document.getElementById('actionCard');
const sendBtnEl      = document.getElementById('sendBtn');
const explainCardEl  = document.getElementById('explainCard');
const glossaryEl     = document.getElementById('glossary');
const progressDotsEl = document.getElementById('progressDots');
const prevBtnEl      = document.getElementById('prevBtn');
const nextBtnEl      = document.getElementById('nextBtn');
const restartBtnEl   = document.getElementById('restartBtn');
const packetEl       = document.getElementById('packet');
const natPanelEl     = document.getElementById('natPanel');
const wanLabelEl     = document.getElementById('ip-router-wan-label');
const wanValueEl     = document.getElementById('ip-router-wan');

/* ---------- ネットワーク図：接続線の座標（index.htmlのpath dと対応） ---------- */
const LINKS = {
  'pc1-pc2':          { id: 'link-pc1-pc2',          points: [[95, 300], [95, 90]] },
  'pc1-router':        { id: 'link-pc1-router',        points: [[150, 300], [345, 235]] },
  'pc2-router':        { id: 'link-pc2-router',        points: [[150, 90], [345, 165]] },
  'router-internet':   { id: 'link-router-internet',   points: [[470, 200], [610, 200]] },
  'internet-server':   { id: 'link-internet-server',   points: [[690, 200], [800, 200]] }
};
const ALL_LINK_IDS = Object.values(LINKS).map(l => l.id);
const ALL_NODE_IDS = ['node-pc1', 'node-pc2', 'node-router', 'node-internet', 'node-server'];

/* ---------- 進捗表示の定義（STEP1〜5のラベル） ---------- */
const STEP_META = [
  { num: 1, label: '宛先確認' },
  { num: 2, label: 'LAN内通信' },
  { num: 3, label: '外部への通信' },
  { num: 4, label: 'NAT変換' },
  { num: 5, label: '到達' }
];

/* ==========================================================
   ネットワーク図の操作ヘルパー
   ========================================================== */
function resetDiagramBase() {
  ALL_NODE_IDS.forEach(id => {
    const n = document.getElementById(id);
    n.classList.remove('is-dim', 'is-focus', 'is-wrong');
  });
  ALL_LINK_IDS.forEach(id => {
    const l = document.getElementById(id);
    l.classList.remove('is-active', 'is-dim');
  });
  hidePacket();
}
function focusNodes(ids) { ids.forEach(id => document.getElementById(id).classList.add('is-focus')); }
function dimNodes(ids)   { ids.forEach(id => document.getElementById(id).classList.add('is-dim')); }
function dimLinks(ids)   { ids.forEach(id => document.getElementById(id).classList.add('is-dim')); }
function activateLink(key, on) {
  const el = document.getElementById(LINKS[key].id);
  el.classList.toggle('is-active', !!on);
}
function hidePacket() { packetEl.style.opacity = 0; }
function placePacket(x, y) {
  packetEl.setAttribute('x', x - 9);
  packetEl.setAttribute('y', y - 7);
}
/** パケットを1本の線の上でアニメーションさせる */
function movePacket(linkKey, duration, callback) {
  const [[x1, y1], [x2, y2]] = LINKS[linkKey].points;
  placePacket(x1, y1);
  packetEl.style.opacity = 1;
  const start = performance.now();
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = easeInOutCubic(t);
    placePacket(x1 + (x2 - x1) * e, y1 + (y2 - y1) * e);
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => { hidePacket(); callback && callback(); }, 250);
    }
  }
  requestAnimationFrame(frame);
}
function setRouterWan(revealed) {
  if (revealed) {
    wanValueEl.textContent = '203.0.113.10';
    wanLabelEl.classList.add('is-changed');
  } else {
    wanValueEl.textContent = '未確定';
    wanLabelEl.classList.remove('is-changed');
  }
}
function showNatPanel() { natPanelEl.hidden = false; }
function hideNatPanel() { natPanelEl.hidden = true; }

/* ==========================================================
   問題・解説・アクション カードの共通描画
   ========================================================== */
function setInfoRows(rows) {
  infoCardEl.style.display = '';
  infoCardEl.innerHTML = rows.map(r =>
    `<div class="info-row"><span class="info-row__label">${r.label}</span><span class="info-row__value">${r.value}</span></div>`
  ).join('');
}

/**
 * 選択式の設問を描画する。
 * onCorrect(instant) は正解したときに呼ばれる。
 * instant === true のときは「すでに完了済みステージを再表示している」ケース。
 */
function renderQuestion(prompt, options, correctId, hint, onCorrect, { completed = false } = {}) {
  questionCardEl.hidden = false;
  questionPromptEl.textContent = prompt;
  questionOptionsEl.innerHTML = '';
  feedbackEl.hidden = true;
  let answered = completed;

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-btn__marker"></span><span>${opt.label}</span>`;
    if (completed) {
      btn.disabled = true;
      if (opt.id === correctId) btn.classList.add('is-correct');
    }
    btn.addEventListener('click', () => {
      if (answered) return;
      if (opt.id === correctId) {
        answered = true;
        btn.classList.add('is-correct');
        questionOptionsEl.querySelectorAll('.option-btn').forEach(b => (b.disabled = true));
        feedbackEl.hidden = true;
        onCorrect(false);
      } else {
        btn.classList.add('is-wrong');
        feedbackEl.hidden = false;
        feedbackEl.className = 'feedback is-wrong';
        feedbackEl.textContent = hint;
        setTimeout(() => btn.classList.remove('is-wrong'), 900);
      }
    });
    questionOptionsEl.appendChild(btn);
  });

  if (completed) onCorrect(true);
}

function showAction(label, onRun) {
  actionCardEl.hidden = false;
  sendBtnEl.textContent = label;
  sendBtnEl.disabled = false;
  sendBtnEl.onclick = () => {
    sendBtnEl.disabled = true;
    onRun(() => { sendBtnEl.disabled = false; });
  };
}
function showExplain(html, success = false) {
  explainCardEl.hidden = false;
  explainCardEl.className = 'explain-card' + (success ? ' is-success' : '');
  explainCardEl.innerHTML = html;
}

/* ==========================================================
   STEPごとの内容定義
   ここを書き換えれば、教師が問題文や解説文を調整できる
   ========================================================== */
let currentIndex = 0;
const doneSet = new Set();

function markReady() {
  doneSet.add(currentIndex);
  nextBtnEl.disabled = false;
}

const STAGES = [

  /* ============ STEP1：宛先を確認する ============ */
  {
    badge: 'STEP 1 / 5',
    title: '宛先を確認する',
    hint: '自分のPCと宛先PCが同じネットワークかどうかに注目しましょう',
    render(completed) {
      focusNodes(['node-pc1', 'node-pc2']);
      dimNodes(['node-router', 'node-internet', 'node-server']);
      dimLinks(['link-pc1-router', 'link-pc2-router', 'link-router-internet', 'link-internet-server']);
      setInfoRows([
        { label: '送信元', value: '192.168.1.10' },
        { label: '宛先', value: '192.168.1.20' },
        { label: 'サブネットマスク', value: '255.255.255.0' }
      ]);
      renderQuestion(
        'この宛先は、自分と同じネットワークにいるでしょうか？',
        [{ id: 'same', label: '同じネットワーク' }, { id: 'diff', label: '違うネットワーク' }],
        'same',
        'サブネットマスクとIPアドレスをもう一度見比べてみよう。255の部分がネットワークを表す範囲です。',
        () => {
          showExplain(
            `<p><strong>192.168.1</strong> の部分が共通しているため、同じネットワーク内の機器です。</p>
             <p class="explain-note">ただし「最初の3つが同じだから」と覚えるのではなく、サブネットマスク <strong>255.255.255.0</strong> によって、IPアドレスのどこまでがネットワークを表す部分なのかを判断しています。</p>`
          );
          markReady();
        },
        { completed }
      );
    }
  },

  /* ============ STEP2：LAN内部で通信する ============ */
  {
    badge: 'STEP 2 / 5',
    title: 'LAN内部で通信する',
    hint: 'ルータやインターネットを経由しない、LAN内部だけの通信です',
    render(completed) {
      focusNodes(['node-pc1', 'node-pc2']);
      dimNodes(['node-router', 'node-internet', 'node-server']);
      dimLinks(['link-pc1-router', 'link-pc2-router', 'link-router-internet', 'link-internet-server']);
      setInfoRows([
        { label: '送信元', value: '192.168.1.10' },
        { label: '宛先', value: '192.168.1.20' }
      ]);
      const explainHTML = '<p>同じネットワーク内の相手なので、<strong>デフォルトゲートウェイを通らずに</strong>通信できます。</p>';
      showAction('送信する', (doneCb) => {
        activateLink('pc1-pc2', true);
        movePacket('pc1-pc2', 900, () => {
          showExplain(explainHTML);
          markReady();
          doneCb();
        });
      });
      if (completed) {
        activateLink('pc1-pc2', true);
        showExplain(explainHTML);
        markReady();
      }
    }
  },

  /* ============ STEP3-A：別のネットワークへの通信（判定） ============ */
  {
    badge: 'STEP 3 / 5',
    title: '別のネットワークへの通信①：宛先を判断する',
    hint: '宛先がWebサーバに変わりました。自分と同じネットワークか判断しましょう',
    render(completed) {
      focusNodes(['node-pc1', 'node-server']);
      dimNodes(['node-pc2', 'node-router', 'node-internet']);
      dimLinks(['link-pc1-pc2', 'link-pc2-router']);
      setInfoRows([
        { label: '送信元', value: '192.168.1.10' },
        { label: '宛先', value: '198.51.100.20' },
        { label: 'サブネットマスク', value: '255.255.255.0' }
      ]);
      renderQuestion(
        'この宛先は、自分と同じネットワークにいるでしょうか？',
        [{ id: 'same', label: '同じネットワーク' }, { id: 'diff', label: '違うネットワーク' }],
        'diff',
        'サブネットマスク 255.255.255.0 で共通しているのはIPアドレスのどこまでか、もう一度確認してみよう。',
        () => {
          showExplain('<p>送信元と宛先で <strong>192.168.1</strong> の部分が一致しないため、違うネットワークにある機器だと分かります。</p>');
          markReady();
        },
        { completed }
      );
    }
  },

  /* ============ STEP3-B：別のネットワークへの通信（送り先） ============ */
  {
    badge: 'STEP 3 / 5',
    title: '別のネットワークへの通信②：送り先を判断する',
    hint: '違うネットワークへの通信では、最初にどこへ送るかがポイントです',
    render(completed) {
      focusNodes(['node-pc1', 'node-router']);
      dimNodes(['node-pc2', 'node-internet', 'node-server']);
      dimLinks(['link-pc1-pc2', 'link-pc2-router', 'link-router-internet', 'link-internet-server']);
      setInfoRows([
        { label: '送信元', value: '192.168.1.10' },
        { label: '宛先', value: '198.51.100.20（違うネットワーク）' }
      ]);
      renderQuestion(
        'では、違うネットワークにいる相手へ送る場合、最初にどこへデータを送ればよいでしょうか？',
        [
          { id: 'pc2', label: '同じLAN内の別のPC' },
          { id: 'gw', label: 'デフォルトゲートウェイ' },
          { id: 'server', label: 'Webサーバへ直接送る' }
        ],
        'gw',
        'デフォルトゲートウェイは、自分のネットワークの外へ出るための出口となる機器でしたね。',
        (instant) => {
          showExplain('<p>自分と異なるネットワークへ通信するときは、まず<strong>デフォルトゲートウェイ</strong>であるルータへデータを送ります。</p>');
          activateLink('pc1-router', true);
          if (instant) {
            markReady();
          } else {
            movePacket('pc1-router', 900, () => markReady());
          }
        },
        { completed }
      );
    }
  },

  /* ============ STEP4：プライベートIPとNAT ============ */
  {
    badge: 'STEP 4 / 5',
    title: 'プライベートIPとNAT',
    hint: 'ルータに到着した送信元IPアドレスに注目しましょう',
    render(completed) {
      focusNodes(['node-router']);
      dimNodes(['node-pc2', 'node-internet', 'node-server']);
      dimLinks(['link-pc1-pc2', 'link-pc2-router', 'link-router-internet', 'link-internet-server']);
      activateLink('pc1-router', true);
      setRouterWan(false);
      setInfoRows([{ label: '送信元IP（ルータ到着時点）', value: '192.168.1.10' }]);
      renderQuestion(
        '192.168.1.10は、そのままインターネット上で送信元として使用できるでしょうか？',
        [{ id: 'yes', label: '使用できる' }, { id: 'no', label: '使用できない' }],
        'no',
        '192.168.1.x は、学校や家庭のLAN内だけで使われるアドレスでしたね。',
        (instant) => {
          showExplain(
            `<p>192.168.1.10は<strong>プライベートIPアドレス</strong>であり、家庭や学校などのLAN内部で使用するアドレスです。</p>
             <p class="explain-note">そこでルータは<strong>NAT</strong>を使って、プライベートIPアドレスをグローバルIPアドレスに変換します。下のボタンで変換の様子を確認しましょう。</p>`
          );
          showAction('NAT変換を見る', (doneCb) => {
            showNatPanel();
            setRouterWan(true);
            markReady();
            doneCb();
          });
          if (instant) {
            showNatPanel();
            setRouterWan(true);
            markReady();
          }
        },
        { completed }
      );
    }
  },

  /* ============ STEP5：インターネットを通ってWebサーバへ ============ */
  {
    badge: 'STEP 5 / 5',
    title: 'インターネットを通ってWebサーバへ',
    hint: 'グローバルIPに変換されたあと、インターネットを経由してサーバに届きます',
    render(completed) {
      focusNodes(['node-router', 'node-internet', 'node-server']);
      dimNodes(['node-pc2']);
      activateLink('pc1-router', true);
      setRouterWan(true);
      showNatPanel();
      setInfoRows([
        { label: '送信元IP（変換後）', value: '203.0.113.10' },
        { label: '宛先', value: '198.51.100.20' }
      ]);
      function showSuccess() {
        showExplain(
          `<p><strong>通信成功！</strong></p>
           <p>今回の通信の流れ：</p>
           <ol class="flow-list">
             <li>宛先IPアドレスを確認する</li>
             <li>サブネットマスクを使って同じネットワークか判断する</li>
             <li>違うネットワークの場合はデフォルトゲートウェイへ送る</li>
             <li>ルータでNATを行う</li>
             <li>プライベートIPをグローバルIPへ変換する</li>
             <li>インターネットを通って目的のサーバへ送る</li>
           </ol>`,
          true
        );
        markReady();
      }
      showAction('送信する', (doneCb) => {
        activateLink('router-internet', true);
        movePacket('router-internet', 800, () => {
          activateLink('internet-server', true);
          movePacket('internet-server', 800, () => {
            showSuccess();
            doneCb();
          });
        });
      });
      if (completed) {
        activateLink('router-internet', true);
        activateLink('internet-server', true);
        showSuccess();
      }
    }
  },

  /* ============ まとめ画面 ============ */
  {
    badge: 'まとめ',
    title: '学んだ用語をネットワーク図と対応させよう',
    hint: '用語をクリックすると、図の対応する部分が光ります',
    render() {
      setRouterWan(true);
      showNatPanel();
      infoCardEl.style.display = 'none';
      glossaryEl.hidden = false;
      const terms = [
        { term: 'IPアドレス', desc: 'ネットワーク上の機器を識別するための住所。', nodes: ['node-pc1', 'node-pc2', 'node-router', 'node-server'] },
        { term: 'サブネットマスク', desc: 'IPアドレスのどこまでがネットワークを表す部分なのかを判断するための情報。', nodes: ['node-pc1', 'node-pc2'] },
        { term: 'デフォルトゲートウェイ', desc: '自分のネットワークの外へ通信するときの出口となる機器。', nodes: ['node-router'] },
        { term: 'プライベートIPアドレス', desc: '家庭、学校、会社などのLAN内部で利用するIPアドレス。', nodes: ['node-pc1', 'node-pc2'] },
        { term: 'グローバルIPアドレス', desc: 'インターネット上で機器やネットワークを識別するために利用するIPアドレス。', nodes: ['node-router', 'node-server'] },
        { term: 'NAT', desc: 'プライベートIPアドレスとグローバルIPアドレスを変換する仕組み。', nodes: ['node-router'] }
      ];
      glossaryEl.innerHTML = '';
      terms.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'glossary-item';
        btn.innerHTML = `<span class="glossary-item__term">${t.term}</span><span class="glossary-item__desc">${t.desc}</span>`;
        btn.addEventListener('click', () => {
          glossaryEl.querySelectorAll('.glossary-item').forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          ALL_NODE_IDS.forEach(id => document.getElementById(id).classList.remove('is-focus'));
          t.nodes.forEach(id => document.getElementById(id).classList.add('is-focus'));
        });
        glossaryEl.appendChild(btn);
      });
    }
  }
];

/* ==========================================================
   進捗ドットの描画
   ========================================================== */
function stepRank(stageIndex) {
  const badge = STAGES[stageIndex].badge;
  if (badge === 'まとめ') return 6;
  return parseInt(badge.replace('STEP ', ''), 10);
}
function renderProgress() {
  const rank = stepRank(currentIndex);
  progressDotsEl.innerHTML = '';
  STEP_META.forEach((m, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'progress-step' + (rank > m.num ? ' is-done' : '') + (rank === m.num ? ' is-current' : '');
    wrap.innerHTML = `<span class="progress-step__dot">${m.num}</span><span class="progress-step__label">${m.label}</span>`;
    progressDotsEl.appendChild(wrap);
    const line = document.createElement('span');
    line.className = 'progress-step__line';
    progressDotsEl.appendChild(line);
  });
  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'progress-step is-summary' + (rank === 6 ? ' is-current' : '') + (rank > 6 ? ' is-done' : '');
  summaryWrap.innerHTML = `<span class="progress-step__dot">✓</span><span class="progress-step__label">まとめ</span>`;
  progressDotsEl.appendChild(summaryWrap);
}

/* ==========================================================
   ステージの表示切り替え
   ========================================================== */
function render(index) {
  currentIndex = index;
  const stage = STAGES[index];

  stageTitleEl.textContent = stage.title;
  stageBadgeEl.textContent = stage.badge;
  diagramHintEl.textContent = stage.hint;

  resetDiagramBase();
  hideNatPanel();
  setRouterWan(false);
  infoCardEl.style.display = '';
  infoCardEl.innerHTML = '';
  questionCardEl.hidden = true;
  actionCardEl.hidden = true;
  explainCardEl.hidden = true;
  glossaryEl.hidden = true;

  prevBtnEl.disabled = index === 0;
  const isLast = index === STAGES.length - 1;
  nextBtnEl.style.visibility = isLast ? 'hidden' : 'visible';
  nextBtnEl.disabled = !doneSet.has(index);

  stage.render(doneSet.has(index));
  renderProgress();
}

/* ==========================================================
   ナビゲーション操作
   ========================================================== */
nextBtnEl.addEventListener('click', () => {
  if (nextBtnEl.disabled) return;
  if (currentIndex < STAGES.length - 1) render(currentIndex + 1);
});
prevBtnEl.addEventListener('click', () => {
  if (currentIndex > 0) render(currentIndex - 1);
});
restartBtnEl.addEventListener('click', () => {
  doneSet.clear();
  render(0);
});

/* ---------- 初期表示 ---------- */
render(0);
