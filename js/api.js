/* Walther League: talks to the Supabase database.
   Everything the site reads or changes goes through this file. Pages (app.js) never call Supabase directly.
   Who is allowed to do what is decided by the database's access rules (see supabase/migrations). */
(function(){
'use strict';

var cfg = window.WL_CONFIG || {};
var sb = null;
var me = {role: null, id: null, name: '', email: '', chairOf: []};
var listeners = [];

function client(){
  if (!sb){
    sb = window.WL_CLIENT || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false}
    });
  }
  return sb;
}

function must(res){
  if (res && res.error){
    var err = new Error(res.error.message || 'Something went wrong');
    err.code = res.error.code;
    throw err;
  }
  return res ? res.data : null;
}

function pad2(n){ return String(n).padStart(2, '0'); }
function isoDate(d){ return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function ago(ts){
  var h = (Date.now() - new Date(ts).getTime()) / 3600000;
  if (h < 1) return 'Just now';
  if (h < 24){ var n = Math.floor(h); return n + ' hour' + (n === 1 ? '' : 's') + ' ago'; }
  var d = Math.floor(h / 24); return d + ' day' + (d === 1 ? '' : 's') + ' ago';
}

/* ---------- row to page-object mapping ---------- */
function setList(list, items){ list.length = 0; items.forEach(function(x){ list.push(x); }); }

/* `people` is either the public view (first_name only) or, for the office, the full leader rows. */
function mapChapter(r, people){
  var of = function(role){ return people.filter(function(p){ return p.chapter_id === r.id && p.role === role; }); };
  var chairs = of('chair'), cos = of('cochair'), pas = of('pastoral_sponsor')[0];
  var first = function(p){ return p.first_name || String(p.full_name || '').trim().split(' ')[0]; };
  var full = function(p){ return p.full_name || p.first_name || ''; };
  return {
    id: r.id, city: r.city, st: r.state, lat: r.lat == null ? null : Number(r.lat), lon: r.lon == null ? null : Number(r.lon),
    setting: r.setting, school: r.school || '', meets: r.meets || '', members: r.member_count || 0, status: r.status,
    bases: r.chat_bases || [], text: r.text_line || '', church: r.church || '', about: r.about || '',
    renewed: r.renewed_on || null, published: r.published !== false,
    chair: chairs.map(first).join(', '), cochair: cos.map(first).join(', '),
    chairFull: chairs.map(full).join(', '), cochairFull: cos.map(full).join(', '),
    /* the public sees "Pastor Mark"; the office sees the full name and congregation */
    sponsor: pas ? (pas.full_name ? pas.full_name : 'Pastor ' + first(pas)) : 'To be named',
    sponsorChurch: pas ? (pas.congregation || '') : ''
  };
}
function mapEvent(r){
  return {id: r.id, title: r.title, date: r.event_date, time: r.event_time || '', chapter: r.chapter_id || 'network', kind: r.kind, place: r.place || '', blurb: r.blurb || ''};
}
function mapLeader(l){
  return {id: l.id, chapter: l.chapter_id, role: l.role, name: l.full_name, email: l.email, church: l.congregation || ''};
}
function mapChange(r){
  return {id: r.id, chapter: r.chapter_id, status: r.status, note: r.note || '', by: r.requested_by_name || '', at: r.created_at,
    date: isoDate(new Date(r.created_at)), decided: r.decided_at ? isoDate(new Date(r.decided_at)) : null, reason: r.decision_note || '',
    leaders: (r.leaders || []).map(function(l){ return {role: l.role, name: l.full_name || '', email: String(l.email || '').toLowerCase(), church: l.congregation || '', city: l.city || '', st: l.state || ''}; })};
}
function mapApplication(a){
  return {id: a.id, city: a.city, st: a.state, setting: a.setting, school: a.school || '',
    chair: a.chair_name, cochair: a.cochair_name, chairEmail: a.chair_email, cochairEmail: a.cochair_email,
    sponsor: a.sponsor_name || '', sponsorEmail: a.sponsor_email || '', sponsorChurch: a.sponsor_congregation || '',
    sponsorCity: a.sponsor_city || '', sponsorSt: a.sponsor_state || '',
    verified: !!a.sponsor_verified, verifiedAt: a.sponsor_verified_at || null,
    church: a.church || '', bases: a.chat_bases || [], why: a.why || '', stage: a.stage, details: a.details || {},
    daysAgo: Math.floor((Date.now() - new Date(a.submitted_at).getTime()) / 86400000), date: isoDate(new Date(a.submitted_at))};
}

/* ---------- loading ---------- */
async function loadPublic(){
  var c = client();
  var res = await Promise.all([
    c.from('chapters_public').select('*'),
    c.from('chapter_leaders_public').select('*'),
    c.from('events').select('*').order('event_date', {ascending: true}),
    c.rpc('interest_map')
  ]);
  var chs = must(res[0]) || [], people = must(res[1]) || [], evs = must(res[2]) || [];
  /* the interest map is an extra: if it fails, the rest of the site still loads */
  var spots = (res[3] && !res[3].error && res[3].data) || [];
  setList(chapters, chs.map(function(r){ return mapChapter(r, people); }));
  setList(events, evs.map(mapEvent));
  setList(interestSpots, spots.map(function(s){
    return {city: s.city, st: s.state, setting: s.setting, school: s.school || '', lat: Number(s.lat), lon: Number(s.lon), people: s.people};
  }));
}

async function loadOffice(){
  var c = client();
  var res = await Promise.all([
    c.from('chapters').select('*'),
    c.from('chapter_leaders').select('*'),
    c.from('applications').select('*').lt('stage', 4).order('submitted_at', {ascending: true}),
    c.from('inquiries').select('*').order('created_at', {ascending: false}),
    c.from('email_aliases').select('*'),
    c.from('alias_recipients').select('*'),
    c.from('change_log').select('*').order('created_at', {ascending: false}).limit(30),
    c.from('interests').select('*').order('created_at', {ascending: false}),
    c.from('leader_changes').select('*').order('created_at', {ascending: false})
  ]);
  var chs = must(res[0]) || [], people = must(res[1]) || [], apps = must(res[2]) || [], inqs = must(res[3]) || [];
  var als = must(res[4]) || [], recs = must(res[5]) || [], log = must(res[6]) || [], ints = must(res[7]) || [];
  setList(chapters, chs.map(function(r){ return mapChapter(r, people); }));
  setList(leaderRows, people.map(mapLeader));
  setList(leaderChanges, (must(res[8]) || []).map(mapChange));
  setList(applications, apps.map(mapApplication));
  setList(inquiries, inqs.map(function(q){
    return {id: q.id, hoursAgo: Math.floor((Date.now() - new Date(q.created_at).getTime()) / 3600000), at: q.created_at,
      from: q.from_name, fromEmail: q.from_email, to: q.to_alias + DOMAIN, about: q.about || '', note: q.note, answered: q.answered};
  }));
  setList(aliases, als.map(function(a){
    return {id: a.id, local: a.local_part, kind: a.kind, chapter: a.chapter_id, note: a.note || '', active: a.active,
      to: recs.filter(function(r){ return r.alias_id === a.id; }).map(function(r){ return r.email; }).sort()};
  }));
  setList(changes, log.map(function(l){ return {when: ago(l.created_at), who: l.actor_name || 'Office', text: l.summary}; }));
  setList(interests, ints.map(function(i){
    return {id: i.id, name: i.full_name, email: i.email, setting: i.setting, school: i.school || '', city: i.city, st: i.state,
      note: i.note || '', status: i.status, at: i.created_at, date: isoDate(new Date(i.created_at)), placed: i.lat != null && i.lon != null};
  }));
}

/* A chair sees the full leader records and change requests for their own chapter only. */
async function loadChair(){
  var c = client();
  if (!me.chairOf.length){ setList(leaderRows, []); setList(leaderChanges, []); return; }
  var res = await Promise.all([
    c.from('chapter_leaders').select('*').in('chapter_id', me.chairOf),
    c.from('leader_changes').select('*').in('chapter_id', me.chairOf).order('created_at', {ascending: false})
  ]);
  setList(leaderRows, (must(res[0]) || []).map(mapLeader));
  setList(leaderChanges, (must(res[1]) || []).map(mapChange));
}
async function loadRole(){
  if (me.role === 'office') await loadOffice();
  else if (me.role === 'chair') await loadChair();
}

async function loadMe(){
  var c = client();
  var s = must(await c.auth.getSession());
  var user = s && s.session && s.session.user;
  me = {role: null, id: null, name: '', email: '', chairOf: []};
  if (!user) return me;
  me.id = user.id; me.email = user.email || '';
  try { await c.rpc('claim_leadership'); } catch (e) { /* not fatal */ }
  var prof = must(await c.from('profiles').select('role, full_name').eq('id', user.id));
  var office = false;
  if (prof && prof[0]){ office = prof[0].role === 'office'; me.name = prof[0].full_name || ''; }
  var mine = must(await c.from('chapter_leaders').select('chapter_id').eq('profile_id', user.id)) || [];
  me.chairOf = mine.map(function(r){ return r.chapter_id; }).filter(function(v, i, a){ return a.indexOf(v) === i; });
  /* everyone who signs in gets a profile; only the office, chairs, and co-chairs have anything to do here */
  me.role = office ? 'office' : (me.chairOf.length ? 'chair' : null);
  return me;
}

async function refresh(){
  await loadPublic();
  await loadRole();
  listeners.forEach(function(fn){ try { fn(); } catch (e) { /* ignore */ } });
}

async function boot(){
  await loadPublic();
  try { await loadMe(); } catch (e) { me = {role: null, id: null, name: '', email: '', chairOf: []}; }
  await loadRole();
}

/* ---------- sign-in (email one-time code) ---------- */
async function sendCode(email){
  must(await client().auth.signInWithOtp({email: email, options: {shouldCreateUser: true}}));
}
async function verifyCode(email, code){
  must(await client().auth.verifyOtp({email: email, token: code, type: 'email'}));
  await loadMe();
  await loadRole();
  return me;
}
async function signOut(){
  await client().auth.signOut();
  me = {role: null, id: null, name: '', email: '', chairOf: []};
  setList(applications, []); setList(inquiries, []); setList(aliases, []); setList(changes, []); setList(interests, []); setList(leaderRows, []); setList(leaderChanges, []);
  await loadPublic();
}

/* ---------- where a city is, for map pins ---------- */
async function geocode(city, st){
  var known = chapters.find(function(c){ return c.lat != null && slug(c.city) === slug(city) && c.st === st; });
  if (known) return [known.lat, known.lon];
  var g = (typeof GEO !== 'undefined') ? GEO[slug(city)] : null;
  if (g) return g;
  /* only the city and state are looked up, never a name or email */
  try {
    var r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' + encodeURIComponent(city + ', ' + st));
    var j = await r.json();
    if (j && j[0]) return [parseFloat(j[0].lat), parseFloat(j[0].lon)];
  } catch (e) { /* the pin can be added later */ }
  return null;
}

/* ---------- things any visitor can send ---------- */
async function sendInquiry(o){
  must(await client().from('inquiries').insert({to_alias: o.to, from_name: o.name, from_email: o.email, about: o.about || '', note: o.note}));
}

/* The database gives the application its reference number (WL-26-001). Visitors cannot read
   applications back, so the number is not shown to them; the office sees it in the dashboard. */
async function submitApplication(a){
  must(await client().from('applications').insert({
    city: a.city, state: a.st, setting: a.setting, school: a.school || '',
    chair_name: a.chair, chair_email: a.chairEmail, cochair_name: a.cochair, cochair_email: a.cochairEmail,
    sponsor_name: a.sponsor, sponsor_email: a.sponsorEmail, sponsor_congregation: a.sponsorChurch || '',
    sponsor_city: a.sponsorCity || '', sponsor_state: a.sponsorSt || '',
    church: a.church || '', chat_bases: a.bases || [], why: a.why || '',
    agreed: true, ages_confirmed: true, details: a.details || {}
  }));
}

async function sendInterest(o){
  var g = await geocode(o.city, o.st);
  must(await client().from('interests').insert({
    full_name: o.name, email: o.email, setting: o.setting, school: o.setting === 'Campus' ? (o.school || '') : '',
    city: o.city, state: o.st, lat: g ? g[0] : null, lon: g ? g[1] : null, age_confirmed: true, note: o.note || ''
  }));
  try { await loadPublic(); } catch (e) { /* the map catches up on the next visit */ }
  return {placed: !!g};
}

/* ---------- chairs (their own chapter) and the office ---------- */
async function saveChapterPage(id, f){
  must(await client().from('chapters').update({meets: f.meets, about: f.about, chat_bases: f.bases, text_line: f.text, member_count: f.members}).eq('id', id));
  await refresh();
}
async function postEvent(chapterId, f){
  must(await client().from('events').insert({chapter_id: chapterId || null, kind: f.kind, title: f.title, event_date: f.date, event_time: f.time || '', place: f.place || '', blurb: f.blurb || ''}));
  await refresh();
}
async function deleteEvent(id){
  must(await client().from('events').delete().eq('id', id));
  await refresh();
}

/* Propose new leaders. Nothing changes until the office approves. */
async function requestLeaderChange(chapterId, list, note){
  must(await client().from('leader_changes').insert({
    chapter_id: chapterId, note: note || '', requested_by: me.id, requested_by_name: me.name || me.email,
    leaders: list.map(function(l){ return {role: l.role, full_name: l.name, email: l.email, congregation: l.church || '', city: l.city || '', state: l.st || ''}; })
  }));
  await refresh();
}
async function withdrawLeaderChange(id){
  must(await client().from('leader_changes').delete().eq('id', id));
  await refresh();
}

/* ---------- office only ---------- */
async function approveLeaderChange(id, sponsorVerified){
  must(await client().rpc('approve_leader_change', {change_id: id, sponsor_verified: !!sponsorVerified}));
  await refresh();
}
async function declineLeaderChange(id, reason){
  must(await client().from('leader_changes').update({status: 'Declined', decision_note: reason || '', decided_by: me.id, decided_at: new Date().toISOString()}).eq('id', id));
  await refresh();
}
async function logChange(text){
  must(await client().from('change_log').insert({summary: text, actor_id: me.id, actor_name: me.name || me.email || 'Office'}));
}
async function markAnswered(id){
  must(await client().from('inquiries').update({answered: true}).eq('id', id));
  await refresh();
}
async function setApplicationStage(id, stage){
  must(await client().from('applications').update({stage: stage}).eq('id', id));
  await refresh();
}
async function verifySponsor(a){
  must(await client().from('applications').update({sponsor_verified: true, sponsor_verified_at: new Date().toISOString(), stage: Math.max(a.stage, 1)}).eq('id', a.id));
  await logChange('Verified ' + a.sponsor + ' as pastoral sponsor for the ' + a.city + ' application (' + a.id + ')');
  await refresh();
}
/* Creates the chapter, its leaders, and its two addresses in one database step, then places the map pin. */
async function publishApplication(a, chapterSlug){
  var id = must(await client().rpc('publish_application', {app_id: a.id, chapter_slug: chapterSlug || null}));
  var g = await geocode(a.city, a.st);
  var patch = {meets: 'Time to be announced', about: 'A new chapter getting started. Check back for the first gathering.'};
  if (g){ patch.lat = g[0]; patch.lon = g[1]; }
  var warn = '';
  try { must(await client().from('chapters').update(patch).eq('id', id)); } catch (e) { warn = e.message; }
  await refresh();
  return {id: id, pinned: !!g && !warn};
}
async function saveAlias(id, local, to, active, note){
  var c = client(), aid = id;
  if (!aid){
    var made = must(await c.from('email_aliases').insert({local_part: local, kind: 'general', note: note || '', active: active}).select('id'));
    aid = made && made[0] && made[0].id;
    if (!aid) throw new Error('The address was not created.');
  } else {
    must(await c.from('email_aliases').update({local_part: local, active: active}).eq('id', aid));
    must(await c.from('alias_recipients').delete().eq('alias_id', aid));
  }
  if (to.length) must(await c.from('alias_recipients').insert(to.map(function(e){ return {alias_id: aid, email: e}; })));
  await refresh();
  return aid;
}
async function setAliasActive(a, active){
  must(await client().from('email_aliases').update({active: active}).eq('id', a.id));
  await refresh();
}
async function deleteAlias(id){
  must(await client().from('alias_recipients').delete().eq('alias_id', id));
  must(await client().from('email_aliases').delete().eq('id', id));
  await refresh();
}
async function renewChapter(id){
  must(await client().from('chapters').update({renewed_on: isoDate(new Date())}).eq('id', id));
  await refresh();
}
async function setChapterStatus(id, status){
  must(await client().from('chapters').update({status: status}).eq('id', id));
  await refresh();
}
async function setChapterPublished(id, on){
  must(await client().from('chapters').update({published: on}).eq('id', id));
  await refresh();
}
async function setInterestStatus(id, status){
  must(await client().from('interests').update({status: status}).eq('id', id));
  await refresh();
}

window.WL = {
  boot: boot, refresh: refresh, loadMe: loadMe, me: function(){ return me; },
  onChange: function(fn){ listeners.push(fn); },
  sendCode: sendCode, verifyCode: verifyCode, signOut: signOut,
  sendInquiry: sendInquiry, submitApplication: submitApplication, sendInterest: sendInterest,
  saveChapterPage: saveChapterPage, postEvent: postEvent, deleteEvent: deleteEvent, logChange: logChange,
  markAnswered: markAnswered, setApplicationStage: setApplicationStage, verifySponsor: verifySponsor, publishApplication: publishApplication,
  saveAlias: saveAlias, setAliasActive: setAliasActive, deleteAlias: deleteAlias,
  renewChapter: renewChapter, setChapterStatus: setChapterStatus, setChapterPublished: setChapterPublished,
  setInterestStatus: setInterestStatus,
  requestLeaderChange: requestLeaderChange, withdrawLeaderChange: withdrawLeaderChange,
  approveLeaderChange: approveLeaderChange, declineLeaderChange: declineLeaderChange,
  isChairOf: function(id){ return me.role === 'office' || me.chairOf.indexOf(id) >= 0; }
};
})();
