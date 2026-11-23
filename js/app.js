/* Walther League site: pages, routing, and interactions.
   Pages are drawn from the lists in data.js, which api.js fills from the database. */
(function(){
'use strict';

/* ---------- helpers ---------- */
var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var $ = function(s, r){ return (r || document).querySelector(s); };
var TODAY = (function(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
var pad = function(n){ return String(n).padStart(2, '0'); };
var iso = function(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
var parse = function(s){ var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
var fmt = function(s, o){ return parse(s).toLocaleDateString('en-US', o); };
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var STATES = {TX:'Texas',IN:'Indiana',MO:'Missouri',IL:'Illinois',MN:'Minnesota',CO:'Colorado',AZ:'Arizona',TN:'Tennessee',NE:'Nebraska',OR:'Oregon',OH:'Ohio'};
var toastTimer = null;
function toast(msg){
  var t = $('#toast'); t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.textContent = ''; }, 4200);
}

function charterHTML(){
  return '<div class="charter"><h3>What we confess</h3><ol>' + CONFESS.map(function(c){ return '<li>' + c + '</li>'; }).join('') + '</ol><h3>What we agree to</h3><ul>' + AGREE.map(function(c){ return '<li>' + c + '</li>'; }).join('') + '</ul></div>';
}
/* ---------- ui state ---------- */
var ui = {signin:null, rsvp:{}, supportSent:false, q:'', setting:'All', status:'All', base:'Any', selected:null, mapView:'us', month:{y:TODAY.getFullYear(),m:TODAY.getMonth()}, evKind:'All', evChapter:'All', adminTab:'overview', contact:null, chairEdit:false, applied:null, appCount:0};

/* ---------- map ---------- */
var K = 14, XS = 0.79;
var px = function(lon, lat){ return [(lon + 125.5) * K * XS, (50.2 - lat) * K]; };
var US_POLY = [[-124.7,48.4],[-123.2,48.2],[-122.8,49.0],[-95.2,49.0],[-94.6,48.7],[-93.0,48.6],[-91.5,48.1],[-89.6,48.0],[-84.5,46.5],[-82.5,43.0],[-83.1,41.7],[-79.0,42.8],[-76.5,43.6],[-75.0,45.0],[-71.5,45.0],[-70.0,46.7],[-67.8,47.1],[-67.0,44.8],[-70.2,43.6],[-70.8,42.6],[-70.0,41.7],[-71.5,41.3],[-73.9,40.6],[-74.0,39.7],[-75.5,38.4],[-76.0,37.0],[-75.5,35.3],[-77.0,34.5],[-79.0,33.4],[-81.0,32.0],[-81.4,30.7],[-80.0,26.8],[-80.4,25.2],[-81.2,25.2],[-82.8,27.8],[-82.7,29.0],[-84.0,30.1],[-85.3,29.7],[-86.5,30.4],[-88.0,30.3],[-89.4,30.2],[-89.2,29.0],[-90.5,29.1],[-92.0,29.6],[-93.8,29.7],[-94.8,29.3],[-96.5,28.3],[-97.4,27.3],[-97.2,25.9],[-99.1,26.4],[-99.5,27.5],[-100.8,29.1],[-102.4,29.8],[-103.1,29.0],[-104.5,29.7],[-106.5,31.8],[-108.2,31.8],[-108.2,31.3],[-111.0,31.3],[-114.8,32.5],[-117.1,32.5],[-118.5,34.0],[-120.6,34.6],[-121.9,36.6],[-122.5,37.8],[-123.8,39.4],[-124.4,40.4],[-124.1,42.0],[-124.5,43.0],[-124.0,46.2]];
var US_PATH = 'M' + US_POLY.map(function(p){ return px(p[0], p[1]).map(function(n){ return n.toFixed(1); }).join(','); }).join('L') + 'Z';

function filtered(){
  var q = ui.q.trim().toLowerCase();
  return chapters.filter(function(c){
    if (!c.published) return false;
    if (ui.setting !== 'All' && c.setting !== ui.setting) return false;
    if (ui.status !== 'All' && c.status !== ui.status) return false;
    if (ui.base !== 'Any' && c.bases.indexOf(ui.base) < 0) return false;
    if (!q) return true;
    var hay = [c.city, c.st, STATES[c.st] || '', c.school, c.sponsor, c.church, c.chair, c.cochair, c.setting, c.bases.join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).every(function(t){ return hay.indexOf(t) >= 0; });
  }).sort(function(a, b){ return a.city.localeCompare(b.city); });
}

function mapSVG(o){
  o = o || {};
  var mini = !!o.mini, tx = !mini && ui.mapView === 'tx';
  var vb = tx ? '138 182 300 168' : '-8 -8 674 377';
  var r = mini ? 4.2 : (tx ? 3.8 : 6.2), sw = tx ? 1.4 : 2.2, fs = tx ? 6 : 11;
  var match = mini ? null : new Set(filtered().map(function(c){ return c.id; }));
  var pins = '', labels = '';
  chapters.forEach(function(c){
    if (c.lat == null || !c.published) return;
    var p = px(c.lon, c.lat), x = p[0].toFixed(1), y = p[1].toFixed(1);
    if (mini){ pins += '<circle class="dot" cx="' + x + '" cy="' + y + '" r="' + r + '"/>'; return; }
    var on = match.has(c.id), sel = ui.selected === c.id;
    var label = c.city + ', ' + c.st + ', ' + c.status;
    pins += '<g class="pin ' + (c.status === 'Forming' ? 'forming ' : '') + (sel ? 'sel ' : '') + (on ? '' : 'off') + '" data-action="pick" data-id="' + c.id + '" tabindex="' + (on ? 0 : -1) + '" role="button" aria-label="' + esc(label) + '"><title>' + esc(label) + '</title><circle cx="' + x + '" cy="' + y + '" r="' + (r * 1.8) + '" fill="transparent"/>' +
      (sel ? '<circle class="ring" cx="' + x + '" cy="' + y + '" r="' + (r + 4) + '"/>' : '') +
      '<circle class="dot" style="stroke-width:' + sw + 'px" cx="' + x + '" cy="' + y + '" r="' + r + '"/></g>';
    var show = on && ((tx && c.st === 'TX') || sel);
    if (show){
      var g = r + 3, a = 'start', lx = p[0] + g, ly = p[1] + fs * 0.35;
      if (c.lab === 'l'){ a = 'end'; lx = p[0] - g; }
      else if (c.lab === 't'){ a = 'middle'; lx = p[0]; ly = p[1] - g; }
      else if (c.lab === 'b'){ a = 'middle'; lx = p[0]; ly = p[1] + g + fs; }
      labels += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + a + '" font-size="' + fs + '">' + esc(c.city) + '</text>';
    }
  });
  return '<svg class="map ' + (mini ? 'mini-map' : '') + '" viewBox="' + vb + '" role="img" aria-label="Map of United States chapters"><path class="land" d="' + US_PATH + '"/>' + pins + labels + '</svg>';
}

/* The interest map: existing chapters as small dots, and a circle for each place where people
   have asked for a chapter. Bigger circle, more people. Places and head counts only. */
function spotLabel(s){ return s.city + ', ' + s.st + (s.setting === 'Campus' && s.school ? ' (' + s.school + ')' : '') + ': ' + s.people + (s.people === 1 ? ' person' : ' people'); }
function interestMapSVG(){
  var out = '';
  chapters.forEach(function(c){
    if (c.lat == null || !c.published) return;
    var p = px(c.lon, c.lat);
    out += '<circle class="chdot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.2"><title>' + esc(c.city + ', ' + c.st + ' chapter') + '</title></circle>';
  });
  interestSpots.slice().sort(function(a, b){ return b.people - a.people; }).forEach(function(s){
    if (isNaN(s.lat) || isNaN(s.lon)) return;
    var p = px(s.lon, s.lat), r = Math.min(20, 5 + 2.6 * Math.sqrt(s.people));
    out += '<g class="spot"><title>' + esc(spotLabel(s)) + '</title><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r.toFixed(1) + '"/>' +
      (s.people > 1 ? '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3.6).toFixed(1) + '" text-anchor="middle" font-size="10">' + s.people + '</text>' : '') + '</g>';
  });
  return '<svg class="map" viewBox="-8 -8 674 377" role="img" aria-label="Map of places where people want a Walther League chapter"><path class="land" d="' + US_PATH + '"/>' + out + '</svg>';
}

/* ---------- views ---------- */
function statusChip(s){
  if (s === 'Inactive') return '<span class="chip">Inactive</span>';
  return s === 'Active'
    ? '<span class="chip chip-active"><i class="dot-f"></i>Active</span>'
    : '<span class="chip chip-forming"><i class="dot-o"></i>Forming</span>';
}

function viewHome(){
  var active = chapters.filter(function(c){ return c.status === 'Active'; }).length;
  var forming = chapters.filter(function(c){ return c.status === 'Forming'; }).length;
  var tx = chapters.filter(function(c){ return c.st === 'TX'; }).length;
  return '' +
  '<section class="hero"><div class="wrap hero-in">' +
    '<div><p class="eyebrow">Since 1893. Starting again in 2026.</p>' +
    '<h1>Confessional Lutheran young adults, one chapter at a time.</h1>' +
    '<p class="lede">The Walther League is a network of chapters where young adults, ages 18 to 35, meet one another, grow in God’s Word together, and share Christian fellowship. Chapters are organized by campus or by city, and every chapter has a chair, a co-chair, and a pastoral sponsor.</p>' +
    '<div class="btn-row"><a class="btn btn-primary" href="#chapters">Find a chapter</a><a class="btn btn-ghost" href="#interest">No chapter near you?</a></div></div>' +
    '<figure class="hero-map">' + mapSVG({mini:true}) + '<figcaption>' + chapters.length + ' chapters in the directory: ' + active + ' active, ' + forming + ' forming. ' + tx + ' are in Texas.</figcaption></figure>' +
  '</div></section>' +

  '<section class="wrap section"><p class="eyebrow">Our mission</p><h2>Why the League exists.</h2>' +
    '<div class="cols-3 mission">' +
      '<div class="role"><p>To assist in keeping our young adults within the Church.</p></div>' +
      '<div class="role"><p>To provide an organizational means to have the older men and women teach the younger men and women what is good. (Titus 2)</p></div>' +
      '<div class="role"><p>To gather young adult Christians around the study of God’s Word and to have social events.</p></div>' +
    '</div><p class="sub" style="margin-top:1rem">From the articles of incorporation of the C.F.W. Walther League.</p></section>' +

  '<section class="wrap section" style="border-top:1px solid var(--line)"><p class="eyebrow">Chapters</p><h2>What a chapter is.</h2>' +
    '<p class="lede">A chapter is a local group of young adults, ages 18 to 35, who meet one another, grow in God’s Word together, and share Christian fellowship.</p>' +
    '<p class="lede">Chapters belong to a campus or a city, and are not tied to one congregation. They rotate among the LCMS congregations in their area, meet in homes, or gather wherever suits them, at least once a quarter. There is no membership roll: a member is whoever comes. Three people carry every chapter.</p>' +
    '<div class="cols-3">' +
      '<div class="role"><h3>Chair</h3><p>The chapter’s head coordinator. Plans the gatherings, keeps the chapter page current, and answers messages sent to the chapter address. It is a planning role, not a teaching office.</p></div>' +
      '<div class="role"><h3>Co-chair</h3><p>Shares the work in whatever areas the chapter assigns and gets the same messages. A chapter can name as many co-chairs as it likes.</p></div>' +
      '<div class="role"><h3>Pastoral sponsor</h3><p>An active LCMS pastor in the chapter’s city who comes to as many events as he can, encourages and prays for the chapter, and helps it find sound Bible studies. He need not serve the congregation where the chapter meets.</p></div>' +
    '</div></section>' +

  '<section class="wrap section" style="border-top:1px solid var(--line)"><div class="split"><div><p class="eyebrow">The chapter charter</p><h2>What every chapter confesses.</h2><p class="lede">Every chapter agrees to the same short charter when it joins. It should sound a lot like your confirmation vows.</p><div class="btn-row"><a class="btn btn-line" href="#start">Read the steps to start a chapter</a></div></div>' + charterHTML() + '</div></section>' +

  '<section class="wrap section" style="border-top:1px solid var(--line)"><div class="split">' +
    '<div><p class="eyebrow">Reaching a chapter</p><h2>Write to the chapter, not to a person.</h2>' +
    '<p class="lede">Each chapter has its own address. When leaders change, we change who receives the mail and the address stays the same. Chapter pages show leaders by first name and role only.</p>' +
    '<div class="btn-row"><a class="btn btn-line" href="#chapters">See the directory</a><a class="btn btn-line" href="#support">Help and support</a></div></div>' +
    '<dl class="addr-box"><div><dt>Chairs and co-chairs</dt><dd><code>austin' + DOMAIN + '</code></dd></div><div><dt>Pastoral sponsor</dt><dd><code>austinpastor' + DOMAIN + '</code></dd></div><div><dt>Text line, if the chapter has one</dt><dd><code>(512) 555-0143</code></dd></div><div><dt>Where the chapter talks</dt><dd>Discord, GroupMe, or Instagram. Each chapter chooses.</dd></div></dl>' +
  '</div></section>' +

  '<section class="wrap section" style="border-top:1px solid var(--line)"><p class="eyebrow">History</p><h2>The League has been here before.</h2>' +
    '<ol class="timeline">' +
      '<li><span class="yr">1848</span><p>On May 7, C. F. W. Walther helps start the first Lutheran youth society, at Trinity in St. Louis.</p></li>' +
      '<li><span class="yr">1893</span><p>Twelve societies join to form the national League and name it for Walther.</p></li>' +
      '<li><span class="yr">1942</span><p>The Lutheran Youth Building opens in Chicago, paid for by the young people themselves.</p></li>' +
      '<li><span class="yr">1989</span><p>The International Walther League dissolves in April.</p></li>' +
      '<li class="now"><span class="yr">2026</span><p>Chapters begin again, starting in Texas.</p></li>' +
    '</ol></section>' +

  '<section class="cta-band"><div class="wrap"><div><h2>No chapter where you live?</h2><p class="lede" style="margin-top:.4rem">Put your city on the interest map and we will connect you with others nearby. Or gather a co-chair and a pastor and apply: it takes about ten minutes.</p></div><div class="btn-row" style="margin-top:0"><a class="btn btn-primary" href="#interest">Add yourself to the interest map</a><a class="btn btn-line" href="#start">Start a chapter</a></div></div></section>';
}

function chipsHTML(){
  var G = [{k:'setting', label:'Setting', vals:['All','Campus','City']}, {k:'status', label:'Status', vals:['All','Active','Forming']}, {k:'base', label:'Where they talk', vals:['Any','Discord','GroupMe','Instagram']}];
  var dirty = ui.setting !== 'All' || ui.status !== 'All' || ui.base !== 'Any' || ui.q;
  return G.map(function(g){
    return '<div class="fgroup" role="group" aria-label="' + g.label + '"><span class="flabel">' + g.label + '</span>' + g.vals.map(function(v){
      return '<button type="button" class="fchip" aria-pressed="' + (ui[g.k] === v) + '" data-action="filter" data-k="' + g.k + '" data-v="' + v + '">' + v + '</button>';
    }).join('') + '</div>';
  }).join('') + (dirty ? '<button type="button" class="btn btn-line btn-sm" data-action="clearfilters">Clear filters</button>' : '');
}

function resultItem(c){
  var sel = ui.selected === c.id;
  return '<article class="res ' + (sel ? 'sel' : '') + '" data-action="pick" data-id="' + c.id + '">' +
    '<div class="res-top"><h3><a href="#chapter-' + c.id + '">' + esc(c.city) + ', ' + esc(c.st) + '</a></h3>' + statusChip(c.status) + '</div>' +
    '<p class="res-meta">' + esc(c.setting) + (c.school ? ' · ' + esc(c.school) : '') + '</p>' +
    '<p class="res-meta">' + esc(c.meets) + '</p>' +
    '<p class="res-bases">' + c.bases.map(function(b){ return '<span class="chip">' + b + '</span>'; }).join('') + (c.members ? '<span class="res-n">About ' + c.members + ' come</span>' : '') + '</p></article>';
}

function selHTML(){
  var c = chapters.find(function(x){ return x.id === ui.selected; });
  if (!c) return '';
  return '<div class="sel-card"><div><strong>' + esc(c.city) + ', ' + esc(c.st) + '</strong><div class="sub">' + esc(c.setting) + ' · ' + esc(c.meets) + '</div></div><a class="btn btn-primary btn-sm" href="#chapter-' + c.id + '">Open chapter page</a></div>';
}

function viewChapters(){
  return '<section class="wrap section"><p class="eyebrow">Directory</p><h1>Find a chapter</h1>' +
    '<p class="lede">Search by city, school, or state. Filter by setting, status, or where the chapter talks. Nothing near you? <a href="#interest">Add your city to the interest map</a>.</p>' +
    '<div class="finder-top"><label class="search" for="q"><span class="hint">Search chapters</span><input type="search" id="q" value="' + esc(ui.q) + '" placeholder="Try Austin, Texas A&amp;M, or Discord" autocomplete="off"></label>' +
    '<div class="fgroups" id="chips">' + chipsHTML() + '</div></div>' +
    '<div class="finder-grid"><div><div class="mapbox"><div class="map-bar"><div class="seg" role="group" aria-label="Map area"><button type="button" data-action="mapview" data-v="us" aria-pressed="' + (ui.mapView === 'us') + '">All states</button><button type="button" data-action="mapview" data-v="tx" aria-pressed="' + (ui.mapView === 'tx') + '">Texas</button></div><span class="count" id="count"></span></div>' +
      '<div id="map"></div>' +
      '<div class="legend"><span><i class="dot-f"></i>Active</span><span><i class="dot-o"></i>Forming</span><span>Select a pin to see details</span></div>' +
      '<div id="sel"></div></div></div>' +
    '<div class="results-wrap"><div class="results" id="results" aria-label="Chapter results"></div></div></div></section>';
}
function renderFinder(){ var c = $('#chips'); if (c) c.innerHTML = chipsHTML(); renderMapAndList(); }
function renderMapAndList(){
  if (!$('#map')) return;
  var list = filtered();
  $('#map').innerHTML = mapSVG();
  $('#sel').innerHTML = selHTML();
  $('#count').textContent = list.length + ' of ' + chapters.filter(function(c){ return c.published; }).length + ' chapters';
  $('#results').innerHTML = list.length ? list.map(resultItem).join('') : '<div class="empty">No chapter matches. Try fewer filters, <a href="#interest">add your city to the interest map</a>, or <a href="#start">start a chapter</a>.</div>';
}

function copyBtn(text){ return '<button type="button" class="btn btn-line btn-sm" data-action="copy" data-text="' + esc(text) + '">Copy</button>'; }

function contactPanel(c){
  if (!ui.contact || ui.contact.id !== c.id) return '';
  var pastor = ui.contact.kind === 'pastor';
  var addr = pastor ? pastorAliasOf(c) : aliasOf(c);
  if (ui.contact.sent){
    return '<div class="panel ok-panel" role="status"><h3>Message sent</h3><p>It went to <code>' + esc(addr) + '</code> and is logged for the Walther League office. No one\'s personal address was shown.</p><div><button type="button" class="btn btn-line btn-sm" data-action="closecontact">Close</button></div></div>';
  }
  return '<form class="panel" id="f-contact" novalidate><h3>' + (pastor ? 'Talk with the chapter\'s pastor' : 'Contact this chapter') + '</h3>' +
    '<p class="hint">This goes to <code>' + esc(addr) + '</code>. ' + (pastor ? 'The chapter’s pastoral sponsor receives it.' : 'The chairs receive it.') + '</p>' +
    '<label for="cn-name">Your name<input type="text" id="cn-name" required></label>' +
    '<label for="cn-email">Your email<input type="email" id="cn-email" required></label>' +
    '<label for="cn-msg">Message<textarea id="cn-msg" required></textarea></label>' +
    '<div class="btn-row" style="margin-top:0"><button class="btn btn-primary" type="submit">Send message</button><button type="button" class="btn btn-line" data-action="closecontact">Cancel</button></div></form>';
}

/* ---------- leader changes ---------- */
var ROLE_LABEL = {chair: 'Chair', cochair: 'Co-chair', pastoral_sponsor: 'Pastoral sponsor'};
var ROLE_ORDER = {chair: 0, cochair: 1, pastoral_sponsor: 2};
function byRole(a, b){ return ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name); }
function leadersOf(id){ return leaderRows.filter(function(l){ return l.chapter === id; }).sort(byRole); }
function pendingChange(id){ return leaderChanges.find(function(x){ return x.chapter === id && x.status === 'Pending'; }) || null; }
function pendingChanges(){ return leaderChanges.filter(function(x){ return x.status === 'Pending'; }); }
function sponsorIsNew(ch){
  var was = leadersOf(ch.chapter).filter(function(l){ return l.role === 'pastoral_sponsor'; })[0];
  var now = ch.leaders.filter(function(l){ return l.role === 'pastoral_sponsor'; })[0];
  return !was || !now || was.email.toLowerCase() !== now.email.toLowerCase();
}
/* the proposed list next to today's, so a reader sees at a glance who is new, who stays, who steps down */
function changeTable(ch){
  var cur = leadersOf(ch.chapter);
  var rows = ch.leaders.slice().sort(byRole).map(function(l){
    var same = cur.filter(function(x){ return x.email.toLowerCase() === l.email.toLowerCase(); })[0];
    var tag = !same ? '<span class="chip chip-forming">New</span>' : same.role !== l.role ? '<span class="chip chip-active">Was ' + ROLE_LABEL[same.role].toLowerCase() + '</span>' : '<span class="chip">Stays</span>';
    var extra = l.role === 'pastoral_sponsor' ? [l.church, [l.city, l.st].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
    return '<tr><td>' + ROLE_LABEL[l.role] + '</td><td>' + esc(l.name) + '<div class="sub">' + esc(l.email) + (extra ? '<br>' + esc(extra) : '') + '</div></td><td>' + tag + '</td></tr>';
  }).join('');
  var gone = cur.filter(function(x){ return !ch.leaders.some(function(l){ return l.email.toLowerCase() === x.email.toLowerCase(); }); });
  return '<div class="scroll"><table class="tbl"><thead><tr><th>Role</th><th>Proposed</th><th>Change</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (gone.length ? '<p class="sub" style="margin-top:.5rem">Stepping down: ' + gone.map(function(x){ return esc(x.name) + ' (' + ROLE_LABEL[x.role].toLowerCase() + ')'; }).join(', ') + '. They stop receiving the chapter’s mail' + (gone.some(function(x){ return x.role !== 'pastoral_sponsor'; }) ? ' and can no longer edit the page' : '') + '.</p>' : '');
}

/* chair tools: who the League has on file, and the form to propose a change */
function leaderSection(c){
  var cur = leadersOf(c.id), pend = pendingChange(c.id);
  var last = leaderChanges.filter(function(x){ return x.chapter === c.id && x.status !== 'Pending'; })[0];
  var long = {month: 'long', day: 'numeric', year: 'numeric'};
  var out = '<div><h3>Leaders on file with the League</h3><p class="hint" style="margin-top:.3rem">Only you and the League office see these names and addresses. The public page shows first names and roles.</p>' +
    (cur.length ? '<ul class="al-log">' + cur.map(function(l){ return '<li><span class="sub">' + ROLE_LABEL[l.role] + '</span><span>' + esc(l.name) + ' <span class="sub">' + esc(l.email) + (l.church ? ' · ' + esc(l.church) : '') + '</span></span></li>'; }).join('') + '</ul>' : '<p class="sub">No leaders listed.</p>') + '</div>';
  if (pend){
    return out + '<div class="panel" style="border-color:var(--gold)"><h3>Leader change waiting for the League office</h3><p class="hint">Sent ' + fmt(pend.date, long) + (pend.by ? ' by ' + esc(pend.by) : '') + '. Nothing changes until the office approves it.</p>' + changeTable(pend) +
      (pend.note ? '<p class="sub">Your note: ' + esc(pend.note) + '</p>' : '') +
      '<div><button type="button" class="btn btn-line btn-sm al-danger" data-action="lcwithdraw" data-id="' + pend.id + '">Withdraw this request</button></div></div>';
  }
  if (last && last.decided){
    out += last.status === 'Approved'
      ? '<p class="sub">Your last leader change was approved on ' + fmt(last.decided, long) + '.</p>'
      : '<div class="panel" style="border-color:var(--red)"><p><strong>The office did not approve your last request</strong> (' + fmt(last.decided, long) + ').' + (last.reason ? ' ' + esc(last.reason) : '') + ' You can send a corrected one below.</p></div>';
  }
  var chair = cur.filter(function(l){ return l.role === 'chair'; })[0] || {name: '', email: ''};
  var cos = cur.filter(function(l){ return l.role === 'cochair'; });
  var sp = cur.filter(function(l){ return l.role === 'pastoral_sponsor'; })[0] || {name: '', email: '', church: ''};
  var coRows = '';
  for (var i = 0; i < Math.max(cos.length, 1) + 2; i++){
    var x = cos[i] || {name: '', email: ''}, opt = i >= Math.max(cos.length, 1);
    coRows += '<div class="row2"><label for="lc-co-n-' + i + '">Co-chair' + (opt ? ' <span class="hint">(optional, another co-chair)</span>' : '') + '<input type="text" id="lc-co-n-' + i + '" data-co="n" value="' + esc(x.name) + '" placeholder="Full name"></label><label for="lc-co-e-' + i + '">Email<input type="email" id="lc-co-e-' + i + '" data-co="e" value="' + esc(x.email) + '"></label></div>';
  }
  return out + '<details class="lead-form"' + (ui.leadOpen ? ' open' : '') + '><summary>Request a leader change</summary>' +
    '<form id="f-leaders" class="form" novalidate><fieldset><legend>Your leaders for the coming year</legend>' +
    '<p class="hint">List everyone as they should be after the change. Keep the people who are staying, replace the ones who are not, and clear a co-chair’s row to remove them. The League office reviews it, and when it is approved the chapter’s email addresses go to the new people and the chapter is renewed for the year.</p>' +
    '<div class="row2"><label for="lc-chair-n">Chair<input type="text" id="lc-chair-n" value="' + esc(chair.name) + '" placeholder="Full name"></label><label for="lc-chair-e">Email<input type="email" id="lc-chair-e" value="' + esc(chair.email) + '"></label></div>' + coRows +
    '<div class="row2"><label for="lc-sp-n">Pastoral sponsor<input type="text" id="lc-sp-n" value="' + esc(sp.name) + '" placeholder="Rev. Full Name"></label><label for="lc-sp-e">His email<input type="email" id="lc-sp-e" value="' + esc(sp.email) + '"></label></div>' +
    '<label for="lc-sp-c">The congregation he serves<input type="text" id="lc-sp-c" value="' + esc(sp.church) + '"></label>' +
    '<div class="row2"><label for="lc-sp-city">Congregation’s city<input type="text" id="lc-sp-city" value="' + esc(c.city) + '"></label><label for="lc-sp-st">State <span class="hint">(2 letters)</span><input type="text" id="lc-sp-st" maxlength="2" value="' + esc(c.st) + '"></label></div>' +
    '<p class="hint">The pastoral sponsor must be an active LCMS pastor in ' + esc(c.city) + '. If you name a new one, the office confirms him before approving.</p>' +
    '<label for="lc-note">Note for the office <span class="hint">(optional)</span><textarea id="lc-note" maxlength="2000" placeholder="For example: elected at our September meeting"></textarea></label>' +
    '<div><button class="btn btn-primary" type="submit">Send to the League office</button></div></fieldset></form></details>';
}

/* office: requests waiting for a decision */
function leaderRequestsHTML(){
  var list = pendingChanges();
  if (!list.length) return '';
  return '<h2 style="margin-top:1.5rem;font-size:1.4rem">Leader changes to review</h2><p class="sub" style="margin-top:.3rem;max-width:70ch">A chair or co-chair has proposed new leaders. Approving replaces the chapter’s leaders, sends its two email addresses to the new people, and marks the chapter renewed. Nothing changes until you approve.</p>' +
    list.map(function(ch){
      var c = chapters.find(function(x){ return x.id === ch.chapter; }) || {city: ch.chapter, st: ''};
      var sp = ch.leaders.filter(function(l){ return l.role === 'pastoral_sponsor'; })[0] || {};
      var fresh = sponsorIsNew(ch), away = fresh && (slug(sp.city || '') !== slug(c.city) || String(sp.st || '').toUpperCase() !== c.st);
      return '<section class="cluster ready"><div class="cluster-h"><div><h3>' + esc(c.city) + (c.st ? ', ' + esc(c.st) : '') + '</h3><p class="sub">Requested ' + fmt(ch.date, {month:'short', day:'numeric', year:'numeric'}) + (ch.by ? ' by ' + esc(ch.by) : '') + '</p></div></div>' +
        changeTable(ch) + (ch.note ? '<p style="margin-top:.6rem"><strong>Note from the chapter:</strong> ' + esc(ch.note) + '</p>' : '') +
        (fresh ? '<div class="panel" style="margin-top:.75rem;border-color:var(--red)"><p><strong>New pastoral sponsor.</strong> Confirm that ' + esc(sp.name || 'he') + ' is an active LCMS pastor serving in ' + esc(c.city) + ' (the <a href="https://locator.lcms.org/" target="_blank" rel="noopener noreferrer">LCMS locator</a> lists rostered pastors) and that he has agreed to sponsor.' + (away ? ' <span class="chip chip-late">Listed in ' + esc([sp.city, sp.st].filter(Boolean).join(', ') || 'another city') + ', not ' + esc(c.city) + '</span>' : '') + '</p>' +
          '<div class="checks"><label><input type="checkbox" id="lv-' + ch.id + '">I have confirmed him.</label></div></div>' : '') +
        '<div class="btn-row" style="margin-top:.75rem"><button type="button" class="btn btn-primary btn-sm" data-action="lcapprove" data-id="' + ch.id + '">Approve new leaders</button><button type="button" class="btn btn-line btn-sm al-danger" data-action="lcdecline" data-id="' + ch.id + '">Decline</button></div></section>';
    }).join('');
}

function chairPanel(c){
  if (!ui.chairEdit) return '';
  var B = ['Discord','GroupMe','Instagram'];
  var mine = events.filter(function(e){ return e.chapter === c.id && e.date >= iso(TODAY); }).sort(function(a, b){ return a.date.localeCompare(b.date); });
  return '<section class="panel" style="margin-top:2rem"><div><p class="eyebrow">Chair tools</p><h2 style="font-size:1.4rem;margin-top:.3rem">Edit the ' + esc(c.city) + ' page</h2><p class="hint" style="margin-top:.3rem">Signed in as ' + esc(WL.me().name || WL.me().email) + '. Changes appear on the public page right away. New chair, co-chair, or pastor? Use “Request a leader change” at the bottom. To change your city or school, write to <a href="mailto:help' + DOMAIN + '">help' + DOMAIN + '</a>.</p></div>' +
    '<form id="f-chair" class="form" novalidate><fieldset><legend>Page details</legend>' +
      '<label for="ce-meets">When and where you meet<input type="text" id="ce-meets" value="' + esc(c.meets) + '"></label>' +
      '<label for="ce-about">About the chapter<textarea id="ce-about">' + esc(c.about) + '</textarea></label>' +
      '<label for="ce-members">About how many people come <span class="hint">(a round number is fine; there is no membership roll)</span><input type="number" id="ce-members" min="0" max="999" value="' + esc(c.members) + '"></label>' +
      '<p class="hint">Where the chapter talks. Tick the ones you use.</p><div class="checks" role="group" aria-label="Where the chapter talks">' + B.map(function(b){ return '<label><input type="checkbox" name="ce-base" value="' + b + '"' + (c.bases.indexOf(b) >= 0 ? ' checked' : '') + '>' + b + '</label>'; }).join('') + '</div>' +
      '<label for="ce-text">Chapter text line <span class="hint">(optional, a free Google Voice number works; do not use a personal number)</span><input type="text" id="ce-text" value="' + esc(c.text) + '"></label>' +
      '<div><button class="btn btn-primary" type="submit">Save page changes</button></div></fieldset></form>' +
    '<form id="f-event" class="form" novalidate><fieldset><legend>Post an event or announcement</legend>' +
      '<label for="ev-title">Title<input type="text" id="ev-title" placeholder="Evening Prayer and supper"></label>' +
      '<div class="row2"><label for="ev-date">Date<input type="date" id="ev-date" min="' + iso(TODAY) + '"></label><label for="ev-time">Time<input type="text" id="ev-time" placeholder="7:00 pm"></label></div>' +
      '<label for="ev-place">Place <span class="hint">(for a private home, write "Address sent after RSVP")</span><input type="text" id="ev-place"></label>' +
      '<label for="ev-blurb">A sentence or two about it <span class="hint">(optional)</span><textarea id="ev-blurb"></textarea></label>' +
      '<label for="ev-kind">Type<select id="ev-kind"><option value="event">Event</option><option value="announcement">Announcement</option></select></label>' +
      '<div><button class="btn btn-line" type="submit">Post to the calendar</button></div></fieldset></form>' +
    '<div><h3>Your upcoming posts</h3>' + (mine.length ? '<ul class="al-log">' + mine.map(function(e){ return '<li><span class="sub">' + fmt(e.date, {month:'short', day:'numeric', year:'numeric'}) + (e.kind === 'announcement' ? ' · Announcement' : '') + '</span><span><a href="#event-' + e.id + '">' + esc(e.title) + '</a> <button type="button" class="btn btn-line btn-sm al-danger" data-action="evdel" data-id="' + e.id + '">Remove</button></span></li>'; }).join('') + '</ul>' : '<p class="sub" style="margin-top:.4rem">Nothing posted yet.</p>') + '</div>' +
    leaderSection(c) +
    '<div><button type="button" class="btn btn-line btn-sm" data-action="chairedit">Close chair tools</button></div></section>';
}

function chatLinks(c){
  if (!c.bases.length) return '<span class="sub">Ask the chairs.</span>';
  return c.bases.map(function(b){ return '<span class="chip">' + esc(b) + '</span>'; }).join('') + '<span class="sub">Ask the chairs for an invite.</span>';
}
function viewChapter(id){
  var c = chapters.find(function(x){ return x.id === id; });
  if (!c) return '<section class="wrap section"><h1>Chapter not found</h1><p class="lede"><a href="#chapters">Back to the directory</a></p></section>';
  var next = events.filter(function(e){ return e.chapter === c.id && (e.end || e.date) >= iso(TODAY); }).sort(function(a, b){ return a.date.localeCompare(b.date); });
  return '<section class="wrap section"><p class="crumb"><a href="#chapters">Chapters</a> / ' + esc(c.city) + '</p>' +
    '<div class="ch-head"><div><p class="eyebrow">' + esc(c.setting) + ' chapter</p><h1>' + esc(c.city) + ', ' + esc(c.st) + '</h1>' + (c.school ? '<p class="lede" style="margin-top:.4rem">' + esc(c.school) + '</p>' : '') + '</div>' + statusChip(c.status) + '</div>' +
    '<div class="ch-grid"><div>' +
      '<p style="font-size:1.125rem">' + esc(c.about) + '</p>' +
      '<dl class="facts"><dt>Meets</dt><dd>' + esc(c.meets || 'Time to be announced') + '</dd>' + (c.church ? '<dt>Usually at</dt><dd>' + esc(c.church) + '</dd>' : '') + (c.members ? '<dt>Who comes</dt><dd>About ' + c.members + ' young adults, ages 18 to 35. A member is whoever comes.</dd>' : '') + '<dt>Leaders</dt><dd>' + (c.chair ? esc(c.chair) + ', chair' : 'Chair to be named') + (c.cochair ? '<br>' + esc(c.cochair) + (c.cochair.indexOf(',') >= 0 ? ', co-chairs' : ', co-chair') : '') + '</dd><dt>Pastoral sponsor</dt><dd>' + esc(c.sponsor) + '</dd></dl>' +
      '<h3>Where the chapter talks</h3><div class="btn-row" style="margin-top:.6rem">' + chatLinks(c) + '</div>' +
      '<h3 style="margin-top:2rem">Coming up</h3>' + (next.length ? '<div class="ev-mini">' + next.map(function(e){ return '<div><b>' + fmt(e.date, {month:'short', day:'numeric'}) + '</b><span><a href="#event-' + e.id + '">' + esc(e.title) + '</a>' + (e.time ? ' <span class="sub">' + esc(e.time) + '</span>' : '') + '</span></div>'; }).join('') + '</div>' : '<p class="sub" style="margin-top:.4rem">Nothing posted yet.</p>') +
    '</div>' +
    '<aside class="stack"><div class="panel"><h3>Contact this chapter</h3><p class="hint">Messages go to the chairs. Their personal addresses stay private.</p>' +
      '<div class="addr"><code>' + esc(aliasOf(c)) + '</code>' + copyBtn(aliasOf(c)) + '</div>' +
      '<div class="addr"><code>' + esc(pastorAliasOf(c)) + '</code>' + copyBtn(pastorAliasOf(c)) + '</div>' +
      (c.text ? '<div class="addr"><code>' + esc(c.text) + '</code><span class="sub">chapter text line</span></div>' : '') +
      '<div class="btn-row" style="margin-top:.2rem"><button type="button" class="btn btn-primary" data-action="contact" data-kind="chair">Contact this chapter</button><button type="button" class="btn btn-line" data-action="contact" data-kind="pastor">Talk with the pastor</button></div></div>' +
      contactPanel(c) +
      (WL.isChairOf(c.id) ? '<div class="sub">You can edit this page. <button type="button" class="btn btn-line btn-sm" data-action="chairedit">Edit this page</button></div>' : '<div class="sub">Chair of this chapter? <a href="#signin">Sign in</a> to edit this page.</div>') + '</aside></div>' +
    chairPanel(c) + '</section>';
}

function eventsFiltered(){
  return events.filter(function(e){
    if (ui.evKind === 'Events' && e.kind !== 'event') return false;
    if (ui.evKind === 'Announcements' && e.kind !== 'announcement') return false;
    if (ui.evChapter !== 'All' && e.chapter !== ui.evChapter) return false;
    return true;
  }).sort(function(a, b){ return a.date.localeCompare(b.date); });
}
function viewEvent(id){
  var e = events.find(function(x){ return x.id === id; });
  if (!e) return '<section class="wrap section"><h1>Event not found</h1><p class="lede"><a href="#events">Back to the calendar</a></p></section>';
  var c = chapters.find(function(x){ return x.id === e.chapter; });
  var ann = e.kind === 'announcement';
  var long = {weekday:'long', month:'long', day:'numeric', year:'numeric'};
  var when = fmt(e.date, long) + (e.end ? ' to ' + fmt(e.end, long) : '');
  var addr = c ? aliasOf(c) : 'info' + DOMAIN;
  var going = ui.rsvp && ui.rsvp[e.id];
  var privateHome = /RSVP/.test(e.place || '');
  var side = '';
  if (!ann){
    side += going
      ? '<div class="panel ok-panel" role="status"><h3>You are on the list</h3><p>' + (privateHome ? 'The chairs will send you the address before the event.' : 'The chairs know to expect you.') + '</p></div>'
      : '<form class="panel" id="f-rsvp" data-id="' + e.id + '" novalidate><h3>Planning to come?</h3><p class="hint">' + (privateHome ? 'This one is in a private home, so the address is sent after you RSVP.' : 'Let the chairs know so they can plan for you.') + '</p><label for="rs-name">Your name<input type="text" id="rs-name" required></label><label for="rs-email">Your email<input type="email" id="rs-email" required></label><div><button type="submit" class="btn btn-primary">RSVP</button></div></form>';
  }
  side += '<div class="panel"><h3>Questions?</h3><p class="hint">' + (c ? 'Write to the ' + esc(c.city) + ' chairs.' : 'Write to the Walther League office.') + '</p><div class="addr"><code>' + esc(addr) + '</code>' + copyBtn(addr) + '</div>' + (c ? '<div><a class="btn btn-line btn-sm" href="#chapter-' + c.id + '">Open the ' + esc(c.city) + ' chapter page</a></div>' : '') + '</div>';
  var more = events.filter(function(x){ return x.id !== e.id && x.chapter === e.chapter && (x.end || x.date) >= iso(TODAY); }).sort(function(a, b){ return a.date.localeCompare(b.date); }).slice(0, 3);
  return '<section class="wrap section"><p class="crumb"><a href="#events">Events</a> / ' + esc(e.title) + '</p>' +
    '<div class="ch-head"><div><p class="eyebrow">' + (ann ? 'Announcement' : 'Event') + ' · ' + esc(chapterName(e.chapter)) + '</p><h1>' + esc(e.title) + '</h1></div>' + (ann ? '<span class="chip chip-late">Announcement</span>' : '') + '</div>' +
    '<div class="ch-grid"><div>' + (e.blurb ? '<p style="font-size:1.125rem">' + esc(e.blurb) + '</p>' : '') +
      '<dl class="facts"><dt>' + (ann ? 'Posted for' : 'Date') + '</dt><dd>' + when + '</dd>' + (e.time ? '<dt>Time</dt><dd>' + esc(e.time) + '</dd>' : '') + (e.place ? '<dt>Place</dt><dd>' + esc(e.place) + '</dd>' : '') + '<dt>' + (ann ? 'From' : 'Hosted by') + '</dt><dd>' + (c ? '<a href="#chapter-' + c.id + '">' + esc(c.city) + ', ' + esc(c.st) + ' chapter</a>' : 'The Walther League (network-wide)') + '</dd>' + (c ? '<dt>Pastoral sponsor</dt><dd>' + esc(c.sponsor) + '</dd>' : '') + '</dl>' +
      (more.length ? '<h3>More from ' + esc(chapterName(e.chapter)) + '</h3><div class="ev-mini">' + more.map(function(x){ return '<div><b>' + fmt(x.date, {month:'short', day:'numeric'}) + '</b><span><a href="#event-' + x.id + '">' + esc(x.title) + '</a></span></div>'; }).join('') + '</div>' : '') +
      '<p style="margin-top:2rem"><a href="#events">‹ Back to the calendar</a></p></div>' +
    '<aside class="stack">' + side + '</aside></div></section>';
}
function chapterName(id){
  if (id === 'network') return 'Network';
  var c = chapters.find(function(x){ return x.id === id; });
  return c ? c.city + ', ' + c.st : id;
}

function monthBounds(){
  var now = TODAY.getFullYear() * 12 + TODAY.getMonth(), lo = now, hi = now + 11;
  events.forEach(function(e){ var d = parse(e.end || e.date), k = d.getFullYear() * 12 + d.getMonth(); if (k > hi) hi = k; var f = parse(e.date), kf = f.getFullYear() * 12 + f.getMonth(); if (kf < lo) lo = kf; });
  return [lo, hi];
}
function viewEvents(){
  var y = ui.month.y, m = ui.month.m;
  var list = eventsFiltered();
  var first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = first.getDay();
  var cells = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(function(d){ cells += '<div class="dow">' + d + '</div>'; });
  for (var i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
  for (var d = 1; d <= days; d++){
    var key = y + '-' + pad(m + 1) + '-' + pad(d);
    var evs = list.filter(function(e){ return e.date <= key && (e.end || e.date) >= key; });
    cells += '<div class="cell ' + (key === iso(TODAY) ? 'today' : '') + '"><span class="d">' + d + '</span>' +
      evs.slice(0, 2).map(function(e){ return '<a class="ev ' + e.kind + '" href="#event-' + e.id + '" title="' + esc(e.title) + '">' + esc(e.title) + '</a><a class="pip ' + e.kind + '" href="#event-' + e.id + '" aria-label="' + esc(e.title) + '"></a>'; }).join('') +
      (evs.length > 2 ? '<span class="more">+' + (evs.length - 2) + ' more</span>' : '') + '</div>';
  }
  var monthKey = y + '-' + pad(m + 1);
  var inMonth = list.filter(function(e){ return e.date.slice(0, 7) === monthKey || (e.end && e.end.slice(0, 7) === monthKey); });
  var ann = events.filter(function(e){ return e.kind === 'announcement' && e.date >= iso(TODAY); }).sort(function(a, b){ return a.date.localeCompare(b.date); });
  var bnd = monthBounds(), atStart = y * 12 + m <= bnd[0], atEnd = y * 12 + m >= bnd[1];
  return '<section class="wrap section"><p class="eyebrow">Calendar</p><h1>Events and announcements</h1>' +
    '<p class="lede">Chapters post their gatherings here, and the office posts news for the whole network.</p>' +
    '<div class="ev-tools"><div class="seg" role="group" aria-label="Show">' + ['All','Events','Announcements'].map(function(k){ return '<button type="button" data-action="evkind" data-v="' + k + '" aria-pressed="' + (ui.evKind === k) + '">' + k + '</button>'; }).join('') + '</div>' +
    '<label for="evchapter" style="display:flex;align-items:center;gap:.5rem;font-weight:500">Chapter<select id="evchapter" style="width:auto"><option value="All">All chapters</option><option value="network"' + (ui.evChapter === 'network' ? ' selected' : '') + '>Network-wide</option>' + chapters.slice().sort(function(a, b){ return a.city.localeCompare(b.city); }).map(function(c){ return '<option value="' + c.id + '"' + (ui.evChapter === c.id ? ' selected' : '') + '>' + esc(c.city) + ', ' + esc(c.st) + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="ev-grid"><div>' +
      '<div class="cal-head"><h2>' + MONTHS[m] + ' ' + y + '</h2><div class="seg"><button type="button" data-action="evmonth" data-dir="-1" aria-label="Previous month"' + (atStart ? ' disabled' : '') + '>‹ Prev</button><button type="button" data-action="evmonth" data-dir="1" aria-label="Next month"' + (atEnd ? ' disabled' : '') + '>Next ›</button></div></div>' +
      '<div class="cal" role="group" aria-label="Month calendar">' + cells + '</div>' +
      '<div class="ev-list">' + (inMonth.length ? inMonth.map(function(e){
        return '<article class="ev-item"><div class="ev-date"><b>' + parse(e.date).getDate() + '</b><span>' + fmt(e.date, {weekday:'short'}) + (e.end ? ' to ' + fmt(e.end, {weekday:'short'}) : '') + '</span></div><div><h3><a href="#event-' + e.id + '">' + esc(e.title) + '</a> ' + (e.kind === 'announcement' ? '<span class="chip chip-late">Announcement</span>' : '') + '</h3>' +
          '<p>' + (e.chapter === 'network' ? 'Network-wide' : '<a href="#chapter-' + e.chapter + '">' + esc(chapterName(e.chapter)) + '</a>') + (e.time ? ' · ' + esc(e.time) : '') + (e.place ? ' · ' + esc(e.place) : '') + '</p><p>' + esc(e.blurb) + '</p></div></article>';
      }).join('') : '<p class="empty">Nothing posted for ' + MONTHS[m] + ' yet. Chairs can add events from their chapter page.</p>') + '</div>' +
    '</div><aside class="ann"><h3>Announcements</h3>' + ann.map(function(e){ return '<article><p class="sub">' + fmt(e.date, {month:'short', day:'numeric', year:'numeric'}) + ' · ' + esc(chapterName(e.chapter)) + '</p><h3 style="margin:.15rem 0"><a href="#event-' + e.id + '">' + esc(e.title) + '</a></h3><p class="sub">' + esc(e.blurb) + '</p></article>'; }).join('') + '</aside></div></section>';
}

function appSlug(a){ return String((a.setting === 'Campus' && a.school) ? a.school : a.city).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function viewStart(){
  var steps = [
    ['Read the charter.', 'It is short: what every chapter confesses and what it agrees to. You will find it in the application.'],
    ['Gather your group.', 'Reach out to young adults, ages 18 to 35, in your congregation and the ones around it. Pick a chair and at least one co-chair.'],
    ['Ask a pastor.', 'Get a commitment from an active LCMS pastor in your city to be the chapter’s pastoral sponsor. He does not have to serve the congregation where you meet.'],
    ['Pick a name and a place.', 'Chapters belong to a campus or a city, not to one congregation. Rotate among the LCMS congregations in your area, meet in homes, or be creative.'],
    ['Hold a first meeting, then apply.', 'Iron out the details together, then fill out the form on this page. It takes about ten minutes.'],
    ['We confirm and approve.', 'The League office confirms your pastor and the people recommending your chair and co-chair, then approves the chapter, and your page goes live.']
  ];
  function recs(p){
    return '<p class="hint">Two recommendations. We contact both to confirm.</p>' +
      '<div class="row2"><label for="ap-' + p + 'rn">Your pastor\'s name<input type="text" id="ap-' + p + 'rn" required></label><label for="ap-' + p + 're">His email<input type="email" id="ap-' + p + 're" required></label><label for="ap-' + p + 'rp">His phone<input type="text" id="ap-' + p + 'rp"></label></div>' +
      '<div class="row2"><label for="ap-' + p + 'mn">A member of your congregation<input type="text" id="ap-' + p + 'mn" required></label><label for="ap-' + p + 'me">Their email<input type="email" id="ap-' + p + 'me" required></label><label for="ap-' + p + 'mp">Their phone<input type="text" id="ap-' + p + 'mp"></label></div>' +
      '<p class="hint">The member should be able to speak to your church attendance, character, and maturity.</p>' +
      '<div class="checks"><label><input type="checkbox" id="ap-' + p + 'a" required>I am an LCMS Lutheran, faithful in church and Bible class, and in good standing in my congregation.</label></div>';
  }
  var left = '<div><h2>How it works</h2><ol class="steps" style="margin-top:1.25rem">' + steps.map(function(s){ return '<li><div><h3>' + s[0] + '</h3><p>' + s[1] + '</p></div></li>'; }).join('') + '</ol>' +
    '<h3 style="margin-top:2rem">What your chapter gets</h3><ul class="gets"><li>A page in the directory and a pin on the map</li><li>Addresses such as <code>yourcity' + DOMAIN + '</code> for the chairs and <code>yourcitypastor' + DOMAIN + '</code> for your sponsor</li><li>A place on the shared calendar</li><li>A listing for the chat platforms you already use</li><li>Help from the office whenever you ask, at <a href="#support">help and support</a></li></ul>' +
    '<h3 style="margin-top:2rem">What your leaders take on</h3>' +
    '<div class="resp"><h4>Chair</h4><ul class="gets"><li>Head coordinator for the chapter’s activities. More like a social planner or event coordinator than a teaching or formal office.</li><li>Renews the chapter’s charter and leader information with the League every September 1.</li><li>Is the contact person other chapters can reach.</li><li>Keeps the chapter page and its events current.</li></ul>' +
    '<h4>Co-chair</h4><ul class="gets"><li>Helps the chair in whatever areas the chapter assigns or elects, from “Head of Snacks” to the chapter newsletter.</li></ul>' +
    '<h4>Pastoral sponsor</h4><ul class="gets"><li>An active LCMS pastor in the chapter’s city, who can be physically present. He need not serve the congregation where the chapter meets.</li><li>Gives his contact information to the chair and to the League.</li><li>Comes to as many events as he can, encourages the chapter, and prays for it.</li><li>Helps the chapter find or create doctrinally sound Bible studies.</li></ul></div>' +
    '<h3 style="margin-top:2rem">Once you are approved</h3><ul class="gets"><li>Post your events and gatherings so young adults nearby can join you.</li><li>Meet at least once a quarter.</li><li>Each chapter decides how it chooses its chair after the first one. Just tell the League when it changes.</li><li>Renew every September 1, when leadership changes over: confirm your chair, co-chair, and pastor with the League.</li></ul>' +
    '<h3 style="margin-top:2rem">Not ready to apply?</h3><p style="margin-top:.4rem">If you are still looking for others, <a href="#interest">add your city to the interest map</a>. When several people gather in one place, the office connects them.</p></div>';
  var right;
  if (ui.applied){
    var a = ui.applied;
    right = '<div class="panel ok-panel" role="status"><p class="eyebrow">Application received</p><h2 style="font-size:1.5rem">Thank you, ' + esc(a.chair.split(' ')[0]) + '.</h2>' +
      '<p>The application for ' + esc(a.city) + ', ' + esc(a.st) + ' is now with the League office. We will write to you at <strong>' + esc(a.chairEmail) + '</strong>.</p>' +
      '<ol class="steps"><li><div><h3>Your pastor is confirmed</h3><p>We confirm that ' + esc(a.sponsor) + ' is an active LCMS pastor in ' + esc(a.sponsorCity || a.city) + ' and has agreed to sponsor the chapter.</p></div></li><li><div><h3>Recommendations confirmed</h3><p>We contact the pastors and congregation members you named for your chair and co-chair.</p></div></li><li><div><h3>Approval</h3><p>The League office approves the chapter.</p></div></li><li><div><h3>Your chapter goes live</h3><p>Your page appears in the directory, with addresses such as <code>' + esc(appSlug(a)) + DOMAIN + '</code> and <code>' + esc(appSlug(a)) + 'pastor' + DOMAIN + '</code>.</p></div></li></ol>' +
      '<div class="btn-row" style="margin-top:0"><a class="btn btn-primary" href="#home">Back to the home page</a><button type="button" class="btn btn-line" data-action="startover">Start another application</button></div></div>';
  } else {
    right = '<form id="f-apply" class="form"><fieldset><legend>Your chapter</legend>' +
      '<div class="row2"><label for="ap-city">City<input type="text" id="ap-city" required placeholder="Omaha"></label><label for="ap-st">State <span class="hint">(2 letters)</span><input type="text" id="ap-st" required maxlength="2" pattern="[A-Za-z]{2}" placeholder="NE"></label></div>' +
      '<div class="checks" role="radiogroup" aria-label="Setting"><label><input type="radio" name="ap-setting" value="City" checked>City</label><label><input type="radio" name="ap-setting" value="Campus">Campus</label></div>' +
      '<p class="hint">Chapters are organized by campus or by city. A chapter is not tied to a single congregation.</p>' +
      '<label for="ap-school">School <span class="hint">(campus chapters only)</span><input type="text" id="ap-school"></label>' +
      '<div class="alias-prev" id="alias-prev" aria-live="polite">Your chapter address would be <code>yourcity' + DOMAIN + '</code></div>' +
      '<label for="ap-name">Chapter name<input type="text" id="ap-name" required placeholder="Omaha Walther League"><span class="hint">Use your campus or city. No personal or congregation names.</span></label>' +
      '<label for="ap-church">Where you plan to meet <span class="hint">(optional: a congregation, a campus building, homes)</span><input type="text" id="ap-church"></label></fieldset>' +
      '<fieldset><legend>Chair</legend><div class="row2"><label for="ap-cf">First name<input type="text" id="ap-cf" required></label><label for="ap-cl">Last name<input type="text" id="ap-cl" required></label></div><div class="row2"><label for="ap-ce">Email<input type="email" id="ap-ce" required></label><label for="ap-cp">Phone<input type="text" id="ap-cp"></label></div><label for="ap-cad">Mailing address<input type="text" id="ap-cad"></label>' + recs('c') + '</fieldset>' +
      '<fieldset><legend>Co-chair</legend><div class="row2"><label for="ap-of">First name<input type="text" id="ap-of" required></label><label for="ap-ol">Last name<input type="text" id="ap-ol" required></label></div><div class="row2"><label for="ap-oe">Email<input type="email" id="ap-oe" required></label><label for="ap-op">Phone<input type="text" id="ap-op"></label></div><label for="ap-oad">Mailing address<input type="text" id="ap-oad"></label>' + recs('o') + '<p class="hint">You can add more co-chairs after your chapter is approved.</p></fieldset>' +
      '<fieldset><legend>Pastoral sponsor</legend><p class="hint">Every chapter needs an active LCMS pastor in its city as pastoral sponsor. He does not have to serve the congregation where you meet. The office confirms him before the chapter is approved. No pastor yet? Write to <a href="mailto:help' + DOMAIN + '">help' + DOMAIN + '</a> and we will help you find one.</p>' +
      '<div class="row2"><label for="ap-pn">Pastor\'s name<input type="text" id="ap-pn" required></label><label for="ap-pe">Pastor\'s email<input type="email" id="ap-pe" required></label></div>' +
      '<label for="ap-pc">The congregation he serves<input type="text" id="ap-pc" required></label>' +
      '<div class="row2"><label for="ap-pcity">Congregation\'s city<input type="text" id="ap-pcity" required></label><label for="ap-pst">State <span class="hint">(2 letters)</span><input type="text" id="ap-pst" required maxlength="2" pattern="[A-Za-z]{2}"></label></div>' +
      '<div class="row2"><label for="ap-pp">Pastor\'s phone<input type="text" id="ap-pp"></label><label for="ap-pad">Pastor\'s mailing address<input type="text" id="ap-pad"></label></div>' +
      '<div class="checks"><label><input type="checkbox" id="ap-pa" required>He has agreed to sponsor the chapter: to come to as many events as he can, to encourage and pray for us, and to help us find sound Bible studies.</label></div></fieldset>' +
      '<fieldset><legend>Where you will talk</legend><div class="checks" role="group" aria-label="Where you will talk"><label><input type="checkbox" name="ap-base" value="Discord">Discord</label><label><input type="checkbox" name="ap-base" value="GroupMe">GroupMe</label><label><input type="checkbox" name="ap-base" value="Instagram">Instagram</label></div>' +
      '<label for="ap-size">How many people do you expect in the first year?<select id="ap-size"><option>5 to 10</option><option>11 to 25</option><option>26 or more</option></select></label>' +
      '<label for="ap-why">Why here, and why now?<textarea id="ap-why"></textarea></label>' +
      '</fieldset><fieldset><legend>The chapter charter</legend>' + charterHTML() +
      '<div class="checks"><label><input type="checkbox" id="ap-ages" required>Our chapter is for young adults, ages 18 to 35.</label><label><input type="checkbox" id="ap-agree" required>Our chapter confesses this faith and agrees to this charter.</label></div></fieldset>' +
      '<div><button class="btn btn-primary" type="submit">Submit application</button><p class="hint" style="margin-top:.7rem">Stuck on something? Write to <a href="mailto:help' + DOMAIN + '">help' + DOMAIN + '</a> and we will help you finish.</p></div></form>';
  }
  return '<section class="wrap section"><p class="eyebrow">Start a chapter</p><h1>Bring the League to your campus or city.</h1><p class="lede">Six steps, from reading the charter to seeing your chapter on the map.</p><p class="addr" style="margin-top:.9rem">Questions along the way? Write to <a href="mailto:help' + DOMAIN + '"><code>help' + DOMAIN + '</code></a>' + copyBtn('help' + DOMAIN) + '</p><div class="start-grid">' + left + '<div>' + right + '</div></div></section>';
}

/* ---------- interest map ---------- */
function viewInterest(){
  var total = interestSpots.reduce(function(n, s){ return n + s.people; }, 0);
  var places = interestSpots.slice().sort(function(a, b){ return b.people - a.people || a.city.localeCompare(b.city); });
  var list = places.length
    ? '<ul class="spot-list">' + places.slice(0, 12).map(function(s){ return '<li><span><strong>' + esc(s.city) + ', ' + esc(s.st) + '</strong>' + (s.setting === 'Campus' ? ' <span class="sub">' + esc(s.school || 'Campus') + '</span>' : '') + '</span><span>' + (s.people >= CLUSTER_MIN ? '<span class="chip chip-active">Gathering</span> ' : '') + s.people + (s.people === 1 ? ' person' : ' people') + '</span></li>'; }).join('') + '</ul>' + (places.length > 12 ? '<p class="sub">And ' + (places.length - 12) + ' more places.</p>' : '')
    : '<p class="empty">No one is on the map yet. Be the first to mark your city.</p>';
  var right;
  if (ui.interestSent){
    var d = ui.interestSent, near = chapters.filter(function(c){ return c.published && c.st === d.st && slug(c.city) === slug(d.city); })[0];
    right = '<div class="panel ok-panel" role="status"><p class="eyebrow">You are on the map</p><h2 style="font-size:1.5rem">Thank you, ' + esc(d.name.split(' ')[0]) + '.</h2>' +
      '<p>We have you down for ' + esc(d.city) + ', ' + esc(d.st) + '. When several people gather there, Hanna at the League office will introduce you to one another and invite you to apply for a chapter.</p>' +
      (d.placed ? '' : '<p class="sub">We could not place ' + esc(d.city) + ' on the map automatically. The office has your entry and will place it by hand.</p>') +
      (near ? '<p>There is already a chapter in ' + esc(near.city) + '. <a href="#chapter-' + near.id + '">Open its page</a> and say hello.</p>' : '') +
      '<div class="btn-row" style="margin-top:0"><a class="btn btn-primary" href="#chapters">See the chapter directory</a><a class="btn btn-line" href="#start">How to start a chapter</a></div></div>';
  } else {
    right = '<form id="f-interest" class="form"><fieldset><legend>Put yourself on the map</legend>' +
      '<p class="hint">Your name and email go only to the League office. The public map shows your city and a head count, nothing else.</p>' +
      '<div class="row2"><label for="in-name">Your name<input type="text" id="in-name" required maxlength="200" autocomplete="name"></label><label for="in-email">Your email<input type="email" id="in-email" required maxlength="320" autocomplete="email"></label></div>' +
      '<div class="row2"><label for="in-city">City<input type="text" id="in-city" required placeholder="Omaha"></label><label for="in-st">State <span class="hint">(2 letters)</span><input type="text" id="in-st" required maxlength="2" pattern="[A-Za-z]{2}" placeholder="NE"></label></div>' +
      '<div class="checks" role="radiogroup" aria-label="What kind of chapter"><label><input type="radio" name="in-setting" value="City" checked>A city chapter</label><label><input type="radio" name="in-setting" value="Campus">A campus chapter</label></div>' +
      '<label for="in-school">School <span class="hint">(campus chapters only)</span><input type="text" id="in-school"></label>' +
      '<label for="in-note">Anything we should know? <span class="hint">(optional)</span><textarea id="in-note" maxlength="2000" placeholder="Your congregation, friends who would come, when you could meet"></textarea></label>' +
      '<div class="checks"><label><input type="checkbox" id="in-age" required>I am between 18 and 35.</label></div>' +
      '<div><button class="btn btn-primary" type="submit">Add me to the map</button></div></fieldset></form>';
  }
  return '<section class="wrap section"><p class="eyebrow">Interest map</p><h1>Want a Walther League where you live?</h1>' +
    '<p class="lede">Mark your city. When several young adults gather in one place, the League office connects them and invites them to start a chapter.</p>' +
    '<div class="ch-grid" style="margin-top:1.5rem"><div><div class="mapbox">' + interestMapSVG() +
      '<div class="legend"><span><i class="dot-g"></i>People asking for a chapter' + (total ? ' (' + total + ' so far)' : '') + '</span><span><i class="dot-f"></i>Chapters today</span></div></div>' +
      '<h3 style="margin-top:1.5rem">Where people are asking</h3>' + list +
      '<p class="sub" style="margin-top:1rem">Already have a co-chair and a pastor? Skip ahead and <a href="#start">start a chapter</a>.</p></div>' +
    '<aside class="stack">' + right + '</aside></div></section>';
}

/* ---------- admin ---------- */
function relTime(h){ if (h < 1) return 'Just now'; if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago'; var d = Math.floor(h / 24); return d + ' day' + (d === 1 ? '' : 's') + ' ago'; }
function median(a){ if (!a.length) return null; var s = a.slice().sort(function(x, y){ return x - y; }), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function weeklyCounts(){
  /* eight weeks, oldest first; the last bar is this week so far (weeks start on Monday) */
  var start = new Date(TODAY); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  var weeks = [], i;
  for (i = 7; i >= 0; i--){ var d = new Date(start); d.setDate(d.getDate() - 7 * i); weeks.push({d: d, n: 0}); }
  inquiries.forEach(function(q){
    var t = new Date(q.at); t.setHours(0, 0, 0, 0);
    for (var k = weeks.length - 1; k >= 0; k--){ if (t >= weeks[k].d){ weeks[k].n++; break; } }
  });
  return weeks;
}
function barChart(){
  var wk = weeklyCounts(), top = Math.max.apply(null, wk.map(function(w){ return w.n; })), max = Math.max(4, Math.ceil(top / 2) * 2);
  var W = 560, H = 176, pl = 26, pb = 28, pt = 20, bw = 40, n = wk.length, gap = (W - pl - n * bw) / n, ph = H - pt - pb;
  var out = '<svg class="bars" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="New inquiries per week for the last eight weeks">';
  [0, max / 2, max].forEach(function(v){ var y = pt + ph * (1 - v / max); out += '<line x1="' + pl + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + v + '</text>'; });
  wk.forEach(function(w, i){
    var x = pl + i * (bw + gap) + gap / 2, h = ph * w.n / max, y = pt + ph - h, last = i === n - 1;
    out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" rx="3" fill="' + (last ? 'var(--red)' : 'var(--accent)') + '"/>' +
      '<text class="v" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle">' + w.n + '</text>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + MONTHS[w.d.getMonth()].slice(0, 3) + ' ' + w.d.getDate() + '</text>';
  });
  return out + '</svg>';
}

function sameCity(a){ return slug(a.sponsorCity) === slug(a.city) && String(a.sponsorSt || '').toUpperCase() === a.st; }
function openInterests(){ return interests.filter(function(i){ return i.status === 'New' || i.status === 'Contacted'; }); }
/* people grouped by place, biggest open group first */
function interestGroups(){
  var by = {};
  interests.forEach(function(i){
    var k = slug(i.city) + '|' + i.st;
    (by[k] = by[k] || {key: k, city: i.city, st: i.st, people: []}).people.push(i);
  });
  return Object.keys(by).map(function(k){
    var g = by[k]; g.open = g.people.filter(function(i){ return i.status === 'New' || i.status === 'Contacted'; });
    g.chapter = chapters.filter(function(c){ return c.st === g.st && slug(c.city) === slug(g.city); })[0] || null;
    return g;
  }).sort(function(a, b){ return b.open.length - a.open.length || b.people.length - a.people.length || a.city.localeCompare(b.city); });
}

function appRow(a){
  var d = a.details || {};
  var pips = '<span class="pips" aria-hidden="true">' + STAGES.map(function(s, i){ return '<i class="' + (i <= a.stage ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  var rec = function(p, who){
    var line = function(n, e, ph){ return (n || e || ph) ? esc(n || 'No name') + (e ? ', ' + esc(e) : '') + (ph ? ', ' + esc(ph) : '') : 'Not given'; };
    return '<p><strong>' + esc(who) + '</strong>' + (d[p + 'p'] ? ' · ' + esc(d[p + 'p']) : '') + (d[p + 'ad'] ? '<br>' + esc(d[p + 'ad']) : '') +
      '<br>Recommended by his or her pastor: ' + line(d[p + 'rn'], d[p + 're'], d[p + 'rp']) + '<br>Recommended by a member: ' + line(d[p + 'mn'], d[p + 'me'], d[p + 'mp']) + '</p>';
  };
  var more = '<details class="app-more"><summary>Full application</summary>' +
    (d.chapterName ? '<p><strong>Chapter name</strong><br>' + esc(d.chapterName) + '</p>' : '') +
    rec('c', 'Chair: ' + a.chair + ', ' + a.chairEmail) + rec('o', 'Co-chair: ' + a.cochair + ', ' + a.cochairEmail) +
    '<p><strong>Pastoral sponsor: ' + esc(a.sponsor) + '</strong>' + (d.pp ? ' · ' + esc(d.pp) : '') + '<br>' + esc(a.sponsorEmail) + (d.pad ? '<br>' + esc(d.pad) : '') + '</p>' +
    (a.church ? '<p><strong>Plans to meet at</strong><br>' + esc(a.church) + '</p>' : '') +
    (a.bases.length ? '<p><strong>Talks on</strong><br>' + esc(a.bases.join(', ')) + '</p>' : '') +
    (d.expectedSize ? '<p><strong>Expected size</strong><br>' + esc(d.expectedSize) + '</p>' : '') +
    (a.why ? '<p><strong>Why here, why now</strong><br>' + esc(a.why) + '</p>' : '') + '</details>';
  var pastor = '<div class="sub" style="margin-top:.35rem">' + esc(a.sponsor) + (a.sponsorChurch ? ', ' + esc(a.sponsorChurch) : '') + (a.sponsorCity ? ', ' + esc(a.sponsorCity) + (a.sponsorSt ? ', ' + esc(a.sponsorSt) : '') : '') + '</div>' +
    '<div style="margin-top:.25rem">' + (a.verified ? '<span class="chip chip-ok">Pastor verified</span>' : '<span class="chip chip-late">Pastor not verified</span>') +
    (sameCity(a) ? '' : ' <span class="chip chip-late">Pastor is not in ' + esc(a.city) + '</span>') + '</div>';
  var next;
  if (!a.verified){
    next = '<button type="button" class="btn btn-primary btn-sm" data-action="appverify" data-id="' + esc(a.id) + '">Mark pastor verified</button>' +
      '<div class="sub" style="margin-top:.35rem">First confirm he is an active LCMS pastor serving in ' + esc(a.city) + ' (the <a href="https://locator.lcms.org/" target="_blank" rel="noopener noreferrer">LCMS locator</a> lists rostered pastors) and that he has agreed to sponsor.</div>';
  } else if (a.stage <= 1){
    next = '<button type="button" class="btn btn-line btn-sm" data-action="adv" data-id="' + esc(a.id) + '">Mark recommendations confirmed</button><div class="sub" style="margin-top:.35rem">Four people to contact. They are listed under Full application.</div>';
  } else if (a.stage === 2){
    next = '<button type="button" class="btn btn-line btn-sm" data-action="adv" data-id="' + esc(a.id) + '">Approve chapter</button>';
  } else {
    var s = appSlug(a), taken = chapters.some(function(c){ return c.id === s; }) || aliases.some(function(x){ return x.local === s || x.local === s + 'pastor'; });
    if (taken) s = s + a.st.toLowerCase();
    next = '<form class="f-publish stack" data-form="publish" data-id="' + esc(a.id) + '" novalidate><label>Chapter address<span class="al-in"><input type="text" name="slug" value="' + esc(s) + '" autocomplete="off" spellcheck="false"><span class="mono">' + DOMAIN + '</span></span></label>' +
      '<div><button type="submit" class="btn btn-primary btn-sm">Publish chapter</button></div><div class="sub">Creates the chapter page, this address for the chairs, and the same address ending in <code>pastor</code> for the sponsor.</div></form>';
  }
  return '<tr><td><span class="mono">' + esc(a.id) + '</span></td><td><strong>' + esc(a.city) + ', ' + esc(a.st) + '</strong><div class="sub">' + esc(a.setting) + (a.school ? ' · ' + esc(a.school) : '') + '</div>' + more + '</td>' +
    '<td>' + esc(a.chair) + ', ' + esc(a.cochair) + pastor + '</td>' +
    '<td>' + fmt(a.date, {month:'short', day:'numeric'}) + '<div class="sub">' + a.daysAgo + ' day' + (a.daysAgo === 1 ? '' : 's') + ' ago</div></td>' +
    '<td>' + pips + '<span class="sub">' + STAGES[a.stage] + '</span></td>' +
    '<td>' + next + '</td></tr>';
}

function adminOverview(){
  var active = chapters.filter(function(c){ return c.status === 'Active'; }).length;
  var forming = chapters.filter(function(c){ return c.status === 'Forming'; }).length;
  var open = inquiries.filter(function(q){ return !q.answered; });
  var late = open.filter(function(q){ return q.hoursAgo >= 48; }).length;
  var med = median(applications.map(function(a){ return a.daysAgo; }));
  var counts = STAGES.map(function(s, i){ return applications.filter(function(a){ return a.stage === i; }).length; });
  var due = chapters.filter(function(c){ return !renewal(c).current; }).length;
  var ready = interestGroups().filter(function(g){ return g.open.length >= CLUSTER_MIN && !g.chapter; }).length;
  var rows = applications.slice().sort(function(a, b){ return b.daysAgo - a.daysAgo; }).map(appRow).join('');
  return '<div class="metrics">' +
    '<div class="metric"><b>' + active + '</b><span>Active chapters</span></div>' +
    '<div class="metric"><b>' + forming + '</b><span>Chapters forming</span></div>' +
    '<div class="metric"><b>' + applications.length + '</b><span>Applications in review</span></div>' +
    '<div class="metric"><b>' + (med == null ? '–' : med) + '</b><span>Median days in review</span></div>' +
    '<div class="metric ' + (late ? 'warn' : '') + '"><b>' + open.length + '</b><span>Messages waiting' + (late ? ', ' + late + ' over 48 hours' : '') + '</span></div>' +
    '<div class="metric ' + (ready ? 'warn' : '') + '"><b>' + openInterests().length + '</b><span>On the interest map' + (ready ? ', ' + ready + (ready === 1 ? ' place' : ' places') + ' ready to connect' : '') + '</span></div>' +
    '<div class="metric ' + (due ? 'warn' : '') + '"><b>' + due + '</b><span>Renewals due</span></div>' +
    '<div class="metric ' + (pendingChanges().length ? 'warn' : '') + '"><b>' + pendingChanges().length + '</b><span>Leader changes to review</span></div></div>' +
    '<h2 style="margin-top:2.25rem;font-size:1.4rem">Applications in progress</h2>' +
    '<p class="sub" style="margin-top:.3rem;max-width:70ch">A chapter can be published only after its pastor is verified, its recommendations are confirmed, and it is approved.</p>' +
    '<div class="pipe">' + STAGES.map(function(s, i){ return '<div><b>' + counts[i] + '</b><span>' + s + '</span></div>'; }).join('') + '</div>' +
    (applications.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Ref</th><th>Chapter</th><th>People</th><th>Received</th><th>Progress</th><th>Next step</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">No applications waiting.</p>') +
    '<h2 style="margin-top:2.25rem;font-size:1.4rem">New inquiries per week</h2><p class="sub" style="margin:.3rem 0 .6rem">The red bar is this week so far.</p>' + barChart();
}

function adminInquiries(){
  var rows = inquiries.slice().sort(function(a, b){ if (a.answered !== b.answered) return a.answered ? 1 : -1; return b.hoursAgo - a.hoursAgo; }).map(function(q){
    var late = !q.answered && q.hoursAgo >= 48;
    return '<tr><td>' + relTime(q.hoursAgo) + (late ? '<div><span class="chip chip-late">Over 48 hours</span></div>' : '') + '</td><td>' + esc(q.from) + '<div class="sub">' + esc(q.fromEmail || '') + '</div></td><td><code>' + esc(q.to) + '</code><div class="sub">' + esc(q.about) + '</div></td><td>' + esc(q.note) + '</td>' +
      '<td>' + (q.answered ? '<span class="chip chip-ok">Answered</span>' : '<button type="button" class="btn btn-line btn-sm" data-action="inq" data-id="' + q.id + '">Mark answered</button>') + '</td></tr>';
  }).join('');
  return '<h2 style="margin-top:1.5rem;font-size:1.4rem">Inquiry log</h2><p class="sub" style="margin-top:.3rem">Every message sent through a chapter page lands here, so nothing sits unanswered past 48 hours.</p><div class="scroll"><table class="tbl"><thead><tr><th>Received</th><th>From</th><th>Sent to</th><th>Message</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function alTable(){
  var q = (ui.alQ || '').trim().toLowerCase();
  var list = aliases.filter(function(a){ return !q || (a.local + ' ' + a.to.join(' ') + ' ' + aliasLabel(a)).toLowerCase().indexOf(q) >= 0; }).sort(function(x, y){ return x.local.localeCompare(y.local); });
  if (!list.length) return '<p class="empty">No address matches that search.</p>';
  var rows = list.map(function(a){
    var addr = a.local + DOMAIN;
    if (ui.alEdit === a.id){
      var del = ui.alDel === a.id
        ? '<div class="panel" style="border-color:var(--red)"><p><strong>Delete ' + esc(addr) + '?</strong> Mail sent to it will bounce' + (a.kind !== 'general' ? ', and the chapter page will fall back to the standard address' : '') + '.</p><div class="btn-row" style="margin-top:0"><button type="button" class="btn btn-primary btn-sm" data-action="aldelyes" data-id="' + a.id + '">Delete address</button><button type="button" class="btn btn-line btn-sm" data-action="aldelno">Keep it</button></div></div>'
        : '';
      return '<tr class="al-editing"><td colspan="4"><form id="f-alias-edit" data-id="' + a.id + '" class="stack" novalidate><h3>Edit ' + esc(addr) + '</h3>' +
        '<div class="row2"><label for="al-local">Address<span class="al-in"><input type="text" id="al-local" value="' + esc(a.local) + '" autocomplete="off"><span class="mono">' + DOMAIN + '</span></span>' + (a.kind !== 'general' ? '<span class="hint">Changing this changes the address shown on the chapter page.</span>' : '') + '</label>' +
        '<label for="al-to">Forwards to <span class="hint">(one email per line)</span><textarea id="al-to" spellcheck="false">' + esc(a.to.join('\n')) + '</textarea></label></div>' +
        '<div class="btn-row" style="margin-top:0"><button class="btn btn-primary btn-sm" type="submit">Save changes</button><button type="button" class="btn btn-line btn-sm" data-action="alcancel">Cancel</button><button type="button" class="btn btn-line btn-sm al-danger" data-action="aldel" data-id="' + a.id + '">Delete address</button></div>' + del + '</form></td></tr>';
    }
    return '<tr><td><code>' + esc(addr) + '</code><div class="sub">' + esc(aliasLabel(a)) + '</div></td>' +
      '<td>' + a.to.map(function(t, i){ return '<span class="al-chip">' + esc(t) + '<button type="button" data-action="alrm" data-id="' + a.id + '" data-i="' + i + '" aria-label="Remove ' + esc(t) + ' from ' + esc(addr) + '">×</button></span>'; }).join('') + '</td>' +
      '<td>' + (a.active ? '<span class="chip chip-ok">Forwarding</span>' : '<span class="chip chip-late">Paused</span>') + '</td>' +
      '<td><div class="al-acts"><button type="button" class="btn btn-line btn-sm" data-action="aledit" data-id="' + a.id + '">Edit</button><button type="button" class="btn btn-line btn-sm" data-action="alpause" data-id="' + a.id + '">' + (a.active ? 'Pause' : 'Resume') + '</button></div></td></tr>';
  }).join('');
  return '<div class="scroll"><table class="tbl"><thead><tr><th>Address</th><th>Forwards to</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function adminAliases(){
  var active = aliases.filter(function(a){ return a.active; }).length;
  return '<h2 style="margin-top:1.5rem;font-size:1.4rem">Email forwarding</h2>' +
    '<p class="sub" style="margin-top:.3rem;max-width:70ch">Every League address forwards to the people listed beside it. When a chair or pastor changes, change the recipients here. The public address stays the same, and no one’s personal email appears on the site. ' + aliases.length + ' addresses, ' + active + ' forwarding.</p>' +
    '<form id="f-alias-new" class="panel" style="margin-top:1rem" novalidate><h3>Add an address</h3><div class="row2"><label for="an-local">Address<span class="al-in"><input type="text" id="an-local" placeholder="conference" autocomplete="off"><span class="mono">' + DOMAIN + '</span></span></label><label for="an-to">Forwards to <span class="hint">(separate emails with commas)</span><input type="text" id="an-to" placeholder="name@example.com"></label></div><div><button class="btn btn-primary btn-sm" type="submit">Add address</button></div></form>' +
    '<label for="al-q" class="search" style="margin-top:1.25rem"><span class="hint">Search addresses, chapters, or recipients</span><input type="search" id="al-q" value="' + esc(ui.alQ || '') + '" autocomplete="off"></label>' +
    '<div id="al-table" style="margin-top:.75rem">' + alTable() + '</div>' +
    '<h2 style="margin-top:2.25rem;font-size:1.4rem">Recent changes</h2><ul class="al-log">' + changes.slice(0, 8).map(function(c){ return '<li><span class="sub">' + esc(c.when) + ' · ' + esc(c.who) + '</span><span>' + esc(c.text) + '</span></li>'; }).join('') + '</ul>';
}

/* Chapters renew every September 1, when leadership changes over. A chapter is current
   once the office has marked it renewed on or after the most recent September 1. */
function renewal(c){
  var y = TODAY.getFullYear(), sep = new Date(y, 8, 1);
  var cycle = TODAY >= sep ? sep : new Date(y - 1, 8, 1);
  var next = new Date(cycle.getFullYear() + 1, 8, 1);
  var current = !!c.renewed && parse(c.renewed) >= cycle;
  return {current: current, cycle: cycle, next: next, daysToNext: Math.round((next - TODAY) / 86400000)};
}
function adminChapters(){
  var rows = chapters.slice().sort(function(a, b){ return a.city.localeCompare(b.city); }).map(function(c){
    var r = renewal(c);
    var flag = !r.current ? '<span class="chip chip-late">Renewal due since Sep 1, ' + r.cycle.getFullYear() + '</span>'
      : r.daysToNext <= 30 ? '<span class="chip chip-forming">Renews Sep 1, in ' + r.daysToNext + ' days</span>' : '<span class="chip chip-ok">Current</span>';
    return '<tr><td><a href="#chapter-' + c.id + '"><strong>' + esc(c.city) + ', ' + esc(c.st) + '</strong></a><div class="sub">' + esc(c.setting) + (c.school ? ' · ' + esc(c.school) : '') + '</div>' + (c.published ? '' : '<div><span class="chip chip-late">Hidden from the public</span></div>') + '</td>' +
      '<td>' + esc(c.chairFull || 'No chair listed') + (c.cochairFull ? ', ' + esc(c.cochairFull) : '') + '<div class="sub">' + esc(c.sponsor) + (c.sponsorChurch ? ', ' + esc(c.sponsorChurch) : '') + '</div></td>' +
      '<td><label class="sr-only" for="st-' + c.id + '">Status of ' + esc(c.city) + '</label><select id="st-' + c.id + '" data-change="chstatus" data-id="' + c.id + '" style="width:auto">' + ['Forming','Active','Inactive'].map(function(s){ return '<option' + (c.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
      '<td>' + (c.renewed ? fmt(c.renewed, {month:'short', day:'numeric', year:'numeric'}) : 'Never') + '<div>' + flag + '</div></td>' +
      '<td><div class="al-acts">' + (r.current ? '' : '<button type="button" class="btn btn-line btn-sm" data-action="chrenew" data-id="' + c.id + '">Mark renewed</button>') + '<button type="button" class="btn btn-line btn-sm' + (c.published ? ' al-danger' : '') + '" data-action="chpub" data-id="' + c.id + '">' + (c.published ? 'Hide' : 'Show') + '</button></div></td></tr>';
  }).join('');
  return leaderRequestsHTML() + '<h2 style="margin-top:' + (pendingChanges().length ? '2.25rem' : '1.5rem') + ';font-size:1.4rem">Chapters</h2><p class="sub" style="margin-top:.3rem;max-width:70ch">Chapters renew every September 1, when leadership changes over: each confirms its chair, co-chair, and pastoral sponsor with the League. Chairs send new leaders from their chapter page for you to approve here, which also renews the chapter. If nothing changed, mark the chapter renewed yourself. A hidden chapter comes off the directory, the map, and the calendar until you show it again.</p>' +
    (chapters.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Chapter</th><th>Leaders</th><th>Status</th><th>Last renewed</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="empty">No chapters yet.</p>');
}

function adminInterest(){
  var groups = interestGroups();
  var total = openInterests().length;
  var body = groups.map(function(g){
    var ready = g.open.length >= CLUSTER_MIN;
    var mails = g.open.map(function(i){ return i.email; }).join(', ');
    var head = '<div class="cluster-h"><div><h3>' + esc(g.city) + ', ' + esc(g.st) + '</h3><p class="sub">' + g.open.length + ' waiting' + (g.people.length > g.open.length ? ', ' + (g.people.length - g.open.length) + ' already handled' : '') + '</p></div><div class="al-acts">' +
      (g.chapter ? '<span class="chip">Chapter here: <a href="#chapter-' + g.chapter.id + '">' + esc(g.chapter.city) + '</a></span>' : ready ? '<span class="chip chip-active">Ready to connect</span>' : '<span class="chip">' + (CLUSTER_MIN - g.open.length) + ' more to connect</span>') +
      (g.open.length ? '<button type="button" class="btn btn-line btn-sm" data-action="copy" data-text="' + esc(mails) + '" data-label="' + g.open.length + (g.open.length === 1 ? ' email address' : ' email addresses') + '">Copy their emails</button>' : '') + '</div></div>';
    var rows = g.people.map(function(i){
      return '<tr><td>' + esc(i.name) + '<div class="sub">' + esc(i.email) + '</div></td><td>' + esc(i.setting) + (i.school ? '<div class="sub">' + esc(i.school) + '</div>' : '') + '</td><td>' + esc(i.note) + (i.placed ? '' : '<div class="sub">Not on the public map: the city could not be located.</div>') + '</td><td>' + fmt(i.date, {month:'short', day:'numeric', year:'numeric'}) + '</td>' +
        '<td><label class="sr-only" for="is-' + i.id + '">Status for ' + esc(i.name) + '</label><select id="is-' + i.id + '" data-change="intstatus" data-id="' + i.id + '" style="width:auto">' + INTEREST_STATUSES.map(function(s){ return '<option' + (i.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>';
    }).join('');
    return '<section class="cluster' + (ready && !g.chapter ? ' ready' : '') + '">' + head + '<div class="scroll"><table class="tbl"><thead><tr><th>Person</th><th>Wants</th><th>Note</th><th>Added</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
  }).join('');
  return '<h2 style="margin-top:1.5rem;font-size:1.4rem">Interest map</h2><p class="sub" style="margin-top:.3rem;max-width:70ch">People who marked where they live and asked for a chapter there, grouped by place. ' + total + ' waiting. When ' + CLUSTER_MIN + ' or more gather in one place, introduce them to one another and invite them to apply, then set each person to Contacted. People set to Joined chapter, Started chapter, or Closed come off the public map. Names and emails are never shown publicly.</p>' +
    (groups.length ? body : '<p class="empty">No one has used the interest map yet.</p>');
}

function adminCalendar(){
  var up = events.filter(function(e){ return e.chapter === 'network' && e.date >= iso(TODAY); }).sort(function(a, b){ return a.date.localeCompare(b.date); });
  return '<h2 style="margin-top:1.5rem;font-size:1.4rem">Network calendar</h2><p class="sub" style="margin-top:.3rem;max-width:70ch">Post events and announcements for the whole League. Chairs post their own chapter’s from their chapter page.</p>' +
    '<form id="f-office-event" class="panel" style="margin-top:1rem" novalidate><h3>Post to the whole network</h3>' +
      '<label for="oe-title">Title<input type="text" id="oe-title"></label>' +
      '<div class="row2"><label for="oe-date">Date<input type="date" id="oe-date" min="' + iso(TODAY) + '"></label><label for="oe-time">Time <span class="hint">(optional)</span><input type="text" id="oe-time"></label></div>' +
      '<div class="row2"><label for="oe-place">Place <span class="hint">(optional)</span><input type="text" id="oe-place"></label><label for="oe-kind">Type<select id="oe-kind"><option value="announcement">Announcement</option><option value="event">Event</option></select></label></div>' +
      '<label for="oe-blurb">A sentence or two about it<textarea id="oe-blurb"></textarea></label>' +
      '<div><button class="btn btn-primary btn-sm" type="submit">Post to the calendar</button></div></form>' +
    '<h3 style="margin-top:1.75rem">Upcoming network posts</h3>' + (up.length ? '<ul class="al-log">' + up.map(function(e){ return '<li><span class="sub">' + fmt(e.date, {month:'short', day:'numeric', year:'numeric'}) + ' · ' + (e.kind === 'announcement' ? 'Announcement' : 'Event') + '</span><span><a href="#event-' + e.id + '">' + esc(e.title) + '</a> <button type="button" class="btn btn-line btn-sm al-danger" data-action="evdel" data-id="' + e.id + '">Remove</button></span></li>'; }).join('') + '</ul>' : '<p class="sub" style="margin-top:.4rem">Nothing posted.</p>');
}

function viewSupport(){
  var help = 'help' + DOMAIN;
  var faq = [
    ['How do I find a chapter near me?', 'Search the <a href="#chapters">chapter directory</a> by city, school, or state, or look at the map. Each chapter page shows when it meets and how to reach it.'],
    ['Who can join?', 'Young adults, ages 18 to 35. Married couples are welcome until they have children.'],
    ['There is no chapter near me. Now what?', 'Add your city to the <a href="#interest">interest map</a>. When several people gather in one place, the office introduces them. Or start one now: you need a chair, a co-chair, and an active LCMS pastor in your city. The <a href="#start">start a chapter</a> page walks through it.'],
    ['Do I need an account to join?', 'No. Membership is informal: a member is whoever comes. Only chapter leaders and the League office sign in.'],
    ['What does a chapter agree to?', 'A short charter: what we confess and what we commit to. You can read it on the <a href="#home">About</a> page and in the application.'],
    ['Is there a fee to start or keep a chapter?', 'No. There is no chapter fee.'],
    ['Who can be a pastoral sponsor?', 'An active LCMS pastor in the chapter’s city. He does not have to serve the congregation where the chapter meets.'],
    ['I wrote to a chapter and have not heard back.', 'The office keeps track of every message sent through the site. If two days pass without an answer, write to ' + help + ' and we will follow up.'],
    ['We have a new chair, co-chair, or pastor.', 'Tell the office. Your chapter address stays the same and we change who receives its mail.'],
    ['How do I update our chapter page or post an event?', 'Chairs can edit their own chapter page and post events from it. If you cannot get in, write to ' + help + '.'],
    ['Mail to our chapter address is not arriving.', 'Write to ' + help + ' from your personal email and we will check the forwarding.']
  ];
  var right = ui.supportSent
    ? '<div class="panel ok-panel" role="status"><h3>Message sent</h3><p>It went to <code>' + esc(help) + '</code>. The office answers within two business days. </p><div><button type="button" class="btn btn-line btn-sm" data-action="supportagain">Send another</button></div></div>'
    : '<form class="panel" id="f-support" novalidate><h3>Send us a message</h3><label for="su-name">Your name<input type="text" id="su-name" required></label><label for="su-email">Your email<input type="email" id="su-email" required></label><label for="su-topic">What is this about?<select id="su-topic"><option>Finding a chapter</option><option>Starting a chapter</option><option>My chapter page or events</option><option>Our chapter email address</option><option>Something else</option></select></label><label for="su-msg">Message<textarea id="su-msg" required></textarea></label><div><button class="btn btn-primary" type="submit">Send message</button></div></form>';
  return '<section class="wrap section"><p class="eyebrow">Help and support</p><h1>How can we help?</h1><p class="lede">Answers to common questions, and a real person at the League office for everything else.</p>' +
    '<div class="ch-grid"><div><h2 style="font-size:1.4rem">Common questions</h2><div class="faq">' + faq.map(function(f){ return '<details><summary>' + f[0] + '</summary><p>' + f[1] + '</p></details>'; }).join('') + '</div></div>' +
    '<aside class="stack"><div class="panel"><h3>Write to the office</h3><p class="hint">One address for every question.</p><div class="addr"><a href="mailto:' + help + '"><code>' + esc(help) + '</code></a>' + copyBtn(help) + '</div></div>' + right +
    '<div class="panel"><h3>For chapter leaders</h3><p class="hint">Starting out or handing off to a new chair?</p><div class="btn-row" style="margin-top:0"><a class="btn btn-line btn-sm" href="#start">Start a chapter</a><a class="btn btn-line btn-sm" href="#home">Read the charter</a></div></div></aside></div></section>';
}

function adminBody(){
  var t = ui.adminTab;
  return t === 'inquiries' ? adminInquiries() : t === 'aliases' ? adminAliases() : t === 'chapters' ? adminChapters() : t === 'interest' ? adminInterest() : t === 'calendar' ? adminCalendar() : adminOverview();
}
function viewAdmin(){
  var waiting = inquiries.filter(function(q){ return !q.answered; }).length;
  var tabs = [['overview','Overview'],['inquiries','Inquiries' + (waiting ? ' (' + waiting + ')' : '')],['interest','Interest map'],['chapters','Chapters' + (pendingChanges().length ? ' (' + pendingChanges().length + ')' : '')],['calendar','Calendar'],['aliases','Email forwarding']];
  return '<section class="wrap section"><div class="admin-h"><div><p class="eyebrow">Office view</p><h1>Walther League office</h1></div><p class="sub">Signed in as ' + esc(WL.me().name || WL.me().email) + ' <button type="button" class="btn btn-line btn-sm" data-action="signout">Sign out</button></p></div>' +
    '<div class="tabs" role="group" aria-label="Office sections">' + tabs.map(function(t){ return '<button type="button" data-action="adtab" data-v="' + t[0] + '" aria-pressed="' + (ui.adminTab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
    '<div id="admin-body">' + adminBody() + '</div></section>';
}

/* ---------- sign-in ---------- */
function viewSignin(){
  var me = WL.me(), help = 'help' + DOMAIN;
  if (me.role){
    return '<section class="wrap section narrow"><p class="eyebrow">Account</p><h1>You are signed in</h1><p class="lede">Signed in as ' + esc(me.name || me.email) + '.</p><div class="btn-row">' +
      (me.role === 'office' ? '<a class="btn btn-primary" href="#admin">Open the office view</a>' : '') +
      me.chairOf.map(function(id){ return '<a class="btn ' + (me.role === 'office' ? 'btn-line' : 'btn-primary') + '" href="#chapter-' + esc(id) + '">Edit the ' + esc(chapterName(id)) + ' page</a>'; }).join('') +
      '<button type="button" class="btn btn-line" data-action="signout">Sign out</button></div>' +
      (me.role === 'chair' ? '<p class="hint" style="margin-top:1.25rem">On your chapter page, choose “Edit this page” to change the details or post an event.</p>' : '') + '</section>';
  }
  if (me.id){
    return '<section class="wrap section narrow"><p class="eyebrow">Account</p><h1>We do not have this email on file</h1><p class="lede">You signed in as ' + esc(me.email) + ', but that is not the address the League has for a chair, a co-chair, or the office.</p>' +
      '<p style="margin-top:1rem">If you lead a chapter, sign in with the email you gave on your application, or write to <a href="mailto:' + help + '">' + help + '</a> and we will fix it.</p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary" data-action="signout">Sign out and try another email</button><a class="btn btn-line" href="#home">Home</a></div></section>';
  }
  var body;
  if (ui.signin){
    body = '<form id="f-signin-code" class="form" novalidate><fieldset><legend>Enter your code</legend><p class="hint">We emailed a code to <strong>' + esc(ui.signin.email) + '</strong>. It can take a minute to arrive.</p>' +
      '<label for="si-code">Code<input type="text" id="si-code" inputmode="numeric" autocomplete="one-time-code" required></label>' +
      '<div class="btn-row" style="margin-top:0"><button class="btn btn-primary" type="submit">Sign in</button><button type="button" class="btn btn-line" data-action="cancelcode">Use a different email</button></div></fieldset></form>';
  } else {
    body = '<form id="f-signin-email" class="form" novalidate><fieldset><legend>Your email</legend><p class="hint">Chapter chairs, co-chairs, and the Walther League office sign in with the email address the League has on file for them. No password: we email you a code.</p>' +
      '<label for="si-email">Email<input type="email" id="si-email" autocomplete="email" required></label>' +
      '<div><button class="btn btn-primary" type="submit">Email me a code</button></div></fieldset></form>';
  }
  return '<section class="wrap section narrow"><p class="eyebrow">Sign in</p><h1>Chairs and office</h1><p class="lede">Chapters have no member accounts. Only chapter leaders and the League office sign in.</p>' + body +
    '<p class="hint" style="margin-top:1rem">Trouble signing in? Write to <a href="mailto:' + help + '">' + help + '</a>. Not a chair yet? <a href="#start">Start a chapter</a>.</p></section>';
}
function viewDenied(){
  return '<section class="wrap section narrow"><h1>That page is for the office</h1><p class="lede">Sign in with your League email to continue.</p><div class="btn-row"><a class="btn btn-primary" href="#signin">Sign in</a><a class="btn btn-line" href="#home">Home</a></div></section>';
}
function renderNav(){
  var l = $('#links'); if (!l) return;
  var me = WL.me(), item = l.querySelector('[data-nav="signin"]'), office = l.querySelector('[data-nav="admin"]');
  if (item){ item.textContent = me.id ? 'Account' : 'Sign in'; }
  if (office){ office.style.display = me.role === 'office' ? '' : 'none'; }
}

/* ---------- router ---------- */
function route(){
  var h = (location.hash || '').replace(/^#/, '') || 'home';
  var view = h, arg = null, app = $('#app');
  if (h.indexOf('chapter-') === 0){ view = 'chapter'; arg = h.slice(8); }
  if (h.indexOf('event-') === 0){ view = 'event'; arg = h.slice(6); }
  ui.contact = null;
  if (view !== 'chapter' || ui.autoEdit !== arg) ui.autoEdit = null;
  ui.chairEdit = !!ui.autoEdit && WL.isChairOf(arg);
  var html;
  if (view === 'event'){ html = viewEvent(arg); }
  else if (view === 'chapters'){ html = viewChapters(); }
  else if (view === 'chapter'){ html = viewChapter(arg); }
  else if (view === 'events'){ html = viewEvents(); }
  else if (view === 'start'){ html = viewStart(); }
  else if (view === 'interest'){ html = viewInterest(); }
  else if (view === 'admin'){ html = WL.me().role === 'office' ? viewAdmin() : viewDenied(); }
  else if (view === 'signin'){ html = viewSignin(); }
  else if (view === 'support'){ html = viewSupport(); }
  else { view = 'home'; html = viewHome(); }
  app.innerHTML = html;
  if (view === 'chapters') renderMapAndList();
  var navKey = view === 'chapter' ? 'chapters' : view === 'event' ? 'events' : view;
  document.querySelectorAll('#links a').forEach(function(a){ if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
}
/* redraw the page you are on after its data changed, keeping your place */
function redraw(){
  var y = window.scrollY, h = (location.hash || '').replace(/^#/, '') || 'home';
  if (h.indexOf('chapter-') === 0) $('#app').innerHTML = viewChapter(h.slice(8));
  else if (h === 'admin' && WL.me().role === 'office') $('#app').innerHTML = viewAdmin();
  else { var saved = {contact: ui.contact, chairEdit: ui.chairEdit}; route(); ui.contact = saved.contact; ui.chairEdit = saved.chairEdit; }
  window.scrollTo(0, y);
}

/* ---------- actions ---------- */
var actions = {
  pick: function(t, e){ if (e.target.closest('a')) return; ui.selected = t.dataset.id; renderMapAndList(); var row = document.querySelector('.res.sel'); if (row && row.scrollIntoView) row.scrollIntoView({block:'nearest'}); },
  filter: function(t){ ui[t.dataset.k] = t.dataset.v; renderFinder(); },
  clearfilters: function(){ ui.q = ''; ui.setting = 'All'; ui.status = 'All'; ui.base = 'Any'; var q = $('#q'); if (q) q.value = ''; renderFinder(); },
  mapview: function(t){ ui.mapView = t.dataset.v; document.querySelectorAll('[data-action="mapview"]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === ui.mapView)); }); renderMapAndList(); },
  copy: function(t){
    var text = t.dataset.text, done = function(){ toast('Copied ' + (t.dataset.label || text)); };
    var fail = function(){ var code = t.previousElementSibling; if (code){ var r = document.createRange(); r.selectNodeContents(code); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Press Ctrl+C or Cmd+C to copy the selected address.'); };
    try { navigator.clipboard.writeText(text).then(done, fail); } catch (err) { fail(); }
  },
  contact: function(t){ var id = (location.hash || '').replace('#chapter-', ''); ui.contact = {id: id, kind: t.dataset.kind, sent: false}; refreshChapter(); var f = $('#cn-name'); if (f) f.focus(); },
  closecontact: function(){ ui.contact = null; refreshChapter(); },
  chairedit: function(){ ui.chairEdit = !ui.chairEdit; ui.autoEdit = null; refreshChapter(); if (ui.chairEdit){ var p = $('#f-chair'); if (p) p.scrollIntoView({block:'center'}); } },
  evkind: function(t){ ui.evKind = t.dataset.v; $('#app').innerHTML = viewEvents(); },
  evmonth: function(t){ var m = ui.month.m + Number(t.dataset.dir), y = ui.month.y; if (m < 0){ m = 11; y--; } if (m > 11){ m = 0; y++; } var bb = monthBounds(); if (y * 12 + m < bb[0] || y * 12 + m > bb[1]) return; ui.month = {y: y, m: m}; $('#app').innerHTML = viewEvents(); },
  adtab: function(t){ ui.adminTab = t.dataset.v; $('#app').innerHTML = viewAdmin(); },
  inq: function(t){ var id = t.dataset.id; t.disabled = true; WL.markAnswered(id).then(function(){ toast('Marked answered.'); $('#app').innerHTML = viewAdmin(); }, fail); },
  adv: function(t){
    var a = applications.find(function(x){ return x.id === t.dataset.id; }); if (!a) return;
    if (!a.verified || a.stage > 2) return;
    var city = a.city, next = a.stage <= 1 ? 2 : 3; t.disabled = true;
    WL.setApplicationStage(a.id, next).then(function(){ return WL.logChange(city + ' application (' + a.id + '): ' + STAGES[next].toLowerCase()); }).then(function(){ return WL.refresh(); })
      .then(function(){ toast(city + ': ' + STAGES[next].toLowerCase() + '.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  appverify: function(t){
    var a = applications.find(function(x){ return x.id === t.dataset.id; }); if (!a) return;
    if (!window.confirm('Mark ' + a.sponsor + ' as verified?\n\nOnly do this once you have confirmed he is an active LCMS pastor serving in ' + a.city + ', ' + a.st + ' and has agreed to sponsor the chapter.')) return;
    t.disabled = true;
    WL.verifySponsor(a).then(function(){ toast(a.sponsor + ' is verified for ' + a.city + '.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  lcwithdraw: function(t){
    if (!window.confirm('Withdraw this leader change request?')) return;
    t.disabled = true;
    WL.withdrawLeaderChange(t.dataset.id).then(function(){ toast('Request withdrawn.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  lcapprove: function(t){
    var ch = leaderChanges.find(function(x){ return x.id === t.dataset.id; }); if (!ch) return;
    var c = chapters.find(function(x){ return x.id === ch.chapter; }) || {city: ch.chapter};
    var fresh = sponsorIsNew(ch), box = document.getElementById('lv-' + ch.id);
    if (fresh && !(box && box.checked)){ toast('Confirm the new pastoral sponsor first, then tick the box.'); return; }
    if (!window.confirm('Approve the new leaders for ' + c.city + '?\n\nThis replaces the chapter’s leaders, changes who receives its email addresses, and marks it renewed.')) return;
    t.disabled = true;
    WL.approveLeaderChange(ch.id, fresh).then(function(){ toast(c.city + ' has its new leaders. Its addresses now go to them.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  lcdecline: function(t){
    var ch = leaderChanges.find(function(x){ return x.id === t.dataset.id; }); if (!ch) return;
    var c = chapters.find(function(x){ return x.id === ch.chapter; }) || {city: ch.chapter};
    var why = window.prompt('Decline the leader change for ' + c.city + '?\n\nAdd a short reason. The chair sees it on their chapter page.', '');
    if (why === null) return;
    t.disabled = true;
    WL.declineLeaderChange(ch.id, why.trim()).then(function(){ return WL.logChange('Declined a leader change for ' + c.city); }).then(function(){ return WL.refresh(); }).then(function(){ toast('Declined. Nothing changed for ' + c.city + '.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  evdel: function(t){
    var ev = events.find(function(x){ return x.id === t.dataset.id; }); if (!ev) return;
    if (!window.confirm('Remove "' + ev.title + '" from the calendar?')) return;
    t.disabled = true;
    WL.deleteEvent(ev.id).then(function(){ toast('Removed from the calendar.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  aledit: function(t){ ui.alEdit = t.dataset.id; ui.alDel = null; $('#app').innerHTML = viewAdmin(); var f = $('#al-to'); if (f) f.focus(); },
  alcancel: function(){ ui.alEdit = null; ui.alDel = null; $('#app').innerHTML = viewAdmin(); },
  alpause: function(t){
    var a = aliases.find(function(x){ return x.id === t.dataset.id; }); if (!a) return;
    var on = !a.active, addr = a.local + DOMAIN; t.disabled = true;
    WL.setAliasActive(a, on).then(function(){ return WL.logChange((on ? 'Resumed ' : 'Paused ') + addr); }).then(function(){ return WL.refresh(); }).then(function(){ toast(addr + (on ? ' is forwarding again.' : ' is paused. Mail is held, not forwarded.')); $('#app').innerHTML = viewAdmin(); }, function(e){ fail(e); $('#app').innerHTML = viewAdmin(); });
  },
  alrm: function(t){
    var a = aliases.find(function(x){ return x.id === t.dataset.id; }); if (!a) return;
    if (a.to.length < 2){ toast('An address needs at least one recipient. Add the new person first, or pause the address.'); return; }
    var i = Number(t.dataset.i), gone = a.to[i], rest = a.to.filter(function(x, k){ return k !== i; }), addr = a.local + DOMAIN; t.disabled = true;
    WL.saveAlias(a.id, a.local, rest, a.active, a.note).then(function(){ return WL.logChange('Removed ' + gone + ' from ' + addr); }).then(function(){ return WL.refresh(); }).then(function(){ toast(gone + ' no longer receives mail for ' + addr + '.'); $('#app').innerHTML = viewAdmin(); }, function(e){ fail(e); $('#app').innerHTML = viewAdmin(); });
  },
  aldel: function(t){ ui.alDel = t.dataset.id; $('#app').innerHTML = viewAdmin(); },
  aldelno: function(){ ui.alDel = null; $('#app').innerHTML = viewAdmin(); },
  aldelyes: function(t){
    var a = aliases.find(function(x){ return x.id === t.dataset.id; }); if (!a) return;
    var addr = a.local + DOMAIN; t.disabled = true;
    WL.deleteAlias(a.id).then(function(){ return WL.logChange('Deleted ' + addr); }).then(function(){ return WL.refresh(); }).then(function(){ ui.alEdit = null; ui.alDel = null; toast(addr + ' was deleted.'); $('#app').innerHTML = viewAdmin(); }, function(e){ fail(e); $('#app').innerHTML = viewAdmin(); });
  },
  chrenew: function(t){
    var c = chapters.find(function(x){ return x.id === t.dataset.id; }); if (!c) return; var city = c.city; t.disabled = true;
    WL.renewChapter(c.id).then(function(){ return WL.logChange('Renewed ' + city + ' for the year'); }).then(function(){ return WL.refresh(); }).then(function(){ toast(city + ' is renewed until next September 1.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  chpub: function(t){
    var c = chapters.find(function(x){ return x.id === t.dataset.id; }); if (!c) return;
    var city = c.city, show = !c.published;
    if (!show && !window.confirm('Hide ' + city + ' from the public directory, map, and calendar? You can show it again at any time.')) return;
    t.disabled = true;
    WL.setChapterPublished(c.id, show).then(function(){ return WL.logChange((show ? 'Showed ' : 'Hid ') + city + (show ? ' in' : ' from') + ' the public directory'); }).then(function(){ return WL.refresh(); }).then(function(){ toast(show ? city + ' is back in the directory.' : city + ' is hidden from the directory, map, and calendar.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  signout: function(){ WL.signOut().then(function(){ renderNav(); toast('Signed out.'); location.hash = '#home'; route(); }, fail); },
  retry: function(){ start(); },
  cancelcode: function(){ ui.signin = null; $('#app').innerHTML = viewSignin(); },
  supportagain: function(){ ui.supportSent = false; $('#app').innerHTML = viewSupport(); },
  startover: function(){ ui.applied = null; $('#app').innerHTML = viewStart(); window.scrollTo(0, 0); }
};
/* drop-downs that save as soon as they change (office only) */
var changes_ = {
  chstatus: function(t){
    var c = chapters.find(function(x){ return x.id === t.dataset.id; }); if (!c) return;
    var city = c.city, to = t.value; t.disabled = true;
    WL.setChapterStatus(c.id, to).then(function(){ return WL.logChange('Set ' + city + ' to ' + to); }).then(function(){ return WL.refresh(); }).then(function(){ toast(city + ' is now ' + to + '.'); redraw(); }, function(e){ fail(e); redraw(); });
  },
  intstatus: function(t){
    var i = interests.find(function(x){ return x.id === t.dataset.id; }); if (!i) return;
    var to = t.value; t.disabled = true;
    WL.setInterestStatus(i.id, to).then(function(){ toast(i.name + ': ' + to + '.'); redraw(); }, function(e){ fail(e); redraw(); });
  }
};
function refreshChapter(){ var id = (location.hash || '').replace('#chapter-', ''); $('#app').innerHTML = viewChapter(id); }

function parseMails(s){ return String(s).split(/[\s,;]+/).map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean); }
function checkAlias(local, to, selfId){
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(local)) return 'Use lowercase letters, numbers, dots, or hyphens for the address.';
  if (aliases.some(function(x){ return x.local === local && x.id !== selfId; })) return local + DOMAIN + ' already exists.';
  if (!to.length) return 'Add at least one email to forward to.';
  var bad = to.filter(function(t){ return !/^\S+@\S+\.\S+$/.test(t); });
  if (bad.length) return bad[0] + ' does not look like an email address.';
  return '';
}
function busy(f, on){ var b = f.querySelector('button[type="submit"]'); if (b){ b.disabled = on; } }
function fail(e){ toast((e && e.message) ? 'Something went wrong: ' + e.message : 'Something went wrong. Please try again.'); }
function checkedVals(name){ return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function(i){ return i.value; }); }
var forms = {
  'f-contact': function(f){
    var name = $('#cn-name').value.trim(), email = $('#cn-email').value.trim(), msg = $('#cn-msg').value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !msg){ toast('Please add your name, a valid email, and a message.'); return; }
    var id = (location.hash || '').replace('#chapter-', ''), c = chapters.find(function(x){ return x.id === id; });
    var pastor = ui.contact.kind === 'pastor'; busy(f, true);
    WL.sendInquiry({to: (pastor ? c.id + 'pastor' : c.id), name: name, email: email, about: pastor ? 'Pastor' : 'Chapter', note: msg}).then(function(){ ui.contact.sent = true; refreshChapter(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-chair': function(f){
    var id = (location.hash || '').replace('#chapter-', ''), c = chapters.find(function(x){ return x.id === id; });
    var bases = checkedVals('ce-base'), n = parseInt($('#ce-members').value, 10);
    if (isNaN(n) || n < 0) n = c.members;
    busy(f, true);
    WL.saveChapterPage(c.id, {meets: $('#ce-meets').value.trim() || c.meets, about: $('#ce-about').value.trim() || c.about, bases: bases, text: $('#ce-text').value.trim(), members: n}).then(function(){ toast('Saved. The public page shows your changes now.'); refreshChapter(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-event': function(f){
    var id = (location.hash || '').replace('#chapter-', ''), title = $('#ev-title').value.trim(), date = $('#ev-date').value;
    if (!title || !date){ toast('Add a title and a date to post.'); return; }
    busy(f, true);
    WL.postEvent(id, {kind: $('#ev-kind').value, title: title, date: date, time: $('#ev-time').value.trim(), place: $('#ev-place').value.trim(), blurb: $('#ev-blurb').value.trim()}).then(function(){ toast('Posted to the calendar.'); refreshChapter(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-leaders': function(f){
    var id = (location.hash || '').replace('#chapter-', ''), c = chapters.find(function(x){ return x.id === id; }); if (!c) return;
    var v = function(i){ var el = $(i); return el ? el.value.trim() : ''; };
    var ok = function(e){ return /^\S+@\S+\.\S+$/.test(e); };
    ui.leadOpen = true;
    var list = [{role: 'chair', name: v('#lc-chair-n'), email: v('#lc-chair-e').toLowerCase()}], bad = '';
    var names = f.querySelectorAll('[data-co="n"]'), mails = f.querySelectorAll('[data-co="e"]');
    for (var i = 0; i < names.length; i++){
      var n = names[i].value.trim(), e = mails[i].value.trim().toLowerCase();
      if (!n && !e) continue;
      if (!n || !ok(e)) bad = 'Each co-chair needs a full name and a valid email.';
      list.push({role: 'cochair', name: n, email: e});
    }
    var st = v('#lc-sp-st').toUpperCase();
    list.push({role: 'pastoral_sponsor', name: v('#lc-sp-n'), email: v('#lc-sp-e').toLowerCase(), church: v('#lc-sp-c'), city: v('#lc-sp-city'), st: st});
    if (!list[0].name || !ok(list[0].email)) bad = 'Add the chair’s full name and a valid email.';
    else if (list.length < 3) bad = 'A chapter needs at least one co-chair.';
    else if (!v('#lc-sp-n') || !ok(v('#lc-sp-e')) || !v('#lc-sp-c') || !v('#lc-sp-city') || !/^[A-Z]{2}$/.test(st)) bad = bad || 'Add the pastoral sponsor’s name, email, congregation, and its city and state.';
    var seen = {};
    list.forEach(function(l){ if (l.role !== 'pastoral_sponsor'){ if (seen[l.email]) bad = bad || 'The same email is listed twice. Each leader needs their own row.'; seen[l.email] = true; } });
    if (bad){ toast(bad); return; }
    busy(f, true);
    WL.requestLeaderChange(c.id, list, v('#lc-note')).then(function(){ ui.leadOpen = false; toast('Sent to the League office. Nothing changes until it is approved.'); refreshChapter(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-office-event': function(f){
    var title = $('#oe-title').value.trim(), date = $('#oe-date').value;
    if (!title || !date){ toast('Add a title and a date to post.'); return; }
    busy(f, true);
    WL.postEvent(null, {kind: $('#oe-kind').value, title: title, date: date, time: $('#oe-time').value.trim(), place: $('#oe-place').value.trim(), blurb: $('#oe-blurb').value.trim()}).then(function(){ toast('Posted for the whole network.'); redraw(); }, function(e){ busy(f, false); fail(e); });
  },
  'publish': function(f){
    var a = applications.find(function(x){ return x.id === f.dataset.id; }); if (!a) return;
    var s = f.querySelector('input[name="slug"]').value.trim().toLowerCase();
    if (!/^[a-z0-9]+$/.test(s)){ toast('Use only lowercase letters and numbers for the chapter address.'); return; }
    if (chapters.some(function(c){ return c.id === s; }) || aliases.some(function(x){ return x.local === s || x.local === s + 'pastor'; })){ toast(s + DOMAIN + ' is already in use. Choose another address.'); return; }
    if (!window.confirm('Publish the ' + a.city + ' chapter?\n\nThis creates its public page and the addresses ' + s + DOMAIN + ' and ' + s + 'pastor' + DOMAIN + '.')) return;
    busy(f, true);
    WL.publishApplication(a, s).then(function(r){ toast(a.city + ' is live in the directory. Addresses created: ' + r.id + DOMAIN + ' and ' + r.id + 'pastor' + DOMAIN + '.' + (r.pinned ? '' : ' The map pin could not be placed automatically.')); redraw(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-interest': function(f){
    var v = function(i){ var el = $(i); return el ? el.value.trim() : ''; };
    var st = v('#in-st').toUpperCase(), setting = (document.querySelector('input[name="in-setting"]:checked') || {}).value || 'City';
    if (!v('#in-name') || !/^\S+@\S+\.\S+$/.test(v('#in-email'))){ toast('Please add your name and a valid email.'); return; }
    if (!v('#in-city') || !/^[A-Z]{2}$/.test(st)){ toast('Add your city and a two-letter state.'); return; }
    if (setting === 'Campus' && !v('#in-school')){ toast('Which school? Add it, or choose a city chapter.'); return; }
    if (!$('#in-age').checked){ toast('The Walther League is for young adults, ages 18 to 35.'); return; }
    var o = {name: v('#in-name'), email: v('#in-email'), city: v('#in-city'), st: st, setting: setting, school: v('#in-school'), note: v('#in-note')};
    busy(f, true);
    WL.sendInterest(o).then(function(r){ o.placed = r.placed; ui.interestSent = o; $('#app').innerHTML = viewInterest(); window.scrollTo(0, 0); }, function(e){ busy(f, false); fail(e); });
  },
  'f-rsvp': function(f){
    var name = $('#rs-name').value.trim(), email = $('#rs-email').value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)){ toast('Please add your name and a valid email.'); return; }
    var e = events.find(function(x){ return x.id === f.dataset.id; }); if (!e) return;
    var c = chapters.find(function(x){ return x.id === e.chapter; }); busy(f, true);
    WL.sendInquiry({to: c ? c.id : 'info', name: name, email: email, about: 'RSVP', note: 'RSVP for "' + e.title + '" on ' + e.date + '.'}).then(function(){ ui.rsvp = ui.rsvp || {}; ui.rsvp[e.id] = true; $('#app').innerHTML = viewEvent(e.id); }, function(err){ busy(f, false); fail(err); });
  },
  'f-alias-new': function(f){
    var local = $('#an-local').value.trim().toLowerCase(), to = parseMails($('#an-to').value);
    var bad = checkAlias(local, to, null); if (bad){ toast(bad); return; }
    busy(f, true);
    WL.saveAlias(null, local, to, true, 'Added by the office').then(function(){ return WL.logChange('Created ' + local + DOMAIN + ', forwarding to ' + to.join(', ')); }).then(function(){ return WL.refresh(); }).then(function(){ toast(local + DOMAIN + ' now forwards to ' + to.length + (to.length === 1 ? ' person.' : ' people.')); $('#app').innerHTML = viewAdmin(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-alias-edit': function(f){
    var a = aliases.find(function(x){ return x.id === f.dataset.id; }); if (!a) return;
    var local = $('#al-local').value.trim().toLowerCase(), to = parseMails($('#al-to').value);
    var bad = checkAlias(local, to, a.id); if (bad){ toast(bad); return; }
    var was = a.local, moved = a.to.join() !== to.join(); busy(f, true);
    WL.saveAlias(a.id, local, to, a.active, a.note).then(function(){
      var p = Promise.resolve();
      if (was !== local) p = p.then(function(){ return WL.logChange('Renamed ' + was + DOMAIN + ' to ' + local + DOMAIN); });
      if (moved) p = p.then(function(){ return WL.logChange('Changed who ' + local + DOMAIN + ' forwards to'); });
      return p;
    }).then(function(){ return WL.refresh(); }).then(function(){ ui.alEdit = null; ui.alDel = null; toast('Saved. ' + local + DOMAIN + ' forwards to ' + to.join(', ') + '.'); $('#app').innerHTML = viewAdmin(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-support': function(f){
    var name = $('#su-name').value.trim(), email = $('#su-email').value.trim(), msg = $('#su-msg').value.trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !msg){ toast('Please add your name, a valid email, and a message.'); return; }
    busy(f, true);
    WL.sendInquiry({to: 'help', name: name, email: email, about: $('#su-topic').value, note: msg}).then(function(){ ui.supportSent = true; $('#app').innerHTML = viewSupport(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-apply': function(f){
    var v = function(i){ var el = $(i); return el ? el.value.trim() : ''; };
    if (!$('#ap-ages').checked){ toast('Please confirm your chapter is for young adults, ages 18 to 35.'); return; }
    if (!$('#ap-agree').checked){ toast('Please tick the box confirming the charter.'); return; }
    var st = v('#ap-st').toUpperCase(), pst = v('#ap-pst').toUpperCase();
    if (!v('#ap-city') || !/^[A-Z]{2}$/.test(st)){ toast('Add your city and a two-letter state.'); return; }
    if ((document.querySelector('input[name="ap-setting"]:checked') || {}).value === 'Campus' && !v('#ap-school')){ toast('Add the school for a campus chapter.'); return; }
    if (!v('#ap-pn') || !/^\S+@\S+\.\S+$/.test(v('#ap-pe')) || !v('#ap-pc') || !v('#ap-pcity') || !/^[A-Z]{2}$/.test(pst)){ toast('Add your pastoral sponsor’s name, email, congregation, and its city and state.'); return; }
    if (!$('#ap-pa').checked){ toast('Please confirm that the pastor has agreed to sponsor the chapter.'); return; }
    var details = {chapterName: v('#ap-name'), expectedSize: v('#ap-size')};
    Array.prototype.forEach.call(f.querySelectorAll('input[id^="ap-"], textarea[id^="ap-"], select[id^="ap-"]'), function(el){
      if (/^ap-(c|o|p)(a|ad|p|rn|re|rp|mn|me|mp)$/.test(el.id)) details[el.id.slice(3)] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    var setting = (document.querySelector('input[name="ap-setting"]:checked') || {}).value || 'City';
    var a = {city: v('#ap-city'), st: st, setting: setting, school: setting === 'Campus' ? v('#ap-school') : '',
      chair: v('#ap-cf') + ' ' + v('#ap-cl'), cochair: v('#ap-of') + ' ' + v('#ap-ol'), chairEmail: v('#ap-ce'), cochairEmail: v('#ap-oe'),
      sponsor: v('#ap-pn'), sponsorEmail: v('#ap-pe'), sponsorChurch: v('#ap-pc'), sponsorCity: v('#ap-pcity'), sponsorSt: pst,
      church: v('#ap-church'), bases: checkedVals('ap-base'), why: v('#ap-why'), details: details};
    busy(f, true);
    WL.submitApplication(a).then(function(){ ui.applied = a; $('#app').innerHTML = viewStart(); window.scrollTo(0, 0); }, function(e){ busy(f, false); fail(e); });
  },
  'f-signin-email': function(f){
    var email = $('#si-email').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)){ toast('Enter the email address you use for the League.'); return; }
    busy(f, true);
    WL.sendCode(email).then(function(){ ui.signin = {email: email}; $('#app').innerHTML = viewSignin(); var c = $('#si-code'); if (c) c.focus(); }, function(e){ busy(f, false); fail(e); });
  },
  'f-signin-code': function(f){
    var code = $('#si-code').value.replace(/\s+/g, '');
    if (!/^\d{6,10}$/.test(code)){ toast('Enter the code from the email.'); return; }
    busy(f, true);
    WL.verifyCode(ui.signin.email, code).then(function(me){
      ui.signin = null; renderNav();
      if (!me.role){ $('#app').innerHTML = viewSignin(); return; }
      toast('Signed in.');
      /* a chair lands on their chapter page with the chair tools already open */
      if (me.role === 'chair') ui.autoEdit = me.chairOf[0];
      location.hash = me.role === 'office' ? '#admin' : '#chapter-' + me.chairOf[0]; route();
    }, function(e){ busy(f, false); toast('That code did not work. Check it and try again, or ask for a new one.'); });
  }
};

document.addEventListener('click', function(e){
  var t = e.target.closest('[data-action]'); if (!t) return;
  var fn = actions[t.dataset.action]; if (fn) fn(t, e);
});
document.addEventListener('keydown', function(e){
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g[data-action]')){ e.preventDefault(); actions[e.target.dataset.action](e.target, e); }
});
document.addEventListener('input', function(e){
  if (e.target.id === 'q'){ ui.q = e.target.value; renderFinder(); var q = $('#q'); if (q && document.activeElement !== q){ q.focus(); } }
  if (e.target.id === 'al-q'){ ui.alQ = e.target.value; var tb = $('#al-table'); if (tb) tb.innerHTML = alTable(); }
  if (e.target.id === 'ap-city' || e.target.id === 'ap-school') aliasPreview();
});
function aliasPreview(){
  var p = $('#alias-prev'); if (!p) return;
  var campus = (document.querySelector('input[name="ap-setting"]:checked') || {}).value === 'Campus';
  var s = appSlug({setting: campus ? 'Campus' : 'City', school: ($('#ap-school') || {}).value || '', city: ($('#ap-city') || {}).value || ''}) || 'yourcity';
  p.innerHTML = 'Your chapter address would be <code>' + esc(s) + DOMAIN + '</code>' + (campus ? ' <span class="hint">(campus chapters are named for the school)</span>' : '');
}
document.addEventListener('change', function(e){
  if (e.target.id === 'evchapter'){ ui.evChapter = e.target.value; $('#app').innerHTML = viewEvents(); }
  if (e.target.name === 'ap-setting') aliasPreview();
  var fn = e.target.dataset && changes_[e.target.dataset.change]; if (fn) fn(e.target);
});
document.addEventListener('submit', function(e){
  e.preventDefault();
  var fn = forms[e.target.id] || forms[e.target.dataset.form]; if (fn) fn(e.target);
});
window.addEventListener('hashchange', route);
function loading(msg){ $('#app').innerHTML = '<section class="wrap section"><p class="lede" role="status">' + esc(msg) + '</p></section>'; }
function start(){
  loading('Loading the Walther League…');
  WL.boot().then(function(){
    WL.onChange(function(){ renderNav(); });
    renderNav(); route();
  }, function(e){
    $('#app').innerHTML = '<section class="wrap section"><h1>We could not load the site</h1><p class="lede">Check your connection and try again. ' + esc((e && e.message) || '') + '</p><div class="btn-row"><button type="button" class="btn btn-primary" data-action="retry">Try again</button></div></section>';
  });
}
start();
})();