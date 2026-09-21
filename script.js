/* =========================================================================
   IPアドレスと通信の仕組み ― 学習アプリ
   script.js

   このファイルは「STEPの進行管理」「ネットワーク図の表示・アニメーション」
   「問題と解説の表示」の3つの役割を持っています。
   1つのSTEP（画面）は scenes 配列の1要素として定義されており、
   後から文言や正解の選択肢を変更したい場合は、この配列の中身を
   編集してください（HTMLやCSSを直接いじる必要はありません）。
   ========================================================================= */

(function () {
  'use strict';

  /* =======================================================================
     1. DOM要素の取得
     ======================================================================= */

  const packet = document.getElementById('packet');
  const packetLabel = document.getElementById('packetLabel');
  const natPopup = document.getElementById('natPopup');

  const devPc = document.getElementById('devPc');
  const devLanPc = document.getElementById('devLanPc');
  const devRouter = document.getElementById('devRouter');
  const devInternet = document.getElementById('devInternet');
  const devServer = document.getElementById('devServer');

  const lanBoundary = document.getElementById('lanBoundary');
  const routerLanSide = document.getElementById('routerLanSide');
  const routerWanSide = document.getElementById('routerWanSide');

  const linePcLanpc = document.getElementById('linePcLanpc');
  const linePcRouter = document.getElementById('linePcRouter');
  const lineRouterInternet = document.getElementById('lineRouterInternet');
  const lineInternetServer = document.getElementById('lineInternetServer');

  const ipBreakdown = document.getElementById('ipBreakdown');
  const breakdownRows = document.getElementById('breakdownRows');

  const qaContent = document.getElementById('qaContent');

  const progressStepText = document.getElementById('progressStepText');
  const progressSceneText = document.getElementById('progressSceneText');
  const progressFill = document.getElementById('progressFill');
  const progressTicks = document.getElementById('progressTicks');

  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnRestart = document.getElementById('btnRestart');

  const DEVICE_MAP = {
    pc: devPc,
    lanpc: devLanPc,
    router: devRouter,
    internet: devInternet,
    server: devServer
  };

  /* =======================================================================
     2. ネットワーク図の座標定義
     （SVGの viewBox="0 0 900 400" に対応するパケットの通過点）
     ======================================================================= */

  const POINTS = {
    pcExit: { x: 182, y: 140 },        // 自分のPCから外へ出る点
    lanBusTop: { x: 135, y: 194 },     // 自分のPC側のLAN配線の端
    lanBusBottom: { x: 135, y: 258 },  // 同じLAN内のPC側のLAN配線の端
    routerLan: { x: 440, y: 200 },     // ルータのLAN側
    routerWan: { x: 590, y: 200 },     // ルータのWAN側
    internetEnter: { x: 637, y: 188 }, // インターネット（雲）の入口
    internetExit: { x: 742, y: 188 },  // インターネット（雲）の出口
    server: { x: 800, y: 155 }         // Webサーバ
  };

  /* =======================================================================
     3. ネットワーク図を操作するための小さな関数群
     ======================================================================= */

  // 待機用（アニメーションのタイミング調整に使用）
  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // 指定した機器だけを「注目中」の見た目にする
  function setActiveDevices(ids) {
    Object.keys(DEVICE_MAP).forEach(function (key) {
      DEVICE_MAP[key].classList.toggle('active', ids.indexOf(key) !== -1);
    });
  }

  // 指定した機器を薄く表示し、注目を他に集める
  function setDimmedDevices(ids) {
    Object.keys(DEVICE_MAP).forEach(function (key) {
      DEVICE_MAP[key].classList.toggle('dimmed', ids.indexOf(key) !== -1);
    });
  }

  // 接続線を強調表示する／解除する
  function setLineActive(lineEl, isActive) {
    lineEl.classList.toggle('active', isActive);
  }

  // パケットを瞬時に指定位置へ配置する（アニメーションなし）
  function placePacketInstant(point, label) {
    packet.classList.remove('is-hidden');
    packet.style.transition = 'none';
    packet.style.transform = 'translate(' + point.x + 'px,' + point.y + 'px)';
    if (typeof label === 'string') {
      packetLabel.textContent = label;
    }
    // 強制的にレイアウトを再計算させ、transition:none を確実に反映する
    void packet.getBoundingClientRect();
  }

  // パケットを指定位置までアニメーションさせながら移動する
  function movePacketTo(point, durationMs) {
    return new Promise(function (resolve) {
      packet.classList.remove('is-hidden');
      packet.style.transition = 'transform ' + durationMs + 'ms cubic-bezier(.4,.1,.2,1)';
      requestAnimationFrame(function () {
        packet.style.transform = 'translate(' + point.x + 'px,' + point.y + 'px)';
      });
      setTimeout(resolve, durationMs + 50);
    });
  }

  function hidePacket() {
    packet.classList.add('is-hidden');
  }

  // NAT変換ポップアップを一瞬だけ強調表示する（再生ボタンで再実行できるようにする）
  function triggerNatPulse() {
    natPopup.classList.remove('pulse');
    void natPopup.getBoundingClientRect();
    natPopup.classList.add('pulse');
  }

  // IPアドレスの内訳表示（サブネットマスクでネットワーク部／ホスト部を色分け）
  function renderIpBreakdown(sourceIp, destIp, maskIp) {
    const maskOctets = maskIp.split('.');
    const isNetOctet = maskOctets.map(function (o) { return o === '255'; });

    function rowHtml(labelText, ip) {
      const octets = ip.split('.');
      const octetsHtml = octets.map(function (o, i) {
        const cls = isNetOctet[i] ? 'net' : 'host';
        const dot = i < octets.length - 1 ? '<span class="octet-dot">.</span>' : '';
        return '<span class="octet ' + cls + '">' + o + '</span>' + dot;
      }).join('');
      return '<div class="breakdown-row">' +
        '<span class="breakdown-row-label">' + labelText + '</span>' +
        '<span class="octets">' + octetsHtml + '</span>' +
        '</div>';
    }

    breakdownRows.innerHTML =
      rowHtml('送信元', sourceIp) +
      rowHtml('宛先', destIp) +
      rowHtml('サブネットマスク', maskIp);
    ipBreakdown.classList.remove('is-hidden');
  }

  function hideBreakdown() {
    ipBreakdown.classList.add('is-hidden');
    breakdownRows.innerHTML = '';
  }

  // シーンが切り替わるたびに、図の状態を一度すべて初期状態へ戻す
  function resetDiagramVisualState() {
    setActiveDevices([]);
    setDimmedDevices([]);
    [linePcLanpc, linePcRouter, lineRouterInternet, lineInternetServer].forEach(function (l) {
      l.classList.remove('active');
    });
    lanBoundary.classList.remove('dimmed');
    routerLanSide.classList.remove('blocked', 'valid');
    routerWanSide.classList.remove('blocked', 'valid');
    natPopup.classList.add('is-hidden');
    natPopup.classList.remove('pulse');
    hidePacket();
    hideBreakdown();
  }

  /* =======================================================================
     4. 問題・解説カード（qaContent）を組み立てるための部品
     ======================================================================= */

  function infoGridHtml(items) {
    return '<div class="qa-info-grid">' + items.map(function (it) {
      return '<div class="qa-info-item"><span class="label">' + it.label +
        '</span><span class="value">' + it.value + '</span></div>';
    }).join('') + '</div>';
  }

  function choiceListHtml(choices) {
    return '<div class="choice-list">' + choices.map(function (c) {
      return '<button type="button" class="choice-btn" data-id="' + c.id + '">' + c.text + '</button>';
    }).join('') + '</div>';
  }

  function feedbackHtml(kindClass, title, bodyHtml) {
    return '<div class="feedback-box ' + kindClass + '">' +
      '<span class="feedback-title">' + title + '</span>' + bodyHtml + '</div>';
  }

  /**
   * 選択式の問題を1つ表示する共通部品。
   * config = {
   *   kicker, question, infoItems, choices, correctId,
   *   correctBody, incorrectHint,
   *   completeOnAnswer (省略時 true。false の場合は onCorrectExtra 側で明示的に markComplete() を呼ぶ),
   *   onCorrectExtra(feedbackAreaEl, isRevisit) （任意。正解時の追加処理）
   * }
   */
  function setupQuestionScene(config) {
    const completeOnAnswer = config.completeOnAnswer !== false;

    qaContent.innerHTML =
      '<div class="qa-kicker">' + config.kicker + '</div>' +
      '<p class="qa-question">' + config.question + '</p>' +
      (config.infoItems ? infoGridHtml(config.infoItems) : '') +
      choiceListHtml(config.choices) +
      '<div id="feedbackArea"></div>';

    const buttons = Array.prototype.slice.call(qaContent.querySelectorAll('.choice-btn'));
    const feedbackArea = qaContent.querySelector('#feedbackArea');

    function renderCorrect(isRevisit) {
      buttons.forEach(function (b) {
        b.disabled = true;
        b.classList.remove('selected', 'incorrect');
        b.classList.toggle('correct', b.dataset.id === config.correctId);
      });
      feedbackArea.innerHTML = feedbackHtml('is-correct', '正解', config.correctBody);
      if (config.onCorrectExtra) {
        config.onCorrectExtra(qaContent.querySelector('#feedbackArea'), isRevisit);
      }
    }

    if (completed[currentIndex]) {
      renderCorrect(true);
      return;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) { return; }
        buttons.forEach(function (b) { b.classList.remove('selected', 'incorrect', 'correct'); });

        if (btn.dataset.id === config.correctId) {
          if (completeOnAnswer) { markComplete(); }
          renderCorrect(false);
        } else {
          btn.classList.add('incorrect');
          feedbackArea.innerHTML = feedbackHtml('is-incorrect', '不正解', '<p>' + config.incorrectHint + '</p>');
        }
      });
    });
  }

  /**
   * 「送信」ボタンなど、問題を伴わない操作型シーンの共通部品。
   * config = {
   *   kicker, lead, infoItems, buttonLabel,
   *   run() -> Promise         （送信ボタンを押したときのアニメーション処理）
   *   instantFinalState()      （見直し時に、アニメーションなしで最終状態を再現する処理）
   *   doneHtml                 （完了後に表示する解説のHTML）
   * }
   */
  function setupActionScene(config) {
    qaContent.innerHTML =
      '<div class="qa-kicker">' + config.kicker + '</div>' +
      '<p class="qa-lead">' + config.lead + '</p>' +
      (config.infoItems ? infoGridHtml(config.infoItems) : '') +
      '<div class="action-row"><button type="button" class="action-btn" id="actionBtn">' +
      config.buttonLabel + '</button></div>' +
      '<div id="feedbackArea"></div>';

    const btn = qaContent.querySelector('#actionBtn');
    const feedbackArea = qaContent.querySelector('#feedbackArea');

    if (completed[currentIndex]) {
      config.instantFinalState();
      btn.textContent = '送信済み';
      btn.disabled = true;
      feedbackArea.innerHTML = config.doneHtml;
      return;
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = '送信中…';
      config.run().then(function () {
        btn.textContent = '送信済み';
        feedbackArea.innerHTML = config.doneHtml;
        markComplete();
      });
    });
  }

  function step5DoneHtml() {
    return '<div class="success-banner">通信成功！</div>' +
      '<p class="qa-lead" style="margin-bottom:6px;">今回の通信の流れをまとめると、次のようになります。</p>' +
      '<ol class="summary-flow">' +
      '<li>宛先IPアドレスを確認する</li>' +
      '<li>サブネットマスクを使って同じネットワークか判断する</li>' +
      '<li>違うネットワークの場合はデフォルトゲートウェイへ送る</li>' +
      '<li>ルータでNATを行う</li>' +
      '<li>プライベートIPをグローバルIPへ変換する</li>' +
      '<li>インターネットを通って目的のサーバへ送る</li>' +
      '</ol>';
  }

  /* =======================================================================
     5. 各STEP（シーン）の定義
     ここを編集すると、問題文・選択肢・正解・解説文を変更できます。
     ======================================================================= */

  const scenes = [

    /* ---------------- STEP1：宛先を確認する ---------------- */
    {
      step: 1,
      label: '宛先を確認する',
      enter: function () {
        setActiveDevices(['pc', 'lanpc']);
        setDimmedDevices(['router', 'internet', 'server']);
        renderIpBreakdown('192.168.1.10', '192.168.1.20', '255.255.255.0');

        setupQuestionScene({
          kicker: 'STEP 1 の問題',
          question: 'この宛先は、自分と同じネットワークにいるでしょうか？',
          infoItems: [
            { label: '送信元', value: '192.168.1.10' },
            { label: '宛先', value: '192.168.1.20' },
            { label: 'サブネットマスク', value: '255.255.255.0' }
          ],
          choices: [
            { id: 'same', text: '同じネットワーク' },
            { id: 'diff', text: '違うネットワーク' }
          ],
          correctId: 'same',
          correctBody:
            '<p>192.168.1 の部分が共通しているため、同じネットワーク内の機器です。</p>' +
            '<p>ただし「最初の3つが同じだから」とだけ覚えるのではなく、サブネットマスク 255.255.255.0 によって、' +
            'IPアドレスのどこまでがネットワークを表す部分なのかを判断します。上の内訳表示で色分けされた部分を見比べてみましょう。</p>',
          incorrectHint: 'サブネットマスクとIPアドレスをもう一度見比べてみよう。255の部分と0の部分で、意味が違うよ。'
        });
      }
    },

    /* ---------------- STEP2：LAN内部で通信する ---------------- */
    {
      step: 2,
      label: 'LAN内部で通信する',
      enter: function () {
        setActiveDevices(['pc', 'lanpc']);
        setDimmedDevices(['router', 'internet', 'server']);
        setLineActive(linePcLanpc, true);

        setupActionScene({
          kicker: 'STEP 2 の操作',
          lead: '宛先「192.168.1.20」は、STEP 1 で確認した通り同じネットワーク内のPCです。「送信」ボタンを押して、実際にデータを送ってみましょう。',
          infoItems: [
            { label: '送信元', value: '192.168.1.10' },
            { label: '宛先', value: '192.168.1.20' }
          ],
          buttonLabel: '送信',
          run: function () {
            placePacketInstant(POINTS.lanBusTop, '192.168.1.10');
            return movePacketTo(POINTS.lanBusBottom, 1100);
          },
          instantFinalState: function () {
            placePacketInstant(POINTS.lanBusBottom, '192.168.1.10');
          },
          doneHtml: feedbackHtml('is-info', '解説',
            '<p>同じネットワーク内の相手なので、デフォルトゲートウェイを通らずに通信できます。</p>')
        });
      }
    },

    /* ---------------- STEP3-1：別のネットワークへの通信（同じ/違うネットワークの判断） ---------------- */
    {
      step: 3,
      label: '別のネットワークへの通信 ①',
      enter: function () {
        setActiveDevices(['pc', 'server']);
        setDimmedDevices(['lanpc', 'router', 'internet']);
        renderIpBreakdown('192.168.1.10', '198.51.100.20', '255.255.255.0');

        setupQuestionScene({
          kicker: 'STEP 3 の問題（1）',
          question: '今度は宛先をWebサーバに変更します。この宛先は、自分と同じネットワークにいるでしょうか？',
          infoItems: [
            { label: '送信元', value: '192.168.1.10' },
            { label: '宛先', value: '198.51.100.20' },
            { label: 'サブネットマスク', value: '255.255.255.0' }
          ],
          choices: [
            { id: 'same', text: '同じネットワーク' },
            { id: 'diff', text: '違うネットワーク' }
          ],
          correctId: 'diff',
          correctBody:
            '<p>サブネットマスク 255.255.255.0 で判断すると、ネットワークを表す部分は最初の3つの数字です。' +
            '送信元は「192.168.1」、宛先は「198.51.100」で一致しないため、違うネットワークにある機器です。</p>',
          incorrectHint: 'サブネットマスクを使って、ネットワークを表す部分がどこまでかをもう一度確認してみよう。STEP 1 のときと数字を見比べるとわかりやすいよ。'
        });
      }
    },

    /* ---------------- STEP3-2：どこへ送るか判断し、ルータまで送信 ---------------- */
    {
      step: 3,
      label: '別のネットワークへの通信 ②',
      enter: function () {
        setActiveDevices(['pc', 'router']);
        setDimmedDevices(['lanpc', 'internet', 'server']);

        setupQuestionScene({
          kicker: 'STEP 3 の問題（2）',
          question: 'では、違うネットワークにいる相手へ送る場合、最初にどこへデータを送ればよいでしょうか？',
          choices: [
            { id: 'lanpc', text: '同じLAN内の別のPC' },
            { id: 'gateway', text: 'デフォルトゲートウェイ' },
            { id: 'server', text: 'Webサーバへ直接送る' }
          ],
          correctId: 'gateway',
          correctBody:
            '<p>自分と異なるネットワークへ通信するときは、まずデフォルトゲートウェイであるルータへデータを送ります。' +
            'ルータより先の経路は、ルータが判断してくれます。</p>',
          incorrectHint: '異なるネットワークへ出ていくときの「出口」の役割をする機器は何だったか、思い出してみよう。',
          completeOnAnswer: false,
          onCorrectExtra: function (feedbackArea, isRevisit) {
            const row = document.createElement('div');
            row.className = 'action-row';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'action-btn';
            row.appendChild(btn);
            feedbackArea.appendChild(row);

            if (isRevisit) {
              setLineActive(linePcRouter, true);
              placePacketInstant(POINTS.routerLan, '192.168.1.10');
              btn.textContent = '送信済み';
              btn.disabled = true;
              const note = document.createElement('div');
              note.className = 'feedback-extra';
              note.innerHTML = '<p>パケットがルータに到着しました。</p>';
              feedbackArea.appendChild(note);
            } else {
              btn.textContent = '送信';
              btn.addEventListener('click', function () {
                btn.disabled = true;
                btn.textContent = '送信中…';
                setLineActive(linePcRouter, true);
                placePacketInstant(POINTS.pcExit, '192.168.1.10');
                movePacketTo(POINTS.routerLan, 1200).then(function () {
                  btn.textContent = '送信済み';
                  const note = document.createElement('div');
                  note.className = 'feedback-extra';
                  note.innerHTML = '<p>パケットがルータに到着しました。次のSTEPで、ルータの内部を見てみましょう。</p>';
                  feedbackArea.appendChild(note);
                  markComplete();
                });
              });
            }
          }
        });
      }
    },

    /* ---------------- STEP4-1：プライベートIPは使えるか ---------------- */
    {
      step: 4,
      label: 'プライベートIPとNAT ①',
      enter: function () {
        setActiveDevices(['router']);
        setDimmedDevices(['pc', 'lanpc', 'internet', 'server']);
        setLineActive(linePcRouter, true);
        placePacketInstant(POINTS.routerLan, '192.168.1.10');

        setupQuestionScene({
          kicker: 'STEP 4 の問題（1）',
          question: '192.168.1.10 は、そのままインターネット上で送信元として使用できるでしょうか？',
          infoItems: [
            { label: '送信元IP（ルータに到着した時点）', value: '192.168.1.10' }
          ],
          choices: [
            { id: 'yes', text: '使用できる' },
            { id: 'no', text: '使用できない' }
          ],
          correctId: 'no',
          correctBody:
            '<p>192.168.1.10 はプライベートIPアドレスであり、家庭や学校などのLAN内部で使用するアドレスです。' +
            'インターネット上の送信元としてそのまま使うことはできません。</p>',
          incorrectHint: 'プライベートIPアドレスがどこで使われるアドレスだったか、もう一度確認してみよう。',
          onCorrectExtra: function () {
            routerLanSide.classList.add('blocked');
          }
        });
      }
    },

    /* ---------------- STEP4-2：NATによる変換 ---------------- */
    {
      step: 4,
      label: 'プライベートIPとNAT ②',
      enter: function () {
        setActiveDevices(['router']);
        setDimmedDevices(['pc', 'lanpc', 'internet', 'server']);
        setLineActive(linePcRouter, true);
        routerLanSide.classList.add('blocked');

        if (completed[currentIndex]) {
          placePacketInstant(POINTS.routerWan, '203.0.113.10');
          routerWanSide.classList.add('valid');
        } else {
          placePacketInstant(POINTS.routerLan, '192.168.1.10');
        }

        setupQuestionScene({
          kicker: 'STEP 4 の問題（2）',
          question: 'ルータはこのあとNATを行い、プライベートIPアドレスをグローバルIPアドレスに変換します。NATによって書き換えられるのは、送信元IPと宛先IPのどちらでしょうか？',
          choices: [
            { id: 'src', text: '送信元IP' },
            { id: 'dst', text: '宛先IP' }
          ],
          correctId: 'src',
          correctBody:
            '<p>そのとおりです。ルータはNATを使って、パケットの「差出人」にあたる送信元IPアドレスを、' +
            'プライベートIPアドレスからグローバルIPアドレスに書き換えます。ボタンを押して、ルータの内部で実際に起きる変換を見てみましょう。</p>',
          incorrectHint: 'NATが書き換えるのは、パケットの「行き先（宛先）」ではなく「差出人（送信元）」の住所です。もう一度考えてみよう。',
          completeOnAnswer: false,
          onCorrectExtra: function (feedbackArea, isRevisit) {
            const row = document.createElement('div');
            row.className = 'action-row';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'action-btn';
            row.appendChild(btn);
            feedbackArea.appendChild(row);

            if (isRevisit) {
              btn.textContent = 'NAT変換をもう一度見る';
              btn.addEventListener('click', function () {
                natPopup.classList.remove('is-hidden');
                triggerNatPulse();
              });
              const note = document.createElement('div');
              note.className = 'feedback-extra';
              note.innerHTML = '<p>192.168.1.10 → 203.0.113.10 に変換され、ルータの外（WAN側）へ送り出されました。</p>';
              feedbackArea.appendChild(note);
            } else {
              btn.textContent = 'NAT変換を実行';
              btn.addEventListener('click', function () {
                btn.disabled = true;
                btn.textContent = '変換中…';
                natPopup.classList.remove('is-hidden');
                triggerNatPulse();
                wait(700).then(function () {
                  routerWanSide.classList.add('valid');
                  packetLabel.textContent = '203.0.113.10';
                  return movePacketTo(POINTS.routerWan, 900);
                }).then(function () {
                  btn.textContent = '変換済み';
                  const note = document.createElement('div');
                  note.className = 'feedback-extra';
                  note.innerHTML = '<p>192.168.1.10 → 203.0.113.10 に変換され、ルータの外（WAN側）へ送り出されました。</p>';
                  feedbackArea.appendChild(note);
                  markComplete();
                });
              });
            }
          }
        });
      }
    },

    /* ---------------- STEP5：インターネットを通ってWebサーバへ ---------------- */
    {
      step: 5,
      label: 'インターネットを通ってWebサーバへ',
      enter: function () {
        setActiveDevices(['router', 'internet', 'server']);
        setDimmedDevices(['pc', 'lanpc']);
        setLineActive(linePcRouter, true);
        routerLanSide.classList.add('blocked');
        routerWanSide.classList.add('valid');

        setupActionScene({
          kicker: 'STEP 5 の操作',
          lead: '送信元アドレスはNATによって 203.0.113.10 に変換されました。「送信」ボタンを押して、インターネットを通してWebサーバまでデータを届けましょう。',
          infoItems: [
            { label: '送信元（変換後）', value: '203.0.113.10' },
            { label: '宛先', value: '198.51.100.20' }
          ],
          buttonLabel: '送信',
          run: function () {
            placePacketInstant(POINTS.routerWan, '203.0.113.10');
            setLineActive(lineRouterInternet, true);
            return movePacketTo(POINTS.internetEnter, 800).then(function () {
              return movePacketTo(POINTS.internetExit, 600);
            }).then(function () {
              setLineActive(lineInternetServer, true);
              return movePacketTo(POINTS.server, 800);
            });
          },
          instantFinalState: function () {
            setLineActive(lineRouterInternet, true);
            setLineActive(lineInternetServer, true);
            placePacketInstant(POINTS.server, '203.0.113.10');
          },
          doneHtml: step5DoneHtml()
        });
      }
    },

    /* ---------------- まとめ：用語とネットワーク図の振り返り ---------------- */
    {
      step: null,
      label: 'まとめ',
      enter: function () {
        setActiveDevices(['pc', 'lanpc', 'router', 'internet', 'server']);
        setDimmedDevices([]);
        setLineActive(linePcLanpc, true);
        setLineActive(linePcRouter, true);
        setLineActive(lineRouterInternet, true);
        setLineActive(lineInternetServer, true);
        routerWanSide.classList.add('valid');

        const terms = [
          { term: 'IPアドレス', desc: 'ネットワーク上の機器を識別するための住所。', devices: ['pc', 'lanpc', 'router', 'server'] },
          { term: 'サブネットマスク', desc: 'IPアドレスのどこまでがネットワークを表す部分なのかを判断するための情報。', devices: ['pc', 'lanpc'] },
          { term: 'デフォルトゲートウェイ', desc: '自分のネットワークの外へ通信するときの出口となる機器。', devices: ['router'] },
          { term: 'プライベートIPアドレス', desc: '家庭、学校、会社などのLAN内部で利用するIPアドレス。', devices: ['pc', 'lanpc'] },
          { term: 'グローバルIPアドレス', desc: 'インターネット上で機器やネットワークを識別するために利用するIPアドレス。', devices: ['router', 'server'] },
          { term: 'NAT', desc: 'プライベートIPアドレスとグローバルIPアドレスを変換する仕組み。', devices: ['router'] }
        ];

        qaContent.innerHTML =
          '<div class="qa-kicker">まとめ</div>' +
          '<p class="qa-question">学習おつかれさまでした。ここで登場した用語をネットワーク図と対応させて振り返りましょう。' +
          '項目にマウスを合わせると、図の中の関係する機器が強調表示されます。</p>' +
          '<div class="glossary-grid">' +
          terms.map(function (t) {
            return '<div class="glossary-item" data-devices="' + t.devices.join(',') + '">' +
              '<div class="glossary-term">' + t.term + '</div>' +
              '<div class="glossary-desc">' + t.desc + '</div>' +
              '</div>';
          }).join('') +
          '</div>';

        const items = qaContent.querySelectorAll('.glossary-item');
        items.forEach(function (item) {
          const ids = item.dataset.devices.split(',');
          item.addEventListener('mouseenter', function () { setActiveDevices(ids); });
          item.addEventListener('mouseleave', function () {
            setActiveDevices(['pc', 'lanpc', 'router', 'internet', 'server']);
          });
        });

        markComplete();
      }
    }
  ];

  /* =======================================================================
     6. 進行管理（現在位置・完了状態・画面遷移）
     ======================================================================= */

  let currentIndex = 0;
  let completed = new Array(scenes.length).fill(false);

  function markComplete() {
    completed[currentIndex] = true;
    updateNavButtons();
  }

  function buildProgressTicks() {
    progressTicks.innerHTML = '';
    [20, 40, 60, 80].forEach(function (pct) {
      const t = document.createElement('div');
      t.className = 'tick';
      t.style.left = pct + '%';
      progressTicks.appendChild(t);
    });
  }

  function updateProgressUi() {
    const scene = scenes[currentIndex];
    if (scene.step === null) {
      progressStepText.textContent = 'まとめ';
      progressFill.style.width = '100%';
    } else {
      progressStepText.textContent = 'STEP ' + scene.step + ' / 5';
      progressFill.style.width = (scene.step / 5 * 100) + '%';
    }
    progressSceneText.textContent = scene.label;
  }

  function updateNavButtons() {
    btnPrev.disabled = currentIndex === 0;
    const isLast = currentIndex === scenes.length - 1;
    btnNext.disabled = !completed[currentIndex] || isLast;
    btnNext.textContent = isLast ? '学習完了' : '次へ →';
  }

  function renderScene() {
    resetDiagramVisualState();
    updateProgressUi();
    scenes[currentIndex].enter();
    updateNavButtons();
  }

  function goTo(index) {
    currentIndex = Math.max(0, Math.min(scenes.length - 1, index));
    renderScene();
  }

  btnNext.addEventListener('click', function () {
    if (!btnNext.disabled) { goTo(currentIndex + 1); }
  });
  btnPrev.addEventListener('click', function () {
    if (!btnPrev.disabled) { goTo(currentIndex - 1); }
  });
  btnRestart.addEventListener('click', function () {
    completed = new Array(scenes.length).fill(false);
    goTo(0);
  });

  // 矢印キーでも操作できるようにする（プロジェクター投影時の操作性向上のため）
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' && !btnNext.disabled) { goTo(currentIndex + 1); }
    if (e.key === 'ArrowLeft' && !btnPrev.disabled) { goTo(currentIndex - 1); }
  });

  /* =======================================================================
     7. 初期化
     ======================================================================= */

  buildProgressTicks();
  renderScene();

})();
