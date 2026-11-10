/* مكتبة د. مالك بن رضا المحمدي. */
(function () {
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => (/^https:\/\//i.test(u || '') ? u : '#');
function linkedText(value) {
  return String(value == null ? '' : value).split(/(https?:\/\/[^\s<>"']+)/gi).map(part => {
    if (!/^https?:\/\//i.test(part)) return esc(part).replace(/\n/g, '<br>');
    let url = part;
    let trailing = '';
    while (/[.,،؛!?؟:)\]}»]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    let validUrl = '';
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') validUrl = parsed.href;
    } catch (e) { /* Keep malformed URLs as text. */ }
    return validUrl
      ? '<a href="' + esc(validUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>' + esc(trailing)
      : esc(part);
  }).join('');
}

const S = { site: null, user: null, saved: [], route: 'home' };
const PAGES = ['home', 'lessons', 'books', 'sermons', 'words', 'files', 'benefits', 'live', 'login', 'signup', 'recover', 'account', 'dashboard', 'terms', 'watch'];
const WATCH = { contentId: null, videoId: '', currentVideoId: '', loadId: 0, questionsId: 0 };
const BENEFIT_VIEW = { items: [], index: 0 };
const PLAYLIST_THUMBNAILS = new Map();
let playlistThumbObserver = null;
let motionObserver = null;
const RECOVERY = { username: '' };
const ACCOUNT_TELEGRAM = { url: '' };
const cfg = k => (S.site.settings[k] || '');
const vid = id => S.site.videos.find(v => v.id === Number(id));
const hasFullAccess = () => !!S.user && (S.user.role === 'admin' || S.user.role === 'supervisor');
const isStaff = hasFullAccess;
const fmtDate = t => (t ? new Date(t * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const ROLE = { admin: 'مشرف', supervisor: 'مشرف', student: 'طالب' };
const GENDER = { male: 'ذكر', female: 'أنثى' };
const genderClass = gender => gender === 'male' || gender === 'female' ? gender : 'unspecified';
const genderIcon = gender => '<svg viewBox="0 0 24 24" focusable="false"><circle cx="10" cy="8" r="3.5"/><path d="M3.5 21v-2a6.5 6.5 0 0 1 13 0v2z"/>' +
  (gender === 'male' ? '<path d="M15 4h5v5m0-5-6 6"/>' : gender === 'female' ? '<path d="M18 14v6m-3-3h6"/>' : '') + '</svg>';
const avatarContent = (role, gender, avatarPath) => avatarPath
  ? '<img src="' + esc(avatarPath) + '" alt="الصورة الشخصية">' : genderIcon(gender);
const userAvatar = (role, gender, className, avatarPath) => '<span class="' + (className || 'gender-avatar') + ' ' +
  (role === 'supervisor' || role === 'admin' ? 'supervisor-avatar' : genderClass(gender)) + '">' +
  avatarContent(role, gender, avatarPath) + '</span>';
const genderBadge = gender => '<span class="gender-label ' + genderClass(gender) + '">' +
  genderIcon(gender) + esc(GENDER[gender] || 'غير محدد') + '</span>';

/* ───────── المظهر ───────── */
const THEME_KEY = 'mahad-theme';
function applyTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const toggle = $('#theme-toggle');
  toggle.innerHTML = dark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z"/></svg>';
  const label = dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن';
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  });
}

/* ───────── الاتصال بالخادم ───────── */
async function api(method, url, body) {
  const opt = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch(url, opt); } catch (e) { throw new Error('تعذّر الاتصال بالخادم'); }
  let d = {};
  try { d = await r.json(); } catch (e) { /* فارغ */ }
  if (!r.ok) { const e = new Error(d.error || 'حدث خطأ'); e.status = r.status; throw e; }
  return d;
}
function setMe(d) { S.user = d.user || null; S.saved = d.saved || []; }
async function loadSite() { S.site = await api('GET', '/api/site'); }
async function loadMe() { setMe(await api('GET', '/api/me')); }

let toastT;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800);
}

