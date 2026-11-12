/* 따라가기 덧입히기 (슬라이드 본문은 건드리지 않아요)
 * 필요한 것: 슬라이드 파일이 window.__follow = {go, slides} 를 열어 둘 것, js/sync.js, js/config.js
 * 주소:  학생  ?room=코드   /  강사  ?teacher&room=코드  /  연습  &mock
 */
(function () {
  var F = window.__follow;
  if (!F || !window.LectureSync) return;
  var cfg = (window.LECTURE_CONFIG && LECTURE_CONFIG.firebase) || {};
  var qs = location.search;
  var teacher = /[?&]teacher\b/.test(qs), useMock = /[?&]mock\b/.test(qs);
  var hasBackend = useMock || LectureSync.validCfg(cfg);
  if (!hasBackend) return;

  var slides = F.slides;
  var ROOMKEY = 'lec-room:' + location.pathname;
  var room = '', remote = null, follow = true, applied = null, FILES = [];
  var sync = { be: null, user: null, online: false, ready: false, unwatch: null, err: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function qsv(n) { var m = new RegExp('[?&]' + n + '=([^&#]*)').exec(qs); return m ? decodeURIComponent(m[1]) : ''; }
  function cleanCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); }
  function genCode() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  function store(get, k, v) { try { if (get) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function curId() { for (var i = 0; i < slides.length; i++) if (!slides[i].hidden) return slides[i].id; return null; }
  function idx(id) { for (var i = 0; i < slides.length; i++) if (slides[i].id === id) return i; return -1; }
  function isInstructor() { return teacher && !!sync.user; }
  function joinLink() { return location.origin + location.pathname + (room ? '?room=' + encodeURIComponent(room) : ''); }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ''; }
  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } }
  function copyText(t, btn) {
    var done = function () { if (!btn) return; var o = btn.textContent; btn.textContent = '복사됨'; setTimeout(function () { btn.textContent = o; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () {}); else { var a = el('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) {} a.remove(); }
  }

  /* ---------- 화면 ---------- */
  var css = el('style');
  css.textContent =
    '.fl-code{display:flex;align-items:center;gap:6px;font-weight:900;font-size:15px}' +
    '.fl-code[hidden]{display:none}' +
    '.fl-code input,.fl-panel input{font:inherit;font-weight:700;border:2px solid var(--ink);border-radius:10px;padding:5px 10px;background:#fff;color:var(--ink);min-width:0}' +
    '.fl-code input{width:6.5em;text-transform:uppercase;letter-spacing:.08em;border-radius:999px}' +
    '.fl-code button{font:inherit;font-weight:900;color:#fff;background:var(--main);border:3px solid var(--ink);border-radius:999px;box-shadow:3px 3px 0 var(--ink);padding:4px 14px;cursor:pointer}' +
    '.fl-chip{font-size:15px!important;padding:4px 14px!important}' +
    '.fl-chip.follow{background:var(--main);color:#fff}' +
    '.fl-chip.free{background:var(--coral)}' +
    '.fl-chip.warn{background:#ffe9a8}' +
    '.fl-panel{position:fixed;z-index:80;top:calc(var(--top-h) + env(safe-area-inset-top,0px) + 8px);right:12px;width:min(390px,calc(100vw - 24px));max-height:calc(100vh - var(--top-h) - var(--bot-h) - 24px);overflow:auto;background:#fff;border:3px solid var(--ink);border-radius:20px;box-shadow:5px 5px 0 var(--ink);padding:14px 16px;font-size:15px;line-height:1.5;color:var(--ink)}' +
    '.fl-panel[hidden]{display:none}' +
    '.fl-panel h3{margin:0;font-size:17px;font-weight:900}' +
    '.fl-panel h4{margin:14px 0 6px;font-size:14px;font-weight:900;color:var(--deep);letter-spacing:.04em}' +
    '.fl-head{display:flex;justify-content:space-between;align-items:center;gap:8px}' +
    '.fl-row{display:flex;gap:6px;align-items:center;margin:5px 0;flex-wrap:wrap}' +
    '.fl-row label{font-weight:700;font-size:13px;min-width:4.2em}' +
    '.fl-row input{flex:1}' +
    '.fl-btn{font:inherit;font-weight:900;font-size:14px;background:#fff;border:2px solid var(--ink);border-radius:999px;padding:3px 12px;cursor:pointer;box-shadow:2px 2px 0 var(--ink)}' +
    '.fl-btn:hover{background:var(--panel)}.fl-btn.pri{background:var(--main);color:#fff}.fl-btn:disabled{opacity:.4;cursor:default}' +
    '.fl-msg{min-height:1.4em;font-size:13px;color:var(--soft)}.fl-msg.ng{color:#b3261e}.fl-msg.ok{color:#2e6b3a}' +
    '.fl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}' +
    '.fl-list li{display:flex;gap:6px;align-items:center}' +
    '.fl-list a{flex:1;min-width:0;display:flex;flex-direction:column;text-decoration:none;color:var(--ink);background:var(--panel);border:2px solid var(--ink);border-radius:12px;padding:6px 10px}' +
    '.fl-list a b{font-size:14px}.fl-list a span{font-size:12px;color:var(--soft)}' +
    '.fl-empty{color:var(--soft);font-size:13px;margin:4px 0}' +
    '.fl-link{word-break:break-all;font-size:12px;color:var(--soft);margin:2px 0}' +
    '@media (max-width:899px){.top{gap:8px}.top .tbtn{font-size:14px;padding:3px 12px}.fl-chip{font-size:12px!important;padding:3px 10px!important}.fl-code{font-size:13px}.fl-code input{width:5em}}';
  document.head.appendChild(css);

  var top = $('.top'), anchor = $('#doneinfo');
  var codeForm = el('form', 'fl-code'); codeForm.hidden = true; codeForm.autocomplete = 'off';
  var codeLab = el('label', null, '수업 코드'); codeLab.setAttribute('for', 'fl-codein');
  var codeIn = el('input'); codeIn.id = 'fl-codein'; codeIn.maxLength = 12; codeIn.placeholder = '코드'; codeIn.setAttribute('autocapitalize', 'characters');
  var codeGo = el('button', null, '들어가기'); codeGo.type = 'submit';
  codeForm.appendChild(codeLab); codeForm.appendChild(codeIn); codeForm.appendChild(codeGo);
  var chip = el('button', 'tbtn fl-chip'); chip.type = 'button'; chip.hidden = true;
  var pushBtn = el('button', 'tbtn'); pushBtn.type = 'button'; pushBtn.textContent = '모두 여기로'; pushBtn.hidden = true;
  var openBtn = el('button', 'tbtn'); openBtn.type = 'button'; openBtn.textContent = teacher ? '수업 연결' : '자료';
  [codeForm, chip, pushBtn, openBtn].forEach(function (n) { top.insertBefore(n, anchor); });

  var panel = el('div', 'fl-panel'); panel.hidden = true; panel.setAttribute('role', 'dialog');
  var ph = el('div', 'fl-head'); ph.appendChild(el('h3', null, teacher ? '수업 연결 · 자료' : '자료'));
  var pclose = el('button', 'fl-btn', '닫기'); pclose.type = 'button'; ph.appendChild(pclose); panel.appendChild(ph);
  var tsec = el('div'); // 강사 전용
  var elRoom, elEmail, elPw, elLogin, elLogout, elMsg, elJoin, elTitle, elUrl, elAdd, elRmsg, elNew, elCopy, elPush2;
  if (teacher) {
    tsec.appendChild(el('h4', null, '수업 코드'));
    var r1 = el('div', 'fl-row'); elRoom = el('input'); elRoom.maxLength = 12; elRoom.style.textTransform = 'uppercase'; elNew = el('button', 'fl-btn', '새 코드'); elNew.type = 'button';
    r1.appendChild(elRoom); r1.appendChild(elNew); tsec.appendChild(r1);
    elJoin = el('div', 'fl-link'); tsec.appendChild(elJoin);
    var r1b = el('div', 'fl-row'); elCopy = el('button', 'fl-btn', '학생 링크 복사'); elCopy.type = 'button'; elPush2 = el('button', 'fl-btn pri', '모두 여기로'); elPush2.type = 'button'; elPush2.disabled = true;
    r1b.appendChild(elCopy); r1b.appendChild(elPush2); tsec.appendChild(r1b);
    tsec.appendChild(el('h4', null, '강사 로그인'));
    var r2 = el('div', 'fl-row'); var l2 = el('label', null, '이메일'); elEmail = el('input'); elEmail.type = 'email'; elEmail.autocomplete = 'username'; r2.appendChild(l2); r2.appendChild(elEmail); tsec.appendChild(r2);
    var r3 = el('div', 'fl-row'); var l3 = el('label', null, '비밀번호'); elPw = el('input'); elPw.type = 'password'; elPw.autocomplete = 'current-password'; r3.appendChild(l3); r3.appendChild(elPw); tsec.appendChild(r3);
    var r4 = el('div', 'fl-row'); elLogin = el('button', 'fl-btn pri', '강사 로그인'); elLogin.type = 'button'; elLogout = el('button', 'fl-btn', '로그아웃'); elLogout.type = 'button'; elLogout.hidden = true;
    r4.appendChild(elLogin); r4.appendChild(elLogout); tsec.appendChild(r4);
    elMsg = el('div', 'fl-msg'); tsec.appendChild(elMsg);
    tsec.appendChild(el('h4', null, '자료 올리기 (학생은 보기만)'));
    var r5 = el('div', 'fl-row'); elTitle = el('input'); elTitle.placeholder = '이름 (예: 실습 파일)'; r5.appendChild(elTitle); tsec.appendChild(r5);
    var r6 = el('div', 'fl-row'); elUrl = el('input'); elUrl.placeholder = 'https:// 구글 드라이브 공유 링크'; elAdd = el('button', 'fl-btn', '올리기'); elAdd.type = 'button'; r6.appendChild(elUrl); r6.appendChild(elAdd); tsec.appendChild(r6);
    elRmsg = el('div', 'fl-msg'); tsec.appendChild(elRmsg);
    panel.appendChild(tsec);
  }
  panel.appendChild(el('h4', null, '올라온 자료'));
  var rlist = el('ul', 'fl-list'); panel.appendChild(rlist);
  document.body.appendChild(panel);
  /* 입력 중에는 화살표 키로 슬라이드가 넘어가지 않게 */
  [panel, codeForm].forEach(function (n) { n.addEventListener('keydown', function (e) { e.stopPropagation(); }); });

  function setMsg(t, bad) { if (!elMsg) return; elMsg.textContent = t || ''; elMsg.className = 'fl-msg ' + (bad ? 'ng' : 'ok'); }
  function synErr(e) { var t = (e && e.message) || '오류'; if (/permission/i.test(t)) t = '쓰기 권한이 없어요. 강사 로그인과 Database 규칙의 UID를 확인해 주세요.'; setMsg(t, true); }

  function renderResources() {
    rlist.textContent = '';
    if (!FILES.length) { var e = el('li', 'fl-empty', '아직 올라온 자료가 없어요.'); rlist.appendChild(e); }
    FILES.forEach(function (f) {
      var u = safeUrl(f.u); if (!u) return;
      var li = el('li'), a = el('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.appendChild(el('b', null, (f.i || '📎') + ' ' + (f.t || hostOf(u)))); a.appendChild(el('span', null, hostOf(u)));
      li.appendChild(a);
      if (isInstructor()) { var d = el('button', 'fl-btn', '삭제'); d.type = 'button'; d.setAttribute('data-rid', f.id); li.appendChild(d); }
      rlist.appendChild(li);
    });
    openBtn.textContent = (teacher ? '수업 연결' : '자료') + (!teacher && FILES.length ? ' ' + FILES.length : '');
  }

  function updateChip() {
    codeForm.hidden = !(!teacher && (!room || forceForm));
    if (!room) { chip.hidden = true; return; }
    chip.hidden = false; chip.className = 'tbtn fl-chip'; chip.title = ''; var t = '';
    if (sync.err) { chip.classList.add('warn'); t = '연결 문제'; chip.title = sync.err; }
    else if (!sync.ready) t = '연결 중…';
    else if (!sync.online) { chip.classList.add('warn'); t = '연결이 끊겼어요'; }
    else if (teacher) { if (isInstructor()) { chip.classList.add('follow'); t = '● 학생과 연결됨 · ' + room; } else { chip.classList.add('warn'); t = '강사 로그인 필요'; } }
    else if (!remote || !remote.slide) t = '강사 시작 전이에요';
    else if (follow) { chip.classList.add('follow'); t = '● 따라가는 중'; }
    else { chip.classList.add('free'); t = '자유 보기 · 눌러서 돌아가기'; }
    chip.textContent = t;
    pushBtn.hidden = !isInstructor();
    if (elPush2) elPush2.disabled = !isInstructor();
    if (teacher) {
      elJoin.textContent = joinLink(); elRoom.value = room;
      elLogin.hidden = !!sync.user; elLogout.hidden = !sync.user;
      elEmail.disabled = elPw.disabled = !!sync.user;
      if (sync.user) setMsg('로그인됨: ' + (sync.user.email || ''), false);
    }
  }
  var forceForm = false;

  /* ---------- 슬라이드 이동 감지 ---------- */
  var lastId = curId(), tmr = null;
  var mo = new MutationObserver(function () { clearTimeout(tmr); tmr = setTimeout(check, 0); });
  slides.forEach(function (s) { mo.observe(s, { attributes: true, attributeFilter: ['hidden'] }); });
  function check() {
    var id = curId(); if (!id || id === lastId) return; lastId = id;
    if (isInstructor()) publishSlide(false);
    else if (!teacher && id !== applied) follow = false;
    updateChip();
  }
  function followTo(id) { var i = idx(id); if (i < 0) return; applied = id; if (curId() !== id) F.go(i); }

  /* ---------- 강사: 보내기 ---------- */
  function publishSlide(push) {
    if (!isInstructor() || !sync.be || !sync.ready || !room) return;
    var o = { slide: curId(), at: Date.now() }; if (push) o.pushSeq = Date.now();
    sync.be.setState(room, o).catch(synErr);
  }
  function pushAll(btn) {
    if (!isInstructor()) return;
    var o = { slide: curId(), pushSeq: Date.now(), at: Date.now() };
    sync.be.setState(room, o).then(function () { if (btn) { var t = btn.textContent; btn.textContent = '보냈어요 ✓'; setTimeout(function () { btn.textContent = t; }, 1400); } }).catch(synErr);
  }

  /* ---------- 학생: 받기 ---------- */
  function onRemoteState(st) {
    var prev = remote; remote = st || {};
    if (!teacher) {
      if (prev && remote.pushSeq !== undefined && remote.pushSeq !== prev.pushSeq) follow = true;
      if (follow && remote.slide) followTo(remote.slide);
    }
    updateChip();
  }
  function watch() {
    if (sync.unwatch) { sync.unwatch(); sync.unwatch = null; }
    if (!sync.be || !room) return;
    remote = null;
    sync.unwatch = sync.be.watchRoom(room, {
      onState: onRemoteState,
      onResources: function (l) { FILES = l; renderResources(); },
      onError: function (e) { sync.err = '읽기 문제: ' + ((e && e.message) || e); updateChip(); }
    });
  }
  function startSync() {
    if (sync.be) return;
    sync.be = useMock ? new LectureSync.Mock() : new LectureSync.Firebase(cfg);
    updateChip();
    sync.be.init().then(function () {
      sync.ready = true;
      sync.be.onConnection(function (on) { sync.online = on; updateChip(); if (on && isInstructor()) publishSlide(false); });
      sync.be.onAuth(function (u) { sync.user = u; updateChip(); renderResources(); if (isInstructor()) publishSlide(false); });
      watch(); updateChip();
    }).catch(function (e) { sync.err = (e && e.message) || '연결 실패'; updateChip(); });
  }

  /* ---------- 이벤트 ---------- */
  openBtn.addEventListener('click', function () { panel.hidden = !panel.hidden; });
  pclose.addEventListener('click', function () { panel.hidden = true; });
  pushBtn.addEventListener('click', function () { pushAll(pushBtn); });
  chip.addEventListener('click', function () {
    if (teacher) { panel.hidden = false; return; }
    if (sync.ready && remote && remote.slide && !follow) { follow = true; followTo(remote.slide); updateChip(); return; }
    if (sync.ready && (!remote || !remote.slide)) { forceForm = true; updateChip(); codeIn.value = room; codeIn.focus(); }
  });
  codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var c = cleanCode(codeIn.value); if (!c) return;
    room = c; follow = true; remote = null; sync.err = null; forceForm = false;
    try { var u = new URL(location.href); u.searchParams.set('room', c); history.replaceState(null, '', u.toString()); } catch (x) {}
    if (sync.be && sync.ready) watch(); else startSync();
    updateChip();
  });
  if (teacher) {
    elRoom.addEventListener('change', function () {
      var c = cleanCode(this.value); if (!c) { this.value = room; return; }
      room = c; store(false, ROOMKEY, room); if (sync.be && sync.ready) { watch(); publishSlide(false); } updateChip();
    });
    elNew.addEventListener('click', function () {
      room = genCode(); store(false, ROOMKEY, room);
      if (sync.be && sync.ready) { watch(); publishSlide(false); } else startSync();
      updateChip();
    });
    elCopy.addEventListener('click', function () { copyText(joinLink(), this); });
    elPush2.addEventListener('click', function () { pushAll(this); });
    elLogin.addEventListener('click', function () {
      var em = elEmail.value.trim(), pw = elPw.value;
      if (!em || !pw) { setMsg('이메일과 비밀번호를 입력해 주세요.', true); return; }
      if (!sync.be) { setMsg('연결이 아직 준비되지 않았어요.', true); return; }
      setMsg('로그인 중…', false);
      sync.be.signIn(em, pw).then(function () { elPw.value = ''; }).catch(function (e) {
        var t = (e && e.code) || (e && e.message) || '';
        setMsg(/unauthorized-domain/.test(t) ? '승인된 도메인에 이 주소를 추가해 주세요 (Firebase → Authentication → 설정).' : /invalid|wrong|user-not-found|credential/.test(t) ? '이메일이나 비밀번호가 맞지 않아요.' : '로그인에 실패했어요: ' + t, true);
      });
    });
    elLogout.addEventListener('click', function () { if (sync.be) sync.be.signOut(); });
    elAdd.addEventListener('click', function () {
      var t = elTitle.value.trim(), u = safeUrl(elUrl.value);
      if (!u) { elRmsg.textContent = 'https:// 로 시작하는 주소를 넣어 주세요.'; elRmsg.className = 'fl-msg ng'; return; }
      if (!isInstructor()) { elRmsg.textContent = '먼저 강사 로그인을 해 주세요.'; elRmsg.className = 'fl-msg ng'; return; }
      sync.be.addResource(room, { t: t || hostOf(u), u: u, i: '📎', ts: Date.now() }).then(function () {
        elTitle.value = ''; elUrl.value = ''; elRmsg.textContent = '올렸어요.'; elRmsg.className = 'fl-msg ok';
      }).catch(function (e) { elRmsg.textContent = ''; synErr(e); });
    });
    rlist.addEventListener('click', function (e) { var b = e.target.closest('[data-rid]'); if (b && sync.be) sync.be.removeResource(room, b.getAttribute('data-rid')).catch(synErr); });
  }

  /* ---------- 시작 ---------- */
  room = cleanCode(qsv('room'));
  if (teacher && !room) { room = cleanCode(store(true, ROOMKEY)) || genCode(); store(false, ROOMKEY, room); }
  renderResources(); updateChip();
  if (room) startSync();
})();