/* ───────── مشغّل يوتيوب داخل الموقع ───────── */
let lastFocus = null;
let playlistLoadId = 0;
let lessonRequestId = 0;
let activeLesson = null;
let lessonData = null;
let lessonDataError = '';
let youtubeApiPromise = null;
let youtubePlayer = null;
let progressTimer = null;
let progressQueue = Promise.resolve();
let frameSerial = 0;
let modalTab = 'lesson';
const youtubeFrame = (videoId, title, autoplay) => {
  const id = 'lesson-player-' + (++frameSerial);
  return '<iframe id="' + id + '" src="https://www.youtube-nocookie.com/embed/' +
    encodeURIComponent(videoId) + '?enablejsapi=1&origin=' + encodeURIComponent(location.origin) +
    '&rel=0&autoplay=' + (autoplay ? '1' : '0') + '&hl=ar" title="' + esc(title) +
    '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
};
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('تعذّر تحميل أداة متابعة مشغّل يوتيوب'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('انتهت مهلة تحميل أداة متابعة يوتيوب')), 15000);
  });
  return youtubeApiPromise;
}
async function saveLessonProgress(completed) {
  if (!activeLesson || !youtubePlayer || !S.user || S.user.role !== 'student') return;
  const duration = Math.floor(youtubePlayer.getDuration() || 0);
  if (duration < 1) return;
  const position = Math.min(duration, Math.floor(youtubePlayer.getCurrentTime() || 0));
  const lesson = activeLesson;
  const payload = { title: lesson.title, position_seconds: position, duration_seconds: duration, completed: !!completed };
  progressQueue = progressQueue.then(() =>
    api('POST', '/api/lessons/' + encodeURIComponent(lesson.id) + '/progress', payload)
  ).catch(e => toast('تعذّر حفظ تقدم الدرس: ' + e.message, true));
}
async function mountYouTubeTracking(frameId, videoId) {
  if (!S.user || S.user.role !== 'student') return;
  try {
    const YT = await loadYouTubeAPI();
    const frame = document.getElementById(frameId);
    if (!frame || !activeLesson || activeLesson.id !== videoId) return;
    youtubePlayer = new YT.Player(frameId, { events: {
      onReady(event) {
        const progress = lessonData && lessonData.progress;
        if (progress && !progress.completed && progress.position_seconds > 3) {
          event.target.seekTo(progress.position_seconds, true);
        }
      },
      onStateChange(event) {
        if (progressTimer) clearInterval(progressTimer);
        if (event.data === YT.PlayerState.PLAYING) {
          progressTimer = setInterval(() => saveLessonProgress(false), 10000);
        } else if (event.data === YT.PlayerState.PAUSED) {
          saveLessonProgress(false);
        } else if (event.data === YT.PlayerState.ENDED) {
          saveLessonProgress(true);
        }
      }
    } });
  } catch (e) { toast(e.message, true); }
}
function renderModalTabs() {
  const tabs = $('#mtabs');
  if (!activeLesson) { tabs.hidden = true; return; }
  tabs.hidden = false;
  tabs.innerHTML = [['lesson', 'الدروس'], ['file', 'الملفات'], ['note', 'الملاحظات'],
    ['audio', 'الصوتيات']].map(([key, title]) =>
    '<button type="button" role="tab" aria-selected="' + (modalTab === key) +
    '" data-act="modal-tab" data-tab="' + key + '"' + (modalTab === key ? ' class="on"' : '') + '>' +
    title + '</button>').join('');
  $('#mplayer').hidden = modalTab !== 'lesson';
  $('#mresources').hidden = modalTab === 'lesson';
  renderLessonResources();
}
function renderLessonResources() {
  const box = $('#mresources');
  if (!activeLesson || modalTab === 'lesson') return;
  if (lessonDataError) { box.innerHTML = '<p class="err">' + esc(lessonDataError) + '</p>'; return; }
  if (!lessonData) { box.innerHTML = '<p class="muted">جارٍ تحميل محتوى الدرس…</p>'; return; }
  const resources = (lessonData.resources || []).filter(r => r.kind === modalTab);
  let html = '';
  if (modalTab === 'file') html = resources.map(r => '<a class="resource-row" href="' + esc(r.path) +
    '" target="_blank" rel="noopener noreferrer"><b>' + esc(r.title) + '</b><span>فتح الملف ↗</span></a>').join('');
  else if (modalTab === 'note') html = resources.map(r => '<article class="resource-note"><h4>' + esc(r.title) +
    '</h4><p>' + esc(r.body).replace(/\n/g, '<br>') + '</p></article>').join('');
  else if (modalTab === 'audio') html = resources.map(r => '<article class="resource-audio"><b>' + esc(r.title) +
    '</b><audio controls preload="none" src="' + esc(r.path) + '">المتصفح لا يدعم تشغيل الصوت.</audio></article>').join('');
  box.innerHTML = html || '<p class="muted">لا توجد مواد مرتبطة بهذا الدرس حتى الآن.</p>';
}
const CHAT = { open: false, recipient: null, contacts: [], messages: [], search: '', timer: null };
const NOTIFICATIONS = { open: false, items: [], unread: 0, latestId: 0, initialized: false, timer: null, audio: null, pendingSound: false };
const ANNOUNCEMENT = { id: 0 };
let contactSearchTimer = null;
function notificationAudio() {
  if (!NOTIFICATIONS.audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) NOTIFICATIONS.audio = new AudioContext();
  }
  if (NOTIFICATIONS.audio && NOTIFICATIONS.audio.state === 'suspended') {
    NOTIFICATIONS.audio.resume().then(() => {
      if (NOTIFICATIONS.pendingSound && NOTIFICATIONS.audio.state === 'running') {
        NOTIFICATIONS.pendingSound = false;
        playNotificationSound();
      }
    }).catch(error => console.warn('تعذّر تفعيل صوت الإشعارات:', error));
  } else if (NOTIFICATIONS.audio && NOTIFICATIONS.audio.state === 'running' && NOTIFICATIONS.pendingSound) {
    NOTIFICATIONS.pendingSound = false;
    playNotificationSound();
  }
}
function playNotificationSound() {
  if (!NOTIFICATIONS.audio || NOTIFICATIONS.audio.state !== 'running') {
    NOTIFICATIONS.pendingSound = true;
    return;
  }
  const context = NOTIFICATIONS.audio;
  const time = context.currentTime;
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time + index * 0.13);
    gain.gain.exponentialRampToValueAtTime(0.13, time + index * 0.13 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + index * 0.13 + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(time + index * 0.13); oscillator.stop(time + index * 0.13 + 0.2);
  });
}
function notificationToasts(items) {
  const container = $('#notification-toasts');
  if (!container) return;
  items.forEach(item => {
    const toastItem = document.createElement('article');
    toastItem.className = 'notification-toast';
    toastItem.dataset.notificationId = item.id;
    toastItem.innerHTML = '<button type="button" class="notification-toast-close" data-act="notification-toast-dismiss" aria-label="إغلاق">×</button>' +
      '<button type="button" class="notification-toast-open" data-act="notification-toast-open" data-id="' + item.id + '">' +
      '<b>' + esc(item.title) + '</b><p>' + esc(item.body || '') + '</p></button>' +
      '<small>' + new Date(item.created_at * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + '</small>';
    container.prepend(toastItem);
    setTimeout(() => { if (toastItem.isConnected) toastItem.remove(); }, 9000);
  });
}
async function pollNotifications() {
  if (!S.user || !['student', 'supervisor'].includes(S.user.role)) return;
  const query = '?after=' + encodeURIComponent(NOTIFICATIONS.latestId);
  const result = await api('GET', '/api/chat/notifications' + query);
  const incoming = result.new_items || [];
  if (NOTIFICATIONS.initialized && incoming.length) {
    playNotificationSound();
    notificationToasts(incoming);
  }
  NOTIFICATIONS.latestId = Math.max(NOTIFICATIONS.latestId, result.latest_id || 0);
  NOTIFICATIONS.initialized = true;
  NOTIFICATIONS.unread = result.unread_count || 0;
  NOTIFICATIONS.items = result.items || [];
  const badge = $('#notification-count');
  if (badge) {
    badge.hidden = !NOTIFICATIONS.unread;
    badge.textContent = NOTIFICATIONS.unread > 99 ? '99+' : String(NOTIFICATIONS.unread);
  }
  renderNotifications();
}
function startNotificationPolling() {
  if (NOTIFICATIONS.timer) clearInterval(NOTIFICATIONS.timer);
  NOTIFICATIONS.timer = null;
  if (!S.user || !['student', 'supervisor'].includes(S.user.role)) {
    NOTIFICATIONS.open = false; NOTIFICATIONS.items = [];
    NOTIFICATIONS.unread = 0; NOTIFICATIONS.latestId = 0; NOTIFICATIONS.initialized = false;
    const panel = $('#notifications-panel');
    if (panel) panel.hidden = true;
    return;
  }
  pollNotifications().catch(e => toast('تعذّر تحميل الإشعارات: ' + e.message, true));
  NOTIFICATIONS.timer = setInterval(() => {
    pollNotifications().catch(e => console.error('Notification polling failed:', e));
  }, 10000);
}
function chatMessagesHtml() {
  if (!CHAT.messages.length) return '<p class="muted">لا توجد رسائل بعد.</p>';
  return CHAT.messages.map(m => {
    let attachment = '';
    if (m.attachment_path && m.attachment_type === 'video') {
      attachment = '<video class="chat-video" controls preload="metadata" src="' + esc(m.attachment_path) + '"></video>';
    } else if (m.attachment_path && m.attachment_type === 'audio') {
      attachment = '<audio controls preload="none" src="' + esc(m.attachment_path) + '"></audio>';
    } else if (m.attachment_path && m.attachment_type === 'image') {
      attachment = '<a class="chat-image-link" href="' + esc(m.attachment_path) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(m.attachment_path) + '" alt="' + esc(m.attachment_name) + '"></a>';
    } else if (m.attachment_path) {
      attachment = '<a class="chat-file" href="' + esc(m.attachment_path) + '" target="_blank" rel="noopener">📎 ' +
        esc(m.attachment_name) + ' ↗</a>';
    }
    return '<article class="chat-message' + (m.sender_id === S.user.id ? ' mine' : '') + '">' +
    '<div class="chat-sender">' + userAvatar(m.sender_role, m.sender_gender, 'contact-avatar', m.sender_avatar_path) + '<b>' + esc(m.sender_name) + '</b></div>' +
    (m.body ? '<p>' + esc(m.body) + '</p>' : '') + attachment + '<time>' +
    new Date(m.created_at * 1000).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) +
    (m.sender_id === S.user.id && m.read_at ? ' · تمت القراءة' : '') +
    '</time></article>';
  }).join('');
}
async function refreshChatMessages() {
  if (!CHAT.open || !S.user || !CHAT.recipient) return;
  const query = '?recipient=' + encodeURIComponent(CHAT.recipient);
  const result = await api('GET', '/api/chat/messages' + query);
  CHAT.messages = result.messages || [];
  const list = $('#chat-messages');
  if (list) { list.innerHTML = chatMessagesHtml(); list.scrollTop = list.scrollHeight; }
  pollNotifications().catch(e => console.error('Notification refresh failed:', e));
}
async function loadCommunity(search) {
  const query = search == null ? CHAT.search : search;
  const searchHadFocus = document.activeElement && document.activeElement.id === 'chat-contact-search';
  const searchPosition = searchHadFocus ? document.activeElement.selectionStart : 0;
  const contacts = await api('GET', '/api/chat/contacts' + (query ? '?q=' + encodeURIComponent(query) : ''));
  CHAT.contacts = contacts.contacts || [];
  CHAT.search = query;
  renderCommunity();
  if (searchHadFocus) {
    const input = $('#chat-contact-search');
    input.focus();
    input.setSelectionRange(searchPosition, searchPosition);
  }
}
function renderCommunity() {
  const toggle = $('#community-toggle'), panel = $('#community-panel');
  const notificationToggle = $('#notification-toggle');
  const notificationPanel = $('#notifications-panel');
  const eligible = !!S.user && ['student', 'supervisor'].includes(S.user.role);
  toggle.hidden = !eligible;
  notificationToggle.hidden = !eligible;
  panel.hidden = !eligible || !CHAT.open;
  notificationPanel.hidden = !eligible || !NOTIFICATIONS.open;
  $('#community-backdrop').hidden = !eligible || (!CHAT.open && !NOTIFICATIONS.open);
  toggle.setAttribute('aria-expanded', String(CHAT.open));
  notificationToggle.setAttribute('aria-expanded', String(NOTIFICATIONS.open));
  if (!eligible) { panel.innerHTML = ''; notificationPanel.innerHTML = ''; return; }
  if (!S.user.gender) {
    panel.innerHTML = '<div class="community-head"><div><b>التواصل الداخلي</b><small>يلزم تحديد النوع أولًا</small></div>' +
      '<button type="button" data-act="community-toggle" aria-label="إغلاق التواصل">✕</button></div>' +
      '<p class="muted community-setup">حدّد النوع من <a class="lnk" href="#account">ملفي الشخصي</a> لتفعيل المساحة المناسبة.</p>';
  } else {
    const current = CHAT.contacts.find(contact => contact.id === Number(CHAT.recipient));
    let content;
    if (current) {
      content = '<div class="chat-conversation-head"><button type="button" class="btn ghost sm" data-act="chat-back">رجوع</button>' +
        userAvatar(current.role, current.gender, 'contact-avatar', current.avatar_path) + '<b>' + esc(current.name) + '</b></div>' +
        '<div class="chat-messages" id="chat-messages">' + chatMessagesHtml() + '</div>' +
        '<form class="chat-compose" data-form="chat"><textarea name="body" maxlength="2000" placeholder="اكتب رسالة…"></textarea>' +
        '<label class="chat-attach" title="إرفاق ملف أو صورة أو صوت أو فيديو">📎<input type="file" data-chat-upload ' +
        'accept="application/pdf,image/jpeg,image/png,image/webp,audio/*,video/mp4,video/webm,video/quicktime"></label>' +
        '<input type="hidden" name="attachment_path"><input type="hidden" name="attachment_name">' +
        '<input type="hidden" name="attachment_type"><button class="btn sm" type="submit">إرسال</button>' +
        '<span class="chat-attachment-name" hidden></span><span class="msg"></span></form>';
    } else {
      const contacts = CHAT.contacts.map(c => '<button type="button" class="chat-contact' +
          (c.unread_count ? ' has-unread' : '') +
          (S.user.role === 'student' && c.role === 'supervisor' ? ' pinned' : '') +
          '" data-act="chat-contact" data-id="' + c.id + '">' +
          userAvatar(c.role, c.gender, 'contact-avatar', c.avatar_path) + '<span class="chat-contact-name"><b>' + esc(c.name) +
          '</b><small>' + (c.role === 'supervisor' ? 'مشرف' : 'طالب') + '</small></span>' +
          (S.user.role === 'student' && c.role === 'supervisor' ? '<span class="chat-pin" aria-label="مثبت دائمًا" title="مثبت دائمًا">📌</span>' : '') +
          (c.unread_count ? '<span class="chat-unread">' + c.unread_count + '</span>' : '') + '</button>').join('');
      content = (S.user.role === 'supervisor' ? '<label class="sr-only" for="chat-contact-search">ابحث عن طالب</label>' +
        '<input id="chat-contact-search" class="chat-search" type="search" value="' + esc(CHAT.search) +
        '" placeholder="ابحث عن طالب بالاسم أو المعرّف…">' : '') +
        '<div class="chat-contacts" id="chat-contacts">' +
        (contacts || '<p class="muted">لا توجد حسابات للتواصل معها.</p>') + '</div>';
    }
    panel.innerHTML = '<div class="community-head"><div><b>التواصل الداخلي</b><small>' +
      (S.user.role === 'student' ? 'مراسلة المشرفين' : 'مراسلة الطلاب والرد على رسائلهم') +
      '</small></div><button type="button" data-act="community-toggle" aria-label="إغلاق التواصل">✕</button></div>' + content;
  }
  renderNotifications();
  const list = $('#chat-messages');
  if (list) list.scrollTop = list.scrollHeight;
}
async function toggleCommunity() {
  if (!S.user || !['student', 'supervisor'].includes(S.user.role)) return;
  NOTIFICATIONS.open = false;
  CHAT.open = !CHAT.open;
  if (CHAT.timer) clearInterval(CHAT.timer);
  CHAT.timer = null;
  if (CHAT.open) {
    notificationAudio();
    if (!['student', 'supervisor'].includes(S.user.role) || !S.user.gender) {
      renderCommunity();
      return;
    }
    await loadCommunity();
    if (CHAT.recipient) await refreshChatMessages();
    CHAT.timer = setInterval(() => {
      if (CHAT.recipient) refreshChatMessages().catch(e => console.error('Chat refresh failed:', e));
      else loadCommunity().catch(e => console.error('Contact refresh failed:', e));
    }, 10000);
  } else renderCommunity();
}
async function openNotifications() {
  if (!S.user || !['student', 'supervisor'].includes(S.user.role)) return;
  notificationAudio();
  CHAT.open = false;
  if (CHAT.timer) clearInterval(CHAT.timer);
  CHAT.timer = null;
  NOTIFICATIONS.open = !NOTIFICATIONS.open;
  renderCommunity();
  if (NOTIFICATIONS.open) await pollNotifications();
}
function renderNotifications() {
  const panel = $('#notifications-panel');
  if (!panel) return;
  const entries = NOTIFICATIONS.items.map(item => '<button type="button" class="notification-item' +
    (item.read_at ? '' : ' unread') + '" data-act="notification-open" data-id="' + item.id + '">' +
    '<span class="notification-item-kind">' + (item.kind === 'question' ? 'سؤال مجلس' :
      item.kind === 'answer' ? 'إجابة مشرف' : 'رسالة') + '</span>' +
    '<b>' + esc(item.title) + '</b><span>' + esc(item.body || '') + '</span><time>' +
    new Date(item.created_at * 1000).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) +
    '</time></button>').join('');
  panel.innerHTML = '<div class="community-head"><div><b>الإشعارات</b><small>' +
    (NOTIFICATIONS.unread ? NOTIFICATIONS.unread + ' غير مقروء' : 'لا توجد إشعارات غير مقروءة') +
    '</small></div><div class="notification-panel-actions">' +
    (NOTIFICATIONS.unread ? '<button type="button" class="btn ghost sm" data-act="notification-read-all">قراءة الكل</button>' : '') +
    '<button type="button" data-act="notification-toggle" aria-label="إغلاق الإشعارات">✕</button></div></div>' +
    '<div class="notification-list">' + (entries || '<p class="muted notification-empty">لا توجد إشعارات بعد.</p>') + '</div>';
}
function showAnnouncement() {
  const item = S.site && S.site.announcement;
  const popup = $('#announcement-popup');
  if (!item || !popup) return;
  const viewer = S.user ? String(S.user.id) : 'visitor';
  const key = 'mahad-announcement-seen:' + viewer;
  if (localStorage.getItem(key) === String(item.id)) return;
  ANNOUNCEMENT.id = item.id;
  $('#announcement-popup-content').innerHTML =
    (item.image_path ? '<img class="announcement-popup-image" src="' + esc(item.image_path) + '" alt="">' : '') +
    '<h2 id="announcement-popup-title">' + esc(item.title) + '</h2><div class="announcement-popup-body">' + linkedText(item.body) + '</div>';
  popup.hidden = false;
  document.documentElement.classList.add('lock');
  playNotificationSound();
}
function closeAnnouncement() {
  const popup = $('#announcement-popup');
  if (!popup || popup.hidden) return;
  popup.hidden = true;
  document.documentElement.classList.remove('lock');
  if (ANNOUNCEMENT.id) {
    const viewer = S.user ? String(S.user.id) : 'visitor';
    localStorage.setItem('mahad-announcement-seen:' + viewer, String(ANNOUNCEMENT.id));
  }
}
async function openNotificationTarget(item) {
  if (!item) return;
  await api('POST', '/api/notifications/' + item.id + '/read', {});
  NOTIFICATIONS.unread = Math.max(0, NOTIFICATIONS.unread - (item.read_at ? 0 : 1));
  NOTIFICATIONS.items = NOTIFICATIONS.items.map(entry =>
    entry.id === item.id ? Object.assign({}, entry, { read_at: Math.floor(Date.now() / 1000) }) : entry);
  NOTIFICATIONS.open = false;
  if (item.target === '#chat' && item.related_user_id) {
    CHAT.open = true;
    CHAT.recipient = Number(item.related_user_id);
    if (CHAT.timer) clearInterval(CHAT.timer);
    CHAT.timer = null;
    await loadCommunity('');
    if (CHAT.contacts.some(contact => contact.id === CHAT.recipient)) await refreshChatMessages();
    CHAT.timer = setInterval(() => {
      if (CHAT.recipient) refreshChatMessages().catch(e => console.error('Chat refresh failed:', e));
      else loadCommunity().catch(e => console.error('Contact refresh failed:', e));
    }, 10000);
  } else {
    CHAT.open = false;
    if (CHAT.timer) clearInterval(CHAT.timer);
    CHAT.timer = null;
    if (item.target) location.hash = item.target;
  }
  renderCommunity();
  await pollNotifications();
}
const SOCIALS = [
  ['x_url', 'X', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.3-8.4L1.8 2h6.5l4.4 6.8L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"/></svg>'],
  ['yt_channel', 'يوتيوب', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7a3 3 0 0 0-2.1-2.1C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7 31 31 0 0 0 .5 12 31 31 0 0 0 1 17a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5A3 3 0 0 0 23 17a31 31 0 0 0 .5-5A31 31 0 0 0 23 7ZM9.7 15.4V8.6l6 3.4-6 3.4Z"/></svg>'],
  ['telegram_url', 'قناة تليجرام', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 3-3.4 18-7.1-5.3-3.8 3.7.5-6 10.1-8.8L5.8 12.3 2 11 22 3Z"/></svg>'],
  ['telegram_benefits_url', 'مجموعة الفوائد على تليجرام', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 3-3.4 18-7.1-5.3-3.8 3.7.5-6 10.1-8.8L5.8 12.3 2 11 22 3Z"/><path d="m8.2 14.4 10.1-8.8"/></svg>'],
  ['whatsapp_url', 'مجموعة الفوائد على واتساب', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3 20.5l1.5-4.9a8.4 8.4 0 1 1 16-3.9Z"/><path d="M8.2 7.8c.3-.6.7-.6 1-.6h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4 0 .6l-.6.8c-.2.2-.2.4 0 .7.5.9 1.3 1.7 2.2 2.2.3.2.5.2.7 0l.9-1c.2-.2.4-.2.7-.1l1.7.8c.3.1.4.3.4.5 0 .3-.2 1.1-.7 1.6-.5.5-1.1.7-1.8.6-1.1-.1-2.5-.7-4.1-2.1-1.2-1.1-2.1-2.4-2.4-3.4-.4-1.1-.2-2.1.2-2.8Z"/></svg>'],
];
function socialLinks(className) {
  return '<div class="' + className + '">' + SOCIALS.filter(([key]) => safeUrl(cfg(key)) !== '#')
    .map(([key, label, icon]) => '<a href="' + esc(safeUrl(cfg(key))) + '" target="_blank" rel="noopener noreferrer" ' +
      'aria-label="' + esc(label) + '" title="' + esc(label) + '">' + icon + '</a>').join('') + '</div>';
}
function socialTextLinks(className) {
  return '<div class="' + className + '">' + SOCIALS.filter(([key]) => safeUrl(cfg(key)) !== '#')
    .map(([key, label]) => '<a href="' + esc(safeUrl(cfg(key))) + '" target="_blank" rel="noopener noreferrer">' +
      esc(label) + '</a>').join('') + '</div>';
}
function showPlaylist(v, videos, error) {
  const entries = videos.map((item, index) => '<button type="button" class="playlist-item" data-act="playlist-video" ' +
    'data-video-id="' + esc(item.id) + '" data-title="' + esc(item.title) + '">' +
    '<span class="playlist-index">' + (index + 1) + '</span><img src="' + esc(item.thumbnail) + '" alt="" loading="lazy">' +
    '<span class="playlist-item-title">' + esc(item.title) + '</span></button>').join('');
  const message = error
    ? '<div class="playlist-message"><b>تعذّر تحميل فيديوهات القائمة.</b><span>' + esc(error) + '</span>' +
      '<a class="btn o sm" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener noreferrer">افتح القائمة على يوتيوب</a></div>'
    : videos.length
      ? '<div class="playlist-message" id="playlist-placeholder"><b>اختر فيديو من القائمة لمشاهدته هنا</b></div>'
      : '<div class="playlist-message"><b>لا تتوفر فيديوهات ظاهرة في هذه القائمة.</b>' +
        '<a class="btn o sm" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener noreferrer">افتح القائمة على يوتيوب</a></div>';
  $('#mplayer').innerHTML = '<div class="playlist-layout"><div class="playlist-player" id="playlist-player">' + message +
    '</div><div class="playlist-items"><h4>فيديوهات القائمة <span>' + videos.length + '</span></h4>' +
    (entries ? '<div class="playlist-items-scroll">' + entries + '</div>' : '') + '</div></div>';
}
async function loadPlaylist(v, requestId) {
  try {
    const result = await api('GET', '/api/playlists/' + encodeURIComponent(v.youtube_id));
    if (requestId === playlistLoadId && !$('#modal').hidden) showPlaylist(v, result.videos || []);
  } catch (e) {
    if (requestId === playlistLoadId && !$('#modal').hidden) showPlaylist(v, [], e.message);
  }
}
function openVideo(id) {
  const v = vid(id);
  if (!v) return;
  const mediaType = v.media_type || (v.kind === 'playlist' ? 'playlist' : 'video');
  if (mediaType === 'playlist' || mediaType === 'video') {
    location.hash = '#watch/' + v.id;
    return;
  }
  lastFocus = document.activeElement;
  $('#mtitle').textContent = v.title;
  activeLesson = null; lessonData = null; modalTab = 'lesson'; lessonRequestId++;
  renderModalTabs();
  const box = $('#mplayer');
  playlistLoadId += 1;
  const requestId = playlistLoadId;
  if (mediaType === 'playlist' && v.youtube_id) {
    box.innerHTML = '<div class="playlist-message" role="status">جارٍ تحميل فيديوهات القائمة…</div>';
  } else if (mediaType === 'audio' && v.youtube_id) {
    box.innerHTML = '<div class="playlist-player" id="lesson-player"></div>';
  } else if (mediaType === 'audio') {
    const source = v.media_path || v.url;
    box.innerHTML = '<div class="media-viewer audio-viewer"><img src="' + esc(v.thumb_url) + '" alt=""><h4>' +
      esc(v.title) + '</h4><audio controls preload="metadata" src="' + esc(source) +
      '">المتصفح لا يدعم تشغيل الصوت.</audio></div>';
  } else if (v.media_path) {
    box.innerHTML = '<div class="media-viewer"><video controls preload="metadata" playsinline src="' +
      esc(v.media_path) + '">المتصفح لا يدعم تشغيل الفيديو.</video></div>';
  } else if (v.youtube_id && mediaType === 'video') {
    box.innerHTML = '<div class="playlist-player" id="lesson-player"></div>';
  } else if (v.url && mediaType === 'video') {
    box.innerHTML = '<div class="media-viewer"><video controls preload="metadata" playsinline src="' +
      esc(v.url) + '">المتصفح لا يدعم تشغيل الفيديو.</video></div>';
  } else {
    box.innerHTML = '<div class="mnone"><b>المادة غير متاحة حاليًا</b><span>سيظهر المحتوى هنا عند إضافة رابط أو ملف.</span>' +
      (hasFullAccess() ? '<a class="btn" href="#dashboard" data-act="close-go" data-tab="videos">اربطه الآن من لوحة التحكم</a>'
        : '<a class="btn" href="' + esc(safeUrl(cfg('yt_playlists'))) + '" target="_blank" rel="noopener">تصفّح قوائم القناة</a>') + '</div>';
  }
  renderModalFoot(v);
  $('#modal').hidden = false;
  document.documentElement.classList.add('lock');
  $('.mclose').focus();
  if (mediaType === 'playlist' && v.youtube_id) loadPlaylist(v, requestId);
  else if (v.youtube_id && (mediaType === 'video' || mediaType === 'audio') && !v.media_path) selectLesson(v.youtube_id, v.title, false);
}
async function selectLesson(videoId, title, autoplay) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoId || '')) return;
  saveLessonProgress(false);
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
  youtubePlayer = null;
  activeLesson = { id: videoId, title: title || 'الدرس' };
  lessonData = null;
  lessonDataError = '';
  modalTab = 'lesson';
  const requestId = ++lessonRequestId;
  renderModalTabs();
  renderLessonResources();
  try { lessonData = await api('GET', '/api/lessons/' + encodeURIComponent(videoId)); }
  catch (e) { lessonDataError = e.message; lessonData = { resources: [], questions: [], progress: null }; }
  if (requestId !== lessonRequestId || !activeLesson || activeLesson.id !== videoId) return;
  renderModalTabs();
  const target = $('#playlist-player') || $('#lesson-player');
  if (target) {
    const frame = youtubeFrame(videoId, title, autoplay);
    target.innerHTML = frame;
    const frameId = $('iframe', target).id;
    mountYouTubeTracking(frameId, videoId);
  }
}
function renderModalFoot(v) {
  const saved = S.saved.indexOf(v.id) > -1;
  let h = '';
  if (S.user) h += '<button type="button" class="btn o sm" data-act="toggle-save" data-id="' + v.id + '">' + (saved ? '★ محفوظة في قائمتي' : '☆ احفظ القائمة') + '</button>';
  else h += '<a class="btn o sm" href="#login" data-act="close-go">سجّل الدخول لحفظ القوائم</a>';
  if (v.url) h += '<a class="btn o sm" href="' + esc(v.url) + '" target="_blank" rel="noopener">فتح على يوتيوب</a>';
  if (v.description) h += '<p>' + esc(v.description) + '</p>';
  $('#mfoot').innerHTML = h;
}
function closeVideo() {
  if ($('#modal').hidden) return;
  playlistLoadId += 1;
  lessonRequestId++;
  saveLessonProgress(false);
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
  youtubePlayer = null;
  activeLesson = null;
  lessonData = null;
  lessonDataError = '';
  $('#mtabs').hidden = true;
  $('#mresources').innerHTML = '';
  $('#mresources').hidden = true;
  $('#mplayer').hidden = false;
  $('#mplayer').innerHTML = '';
  $('#modal').hidden = true;
  BENEFIT_VIEW.items = [];
  BENEFIT_VIEW.index = 0;
  document.documentElement.classList.remove('lock');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function stopWatchPlayback() {
  WATCH.loadId++;
  WATCH.questionsId++;
  WATCH.currentVideoId = '';
  saveLessonProgress(false);
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
  youtubePlayer = null;
  activeLesson = null;
  lessonData = null;
  lessonDataError = '';
}
function watchPage() {
  return '<section class="watch-page" id="watch-page"><div class="watch-status" role="status">جارٍ تحميل المحتوى…</div></section>';
}
function renderWatchQuestions(videoId, questions) {
  const box = $('#watch-questions');
  if (!box) return;
  let html = '<h2>أسئلة حول الدرس</h2><p class="watch-question-note">الأسئلة والإجابات هنا، ولا يجيب عنها إلا المشرفون.</p>';
  if (!videoId) {
    box.innerHTML = html + '<p class="muted">الأسئلة متاحة للدروس المرتبطة بفيديو يوتيوب.</p>';
    return;
  }
  if (!S.user) {
    html += '<p class="muted">سجّل الدخول لطرح سؤال عن هذا الدرس.</p>' + btn('#login', 'تسجيل الدخول');
  } else {
    html += '<form class="watch-question-form" data-form="lesson-question" data-video-id="' + esc(videoId) + '">' +
      '<label for="watch-question-input">اكتب سؤالك</label><textarea id="watch-question-input" name="body" maxlength="2000" required minlength="4"></textarea>' +
      '<button class="btn sm" type="submit">إرسال السؤال</button><span class="msg"></span></form>';
  }
  if (!questions) {
    box.innerHTML = html + '<p class="muted" role="status">جارٍ تحميل الأسئلة…</p>';
    return;
  }
  if (!questions.length) html += '<p class="muted">لا توجد أسئلة لهذا الدرس بعد.</p>';
  else html += '<div class="watch-question-list">' + questions.map(question =>
    '<article class="watch-question"><p>' + esc(question.body).replace(/\n/g, '<br>') + '</p><time>' +
    esc(fmtDate(question.created_at)) + '</time>' +
    (question.answer
      ? '<div class="watch-answer"><b>إجابة المشرف</b><p>' + esc(question.answer).replace(/\n/g, '<br>') +
        '</p></div>'
      : (isStaff()
        ? '<form class="watch-answer-form" data-form="lesson-question-answer" data-question-id="' + question.id +
          '" data-video-id="' + esc(videoId) + '">' +
          '<label>إجابة المشرف</label><textarea name="answer" maxlength="2000" required minlength="2"></textarea>' +
          '<button class="btn ghost sm" type="submit">نشر الإجابة</button><span class="msg"></span></form>'
        : '<p class="muted">بانتظار إجابة المشرف.</p>')) + '</article>').join('') + '</div>';
  box.innerHTML = html;
}
async function loadWatchQuestions(videoId) {
  const requestId = ++WATCH.questionsId;
  renderWatchQuestions(videoId, null);
  if (!videoId) return;
  try {
    const result = await api('GET', '/api/lessons/' + encodeURIComponent(videoId) + '/questions');
    if (requestId === WATCH.questionsId && S.route === 'watch' && WATCH.currentVideoId === videoId) {
      renderWatchQuestions(videoId, result.questions || []);
    }
  } catch (e) {
    if (requestId === WATCH.questionsId && S.route === 'watch' && WATCH.currentVideoId === videoId) {
      const box = $('#watch-questions');
      if (box) box.innerHTML = '<h2>أسئلة حول الدرس</h2><p class="err">تعذّر تحميل الأسئلة: ' + esc(e.message) + '</p>';
    }
  }
}
async function selectWatchLesson(videoId, title, autoplay) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(videoId || '')) return;
  saveLessonProgress(false);
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
  youtubePlayer = null;
  activeLesson = { id: videoId, title: title || 'الدرس' };
  lessonData = null;
  lessonDataError = '';
  const requestId = ++lessonRequestId;
  try { lessonData = await api('GET', '/api/lessons/' + encodeURIComponent(videoId)); }
  catch (e) { lessonDataError = e.message; lessonData = { resources: [], questions: [], progress: null }; }
  if (requestId !== lessonRequestId || S.route !== 'watch' || !activeLesson || activeLesson.id !== videoId) return;
  const target = $('#watch-player');
  if (target) {
    target.innerHTML = youtubeFrame(videoId, title, autoplay);
    mountYouTubeTracking($('iframe', target).id, videoId);
  }
  loadWatchQuestions(videoId);
}
function renderWatchPage(v, videos, index, error) {
  const mediaType = v.media_type || (v.kind === 'playlist' ? 'playlist' : 'video');
  const isPlaylist = mediaType === 'playlist';
  const selected = isPlaylist ? videos[index] : null;
  const currentTitle = selected ? selected.title : v.title;
  const videoId = selected ? selected.id : v.youtube_id;
  WATCH.currentVideoId = videoId || '';
  let player = '<div class="watch-player" id="watch-player"></div>';
  if (!isPlaylist && v.media_path) {
    player = '<div class="watch-player"><video controls preload="metadata" playsinline src="' + esc(v.media_path) +
      '">المتصفح لا يدعم تشغيل الفيديو.</video></div>';
  } else if (!isPlaylist && !videoId && v.url) {
    player = '<div class="watch-player"><video controls preload="metadata" playsinline src="' + esc(v.url) +
      '">المتصفح لا يدعم تشغيل الفيديو.</video></div>';
  } else if (!videoId) {
    player = '<div class="watch-player watch-unavailable"><b>الفيديو غير متاح حاليًا</b>' +
      (hasFullAccess() ? '<a class="btn sm" href="#dashboard" data-act="close-go" data-tab="videos">أضف رابط الفيديو من لوحة التحكم</a>' : '') + '</div>';
  }
  const entries = videos.map((item, itemIndex) =>
    '<button type="button" class="watch-queue-item' + (itemIndex === index ? ' on' : '') +
    '" data-act="watch-video" data-content-id="' + v.id + '" data-video-id="' + esc(item.id) + '">' +
    '<span class="watch-queue-index">' + (itemIndex + 1) + '</span><img src="' + esc(item.thumbnail || v.thumb_url || '/img/malik-logo.jpg') +
    '" alt="" loading="lazy"><span>' + esc(item.title) + '</span></button>').join('');
  const category = v.category;
  const related = category ? S.site.videos.filter(item => item.id !== v.id && item.category === category).slice(0, 6) : [];
  const relatedCategories = relatedScienceKeys(category);
  const otherScienceVideos = S.site.videos.filter(item =>
    item.id !== v.id && relatedCategories.includes(item.category)
  ).slice(0, 6);
  const channelUrl = safeUrl(cfg('yt_channel'));
  $('#watch-page').innerHTML = '<div class="watch-header"><a class="lnk" href="#lessons">العودة إلى المكتبة</a>' +
    '<span>' + esc(v.category_name || 'مكتبة العلوم الشرعية') + '</span></div>' +
    (error ? '<div class="watch-error err" role="alert">تعذّر تحميل القائمة: ' + esc(error) +
      (v.url ? ' <a class="lnk" href="' + esc(safeUrl(v.url)) + '" target="_blank" rel="noopener noreferrer">افتحها على يوتيوب</a>' : '') + '</div>' : '') +
    '<div class="watch-grid"><div class="watch-main">' + player + '<div class="watch-title"><h1>' + esc(currentTitle) +
    '</h1><p>' + esc(isPlaylist ? v.title : (v.category_name || '')) + '</p>' +
    (v.description ? '<p>' + esc(v.description) + '</p>' : '') +
    (channelUrl !== '#' ? '<a class="watch-youtube-link" href="' + esc(channelUrl) + '" target="_blank" rel="noopener noreferrer">المشاهدة على قناة يوتيوب ↗</a>' : '') +
    '</div><section class="watch-questions" id="watch-questions"></section>' +
    '</div><aside class="watch-queue"><div class="watch-queue-heading"><h2>' + (isPlaylist ? 'محتويات القائمة' : 'الفيديو') +
    '</h2><span>' + (videos.length ? (index + 1) + ' من ' + videos.length : '0') + '</span></div>' +
    (entries || '<p class="muted">' + (error ? 'تعذّر إظهار عناصر القائمة.' : 'لا توجد فيديوهات في هذه القائمة.') + '</p>') + '</aside></div>' +
    (related.length ? '<section class="watch-related"><h2>قوائم مرتبطة بهذا العلم</h2><div class="grid vg">' +
      related.map(vcard).join('') + '</div></section>' : '') +
    (otherScienceVideos.length ? '<section class="watch-related"><h2>مجالس لعلوم أخرى</h2><div class="grid vg">' +
      otherScienceVideos.map(vcard).join('') + '</div></section>' : '');
  if (videoId && !isPlaylist && v.media_path) loadWatchQuestions(videoId);
  else if (videoId && !isPlaylist && !v.media_path) selectWatchLesson(videoId, currentTitle, false);
  else if (selected) selectWatchLesson(selected.id, selected.title, false);
  else renderWatchQuestions(null);
}
async function loadWatch(contentId, requestedVideoId) {
  const requestId = ++WATCH.loadId;
  const v = vid(contentId);
  const page = $('#watch-page');
  if (!v || !page) {
    if (page) page.innerHTML = '<div class="watch-error err">المحتوى غير موجود في المكتبة.</div>';
    return;
  }
  const mediaType = v.media_type || (v.kind === 'playlist' ? 'playlist' : 'video');
  if (mediaType !== 'playlist' || !v.youtube_id) {
    if (requestId === WATCH.loadId) renderWatchPage(v, v.youtube_id ? [{ id: v.youtube_id, title: v.title, thumbnail: v.thumb_url }] : [], 0);
    return;
  }
  try {
    const result = await api('GET', '/api/playlists/' + encodeURIComponent(v.youtube_id));
    if (requestId !== WATCH.loadId || S.route !== 'watch') return;
    const videos = result.videos || [];
    if (!videos.length) {
      renderWatchPage(v, [], 0, 'لا توجد فيديوهات ظاهرة في هذه القائمة.');
      return;
    }
    const index = requestedVideoId ? videos.findIndex(item => item.id === requestedVideoId) : 0;
    if (index < 0) {
      renderWatchPage(v, videos, 0, 'الفيديو المطلوب غير موجود ضمن هذه القائمة.');
      return;
    }
    renderWatchPage(v, videos, index);
  } catch (e) {
    if (requestId === WATCH.loadId && S.route === 'watch') renderWatchPage(v, [], 0, e.message);
  }
}

/* ───────── مكوّنات العرض ───────── */
const btn = (href, t, c, extra) => '<a class="btn ' + (c || '') + '" href="' + href + '"' + (extra || '') + '>' + esc(t) + '</a>';
const hero = (t, h, d, b) => '<div class="hero"><div class="hero-copy"><div class="tag">' + esc(cfg('hero_tag')) +
  '</div><h1>' + esc(t) + '</h1>' + (h ? '<h2>' + esc(h) + '</h2>' : '') + '<p>' + esc(d) +
  '</p><div class="hero-actions">' + b + '</div></div><div class="hero-seal" aria-hidden="true"><img src="/img/malik-logo.jpg" alt=""></div></div>';
const secHead = (t, s) => '<h3 class="t">' + esc(t) + '</h3><p class="sub">' + (esc(s) || '&nbsp;') + '</p>';

function vcard(v) {
  const mediaType = v.media_type || (v.kind === 'playlist' ? 'playlist' : 'video');
  const labels = { playlist: 'قائمة تشغيل', video: 'فيديو', audio: 'صوتي' };
  const sub = v.category_name || labels[mediaType];
  const label = labels[mediaType];
  return '<button type="button" class="pl" data-play="' + v.id + '"><div class="th">' +
    (v.thumb_url ? '<img class="th-cover" src="' + esc(v.thumb_url) + '" alt="" loading="lazy">' :
      '<img class="th-icon"' + (mediaType === 'playlist' && v.youtube_id
        ? ' data-playlist-thumb data-playlist-id="' + esc(v.youtube_id) + '"' : '') +
        ' src="/img/malik-logo.jpg" alt="" loading="lazy">') +
    ((v.youtube_id || v.media_path || v.url) ? '' : '<span class="soon">قريبًا</span>') +
    '<span class="play">' + (mediaType === 'audio' ? '♫' : '▶') + '</span><span class="playlist-tag">' +
    label + '</span></div><div class="pi"><span class="playlist-category">' + esc(sub) +
    '</span><h4>' + esc(v.title) + '</h4></div></button>';
}
const vgrid = list => '<div class="grid vg">' + list.map(vcard).join('') + '</div>';
function watchPlaylistThumbnails(root) {
  const images = $$('[data-playlist-thumb][data-playlist-id]', root || document);
  if (!images.length) return;
  if (!('IntersectionObserver' in window)) {
    images.forEach(loadPlaylistThumbnail);
    return;
  }
  if (!playlistThumbObserver) {
    playlistThumbObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        playlistThumbObserver.unobserve(entry.target);
        loadPlaylistThumbnail(entry.target);
      });
    }, { rootMargin: '240px' });
  }
  images.forEach(image => playlistThumbObserver.observe(image));
}
async function loadPlaylistThumbnail(image) {
  const playlistId = image.dataset.playlistId;
  if (!playlistId || image.dataset.loaded === 'true') return;
  try {
    let request = PLAYLIST_THUMBNAILS.get(playlistId);
    if (!request) {
      request = api('GET', '/api/playlists/' + encodeURIComponent(playlistId))
        .then(result => (result.videos || [])[0]?.thumbnail || '');
      PLAYLIST_THUMBNAILS.set(playlistId, request);
    }
    const thumbnail = await request;
    if (!thumbnail) throw new Error('القائمة لا تحتوي على فيديو ظاهر');
    if (!image.isConnected) return;
    image.src = thumbnail;
    image.classList.remove('th-icon');
    image.dataset.loaded = 'true';
  } catch (error) {
    PLAYLIST_THUMBNAILS.delete(playlistId);
    console.warn('تعذّر تحميل صورة أول فيديو في قائمة التشغيل:', playlistId, error);
  }
}
function initMotion(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  if (!motionObserver) {
    motionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('motion-visible');
        motionObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px' });
  }
  const container = root || $('#app');
  const selectors = '.hero, main section, main section .card, main section .pl, .cta';
  const targets = [];
  if (container.matches && container.matches(selectors)) targets.push(container);
  targets.push(...$$(selectors, container));
  targets.forEach(target => {
    if (target.classList.contains('motion-ready') || target.closest('[hidden]')) return;
    target.classList.add('motion-ready');
    motionObserver.observe(target);
  });
}
const HOME_CAROUSELS = Object.create(null);
function homeCarouselMarkup(id) {
  const carousel = HOME_CAROUSELS[id];
  if (!carousel) return '';
  if (!carousel.items.length) return '<div class="empty-state">' + carousel.empty + '</div>';
  const pages = Math.ceil(carousel.items.length / carousel.pageSize);
  const start = carousel.page * carousel.pageSize;
  const cards = carousel.items.slice(start, start + carousel.pageSize);
  return '<div class="home-carousel-controls">' +
    '<button class="btn ghost sm" type="button" data-act="home-carousel" data-carousel="' + id +
    '" data-direction="prev" aria-label="المحتويات السابقة"' + (carousel.page === 0 ? ' disabled' : '') + '>→</button>' +
    '<span>' + (carousel.page + 1) + ' من ' + pages + '</span>' +
    '<button class="btn ghost sm" type="button" data-act="home-carousel" data-carousel="' + id +
    '" data-direction="next" aria-label="المحتويات التالية"' + (carousel.page >= pages - 1 ? ' disabled' : '') + '>←</button>' +
    '</div><div class="grid home-carousel-grid' + (carousel.pageSize === 1 ? ' single-card' : '') + '">' +
    cards.map(carousel.renderCard).join('') + '</div>';
}
function homeCarousel(id, items, renderCard, empty, pageSize) {
  const previous = HOME_CAROUSELS[id];
  HOME_CAROUSELS[id] = {
    items: items.slice(0, 15),
    renderCard,
    empty,
    pageSize: pageSize || 3,
    page: previous ? Math.min(previous.page, Math.max(0, Math.ceil(items.length / (pageSize || 3)) - 1)) : 0
  };
  return '<div class="home-carousel" id="' + id + '" role="region">' + homeCarouselMarkup(id) + '</div>';
}
function benefitCard(item) {
  const preview = item.youtube_id
    ? '<img src="https://i.ytimg.com/vi/' + encodeURIComponent(item.youtube_id) +
      '/hqdefault.jpg" alt="" loading="lazy">'
    : '<span class="benefit-local-preview" aria-hidden="true">▶</span>';
  return '<article class="card benefit-card"><button type="button" class="benefit-open" data-act="benefit-open" data-id="' +
    item.id + '" aria-label="مشاهدة ' + esc(item.title) + '">' + preview +
    '<span class="benefit-play" aria-hidden="true">▶</span></button><h4>' + esc(item.title) + '</h4>' +
    (item.description ? '<p>' + esc(item.description) + '</p>' : '') + '</article>';
}
function benefitsContent(list) {
  return list.length ? '<div class="benefits-grid">' + list.map(benefitCard).join('') + '</div>' :
    '<div class="empty-state"><span>✦</span><b>لا توجد فوائد مرئية مضافة بعد</b><p>ستظهر هنا مقاطع الفيديو التي يضيفها المشرفون.</p></div>';
}
let benefitQuery = '';
function benefitResults() {
  const query = benefitQuery.trim().toLocaleLowerCase();
  return (S.site.benefits || []).filter(item =>
    !query || (item.title + ' ' + (item.description || '')).toLocaleLowerCase().includes(query));
}
function renderBenefitModal() {
  const item = BENEFIT_VIEW.items[BENEFIT_VIEW.index];
  if (!item) { closeVideo(); return; }
  $('#mtitle').textContent = item.title;
  activeLesson = null;
  lessonData = null;
  lessonDataError = '';
  lessonRequestId++;
  $('#mtabs').hidden = true;
  $('#mresources').hidden = true;
  $('#mresources').innerHTML = '';
  $('#mplayer').hidden = false;
  $('#mplayer').innerHTML = item.youtube_id
    ? '<div class="benefit-modal-video"><iframe src="https://www.youtube-nocookie.com/embed/' +
      encodeURIComponent(item.youtube_id) + '?rel=0&playsinline=1&hl=ar&autoplay=1" title="' +
      esc(item.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>'
    : '<div class="benefit-modal-video"><video controls autoplay playsinline src="' + esc(item.path) +
      '">المتصفح لا يدعم تشغيل الفيديو.</video></div>';
  const last = BENEFIT_VIEW.items.length - 1;
  $('#mfoot').innerHTML = (item.description ? '<p>' + esc(item.description) + '</p>' : '') +
    '<div class="benefit-modal-navigation"><button type="button" class="btn ghost sm" data-act="benefit-nav" data-direction="prev"' +
    (BENEFIT_VIEW.index === 0 ? ' disabled' : '') + '>→ السابق</button><span>' +
    (BENEFIT_VIEW.index + 1) + ' من ' + BENEFIT_VIEW.items.length + '</span>' +
    '<button type="button" class="btn ghost sm" data-act="benefit-nav" data-direction="next"' +
    (BENEFIT_VIEW.index >= last ? ' disabled' : '') + '>التالي ←</button></div>';
  $('#modal').hidden = false;
  document.documentElement.classList.add('lock');
}
function openBenefit(id) {
  const items = benefitResults();
  const index = items.findIndex(item => item.id === Number(id));
  if (index < 0) return;
  lastFocus = document.activeElement;
  BENEFIT_VIEW.items = items;
  BENEFIT_VIEW.index = index;
  renderBenefitModal();
  $('.mclose').focus();
}
function viewBenefits() {
  const benefits = benefitResults();
  return '<section class="lessons-page">' + secHead('الفوائد', 'مقاطع مرئية صغيرة تفيد المسلم عمومًا وطالب العلم خصوصًا.') +
    '<input class="search" id="benefit-search" type="search" placeholder="ابحث في الفوائد…" value="' + esc(benefitQuery) + '">' +
    '<div class="results-heading"><b>مقاطع الفوائد</b><span id="benefit-count">' + benefits.length + ' مقطعًا</span></div>' +
    '<div id="benefit-results">' + benefitsContent(benefits) + '</div></section>';
}
function benefitsSection() {
  const items = (S.site.benefits || []).slice(0, 15);
  return '<section class="benefits-section">' + secHead('الفوائد', 'شاهد المقاطع المرئية المضافة حديثًا.') +
    homeCarousel('home-benefits', items, benefitCard, '<span>✦</span><b>لا توجد فوائد مرئية مضافة بعد</b><p>ستظهر هنا مقاطع الفيديو التي يضيفها المشرفون.</p>', 1) +
    '<div class="section-action">' + btn('#benefits', 'عرض كل الفوائد') + '</div></section>';
}

function wordCard(word, className) {
  return '<article class="card word-card' + (className ? ' ' + className : '') + '">' +
    (word.image_path || word.image_url ? '<img src="' + esc(word.image_path || word.image_url) + '" alt="" loading="lazy">' : '') +
    '<div><h4>' + linkedText(word.title) + '</h4><p>' + linkedText(word.body) + '</p></div></article>';
}
function wordsSection() {
  const words = (S.site.words || []).slice(0, 15);
  return '<section class="words-home-section">' + secHead('الكلمات', 'كلمات نافعة في العلم والعمل، ويُعرض هنا أيضًا إعلان عن كل جديد.') +
    homeCarousel('home-words', words, word => wordCard(word, 'word-slide'),
      '<span>✦</span><b>لا توجد كلمات مضافة بعد</b><p>ستظهر هنا الكلمات التي يضيفها المشرف.</p>', 1) +
    '<div class="section-action">' + btn('#words', 'مشاهدة كل الكلمات') + '</div></section>';
}

function sermonsSection() {
  const sermons = (S.site.sermons || []).slice(0, 3);
  return '<section class="sermons-home-section">' + secHead('الخطب المنبرية', 'استمع إلى الخطب المضافة إلى المكتبة.') +
    (sermons.length ? '<div class="grid library-grid">' + sermons.map(sermon =>
      '<article class="card library-card"><h4>' + esc(sermon.title) + '</h4>' +
      (sermon.speaker ? '<p class="muted">الخطيب: ' + esc(sermon.speaker) + '</p>' : '') +
      (sermon.description ? '<p>' + esc(sermon.description) + '</p>' : '') +
      '</article>').join('') + '</div>' :
      '<div class="empty-state"><span>🎙</span><b>لا توجد خطب منبرية مضافة بعد</b><p>ستظهر هنا الخطب المنشورة في المكتبة.</p></div>') +
    '<div class="section-action">' + btn('#sermons', 'عرض جميع الخطب المنبرية') + '</div></section>';
}

function booksSection() {
  const books = (S.site.books || []).slice(0, 3);
  return '<section class="books-home-section">' + secHead('الكتب', 'تصفّح الكتب المضافة إلى المكتبة.') +
    (books.length ? '<div class="grid library-grid">' + books.map(book => {
      const source = book.media_path || safeUrl(book.media_url);
      return '<article class="card library-card"><h4>' + esc(book.title) + '</h4>' +
        (book.author ? '<p class="muted">المؤلف: ' + esc(book.author) + '</p>' : '') +
        (book.description ? '<p>' + esc(book.description) + '</p>' : '') +
        (source !== '#' ? '<a class="btn sm" href="' + esc(source) +
          '" target="_blank" rel="noopener noreferrer">قراءة الكتاب أو تنزيله ↗</a>' : '') +
        '</article>';
    }).join('') + '</div>' :
      '<div class="empty-state"><span>📚</span><b>لا توجد كتب مضافة بعد</b><p>ستظهر الكتب هنا عند إضافتها إلى المكتبة.</p></div>') +
    '<div class="section-action">' + btn('#books', 'عرض جميع الكتب') + '</div></section>';
}

function viewHome() {
  let o = hero(cfg('hero_title'), cfg('hero_subtitle'), cfg('hero_text'),
    btn('#lessons', 'استكشف المكتبة') + btn(S.user ? '#account' : '#signup', S.user ? 'حسابي' : 'إنشاء حساب', 'o'));
  const featured = scienceOrderedVideos(S.site.videos).slice(0, 8);
  if (featured.length) o += '<section class="featured-section">' + secHead('مكتبة العلوم الشرعية', 'قوائم تشغيل ودروس مرئية ومجالس صوتية.') +
    vgrid(featured) + '<div class="section-action">' + btn('#lessons', 'عرض جميع القوائم') + '</div></section>';
  o += wordsSection();
  o += benefitsSection();
  o += sermonsSection();
  o += booksSection();
  if (S.site.faqs.length) o += '<section>' + secHead('أسئلة شائعة', '') + S.site.faqs.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>').join('') + '</section>';
  return o;
}
let LF = { q: '', category: '' };
const SCIENCE_RELATION_GROUPS = [
  ['tafsir', 'usul_tafsir', 'ulum_quran', 'science_9a196f48', 'science_4446f473', 'science_894b2e61', 'science_454e5ee4'],
  ['ulum_quran', 'science_b92e4cf8', 'qiraat', 'science_1685c0ee', 'science_288d46ca', 'science_b632b514', 'science_d8caa3f2', 'science_fa0262c4'],
  ['sharia', 'science_a7d3f319', 'fiqh', 'usul_fiqh', 'science_73e5f8c8', 'science_4fa9e9de'],
  ['science_9f3a1b07', 'science_a1cd6b26', 'science_c06e5336', 'science_48f07b56'],
  ['aqidah', 'tazkiyah', 'science_75b64c3a', 'sira', 'science_4ce6e16d', 'science_a70cb09e'],
  ['science_9f1cb86b', 'science_4a4e274a', 'science_a9798baa', 'science_4ce6e16d'],
  ['science_73e5f8c8', 'science_4fa9e9de', 'fiqh', 'usul_fiqh'],
  ['science_9a196f48', 'science_73e5f8c8', 'fiqh', 'usul_fiqh'],
  ['science_4a4e274a', 'science_9f1cb86b', 'tazkiyah', 'aqidah']
];
function relatedScienceKeys(categoryKey) {
  return Array.from(new Set(SCIENCE_RELATION_GROUPS.filter(group => group.includes(categoryKey)).flat()))
    .filter(key => key !== categoryKey);
}
function scienceOrderedVideos(videos) {
  const ordered = S.site.categories.flatMap(category =>
    videos.filter(video => video.category === category.key)
  );
  const categorized = new Set(ordered.map(video => video.id));
  return ordered.concat(videos.filter(video => !categorized.has(video.id)));
}
function lessonResults() {
  const q = LF.q.trim().toLowerCase();
  return S.site.videos.filter(v => (!LF.category || v.category === LF.category) &&
    (!q || (v.title + ' ' + v.description + ' ' + v.category_name).toLowerCase().indexOf(q) > -1));
}
function lessonsGrid() {
  const list = lessonResults();
  if (list.length && LF.category) return vgrid(list);
  if (list.length) return vgrid(scienceOrderedVideos(list));
  const selected = S.site.categories.find(c => c.key === LF.category);
  return '<div class="empty-state"><span>✦</span><b>' + (LF.q.trim() ? 'لا توجد نتائج مطابقة' : 'لا توجد قوائم في هذا التصنيف بعد') +
    '</b><p>' + (LF.q.trim() ? 'جرّب كلمة بحث أخرى أو أزلها لعرض قوائم التصنيف.' :
      selected ? 'لا تعرض القناة حاليًا قائمة تشغيل ضمن «' + esc(selected.name) + '». ستظهر هنا عند توفرها.' :
        'جرّب كلمة بحث أخرى أو اختر تصنيفًا مختلفًا.') + '</p></div>';
}
function viewLessons() {
  return '<section class="lessons-page">' + secHead('مكتبة العلوم الشرعية', cfg('lectures_sub')) +
    '<p class="learning-path-note" role="note">تنبيه: وُضعت هذه المجالس بترتيب الشيخ -وفقه الله-؛ لتكون مسارًا لطالب العلم في كل علم على حدة.</p>' +
    '<input class="search" id="lsearch" type="search" placeholder="ابحث باسم السلسلة أو العلم…" value="' + esc(LF.q) + '">' +
    '<div class="chips" id="lchips">' + chips() + '</div><div class="results-heading" id="lheading"><b>' +
    (LF.category ? esc(S.site.categories.find(c => c.key === LF.category).name) : 'كل العلوم') +
    '</b><span>' + lessonResults().length + ' قائمة</span></div>' +
    '<div id="lgrid">' + lessonsGrid() + '</div></section>';
}
function chips() {
  return ['<button type="button" data-act="lfilter" data-category=""' + (LF.category === '' ? ' class="on"' : '') + '>الكل</button>']
    .concat(S.site.categories.map(c => '<button type="button" data-act="lfilter" data-category="' + esc(c.key) + '"' +
      (LF.category === c.key ? ' class="on"' : '') + '>' + esc(c.name) + '</button>')).join('');
}
function viewFiles() {
  const files = S.site.playlist_files || [];
  const grouped = files.reduce((result, file) => {
    (result[file.video_id] = result[file.video_id] || { title: file.playlist_title, files: [] }).files.push(file);
    return result;
  }, {});
  return '<section class="lessons-page">' + secHead('الملفات المرتبطة', 'ملفات مرفقة بقوائم التشغيل، أضافها مشرفو المعهد.') +
    (Object.keys(grouped).length ? '<div class="grid files-grid">' + Object.keys(grouped).map(id =>
      '<article class="card"><h4>' + esc(grouped[id].title) + '</h4><div class="related-file-list">' +
      grouped[id].files.map(file => '<a class="related-file" href="' + esc(file.path) +
        '" target="_blank" rel="noopener"><span>📎 ' + esc(file.title) +
        '</span><small>' + (file.size_bytes / (1024 * 1024)).toFixed(1) + ' MB ↗</small></a>').join('') +
      '</div></article>').join('') + '</div>' :
      '<div class="empty-state"><span>📎</span><b>لا توجد ملفات مضافة بعد</b><p>ستظهر هنا ملفات قوائم التشغيل المرتبطة.</p></div>') +
    '</section>';
}

let bookQuery = '';
let sermonQuery = '';
function bookResults() {
  const query = bookQuery.trim().toLowerCase();
  return (S.site.books || []).filter(book =>
    !query || (book.title + ' ' + book.author + ' ' + book.description).toLowerCase().includes(query));
}
function sermonResults() {
  const query = sermonQuery.trim().toLowerCase();
  return (S.site.sermons || []).filter(sermon =>
    !query || (sermon.title + ' ' + sermon.speaker + ' ' + sermon.description).toLowerCase().includes(query));
}
function bookCards() {
  const books = bookResults();
  return books.length ? '<div class="grid library-grid">' + books.map(book => {
    const source = book.media_path || safeUrl(book.media_url);
    return '<article class="card library-card"><h4>' + esc(book.title) + '</h4>' +
      (book.author ? '<p class="muted">المؤلف: ' + esc(book.author) + '</p>' : '') +
      (book.description ? '<p>' + esc(book.description) + '</p>' : '') +
      (source !== '#' ? '<a class="btn sm" href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">قراءة الكتاب أو تنزيله ↗</a>' : '') +
      '</article>';
  }).join('') + '</div>' :
    '<div class="empty-state"><span>📚</span><b>' + (bookQuery.trim() ? 'لا توجد نتائج مطابقة' : 'لا توجد كتب مضافة بعد') +
    '</b><p>ستظهر الكتب هنا عند إضافتها إلى المكتبة.</p></div>';
}
function viewBooks() {
  return '<section class="lessons-page">' + secHead('الكتب', 'تصفّح الكتب وابحث بعنوان الكتاب أو اسم مؤلفه.') +
    '<input class="search" id="book-search" type="search" placeholder="ابحث في الكتب والمؤلفين…" value="' + esc(bookQuery) + '">' +
    '<div class="results-heading"><b>كتب المكتبة</b><span id="book-count">' + bookResults().length + ' كتاب</span></div>' +
    '<div id="book-results">' + bookCards() + '</div></section>';
}
function sermonCards() {
  const sermons = sermonResults();
  return sermons.length ? '<div class="grid library-grid">' + sermons.map(sermon => {
    const source = sermon.media_path || safeUrl(sermon.media_url);
    const media = sermon.media_path ? (sermon.media_type === 'audio'
      ? '<audio controls preload="metadata" src="' + esc(source) + '">المتصفح لا يدعم تشغيل الصوت.</audio>'
      : '<video controls preload="metadata" playsinline src="' + esc(source) + '">المتصفح لا يدعم تشغيل الفيديو.</video>')
      : (source !== '#' ? '<a class="btn sm" href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">' +
        (sermon.media_type === 'audio' ? 'استماع إلى الخطبة ↗' : 'مشاهدة الخطبة ↗') + '</a>' : '');
    return '<article class="card library-card"><h4>' + esc(sermon.title) + '</h4>' +
      (sermon.speaker ? '<p class="muted">الخطيب: ' + esc(sermon.speaker) + '</p>' : '') +
      (sermon.description ? '<p>' + esc(sermon.description) + '</p>' : '') + media + '</article>';
  }).join('') + '</div>' :
    '<div class="empty-state"><span>🎙</span><b>' + (sermonQuery.trim() ? 'لا توجد نتائج مطابقة' : 'لا توجد خطب منبرية مضافة بعد') +
    '</b><p>ستظهر الخطب هنا عند إضافتها إلى المكتبة.</p></div>';
}
function viewSermons() {
  return '<section class="lessons-page">' + secHead('الخطب المنبرية', 'استمع إلى الخطب أو شاهدها، وابحث بعنوان الخطبة أو اسم الخطيب.') +
    '<input class="search" id="sermon-search" type="search" placeholder="ابحث في الخطب والخطباء…" value="' + esc(sermonQuery) + '">' +
    '<div class="results-heading"><b>الخطب المنبرية</b><span id="sermon-count">' + sermonResults().length + ' خطبة</span></div>' +
    '<div id="sermon-results">' + sermonCards() + '</div></section>';
}

function viewWords() {
  const words = S.site.words || [];
  return '<section class="lessons-page">' + secHead('الكلمات', 'كلمات نافعة في العلم والعمل، ويُعرض هنا أيضًا إعلان عن كل جديد.') +
    (words.length ? '<div class="grid words-grid">' + words.map(word =>
      wordCard(word)
    ).join('') + '</div>' :
      '<div class="empty-state"><span>✦</span><b>لا توجد كلمات مضافة بعد</b><p>ستظهر هنا الكلمات والفوائد عند إضافتها.</p></div>') +
    '</section>';
}

function viewLive() {
  if (!S.user) return '<section class="narrow">' + secHead('غرف البث المباشر', 'سجّل الدخول لمشاهدة الغرف المخصصة للطلاب.') +
    '<div class="card">' + btn('#login', 'تسجيل الدخول') + '</div></section>';
  return '<section class="lessons-page">' + secHead('غرف البث المباشر', 'تُفتح أحداث StreamYard On-Air في المتصفح، وتُعرض الغرف المخصصة لفئتك فقط.') +
    '<div id="live-list" class="live-grid"><p class="muted">جارٍ تحميل الغرف…</p></div></section>';
}
async function loadLiveRooms() {
  const target = $('#live-list');
  if (!target || !S.user) return;
  try {
    const { rooms } = await api('GET', '/api/live-rooms');
    target.innerHTML = rooms.length ? rooms.map(r => '<article class="card live-room"><span class="badge ' +
      (r.status === 'live' ? 'ok' : '') + '">' + (r.status === 'live' ? 'مباشر الآن' : r.status === 'ended' ? 'انتهى' : 'مجدول') +
      '</span><h4>' + esc(r.title) + '</h4><p>' + esc(r.description || '') + '</p>' +
      (r.starts_at ? '<p class="muted">الموعد: ' + new Date(r.starts_at * 1000).toLocaleString('ar-EG') + '</p>' : '') +
      '<a class="btn sm" href="' + esc(safeUrl(r.event_url)) + '" target="_blank" rel="noopener noreferrer">دخول البث عبر المتصفح ↗</a></article>').join('') :
      '<div class="card"><p class="muted">لا توجد غرف بث متاحة لفئتك حاليًا.</p></div>';
  } catch (e) { target.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; }
}

function viewLogin() {
  return '<form class="form" data-form="login"><h3>تسجيل الدخول</h3><p class="formsub">ادخل إلى منصة ' + esc(cfg('site_name')) + '</p>' +
    '<label for="l1">معرّف تيليجرام</label><input id="l1" name="username" dir="ltr" autocomplete="username" placeholder="@ahmed_abdullah">' +
    '<label for="l2">كلمة المرور</label><input id="l2" name="password" type="password" autocomplete="current-password">' +
    '<button class="btn" type="submit">دخول</button><div class="msg"></div>' +
    '<p class="formsub"><a class="lnk" href="#recover">نسيت كلمة المرور؟</a></p>' +
    '<p class="formsub">ليس لديك حساب؟ <a class="lnk" href="#signup">سجّل هنا</a></p></form>';
}
function viewRecovery() {
  if (!RECOVERY.username) {
    return '<form class="form" data-form="recovery-request"><h3>استعادة كلمة المرور</h3>' +
      '<p class="formsub">أدخل معرّف حسابك، وسنرسل رمزًا إلى تيليجرام المرتبط به إن وُجد.</p>' +
      '<label for="recovery-user">معرّف تيليجرام</label><input id="recovery-user" name="username" dir="ltr" autocomplete="username" required>' +
      '<button class="btn" type="submit">إرسال رمز الاستعادة</button><div class="msg"></div>' +
      '<p class="formsub"><a class="lnk" href="#login">العودة لتسجيل الدخول</a></p></form>';
  }
  return '<form class="form" data-form="recovery-verify"><h3>تعيين كلمة مرور جديدة</h3>' +
    '<p class="formsub">إذا كان الحساب مرتبطًا بتيليجرام، أدخل الرمز المرسل إليه. صلاحية الرمز ١٠ دقائق.</p>' +
    '<label for="recovery-code">رمز الاستعادة</label><input id="recovery-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" required>' +
    '<label for="recovery-password">كلمة المرور الجديدة (١٢ حرفًا على الأقل)</label><input id="recovery-password" name="password" type="password" autocomplete="new-password" required>' +
    '<label for="recovery-password2">تأكيد كلمة المرور</label><input id="recovery-password2" name="password2" type="password" autocomplete="new-password" required>' +
    '<button class="btn" type="submit">حفظ كلمة المرور</button><div class="msg"></div>' +
    '<p class="formsub">لم يصلك الرمز؟ <button type="button" class="lnk" data-act="recover-reset">إعادة المحاولة</button></p></form>';
}
function viewSignup() {
  return '<form class="form" data-form="signup"><h3>إنشاء حساب</h3><p class="formsub">أنشئ حسابك، واستخدم معرف تيليجرام للدخول بدل البريد الإلكتروني.</p>' +
    '<label for="s1">الاسم الكامل</label><input id="s1" name="name" maxlength="80" autocomplete="name" placeholder="أحمد عبد الله">' +
    '<label for="s2">معرف تيليجرام</label><input id="s2" name="username" dir="ltr" autocomplete="username" placeholder="@ahmed_abdullah">' +
    '<fieldset class="gender-group"><legend>النوع</legend><div class="gender-options">' +
    '<label class="gender-choice"><input type="radio" name="gender" value="male" required> <span>ذكر</span></label>' +
    '<label class="gender-choice"><input type="radio" name="gender" value="female" required> <span>أنثى</span></label></div></fieldset>' +
    '<label for="s3">كلمة المرور (٨ أحرف على الأقل)</label><input id="s3" name="password" type="password" autocomplete="new-password">' +
    '<label for="s4">تأكيد كلمة المرور</label><input id="s4" name="password2" type="password" autocomplete="new-password">' +
    '<label class="ckl"><input type="checkbox" name="terms"> الموافقة على <a class="lnk" href="/#terms" target="_blank" rel="noopener">شروط الاستخدام وسياسة الخصوصية</a></label>' +
    '<button class="btn" type="submit">إنشاء حساب</button><div class="msg"></div>' +
    '<p class="formsub">لديك حساب؟ <a class="lnk" href="#login">تسجيل الدخول</a></p></form>';
}
const viewTerms = () => '<section class="narrow">' + secHead('شروط الاستخدام وسياسة الخصوصية', '') + '<div class="card terms">' + esc(cfg('terms_text')) + '</div></section>';

function viewAccount() {
  const u = S.user;
  if (u.password_reset_required) {
    return '<section class="narrow"><div class="card"><h3>تغيير كلمة المرور مطلوب</h3>' +
      '<p class="muted">هذه كلمة مرور مؤقتة للمشرف. اختر كلمة مرور جديدة من ١٢ حرفًا على الأقل لتفعيل الحساب.</p>' +
      '<form class="inl" data-form="password">' +
      fld('old', 'كلمة المرور المؤقتة', '', { type: 'password' }) +
      fld('new', 'كلمة المرور الجديدة (١٢ حرفًا على الأقل)', '', { type: 'password' }) +
      fld('new2', 'تأكيد كلمة المرور الجديدة', '', { type: 'password' }) +
      '<div class="acts"><button class="btn" type="submit">حفظ كلمة المرور الجديدة</button><span class="msg"></span></div></form></div></section>';
  }
  let o = '<section><div class="card"><div class="prof"><div class="av ' + genderClass(u.gender) + '">' +
    avatarContent(u.role, u.gender, u.avatar_path) + '</div><div><h3 class="h0">' + esc(u.name) + '</h3>' +
    '<div class="muted"><span dir="ltr">@' + esc(u.username) + '</span> · ' + ROLE[u.role] + (u.gender ? ' · ' + esc(GENDER[u.gender]) : '') + (u.city ? ' · ' + esc(u.city) : '') + '</div>' +
    (u.bio ? '<div class="muted">' + esc(u.bio) + '</div>' : '') + '</div></div>' +
    '<div class="avatar-editor"><label class="btn ghost sm">تغيير الصورة الشخصية<input type="file" accept="image/jpeg,image/png,image/webp" data-profile-avatar></label>' +
    (u.avatar_path ? '<button class="btn ghost sm" type="button" data-act="avatar-clear">إزالة الصورة</button>' : '') +
    '<small class="muted">JPG أو PNG أو WEBP — الحد الأقصى ٣ ميجابايت</small></div>' +
    (isStaff() ? '<div class="acts">' + btn('#dashboard', 'لوحة التحكم', 'sm') + '</div>' : '') +
    '<details><summary>تعديل بياناتي</summary><form class="inl" data-form="profile">' +
    (u.role === 'supervisor' && !u.gender ? '<fieldset class="gender-group"><legend>النوع — مطلوب لتحديد مساحة التواصل</legend><div class="gender-options">' +
      '<label class="gender-choice"><input type="radio" name="gender" value="male" required> <span>ذكر</span></label>' +
      '<label class="gender-choice"><input type="radio" name="gender" value="female" required> <span>أنثى</span></label></div></fieldset>' : '') +
    fld('name', 'الاسم', u.name) + fld('city', 'المدينة', u.city) + fld('bio', 'نبذة عنك', u.bio, { type: 'area' }) +
    '<button class="btn sm" type="submit">حفظ</button> <span class="msg"></span></form></details>' +
    '<details><summary>تغيير كلمة المرور</summary><form class="inl" data-form="password">' +
    fld('old', 'كلمة المرور الحالية', '', { type: 'password' }) + fld('new', 'كلمة المرور الجديدة (٨ أحرف على الأقل)', '', { type: 'password' }) +
    fld('new2', 'تأكيد كلمة المرور الجديدة', '', { type: 'password' }) +
    '<button class="btn sm" type="submit">تغيير</button> <span class="msg"></span></form></details></div>';
  const sv = S.saved.map(vid).filter(Boolean);
  o += '<br><div class="card"><h4>ربط تيليجرام واستعادة كلمة المرور</h4>' +
    (u.telegram_linked
      ? '<p class="muted">حساب تيليجرام مرتبط؛ يمكنه استلام رموز استعادة كلمة المرور.</p>' +
        '<button type="button" class="btn ghost sm" data-act="telegram-refresh">التحقق من حالة الربط</button>'
      : '<p class="muted">اربط حساب تيليجرام مرة واحدة لتتمكن من استعادة كلمة المرور لاحقًا.</p>' +
        '<button type="button" class="btn sm" data-act="telegram-link">إنشاء رابط الربط</button>' +
        (ACCOUNT_TELEGRAM.url ? '<p><a class="btn ghost sm" href="' + esc(safeUrl(ACCOUNT_TELEGRAM.url)) +
          '" target="_blank" rel="noopener noreferrer">فتح تيليجرام وإتمام الربط ↗</a></p>' +
          '<button type="button" class="btn ghost sm" data-act="telegram-refresh">تحققت من الربط</button>' : '')) +
    '</div><br><div class="card"><h4>قوائمي المحفوظة (' + sv.length + ')</h4>' + (sv.length ? vgrid(sv) : '<p class="muted">افتح أي قائمة تشغيل واضغط «احفظ القائمة» لتظهر هنا.</p>') + '</div></section>';
  return o;
}

/* ───────── أدوات النماذج ───────── */
function fld(name, label, val, o) {
  o = o || {};
  const id = 'f' + Math.random().toString(36).slice(2, 9), type = o.type || 'text';
  const dir = o.dir ? ' dir="' + o.dir + '"' : '', ph = o.ph ? ' placeholder="' + esc(o.ph) + '"' : '';
  if (type === 'check') return '<label class="fld ckl"><input type="checkbox" name="' + name + '"' + (val ? ' checked' : '') + '> ' + esc(label) + '</label>';
  let input;
  if (type === 'area') input = '<textarea id="' + id + '" name="' + name + '"' + dir + ph + '>' + esc(val) + '</textarea>';
  else if (type === 'select') input = '<select id="' + id + '" name="' + name + '">' + o.opts.map(x => '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(val) ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select>';
  else input = '<input id="' + id + '" name="' + name + '" type="' + type + '" value="' + esc(val) + '"' + dir + ph + (o.ro ? ' readonly' : '') + '>';
  return '<label class="fld" for="' + id + '">' + esc(label) + '</label>' + input + (o.hint ? '<div class="muted">' + o.hint + '</div>' : '');
}
const imageUploadField = (name, label, val) => '<label class="fld">' + esc(label) + '</label>' +
  (val ? '<img class="thumbprev" src="' + esc(val) + '" alt="">' : '') +
  '<input name="' + name + '" type="hidden" value="' + esc(val || '') + '">' +
  '<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="' + name + '">';
function readForm(f) {
  const o = {};
  $$('[name]', f).forEach(el => {
    if (el.closest('[hidden]')) return;
    const n = el.name;
    if (el.type === 'radio') {
      if (el.checked) o[n] = el.value;
    } else if (el.type === 'checkbox') {
      if (el.hasAttribute('data-multi')) { o[n] = o[n] || []; if (el.checked) o[n].push(el.value); } else o[n] = el.checked;
    } else if (el.type === 'number') o[n] = parseInt(el.value, 10) || 0;
    else if (el.type !== 'file') o[n] = el.value;
  });
  return o;
}
/* ───────── لوحة التحكم ───────── */
let DT = 'overview';
const selectedVideoIds = new Set();
const TABS = { overview: 'نظرة عامة', students: 'الطلاب', supervisors: 'المشرفون',
  videos: 'مكتبة المحتوى', books: 'إضافة كتاب', sermons: 'إضافة خطبة منبرية', benefits: 'الفوائد',
  words: 'الكلمات', announcements: 'الإعلانات', categories: 'العلوم', progress: 'متابعة الدروس', live: 'غرف البث المباشر',
  faqs: 'الأسئلة الشائعة', settings: 'الإعدادات' };
const tabList = () => Object.keys(TABS);
const SET_FIELDS = [['site_name', 'اسم الموقع'], ['hero_tag', 'وسم الصفحة الرئيسية'], ['hero_title', 'العنوان الرئيسي'], ['hero_subtitle', 'العنوان الفرعي'], ['hero_text', 'التعريف بالمكتبة', 'area'],
  ['lectures_title', 'عنوان التصنيفات'], ['lectures_sub', 'وصف التصنيفات'], ['cta_title', 'عنوان الدعوة'], ['cta_text', 'نص الدعوة'],
  ['footer_about', 'تعريف أسفل الصفحة', 'area'], ['copyright', 'حقوق النشر'], ['yt_channel', 'رابط قناة يوتيوب', 'url'],
  ['yt_playlists', 'رابط قوائم التشغيل', 'url'], ['x_url', 'رابط حساب X', 'url'],
  ['telegram_url', 'رابط قناة تليجرام', 'url'], ['telegram_benefits_url', 'رابط مجموعة الفوائد على تليجرام', 'url'],
  ['whatsapp_url', 'رابط مجموعة الفوائد على واتساب', 'url'], ['terms_text', 'نص الشروط وسياسة الخصوصية', 'area']];

const stat = (n, l) => '<div class="stat"><span class="num">' + esc(n) + '</span>' + esc(l) + '</div>';
const DR = {};
DR.overview = async () => {
  const s = await api('GET', '/api/admin/stats');
  let o = '<div class="stats">' + stat(s.students, 'حساب طالب') + stat(s.supervisors, 'مشرف') +
    stat(s.videos, 'قائمة تشغيل') + '</div>';
  if (s.unlinked) o += '<div class="note">' + s.unlinked + ' من القوائم غير مربوطة بيوتيوب — <a class="lnk" href="#" data-act="tab" data-tab="videos">أضف رابطها</a>.</div><br>';
  o += '<div class="card"><b>إدارة مكتبة التصنيفات</b><p class="muted">تحتوي المكتبة على ' +
    S.site.categories.length + ' تصنيفات و' + S.site.videos.length + ' قائمة تشغيل من القناة الرسمية.</p></div>';
  return o;
};
DR.students = async () => {
  const { students } = await api('GET', '/api/admin/students');
  if (!students.length) return '<div class="card"><p class="muted">لا يوجد طلاب بعد.</p></div>';
  return '<input class="search" id="stsearch" type="search" placeholder="ابحث بالاسم أو المعرّف…"><div class="card"><b>الطلاب (' + students.length + ')</b>' + students.map(s => {
    return '<div class="rw" data-id="' + s.id + '" data-q="' + esc((s.name + ' ' + s.username).toLowerCase()) + '"><b>' + esc(s.name) + '</b> ' + genderBadge(s.gender) + ' <span class="muted" dir="ltr">@' + esc(s.username) + '</span> <span class="muted">· ' + fmtDate(s.created_at) + (s.city ? ' · ' + esc(s.city) : '') + '</span>' +
      '<div class="acts"><button type="button" class="btn ghost sm" data-act="u-pass">كلمة مرور جديدة</button><button type="button" class="btn ghost sm" data-act="u-del">حذف الحساب</button></div></div>';
  }).join('') + '</div>';
};
DR.supervisors = async () => {
  const { supervisors } = await api('GET', '/api/admin/supervisors');
  return '<div class="note">جميع المشرفين لديهم صلاحيات إدارة كاملة. وتُحصر متابعة الطلاب في مساحة جنس المشرف.</div><br>' +
    '<form class="card" data-form="sup"><b>إضافة مشرف</b>' + fld('name', 'اسم المشرف', '') + fld('username', 'معرّف تيليجرام', '', { dir: 'ltr', ph: '@username' }) +
    '<fieldset class="gender-group"><legend>النوع لتحديد مساحة التواصل</legend><div class="gender-options">' +
    '<label class="gender-choice"><input type="radio" name="gender" value="male" required> <span>ذكر</span></label>' +
    '<label class="gender-choice"><input type="radio" name="gender" value="female" required> <span>أنثى</span></label></div></fieldset>' +
    fld('password', 'كلمة مرور مؤقتة (٨ أحرف على الأقل)', '', { type: 'password' }) +
    '<div class="acts"><button class="btn" type="submit">إضافة مشرف</button><span class="msg"></span></div></form><br><div class="card"><b>المشرفون (' + supervisors.length + ')</b>' +
    (supervisors.map(s => '<div class="rw supervisor-row" data-id="' + s.id + '">' +
      userAvatar('supervisor', s.gender, 'contact-avatar') + '<b>' + esc(s.name) + '</b> ' +
      (s.gender ? genderBadge(s.gender) : '<span class="badge wait">حدّد النوع من ملفك الشخصي</span>') +
      ' <span class="badge ok">صلاحية كاملة</span> <span class="muted" dir="ltr">@' + esc(s.username) + '</span>' +
      '<div class="acts"><button type="button" class="btn ghost sm" data-act="u-pass">كلمة مرور جديدة</button>' +
      (s.id === S.user.id ? '<span class="muted">هذا حسابك</span>' : '<button type="button" class="btn ghost sm" data-act="u-del">حذف</button>') + '</div></div>').join('') || '<p class="muted">لا يوجد مشرفون بعد.</p>') + '</div>';
};
function videoForm(v) {
  v = v || { media_type: 'playlist', title: '', url: '', category: '', thumb: '', media_path: '', sort: 0, published: true };
  const mediaType = v.media_type || (v.kind === 'playlist' ? 'playlist' : 'video');
  const categories = S.site.categories.map(c => [c.key, c.name]);
  const urlField = (label, placeholder) => fld('url', label, v.url, {
    dir: 'ltr', ph: placeholder
  });
  const titleField = (label) => fld('title', label, v.title);
  const types = [['playlist', 'قائمة تشغيل'], ['video', 'فيديو'], ['audio', 'صوتي']];
  const attachments = (v.attachments || []).map(file => '<div class="related-file-admin"><a href="' +
    esc(file.path) + '" target="_blank" rel="noopener">' + esc(file.title) + '</a><button type="button" class="btn ghost sm" ' +
    'data-act="playlist-file-del" data-id="' + file.id + '">حذف الملف</button></div>').join('');
  const videoAccept = '.mp4,.m4v,.mov,.webm,.mkv,.avi';
  const audioAccept = '.mp3,.m4a,.aac,.wav,.ogg,.flac,.webm';
  return fld('media_type', 'نوع المحتوى', mediaType, { type: 'select', opts: types }) +
    '<div data-media-fields="playlist"' + (mediaType === 'playlist' ? '' : ' hidden') + '>' +
    titleField('عنوان قائمة التشغيل') +
    urlField('رابط قائمة التشغيل من يوتيوب', 'https://www.youtube.com/playlist?list=...') +
    '<label class="fld">ملفات مرتبطة (اختياري) — PDF أو صوت حتى ٢٥ ميجابايت للملف</label>' +
    '<input type="file" data-playlist-files multiple accept=".pdf,.mp3,.m4a,.wav,.ogg,.webm,audio/*,application/pdf">' +
    (attachments ? '<div class="related-file-admin-list">' + attachments + '</div>' : '') + '</div>' +
    '<div data-media-fields="video"' + (mediaType === 'video' ? '' : ' hidden') + '>' +
    titleField('عنوان الفيديو') + urlField('رابط الفيديو (اختياري)', 'https://…') +
    mediaUploadField(v.media_path, videoAccept, 'media_path', 'رفع ملف فيديو (اختياري — حتى ٢٥ ميجابايت)') +
    '</div><div data-media-fields="audio"' + (mediaType === 'audio' ? '' : ' hidden') + '>' +
    titleField('عنوان المجلس الصوتي') + urlField('رابط الصوت (اختياري)', 'https://…') +
    mediaUploadField(v.media_path, audioAccept, 'media_path', 'رفع ملف صوتي (اختياري — حتى ٢٥ ميجابايت)') +
    '</div>' + fld('category', 'التصنيف العلمي', v.category, { type: 'select', opts: categories }) +
    imageUploadField('thumb', 'صورة اختيارية — الافتراضي شعار المعهد', v.thumb) +
    fld('sort', 'الترتيب', v.sort, { type: 'number' }) + fld('published', 'منشور', v.published, { type: 'check' });
}
DR.videos = async () => {
  const { videos } = await api('GET', '/api/admin/videos');
  const labels = { playlist: 'قائمة تشغيل', video: 'فيديو', audio: 'صوتي' };
  return '<div class="note">اختر نوع المحتوى من القائمة؛ تتغير الحقول تلقائيًا. ملفات الفيديو والصوت المباشرة محدودة بـ٢٥ ميجابايت، والملفات المرتبطة بالقائمة اختيارية.</div>' +
    '<details class="card" open><summary><b>+ إضافة محتوى</b></summary><form data-form="video">' + videoForm() + '<div class="acts"><button class="btn" type="submit">إضافة</button><span class="msg"></span></div></form></details><br>' +
    '<div class="card"><div class="video-selection-toolbar"><b>المكتبة</b>' +
      '<input class="search video-library-search" id="video-search" type="search" placeholder="ابحث باسم القائمة أو العلم أو النوع…">' +
      '<span data-video-selection-count>لم يتم تحديد محتوى</span>' +
      '<button class="btn r sm" type="button" data-act="vid-delete-selected" disabled>حذف المحدد</button></div>' +
      '<div class="video-library-count" id="video-library-count">' + videos.length + ' مادة</div>' +
      videos.map(v => '<div class="video-admin-item" data-q="' +
        esc((v.title + ' ' + v.category_name + ' ' + (labels[v.media_type] || 'فيديو')).toLocaleLowerCase()) +
        '"><label class="video-select" for="video-select-' + v.id + '">' +
        '<input id="video-select-' + v.id + '" type="checkbox" data-video-select data-id="' + v.id + '"' +
        (selectedVideoIds.has(v.id) ? ' checked' : '') + ' aria-label="تحديد ' + esc(v.title) + ' للحذف"><span>تحديد للحذف</span></label>' +
        '<details><summary>' + esc(v.title) + ' <span class="badge">' +
        esc(v.category_name) + '</span> <span class="badge">' + esc(labels[v.media_type] || 'فيديو') + '</span>' +
        (v.published ? '' : ' <span class="badge">مخفي</span>') + '</summary><form data-form="video" data-id="' + v.id + '">' + videoForm(v) +
        '<div class="acts"><button class="btn sm" type="submit">حفظ</button><button type="button" class="btn ghost sm" data-act="vid-del" data-id="' + v.id + '">حذف</button><span class="msg"></span></div></form></details></div>').join('') +
      '</div>';
};
function updateVideoSelectionToolbar() {
  const count = $('[data-video-selection-count]');
  const button = $('[data-act="vid-delete-selected"]');
  if (!count || !button) return;
  const selectedCount = selectedVideoIds.size;
  count.textContent = selectedCount ? 'تم تحديد ' + selectedCount + ' عنصر' : 'لم يتم تحديد محتوى';
  button.disabled = selectedCount === 0;
}
function wordForm(word) {
  word = word || { title: '', body: '', image_path: '', image_url: '', youtube_url: '', sort: 0, published: true };
  return fld('title', 'عنوان الكلمة', word.title) +
    fld('body', 'وصف الكلمة', word.body, { type: 'area' }) +
    fld('youtube_url', 'رابط منشور YouTube (اختياري)', word.youtube_url, {
      type: 'url', dir: 'ltr', ph: 'https://www.youtube.com/post/…',
      hint: 'يُحفظ الرابط في لوحة التحكم فقط؛ تظهر الكلمة وصورتها ونصها هنا دون تحويل الزائر إلى يوتيوب.'
    }) +
    fld('image_url', 'رابط الصورة (اختياري)', word.image_url, { type: 'url', dir: 'ltr', ph: 'https://…' }) +
    imageUploadField('image_path', 'أو ارفع صورة من الجهاز', word.image_path) +
    fld('sort', 'الترتيب', word.sort, { type: 'number' }) +
    fld('published', 'منشورة', word.published, { type: 'check' });
}
DR.words = async () => {
  const { words } = await api('GET', '/api/admin/words');
  return '<div class="note">أضف نصًا أو منشورًا من YouTube. لا يُعرض رابط YouTube للزائر؛ أضف عنوان المنشور ونصه ورابط صورته يدويًا، ثم اضبط الترتيب لمطابقة ترتيب منشورات القناة.</div>' +
    '<form class="card" data-form="word"><b>إضافة كلمة أو منشور</b>' + wordForm() +
    '<div class="acts"><button class="btn" type="submit">إضافة الكلمة</button><span class="msg"></span></div></form>' +
    '<div class="card"><b>الكلمات (' + words.length + ')</b>' +
    (words.map(word => '<details><summary>' + esc(word.title) +
      (word.published ? '' : ' <span class="badge">مخفية</span>') + '</summary>' +
      '<form data-form="word-edit" data-id="' + word.id + '">' + wordForm(word) +
      '<div class="acts"><button class="btn sm" type="submit">حفظ</button>' +
      '<button type="button" class="btn ghost sm" data-act="word-del" data-id="' + word.id + '">حذف</button><span class="msg"></span></div></form></details>').join('') ||
      '<p class="muted">لا توجد كلمات مضافة بعد.</p>') + '</div>';
};
DR.announcements = async () => {
  const { announcements } = await api('GET', '/api/admin/announcements');
  return '<div class="note">اكتب إعلانًا واختر صورة عند الحاجة. بعد النشر يظهر الإعلان للزوار في نافذة وسط الشاشة، ويُضاف نصه وصورته تلقائيًا إلى قسم الكلمات.</div>' +
    '<form class="card" data-form="announcement"><b>نشر إعلان جديد</b>' +
    fld('title', 'عنوان الإعلان', '') +
    fld('body', 'نص الإعلان', '', { type: 'area' }) +
    imageUploadField('image_path', 'صورة اختيارية', '') +
    '<div class="acts"><button class="btn" type="submit">نشر الإعلان وإضافته للكلمات</button><span class="msg"></span></div></form>' +
    '<div class="card"><b>الإعلانات (' + announcements.length + ')</b>' +
    (announcements.map(item => '<article class="announcement-admin-row">' +
      (item.image_path ? '<img src="' + esc(item.image_path) + '" alt="">' : '') +
      '<div><b>' + esc(item.title) + '</b><p>' + esc(item.body) + '</p><small>' +
      (item.active ? 'الإعلان الظاهر حاليًا' : 'إعلان سابق') + ' · ' + fmtDate(item.created_at) +
      ' · تمت إضافته إلى الكلمات</small></div></article>').join('') ||
      '<p class="muted">لم تُنشر إعلانات بعد.</p>') + '</div>';
};
function categoryForm(category) {
  category = category || { name: '', description: '', sort: 0 };
  return fld('name', 'اسم العلم', category.name) +
    fld('description', 'وصف العلم (اختياري)', category.description, { type: 'area' }) +
    fld('sort', 'الترتيب', category.sort, { type: 'number' });
}
DR.categories = async () => {
  const { categories } = await api('GET', '/api/admin/categories');
  return '<div class="note">إدارة العلوم المستخدمة في تصنيف المكتبة. لا يمكن حذف علم مرتبط بمحتوى قبل نقل محتواه إلى علم آخر.</div>' +
    '<form class="card" data-form="category"><b>إضافة علم</b>' + categoryForm() +
    '<div class="acts"><button class="btn" type="submit">إضافة العلم</button><span class="msg"></span></div></form>' +
    '<div class="card"><b>العلوم (' + categories.length + ')</b>' +
    (categories.map(category => '<details><summary>' + esc(category.name) + '</summary>' +
      '<form data-form="category-edit" data-key="' + esc(category.key) + '">' + categoryForm(category) +
      '<div class="acts"><button class="btn sm" type="submit">حفظ</button>' +
      '<button type="button" class="btn ghost sm" data-act="category-del" data-key="' + esc(category.key) + '">حذف</button><span class="msg"></span></div></form></details>').join('') ||
      '<p class="muted">لا توجد علوم معرفة.</p>') + '</div>';
};
function benefitUploadForm() {
  const accept = '.mp4,.m4v,.mov,.webm,.mkv,.avi';
  return fld('title', 'عنوان الفائدة', '') +
    '<label class="fld">ملف فيديو من الجهاز (حتى ٨ جيجابايت)</label><input type="file" name="benefit_file" data-benefit-file accept="' + accept + '" required>' +
    '<div class="muted">للفيديوهات الطويلة بدقة 720p؛ يتطلب الرفع مساحة تخزين كافية واتصالًا مستقرًا بالإنترنت.</div>' +
    fld('published', 'منشور', true, { type: 'check' }) +
    '<div class="benefit-upload-progress" data-upload-progress role="status" aria-live="polite"></div>' +
    '<div class="acts"><button class="btn" type="submit">رفع وإضافة الفائدة</button><span class="msg"></span></div>';
}
function benefitYoutubeForm() {
  return fld('title', 'عنوان الـShort', '') +
    fld('youtube_url', 'رابط YouTube Short', '', { type: 'url', dir: 'ltr', ph: 'https://www.youtube.com/shorts/…' }) +
    fld('description', 'وصف (اختياري)', '', { type: 'area' }) +
    fld('sort', 'الترتيب حسب القناة', 0, { type: 'number' }) +
    fld('published', 'منشور', true, { type: 'check' }) +
    '<div class="acts"><button class="btn" type="submit">إضافة الـShort</button><span class="msg"></span></div>';
}
DR.benefits = async () => {
  const { benefits } = await api('GET', '/api/admin/benefits');
  return '<div class="note">أضف Shorts من يوتيوب كرابط لتشغيلها داخل الموقع، أو ارفع مقطعًا من الجهاز. اضبط ترتيب كل مقطع ليتبع ترتيب القناة.</div>' +
    '<form class="card" data-form="benefit-youtube"><b>إضافة Short من يوتيوب</b>' + benefitYoutubeForm() + '</form>' +
    '<div class="note">لرفع فيديو من الجهاز، اختر الملف ثم ارفعه على أجزاء (حتى ٨ جيجابايت).</div>' +
    '<form class="card benefit-upload-form" data-form="benefit"><b>إضافة فائدة جديدة</b>' + benefitUploadForm() + '</form>' +
    '<div class="card"><b>الفوائد (' + benefits.filter(item => item.kind === 'video').length + ')</b>' +
    (benefits.filter(item => item.kind === 'video').map(item => '<details><summary>' + esc(item.title) + ' <span class="badge">فيديو</span>' +
      (item.published ? '' : ' <span class="badge">مخفي</span>') +
      '</summary><form data-form="benefit-edit" data-id="' + item.id + '">' +
      fld('title', 'العنوان', item.title) +
      fld('youtube_url', 'رابط YouTube (لـShort)', item.youtube_id ? 'https://www.youtube.com/shorts/' + item.youtube_id : '',
        { type: 'url', dir: 'ltr', ph: 'https://www.youtube.com/shorts/…' }) +
      fld('description', 'الوصف', item.description || '', { type: 'area' }) +
      fld('sort', 'الترتيب', item.sort, { type: 'number' }) + fld('published', 'منشور', !!item.published, { type: 'check' }) +
      (item.youtube_id ? '<p class="muted">Short من يوتيوب</p>' :
        '<p class="muted">' + esc(item.original_name) + ' · ' + (item.size_bytes / (1024 * 1024)).toFixed(1) + ' ميجابايت</p>') +
      '<div class="acts"><button class="btn sm" type="submit">حفظ</button><button type="button" class="btn ghost sm" data-act="benefit-del" data-id="' +
      item.id + '">حذف</button><span class="msg"></span></div></form></details>').join('') ||
      '<p class="muted">لا توجد فوائد مضافة بعد.</p>') + '</div>';
};
function bookForm() {
  return '<div class="note">أضف رابطًا مباشرًا للكتاب أو ارفع ملف PDF. استخدم أحد الخيارين فقط، ثم اضغط «إضافة الكتاب».</div>' +
    fld('title', 'عنوان الكتاب', '') + fld('author', 'المؤلف (اختياري)', '') +
    fld('description', 'وصف الكتاب (اختياري)', '', { type: 'area' }) +
    fld('media_url', 'رابط الكتاب (اختياري)', '', { type: 'url', dir: 'ltr', ph: 'https://…' }) +
    mediaUploadField('', '.pdf,application/pdf', 'media_path', 'رفع ملف الكتاب PDF (اختياري)') +
    fld('sort', 'الترتيب', 0, { type: 'number' }) + fld('published', 'نشر الكتاب', true, { type: 'check' }) +
    '<div class="acts"><button class="btn" type="submit">إضافة الكتاب</button><span class="msg"></span></div>';
}
DR.books = async () => {
  const { books } = await api('GET', '/api/admin/books');
  return '<form class="card" data-form="book"><b>إضافة كتاب</b>' + bookForm() + '</form>' +
    '<div class="card"><b>الكتب المضافة (' + books.length + ')</b>' +
    (books.map(book => '<div class="rw"><b>' + esc(book.title) + '</b>' +
      (book.author ? ' <span class="muted">· ' + esc(book.author) + '</span>' : '') +
      (book.published ? '' : ' <span class="badge">مخفي</span>') +
      '<div class="acts"><button type="button" class="btn ghost sm" data-act="book-del" data-id="' + book.id + '">حذف</button></div></div>').join('') ||
      '<p class="muted">لا توجد كتب مضافة بعد.</p>') + '</div>';
};
function sermonForm() {
  const videoAccept = '.mp4,.m4v,.mov,.webm,.mkv,.avi';
  const audioAccept = '.mp3,.m4a,.aac,.wav,.ogg,.flac,.webm';
  return '<div class="note">أضف رابطًا مباشرًا للخطبة أو ارفع ملف فيديو أو صوت. اختر رابطًا أو ملفًا واحدًا فقط، وحدّث نوع الوسيط ليتوافق مع الملف المرفوع. الحد الأقصى للملف ٢٥ ميجابايت.</div>' +
    fld('title', 'عنوان الخطبة', '') + fld('speaker', 'اسم الخطيب (اختياري)', '') +
    fld('description', 'وصف الخطبة (اختياري)', '', { type: 'area' }) +
    fld('media_type', 'نوع الخطبة', 'video', { type: 'select', opts: [['video', 'فيديو'], ['audio', 'صوت']] }) +
    fld('media_url', 'رابط الخطبة (اختياري)', '', { type: 'url', dir: 'ltr', ph: 'https://…' }) +
    mediaUploadField('', videoAccept + ',' + audioAccept, 'media_path', 'رفع ملف الخطبة (فيديو أو صوت، اختياري)') +
    fld('sort', 'الترتيب', 0, { type: 'number' }) + fld('published', 'نشر الخطبة', true, { type: 'check' }) +
    '<div class="acts"><button class="btn" type="submit">إضافة الخطبة المنبرية</button><span class="msg"></span></div>';
}
DR.sermons = async () => {
  const { sermons } = await api('GET', '/api/admin/sermons');
  return '<form class="card" data-form="sermon"><b>إضافة خطبة منبرية</b>' + sermonForm() + '</form>' +
    '<div class="card"><b>الخطب المضافة (' + sermons.length + ')</b>' +
    (sermons.map(sermon => '<div class="rw"><b>' + esc(sermon.title) + '</b>' +
      (sermon.speaker ? ' <span class="muted">· ' + esc(sermon.speaker) + '</span>' : '') +
      ' <span class="badge">' + (sermon.media_type === 'audio' ? 'صوت' : 'فيديو') + '</span>' +
      (sermon.published ? '' : ' <span class="badge">مخفية</span>') +
      '<div class="acts"><button type="button" class="btn ghost sm" data-act="sermon-del" data-id="' + sermon.id + '">حذف</button></div></div>').join('') ||
      '<p class="muted">لا توجد خطب مضافة بعد.</p>') + '</div>';
};
function mediaUploadField(path, accept, name, label) {
  name = name || 'path';
  return '<label class="fld">' + esc(label || 'الملف (PDF أو صوت حتى ٢٥ ميجابايت)') + '</label>' +
    '<input name="' + esc(name) + '" type="hidden" value="' + esc(path || '') + '">' +
    '<input type="file" accept="' + esc(accept) + '" data-media-upload="' + esc(name) + '">';
}
function durationLabel(value) {
  const seconds = Math.max(0, Number(value) || 0);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
DR.progress = async () => {
  const { progress } = await api('GET', '/api/admin/lesson-progress');
  const lessons = {};
  progress.forEach(p => {
    if (!lessons[p.video_id]) lessons[p.video_id] = { title: p.lesson_title, viewers: [] };
    if (p.user_id) lessons[p.video_id].viewers.push(p);
  });
  const entries = Object.keys(lessons).map(id => {
    const lesson = lessons[id];
    return '<details class="progress-lesson"><summary>' + esc(lesson.title) + ' <span class="badge">' +
      lesson.viewers.length + ' بدأوا المتابعة</span></summary>' +
      (lesson.viewers.length ? lesson.viewers.map(p => '<div class="rw"><b>' + esc(p.student_name) + '</b> ' +
        genderBadge(p.gender) + '<span class="badge ' + (p.completed ? 'ok' : 'wait') + '">' +
        (p.completed ? 'أكمل الدرس' : 'لم يكمله') + '</span><span class="muted"> · توقف عند ' +
        durationLabel(p.position_seconds) + ' من ' + durationLabel(p.duration_seconds) + ' · ' +
        fmtDate(p.updated_at) + '</span></div>').join('') : '<p class="muted">لم يبدأ أحد هذا الدرس بعد.</p>') + '</details>';
  }).join('');
  return '<div class="note">تُسجّل نقطة التوقف كل ١٠ ثوانٍ وعند الإيقاف أو إغلاق المشغّل. يُعد الدرس مكتملًا عند وصول حدث انتهاء الفيديو.</div>' +
    '<div class="card"><b>متابعة الطلاب (' + Object.keys(lessons).length + ' درس)</b>' +
    (entries || '<p class="muted">افتح قوائم التشغيل لتحميل دروسها، ثم يبدأ ظهور متابعة الطلاب هنا.</p>') + '</div>';
};
function liveRoomForm(room) {
  room = room || { title: '', description: '', event_url: '', audience: 'both', status: 'scheduled', starts_at: null, published: true };
  const audience = [['both', 'الرجال والنساء'], ['male', 'الرجال'], ['female', 'النساء']];
  const states = [['scheduled', 'مجدول'], ['live', 'مباشر الآن'], ['ended', 'انتهى']];
  const localStart = room.starts_at ? new Date(room.starts_at * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return fld('title', 'عنوان البث', room.title) + fld('description', 'الوصف', room.description, { type: 'area' }) +
    fld('event_url', 'رابط مشاهدة StreamYard On-Air', room.event_url, { dir: 'ltr', ph: 'https://streamyard.com/watch/…' }) +
    fld('audience', 'الفئة', room.audience, { type: 'select', opts: audience }) +
    fld('status', 'حالة الغرفة', room.status, { type: 'select', opts: states }) +
    fld('starts_at', 'موعد البث (اختياري)', localStart, { type: 'datetime-local' }) +
    fld('published', 'إظهار الغرفة للطلاب', room.published, { type: 'check' }) +
    '<div class="acts"><button class="btn sm" type="submit">حفظ الغرفة</button><span class="msg"></span></div>';
}
DR.live = async () => {
  const { rooms } = await api('GET', '/api/admin/live-rooms');
  return '<div class="note">بعد فتح حساب StreamYard On-Air وإنشاء حدث، انسخ رابط المشاهدة وضعه هنا. الحضور يفتح البث في المتصفح دون تنزيل تطبيق.</div>' +
    '<form class="card" data-form="live-room"><b>إضافة غرفة بث</b>' + liveRoomForm() + '</form><div class="card"><b>غرف البث (' + rooms.length + ')</b>' +
    (rooms.map(r => '<details><summary>' + esc(r.title) + ' <span class="badge">' +
      (r.status === 'live' ? 'مباشر الآن' : r.status === 'ended' ? 'انتهى' : 'مجدول') + '</span></summary>' +
      '<form data-form="live-room" data-id="' + r.id + '">' + liveRoomForm(r) +
      '<div class="acts"><button type="button" class="btn ghost sm" data-act="live-del" data-id="' + r.id + '">حذف الغرفة</button></div></form></details>').join('') ||
      '<p class="muted">لا توجد غرف بث مضافة.</p>') + '</div>';
};
DR.faqs = async () => {
  const { faqs } = await api('GET', '/api/admin/faqs');
  const form = f => fld('q', 'السؤال', f ? f.q : '') + fld('a', 'الجواب', f ? f.a : '', { type: 'area' }) + fld('sort', 'الترتيب', f ? f.sort : 0, { type: 'number' });
  return '<details class="card" open><summary><b>+ إضافة سؤال</b></summary><form data-form="faq">' + form() + '<div class="acts"><button class="btn" type="submit">إضافة</button><span class="msg"></span></div></form></details><br><div class="card"><b>الأسئلة (' + faqs.length + ')</b>' +
    faqs.map(f => '<details><summary>' + esc(f.q) + '</summary><form data-form="faq" data-id="' + f.id + '">' + form(f) + '<div class="acts"><button class="btn sm" type="submit">حفظ</button><button type="button" class="btn ghost sm" data-act="faq-del" data-id="' + f.id + '">حذف</button><span class="msg"></span></div></form></details>').join('') + '</div>';
};
DR.settings = async () => {
  const { settings } = await api('GET', '/api/admin/settings');
  return '<form class="card" data-form="settings"><b>إعدادات الموقع ونصوصه</b>' + SET_FIELDS.map(f => fld(f[0], f[1], settings[f[0]] || '', { type: f[2] === 'area' ? 'area' : 'text', dir: f[2] === 'url' ? 'ltr' : '' })).join('') +
    '<div class="acts"><button class="btn" type="submit">حفظ الإعدادات</button><span class="msg"></span></div></form>';
};
const viewDash = () => '<section class="dsh"><h3 class="t">لوحة تحكم المشرف</h3><p class="sub">إدارة كاملة لمحتوى الموقع والمستخدمين والمشرفين</p><div class="tabs" id="dtabs"></div><div id="dd"></div></section>';
async function dash() {
  if (tabList().indexOf(DT) < 0) DT = 'overview';
  const tabs = $('#dtabs'), dd = $('#dd');
  if (!tabs || !dd) return;
  tabs.innerHTML = tabList().map(k => '<button type="button" data-act="tab" data-tab="' + k + '"' + (k === DT ? ' class="on"' : '') + '>' + TABS[k] + '</button>').join('');
  try {
    dd.innerHTML = await DR[DT]();
    updateVideoSelectionToolbar();
    initMotion(dd);
  } catch (e) { dd.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; }
}
async function refreshAll() { await loadSite(); renderChrome(); await dash(); }

/* ───────── معالجات النماذج ───────── */
const FORMS = {
  async login(f, d) {
    setMe(await api('POST', '/api/login', { username: d.username, password: d.password }));
    ACCOUNT_TELEGRAM.url = '';
    renderChrome();
    renderCommunity();
    startNotificationPolling();
    if (S.user.password_reset_required) {
      toast('يجب تغيير كلمة المرور المؤقتة أولًا');
      location.hash = '#account';
    } else {
      toast('أهلًا بك ' + S.user.name);
      location.hash = isStaff() ? '#dashboard' : '#account';
    }
  },
  async signup(f, d) {
    if (!d.name.trim() || !d.username.trim()) throw new Error('أكمل الاسم ومعرّف تيليجرام');
    if (d.password !== d.password2) throw new Error('كلمتا المرور غير متطابقتين');
    if (!d.terms) throw new Error('يلزم الموافقة على شروط الاستخدام وسياسة الخصوصية');
    setMe(await api('POST', '/api/signup', d));
    renderChrome(); renderCommunity(); startNotificationPolling(); toast('تم إنشاء حسابك بنجاح.'); location.hash = '#account';
  },
  async 'recovery-request'(f, d) {
    if (!d.username.trim()) throw new Error('أدخل معرّف حسابك');
    await api('POST', '/api/password/recovery', { username: d.username });
    RECOVERY.username = d.username.trim().replace(/^@/, '').toLowerCase();
    route();
  },
  async 'recovery-verify'(f, d) {
    if (d.password !== d.password2) throw new Error('كلمتا المرور غير متطابقتين');
    await api('POST', '/api/password/recovery/verify', {
      username: RECOVERY.username, code: d.code, password: d.password, password2: d.password2
    });
    RECOVERY.username = '';
    toast('تم تغيير كلمة المرور. سجّل الدخول باستخدامها الجديدة.');
    location.hash = '#login';
  },
  async profile(f, d) { setMe(await api('PUT', '/api/me', d)); toast('تم حفظ بياناتك'); route(); },
  async avatarClear() { setMe(await api('DELETE', '/api/me/avatar')); renderNav(); toast('تمت إزالة الصورة الشخصية'); route(); },
  async password(f, d) {
    if (d.new2 !== undefined && d.new !== d.new2) throw new Error('كلمتا المرور الجديدتان غير متطابقتين');
    await api('PUT', '/api/me/password', d);
    f.reset();
    setMe(await api('GET', '/api/me'));
    renderNav();
    route();
    toast('تم تغيير كلمة المرور');
  },
  async sup(f, d) { await api('POST', '/api/admin/supervisors', d); toast('تمت إضافة المشرف'); await dash(); },
  async video(f, d) {
    const id = f.dataset.id;
    d.published = !!d.published;
    const saved = await api(id ? 'PUT' : 'POST', '/api/admin/videos' + (id ? '/' + id : ''), d);
    const videoId = id || saved.id;
    const filesInput = $('[data-playlist-files]', f);
    const files = d.media_type === 'playlist' && filesInput ? Array.from(filesInput.files || []) : [];
    if (files.length) {
      try {
        for (const file of files) {
          const response = await fetch('/api/admin/media/upload?filename=' + encodeURIComponent(file.name), {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'تعذّر رفع الملف المرتبط');
          await api('POST', '/api/admin/videos/' + videoId + '/files', { title: file.name, path: result.path });
        }
      } catch (error) {
        await refreshAll();
        toast('تم حفظ قائمة التشغيل، لكن تعذّر إكمال رفع الملفات المرتبطة: ' + error.message, true);
        return;
      }
    }
    toast('تم حفظ المحتوى');
    await refreshAll();
  },
  async book(f, d) {
    if (!!d.media_url.trim() === !!d.media_path) throw new Error('أدخل رابط الكتاب أو ارفع ملف PDF، وليس الاثنين معًا');
    await api('POST', '/api/admin/books', d);
    toast('تمت إضافة الكتاب');
    await refreshAll();
  },
  async sermon(f, d) {
    if (!!d.media_url.trim() === !!d.media_path) throw new Error('أدخل رابط الخطبة أو ارفع ملفًا، وليس الاثنين معًا');
    await api('POST', '/api/admin/sermons', d);
    toast('تمت إضافة الخطبة المنبرية');
    await refreshAll();
  },
  async word(f, d) {
    d.published = !!d.published;
    await api('POST', '/api/admin/words', d);
    toast('تمت إضافة الكلمة');
    await refreshAll();
  },
  async announcement(f, d) {
    await api('POST', '/api/admin/announcements', d);
    toast('تم نشر الإعلان وإضافته إلى الكلمات');
    await loadSite();
    await dash();
  },
  async 'word-edit'(f, d) {
    d.published = !!d.published;
    await api('PUT', '/api/admin/words/' + f.dataset.id, d);
    toast('تم حفظ الكلمة');
    await refreshAll();
  },
  async category(f, d) {
    await api('POST', '/api/admin/categories', d);
    toast('تمت إضافة العلم');
    await refreshAll();
  },
  async 'category-edit'(f, d) {
    await api('PUT', '/api/admin/categories/' + encodeURIComponent(f.dataset.key), d);
    toast('تم حفظ العلم');
    await refreshAll();
  },
  async benefit(f, d) {
    const file = $('[data-benefit-file]', f).files[0];
    if (!file) throw new Error('اختر ملف فيديو من جهازك');
    let uploadId = '';
    const progress = $('[data-upload-progress]', f);
    try {
      const upload = await api('POST', '/api/admin/benefits/uploads', {
        title: d.title, description: '', kind: 'video', file_name: file.name, size: file.size
      });
      uploadId = upload.upload_id;
      const chunkSize = upload.chunk_size;
      const chunks = Math.ceil(file.size / chunkSize);
      for (let index = 0; index < chunks; index++) {
        const start = index * chunkSize;
        const response = await fetch('/api/admin/benefits/uploads/' + uploadId + '/' + index, {
          method: 'PUT', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(start, start + chunkSize)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'تعذّر رفع جزء من الملف');
        if (progress) progress.textContent = 'جارٍ رفع الملف: ' +
          Math.min(100, Math.round((Math.min(file.size, start + chunkSize) / file.size) * 100)) + '%';
      }
      const saved = await api('POST', '/api/admin/benefits/uploads/' + uploadId + '/complete', {});
      uploadId = '';
      await api('PUT', '/api/admin/benefits/' + saved.id, {
        title: d.title, description: d.description, published: !!d.published, sort: d.sort
      });
      toast('تم رفع الفائدة وإضافتها');
      await loadSite();
      await dash();
    } catch (error) {
      if (uploadId) {
        try { await api('DELETE', '/api/admin/benefits/uploads/' + uploadId); }
        catch (cleanupError) {
          throw new Error(error.message + '؛ وتعذّر حذف الرفع غير المكتمل: ' + cleanupError.message);
        }
      }
      throw error;
    }
  },
  async 'benefit-edit'(f, d) {
    d.published = !!d.published;
    await api('PUT', '/api/admin/benefits/' + f.dataset.id, d);
    toast('تم حفظ الفائدة');
    await loadSite();
    await dash();
  },
  async faq(f, d) { const id = f.dataset.id; await api(id ? 'PUT' : 'POST', '/api/admin/faqs' + (id ? '/' + id : ''), d); toast('تم الحفظ'); await refreshAll(); },
  async settings(f, d) { await api('PUT', '/api/admin/settings', d); toast('تم حفظ الإعدادات'); await refreshAll(); },
  async 'live-room'(f, d) {
    const id = f.dataset.id;
    d.starts_at = d.starts_at ? Math.floor(new Date(d.starts_at).getTime() / 1000) : null;
    await api(id ? 'PUT' : 'POST', '/api/admin/live-rooms' + (id ? '/' + id : ''), d);
    toast('تم حفظ غرفة البث'); await dash();
  },
  async chat(f, d) {
    const payload = {
      body: d.body, recipient: CHAT.recipient, attachment_path: d.attachment_path,
      attachment_name: d.attachment_name, attachment_type: d.attachment_type
    };
    await api('POST', '/api/chat/messages', payload);
    f.reset();
    const preview = $('.chat-attachment-name', f);
    if (preview) { preview.hidden = true; preview.textContent = ''; }
    await refreshChatMessages();
    await loadCommunity();
  },
  async 'benefit-youtube'(f, d) {
    d.published = !!d.published;
    await api('POST', '/api/admin/benefits/youtube', d);
    toast('تمت إضافة الـShort');
    await loadSite();
    await dash();
  },
  async 'lesson-question'(f, d) {
    const videoId = f.dataset.videoId;
    await api('POST', '/api/lessons/' + encodeURIComponent(videoId) + '/questions', { body: d.body });
    toast('تم إرسال سؤالك للمشرفين');
    if (S.route === 'watch' && WATCH.currentVideoId === videoId) await loadWatchQuestions(videoId);
  },
  async 'lesson-question-answer'(f, d) {
    await api('POST', '/api/admin/lesson-questions/' + encodeURIComponent(f.dataset.questionId) + '/answer', { answer: d.answer });
    toast('تم نشر إجابة المشرف');
    if (S.route === 'watch' && WATCH.currentVideoId === f.dataset.videoId) await loadWatchQuestions(f.dataset.videoId);
  },
};
function msg(f, t, bad) { const m = $('.msg', f); if (m) { m.textContent = t; m.className = 'msg' + (bad ? ' err' : ''); } else if (t) toast(t, bad); }

document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const b = $('button[type=submit]', f);
  if (b) b.disabled = true;
  msg(f, '');
  try { await FORMS[f.dataset.form](f, readForm(f)); } catch (err) { msg(f, err.message, true); }
  if (b) b.disabled = false;
});

/* ───────── الإجراءات (أزرار) ───────── */
const rowId = el => (el.closest('[data-id]') || el).dataset.id;
async function relogin() {
  setMe({});
  CHAT.open = false;
  startNotificationPolling();
  renderChrome();
  renderCommunity();
  location.hash = '#login';
}
const ACT = {
  menu() { $('#nav').classList.toggle('open'); },
  'profile-toggle'() {
    const menu = $('#profile-dropdown');
    const expanded = menu.hidden;
    menu.hidden = !expanded;
    $('#profile-toggle').setAttribute('aria-expanded', String(expanded));
  },
  close() { closeVideo(); },
  'announcement-close'() { closeAnnouncement(); },
  'modal-tab'(el) { modalTab = el.dataset.tab; renderModalTabs(); },
  'benefit-open'(el) { openBenefit(el.dataset.id); },
  'benefit-nav'(el) {
    const next = BENEFIT_VIEW.index + (el.dataset.direction === 'next' ? 1 : -1);
    if (next < 0 || next >= BENEFIT_VIEW.items.length) return;
    BENEFIT_VIEW.index = next;
    renderBenefitModal();
    const navigationButton = $('[data-act="benefit-nav"][data-direction="' + el.dataset.direction + '"]');
    if (navigationButton) navigationButton.focus();
  },
  async 'avatar-clear'() {
    await FORMS.avatarClear();
  },
  'recover-reset'() { RECOVERY.username = ''; route(); },
  async 'telegram-link'() {
    const result = await api('POST', '/api/me/telegram/link');
    ACCOUNT_TELEGRAM.url = result.url || '';
    setMe(await api('GET', '/api/me'));
    route();
    if (ACCOUNT_TELEGRAM.url) toast('افتح رابط تيليجرام لإتمام الربط ثم تحقق من الحالة');
  },
  async 'telegram-refresh'() {
    setMe(await api('GET', '/api/me'));
    if (S.user.telegram_linked) ACCOUNT_TELEGRAM.url = '';
    route();
  },
  'chat-back'() { CHAT.recipient = null; CHAT.messages = []; CHAT.search = ''; loadCommunity('').catch(e => toast(e.message, true)); },
  'close-go'(el) { closeVideo(); if (el.dataset.tab) DT = el.dataset.tab; if (el.getAttribute('href') === '#dashboard' && location.hash === '#dashboard') route(); else if (el.getAttribute('href')) location.hash = el.getAttribute('href'); },
  async 'playlist-video'(el) {
    const videoId = el.dataset.videoId;
    if (!$('#playlist-player') || !/^[A-Za-z0-9_-]{6,64}$/.test(videoId || '')) return;
    $$('.playlist-item').forEach(item => item.classList.toggle('on', item === el));
    await selectLesson(videoId, el.dataset.title || S.site.settings.site_name, true);
  },
  'watch-video'(el) {
    const contentId = Number(el.dataset.contentId);
    const videoId = el.dataset.videoId;
    if (!Number.isInteger(contentId) || !/^[A-Za-z0-9_-]{6,64}$/.test(videoId || '')) return;
    location.hash = '#watch/' + contentId + '/' + encodeURIComponent(videoId);
  },
  async logout() {
    await api('POST', '/api/logout'); setMe({});
    CHAT.open = false; if (CHAT.timer) clearInterval(CHAT.timer); CHAT.timer = null;
    NOTIFICATIONS.open = false;
    startNotificationPolling(); renderChrome(); renderCommunity(); toast('تم تسجيل الخروج'); location.hash = '#home'; route();
  },
  async 'community-toggle'() { await toggleCommunity(); },
  async 'notification-toggle'() { await openNotifications(); },
  'communication-close'() {
    CHAT.open = false;
    NOTIFICATIONS.open = false;
    if (CHAT.timer) clearInterval(CHAT.timer);
    CHAT.timer = null;
    renderCommunity();
  },
  async 'notification-open'(el) {
    const item = NOTIFICATIONS.items.find(entry => entry.id === Number(el.dataset.id));
    await openNotificationTarget(item);
  },
  async 'notification-toast-open'(el) {
    const item = NOTIFICATIONS.items.find(entry => entry.id === Number(el.dataset.id));
    await openNotificationTarget(item);
    const toastItem = el.closest('.notification-toast');
    if (toastItem) toastItem.remove();
  },
  'notification-toast-dismiss'(el) {
    const toastItem = el.closest('.notification-toast');
    if (toastItem) toastItem.remove();
  },
  async 'notification-read-all'() {
    await api('POST', '/api/notifications/read-all', {});
    await pollNotifications();
  },
  async 'chat-contact'(el) {
    CHAT.recipient = Number(el.dataset.id);
    CHAT.messages = [];
    await refreshChatMessages();
    renderCommunity();
  },
  async 'toggle-save'(el) {
    const id = Number(el.dataset.id), saved = S.saved.indexOf(id) > -1;
    setMe(await api(saved ? 'DELETE' : 'POST', '/api/saved/' + id)); renderModalFoot(vid(id)); toast(saved ? 'أُزيلت القائمة من محفوظاتك' : 'حُفظت القائمة');
    if (S.route === 'account') route();
  },
  'word-slide'(el) {
    const track = $('#words-slider');
    if (!track) return;
    track.scrollBy({ left: el.dataset.direction === 'next' ? -track.clientWidth : track.clientWidth, behavior: 'smooth' });
  },
  'home-carousel'(el) {
    const carousel = HOME_CAROUSELS[el.dataset.carousel];
    if (!carousel) return;
    const pages = Math.ceil(carousel.items.length / carousel.pageSize);
    const nextPage = carousel.page + (el.dataset.direction === 'next' ? 1 : -1);
    if (nextPage < 0 || nextPage >= pages) return;
    carousel.page = nextPage;
    const target = document.getElementById(el.dataset.carousel);
    if (target) {
      target.innerHTML = homeCarouselMarkup(el.dataset.carousel);
      initMotion(target);
    }
  },
  category(el) { LF.category = el.dataset.category; LF.q = ''; location.hash = '#lessons'; },
  lfilter(el) {
    LF.category = el.dataset.category;
    $('#lchips').innerHTML = chips();
    const category = S.site.categories.find(c => c.key === LF.category);
    $('#lheading').innerHTML = '<b>' + (category ? esc(category.name) : 'كل العلوم') + '</b><span>' +
      lessonResults().length + ' قائمة</span>';
    $('#lgrid').innerHTML = lessonsGrid();
    initMotion($('#lgrid'));
    watchPlaylistThumbnails($('#lgrid'));
  },
  tab(el) { DT = el.dataset.tab; dash(); },
  async 'u-del'(el) { if (!confirm('حذف هذا الحساب نهائيًا مع كل بياناته؟')) return; await api('DELETE', '/api/admin/users/' + rowId(el)); toast('تم الحذف'); await dash(); },
  async 'u-pass'(el) { const p = prompt('كلمة المرور الجديدة (٨ أحرف على الأقل):'); if (!p) return; await api('PUT', '/api/admin/users/' + rowId(el) + '/password', { password: p }); toast('تم تغيير كلمة المرور'); },
  async 'vid-del'(el) {
    if (!confirm('حذف هذا المحتوى وملفاته المرتبطة؟')) return;
    await api('DELETE', '/api/admin/videos/' + el.dataset.id);
    selectedVideoIds.delete(Number(el.dataset.id));
    toast('تم الحذف');
    await refreshAll();
  },
  async 'vid-delete-selected'() {
    const ids = Array.from(selectedVideoIds);
    if (!ids.length || !confirm('حذف ' + ids.length + ' من عناصر المكتبة وملفاتها المرتبطة؟')) return;
    const result = await api('POST', '/api/admin/videos/delete', { ids });
    selectedVideoIds.clear();
    toast('تم حذف ' + result.deleted + ' عنصر');
    await refreshAll();
  },
  async 'book-del'(el) { if (!confirm('حذف هذا الكتاب؟')) return; await api('DELETE', '/api/admin/books/' + el.dataset.id); toast('تم حذف الكتاب'); await refreshAll(); },
  async 'sermon-del'(el) { if (!confirm('حذف هذه الخطبة؟')) return; await api('DELETE', '/api/admin/sermons/' + el.dataset.id); toast('تم حذف الخطبة'); await refreshAll(); },
  async 'word-del'(el) { if (!confirm('حذف هذه الكلمة وصورتها؟')) return; await api('DELETE', '/api/admin/words/' + el.dataset.id); toast('تم حذف الكلمة'); await refreshAll(); },
  async 'category-del'(el) { if (!confirm('حذف هذا العلم؟')) return; await api('DELETE', '/api/admin/categories/' + encodeURIComponent(el.dataset.key)); toast('تم حذف العلم'); await refreshAll(); },
  async 'playlist-file-del'(el) {
    if (!confirm('حذف الملف المرتبط بقائمة التشغيل؟')) return;
    await api('DELETE', '/api/admin/playlist-files/' + el.dataset.id);
    await dash();
    await loadSite();
  },
  async 'faq-del'(el) { if (!confirm('حذف السؤال؟')) return; await api('DELETE', '/api/admin/faqs/' + el.dataset.id); toast('تم الحذف'); await refreshAll(); },
  async 'benefit-del'(el) { if (!confirm('حذف هذه الفائدة والملف المرفوع؟')) return; await api('DELETE', '/api/admin/benefits/' + el.dataset.id); await loadSite(); await dash(); },
  async 'live-del'(el) { if (!confirm('حذف غرفة البث؟')) return; await api('DELETE', '/api/admin/live-rooms/' + el.dataset.id); await dash(); },
};
document.addEventListener('click', async e => {
  if (e.target === $('#modal')) { closeVideo(); return; }
  if (!e.target.closest('#account-menu')) {
    $('#profile-dropdown').hidden = true;
    $('#profile-toggle').setAttribute('aria-expanded', 'false');
  }
  const el = e.target.closest('[data-act],[data-play]');
  if (!el) return;
  if (el.dataset.play) { e.preventDefault(); openVideo(el.dataset.play); return; }
  const a = el.dataset.act;
  if (!ACT[a]) return;
  e.preventDefault();
  if (el.tagName === 'BUTTON') el.disabled = true;
  try { await ACT[a](el); } catch (err) {
    if (err.status === 401 && S.user) { toast('انتهت الجلسة، سجّل الدخول من جديد', true); await relogin(); } else toast(err.message, true);
  }
  if (el.isConnected && el.tagName === 'BUTTON') el.disabled = false;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeVideo();
    if (CHAT.open) {
      CHAT.open = false;
      if (CHAT.timer) clearInterval(CHAT.timer);
      CHAT.timer = null;
      renderCommunity();
    }
    if (NOTIFICATIONS.open) {
      NOTIFICATIONS.open = false;
      renderCommunity();
    }
    closeAnnouncement();
    $('#profile-dropdown').hidden = true;
    $('#profile-toggle').setAttribute('aria-expanded', 'false');
    return;
  }
  if (!$('#modal').hidden && BENEFIT_VIEW.items.length &&
      !e.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) {
    if (e.key === 'ArrowRight' && BENEFIT_VIEW.index > 0) {
      BENEFIT_VIEW.index--;
      renderBenefitModal();
    } else if (e.key === 'ArrowLeft' && BENEFIT_VIEW.index < BENEFIT_VIEW.items.length - 1) {
      BENEFIT_VIEW.index++;
      renderBenefitModal();
    }
  }
});
document.addEventListener('pointerdown', notificationAudio, { once: true });
document.addEventListener('keydown', notificationAudio, { once: true });
document.addEventListener('input', e => {
  if (e.target.name === 'image_url' && e.target.value) {
    const form = e.target.closest('form');
    const uploadedImage = form && form.querySelector('input[type="hidden"][name="image_path"]');
    if (uploadedImage) uploadedImage.value = '';
  }
  if (e.target.id === 'lsearch') {
    LF.q = e.target.value;
    $('#lheading').lastElementChild.textContent = lessonResults().length + ' قائمة';
    $('#lgrid').innerHTML = lessonsGrid();
    initMotion($('#lgrid'));
    watchPlaylistThumbnails($('#lgrid'));
  }
  if (e.target.id === 'benefit-search') {
    benefitQuery = e.target.value;
    const benefits = benefitResults();
    $('#benefit-count').textContent = benefits.length + ' مقطعًا';
    $('#benefit-results').innerHTML = benefitsContent(benefits);
    initMotion($('#benefit-results'));
  }
  if (e.target.id === 'video-search') {
    const query = e.target.value.trim().toLocaleLowerCase();
    const rows = $$('.video-admin-item[data-q]');
    let visible = 0;
    rows.forEach(row => {
      const matches = !query || row.dataset.q.includes(query);
      row.hidden = !matches;
      if (matches) visible++;
    });
    $('#video-library-count').textContent = visible + ' من ' + rows.length + ' مادة';
  }
  if (e.target.id === 'book-search') {
    bookQuery = e.target.value;
    $('#book-count').textContent = bookResults().length + ' كتاب';
    $('#book-results').innerHTML = bookCards();
  }
  if (e.target.id === 'sermon-search') {
    sermonQuery = e.target.value;
    $('#sermon-count').textContent = sermonResults().length + ' خطبة';
    $('#sermon-results').innerHTML = sermonCards();
  }
  if (e.target.id === 'stsearch') { const q = e.target.value.trim().toLowerCase(); $$('.rw[data-q]').forEach(r => { r.hidden = q && r.dataset.q.indexOf(q) < 0; }); }
  if (e.target.id === 'chat-contact-search') {
    clearTimeout(contactSearchTimer);
    const value = e.target.value;
    contactSearchTimer = setTimeout(() => loadCommunity(value).catch(err => toast(err.message, true)), 250);
  }
});
document.addEventListener('change', async e => {
  const inp = e.target;
  if (inp.matches && inp.matches('[data-video-select]')) {
    const id = Number(inp.dataset.id);
    if (inp.checked) selectedVideoIds.add(id);
    else selectedVideoIds.delete(id);
    updateVideoSelectionToolbar();
    return;
  }
  if (inp.matches && inp.matches('input[type=file][data-profile-avatar]') && inp.files[0]) {
    const file = inp.files[0];
    try {
      const r = await fetch('/api/me/avatar', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'تعذّر تحديث الصورة الشخصية');
      setMe(data);
      renderNav();
      route();
      toast('تم تحديث الصورة الشخصية');
    } catch (err) {
      toast(err.message, true);
    } finally {
      inp.value = '';
    }
    return;
  }
  if (inp.matches && inp.matches('[data-audio-playlist]')) {
    const details = inp.closest('[data-audio-playlist-option]').querySelector('[data-audio-playlist-details]');
    details.hidden = !inp.checked;
    details.open = inp.checked;
    return;
  }
  if (inp.matches && inp.matches('select[name="media_type"]')) {
    const form = inp.closest('form[data-form="video"]');
    if (!form) return;
    $$('[data-media-fields]', form).forEach(panel => {
      panel.hidden = panel.dataset.mediaFields !== inp.value;
    });
    return;
  }
  if (inp.matches && inp.matches('select[name="kind"]')) {
    const form = inp.closest('form[data-form="resource"]');
    const option = form && form.querySelector('[data-audio-playlist-option]');
    if (option) {
      option.hidden = inp.value !== 'audio';
      if (inp.value !== 'audio') {
        const checkbox = option.querySelector('[data-audio-playlist]');
        checkbox.checked = false;
        const details = option.querySelector('[data-audio-playlist-details]');
        details.hidden = true; details.open = false;
      }
    }
    return;
  }
  if (!inp.matches || !inp.matches('input[type=file][data-upload],input[type=file][data-media-upload],input[type=file][data-chat-upload]') || !inp.files[0]) return;
  const file = inp.files[0];
  if (inp.hasAttribute('data-chat-upload')) {
    const form = inp.closest('form[data-form="chat"]');
    const preview = form && $('.chat-attachment-name', form);
    try {
      const r = await fetch('/api/chat/upload', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'فشل رفع المرفق');
      $('[name="attachment_path"]', form).value = data.path;
      $('[name="attachment_name"]', form).value = file.name.slice(0, 180);
      $('[name="attachment_type"]', form).value = data.kind;
      if (preview) { preview.textContent = file.name; preview.hidden = false; }
      toast('تم إرفاق الملف بالرسالة');
    } catch (err) { toast(err.message, true); inp.value = ''; }
    return;
  }
  const media = inp.hasAttribute('data-media-upload');
  try {
    const uploadUrl = media ? '/api/admin/media/upload?filename=' + encodeURIComponent(file.name) : '/api/admin/upload';
    const r = await fetch(uploadUrl, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'فشل الرفع');
    const field = inp.dataset.mediaUpload || inp.dataset.upload;
    const t = inp.parentNode.querySelector('input[name="' + field + '"]');
    if (t) t.value = d.path;
    if (field === 'image_path') {
      const form = inp.closest('form');
      const imageUrl = form && form.querySelector('[name="image_url"]');
      if (imageUrl) imageUrl.value = '';
      const preview = inp.parentNode.querySelector('.thumbprev');
      if (preview) preview.remove();
    }
    toast(media ? 'تم رفع الملف — اضغط حفظ لربطه بالدرس' : 'تم رفع الصورة — اضغط حفظ لتثبيتها');
  } catch (err) { toast(err.message, true); }
});

/* ───────── الهيكل والتوجيه ───────── */
function renderNav() {
  const cur = S.route;
  const items = navItems();
  let h = items.map(x => '<a href="#' + esc(x[0]) + '" class="' + (x[0] === cur ? 'on' : '') + '">' + esc(x[1]) + '</a>').join('');
  $('#nav').innerHTML = h; $('#nav').classList.remove('open');
  const accountMenu = $('#account-menu');
  const profileToggle = $('#profile-toggle');
  if (S.user) {
    accountMenu.hidden = false;
    $('#header-avatar').className = 'gender-avatar ' +
        (S.user.role === 'supervisor' || S.user.role === 'admin' ? 'supervisor-avatar' : genderClass(S.user.gender));
    $('#header-avatar').innerHTML = avatarContent(S.user.role, S.user.gender, S.user.avatar_path);
    $('#header-name').textContent = S.user.name;
    $('#profile-dropdown').hidden = true;
    profileToggle.setAttribute('aria-expanded', 'false');
  } else {
    accountMenu.hidden = true;
  }
}
function navItems() {
  if (S.user && S.user.password_reset_required) return [['account', 'تغيير كلمة المرور']];
  const items = [['home', 'الرئيسية'], ['lessons', 'المكتبة'], ['words', 'الكلمات'],
    ['benefits', 'الفوائد'], ['sermons', 'الخطب المنبرية'], ['books', 'الكتب'], ['live', 'البث المباشر']];
  if (!S.user) items.push(['login', 'تسجيل الدخول']);
  else { items.push(['account', 'حسابي']); if (isStaff()) items.push(['dashboard', 'لوحة التحكم']); }
  return items;
}
function renderChrome() {
  $('#brand').textContent = cfg('site_name');
  $('#brand-subtitle').textContent = cfg('hero_subtitle');
  const exploreLinks = navItems().map(item => '<a href="#' + esc(item[0]) + '">' + esc(item[1]) + '</a>').join('');
  const playlistLink = safeUrl(cfg('yt_playlists'));
  const siteLinks = (playlistLink !== '#' ? '<a href="' + esc(playlistLink) +
    '" target="_blank" rel="noopener noreferrer">قوائم التشغيل على يوتيوب</a>' : '') +
    '<a href="#terms">الشروط والخصوصية</a>';
  $('#foot').innerHTML = '<div><div class="footer-brand"><img class="footer-calligraphy" src="/img/footer-calligraphy-from-user.png?v=2" alt="فضيلة الشيخ الدكتور مالك بن رضا المحمدي">' +
    '<p>' + esc(cfg('footer_about')) + '</p></div>' +
    '<div><b>استكشف</b>' + exploreLinks + '</div>' +
    '<div><b>روابط الموقع</b>' + siteLinks + '</div>' +
    '<div class="footer-social"><b>تابعنا وتواصل معنا</b>' + socialLinks('social-links') + '</div></div>' +
    '<p class="copy">' + esc(cfg('copyright')) + '</p>';
  renderNav();
}
function resolve() {
  let r = (location.hash || '#home').slice(1);
  const watch = r.match(/^watch\/(\d+)(?:\/([A-Za-z0-9_-]{6,64}))?$/);
  if (watch) {
    WATCH.contentId = Number(watch[1]);
    WATCH.videoId = watch[2] || '';
    return 'watch';
  }
  WATCH.contentId = null;
  WATCH.videoId = '';
  if (r === 'audio') r = 'benefits';
  if (PAGES.indexOf(r) < 0) r = 'home';
  if (r === 'account' && !S.user) r = 'login';
  if (r === 'recover' && S.user) r = 'account';
  if (r === 'dashboard' && !isStaff()) r = S.user ? 'account' : 'login';
  if ((r === 'login' || r === 'signup') && S.user) r = 'account';
  if (S.user && S.user.password_reset_required && r !== 'account') r = 'account';
  return r;
}
function route() {
  if (!S.site) return;
  const previous = { route: S.route, contentId: WATCH.contentId, videoId: WATCH.videoId };
  const r = resolve();
  if (previous.route === 'watch' &&
      (r !== 'watch' || previous.contentId !== WATCH.contentId || previous.videoId !== WATCH.videoId)) stopWatchPlayback();
  S.route = r;
  const titles = { home: '', lessons: 'مكتبة العلوم الشرعية', books: 'الكتب', sermons: 'الخطب المنبرية', words: 'الكلمات',
    files: 'الملفات المرتبطة', benefits: 'الفوائد', live: 'غرف البث المباشر', login: 'تسجيل الدخول',
    signup: 'إنشاء حساب', recover: 'استعادة كلمة المرور', account: 'حسابي', dashboard: 'لوحة التحكم', terms: 'الشروط والخصوصية',
    watch: 'مشاهدة الدرس' };
  const t = titles[r];
  document.title = (t ? t + ' — ' : '') + cfg('site_name');
  const views = { home: viewHome, lessons: viewLessons, books: viewBooks, sermons: viewSermons, words: viewWords, files: viewFiles,
    benefits: viewBenefits, live: viewLive, login: viewLogin, signup: viewSignup, recover: viewRecovery, account: viewAccount,
    dashboard: viewDash, terms: viewTerms, watch: watchPage };
  $('#app').innerHTML = views[r]();
  initMotion($('#app'));
  watchPlaylistThumbnails($('#app'));
  renderNav();
  if (r === 'dashboard') dash();
  if (r === 'live') loadLiveRooms();
  if (r === 'watch') loadWatch(WATCH.contentId, WATCH.videoId);
  const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  window.scrollTo({ top: 0, behavior });
}
addEventListener('hashchange', () => { closeVideo(); route(); });

(async function init() {
  initTheme();
  try {
    await loadSite();
    try { await loadMe(); } catch (e) { setMe({}); }
    renderChrome(); route(); renderCommunity(); startNotificationPolling(); showAnnouncement();
  } catch (e) {
    $('#app').innerHTML = '<section><p class="sub err">تعذّر تحميل الموقع: ' + esc(e.message) + '</p></section>';
  }
})();
})();
