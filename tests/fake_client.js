/* In-memory stand-in for the Supabase client, used only by tests/demo.html.
   It imitates the live project's tables, public views, access rules, and functions closely
   enough to click through the whole site, including the office and chair views, without
   touching the real database. Nothing here is saved: reloading resets it.
   Sign in on the demo page with office@example.com or chair@example.com and the code 123456. */
(function(){
var uid = 100, nid = function(p){ return p + (++uid); };
var iso = function(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
var plus = function(n){ var d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
var ago = function(h){ return new Date(Date.now() - h * 3600000).toISOString(); };
var DB = {
  profiles: [{id:'u-office', role:'office', full_name:'Hanna Berglund', email:'office@example.com'}, {id:'u-chair', role:'chair', full_name:'Maria Chair', email:'chair@example.com'}],
  chapters: [
    {id:'austin', city:'Austin', state:'TX', lat:30.27, lon:-97.74, setting:'City', school:'', meets:'Thursdays, 7:00 pm', member_count:14, status:'Active', chat_bases:['Discord'], text_line:'', church:'Trinity Lutheran Church', about:'Evening Prayer, supper, and a short study.', renewed_on:plus(-30), published:true},
    {id:'tamu', city:'College Station', state:'TX', lat:30.63, lon:-96.33, setting:'Campus', school:'Texas A&M University', meets:'Tuesdays, 7:30 pm', member_count:20, status:'Active', chat_bases:['GroupMe','Instagram'], text_line:'', church:'', about:'Campus chapter.', renewed_on:plus(-500), published:true},
    {id:'denver', city:'Denver', state:'CO', lat:39.74, lon:-104.99, setting:'City', school:'', meets:'First Sundays', member_count:8, status:'Forming', chat_bases:[], text_line:'', church:'', about:'Denver chapter.', renewed_on:null, published:true}
  ],
  chapter_leaders: [
    {id:'l1', chapter_id:'austin', role:'chair', full_name:'Maria Chair', email:'chair@example.com', profile_id:null, congregation:''},
    {id:'l2', chapter_id:'austin', role:'cochair', full_name:'Sam Co', email:'sam@example.com', profile_id:null, congregation:''},
    {id:'l3', chapter_id:'austin', role:'pastoral_sponsor', full_name:'Rev. Paul Pastor', email:'pp@example.com', profile_id:null, congregation:'Trinity Lutheran Church'},
    {id:'l4', chapter_id:'tamu', role:'chair', full_name:'Tess Aggie', email:'tess@example.com', profile_id:null, congregation:''},
    {id:'l5', chapter_id:'denver', role:'chair', full_name:'Dan Denver', email:'dan@example.com', profile_id:null, congregation:''}
  ],
  events: [
    {id:'e1', chapter_id:'austin', kind:'event', title:'Evening Prayer and supper', event_date:plus(5), event_time:'7:00 pm', place:'Address sent after RSVP', blurb:''},
    {id:'e2', chapter_id:null, kind:'announcement', title:'Spring chapter applications are open', event_date:plus(12), event_time:'', place:'', blurb:'Apply by March 1.'}
  ],
  applications: [
    {id:'WL-26-001', city:'Omaha', state:'NE', setting:'City', school:'', chair_name:'Olive Chair', chair_email:'o@example.com', cochair_name:'Pat Co', cochair_email:'p@example.com', sponsor_name:'Rev. Sven Sponsor', sponsor_email:'s@example.com', sponsor_congregation:'Zion Lutheran Church', sponsor_city:'Omaha', sponsor_state:'NE', sponsor_verified:false, sponsor_verified_at:null, ages_confirmed:true, agreed:true, church:'Zion Lutheran Church', chat_bases:['GroupMe'], why:'Several of us moved here after college.', stage:0, chapter_id:null, submitted_at:ago(30), details:{chapterName:'Omaha Walther League', expectedSize:'5 to 10', crn:'Rev. A', cre:'a@example.com', cmn:'Bea Member', cme:'bea@example.com', orn:'Rev. C', ore:'c@example.com', omn:'Dee Member', ome:'dee@example.com'}},
    {id:'WL-26-002', city:'Lincoln', state:'NE', setting:'Campus', school:'University of Nebraska', chair_name:'Leo Lead', chair_email:'leo@example.com', cochair_name:'Mia Co', cochair_email:'mia@example.com', sponsor_name:'Rev. Far Away', sponsor_email:'far@example.com', sponsor_congregation:'Grace Lutheran Church', sponsor_city:'Seward', sponsor_state:'NE', sponsor_verified:true, sponsor_verified_at:ago(48), ages_confirmed:true, agreed:true, church:'', chat_bases:[], why:'', stage:3, chapter_id:null, submitted_at:ago(24 * 9), details:{}}
  ],
  inquiries: [
    {id:'q1', to_alias:'austin', from_name:'Nell Newcomer', from_email:'nell@example.com', about:'Chapter', note:'Can I come this Thursday?', answered:false, created_at:ago(60)},
    {id:'q2', to_alias:'help', from_name:'Hal Helpme', from_email:'hal@example.com', about:'Starting a chapter', note:'Do we need a pastor first?', answered:false, created_at:ago(5)}
  ],
  interests: [
    {id:'i1', full_name:'Ann Arbor', email:'ann@example.com', setting:'City', school:'', city:'Tulsa', state:'OK', lat:36.15, lon:-95.99, age_confirmed:true, note:'Three friends would come.', status:'New', chapter_id:null, created_at:ago(100)},
    {id:'i2', full_name:'Ben Boone', email:'ben@example.com', setting:'City', school:'', city:'Tulsa', state:'OK', lat:36.15, lon:-95.99, age_confirmed:true, note:'', status:'New', chapter_id:null, created_at:ago(80)},
    {id:'i3', full_name:'Cal Cole', email:'cal@example.com', setting:'City', school:'', city:'Tulsa', state:'OK', lat:36.15, lon:-95.99, age_confirmed:true, note:'', status:'Contacted', chapter_id:null, created_at:ago(50)},
    {id:'i4', full_name:'Dot Dunn', email:'dot@example.com', setting:'Campus', school:'Boise State', city:'Boise', state:'ID', lat:43.62, lon:-116.2, age_confirmed:true, note:'', status:'New', chapter_id:null, created_at:ago(20)}
  ],
  email_aliases: [{id:'a1', local_part:'austin', kind:'chapter', chapter_id:'austin', active:true, note:''}, {id:'a3', local_part:'austinpastor', kind:'pastor', chapter_id:'austin', active:true, note:''}, {id:'a2', local_part:'help', kind:'general', chapter_id:null, active:true, note:'Help and support'}],
  alias_recipients: [{alias_id:'a1', email:'chair@example.com'}, {alias_id:'a1', email:'sam@example.com'}, {alias_id:'a3', email:'pp@example.com'}, {alias_id:'a2', email:'office@example.com'}],
  leader_changes: [
    {id:'lc1', chapter_id:'tamu', status:'Pending', note:'Elected at our September meeting.', requested_by:null, requested_by_name:'Tess Aggie', decided_by:null, decided_at:null, decision_note:'', created_at:ago(40),
      leaders:[{role:'chair', full_name:'Nora Newchair', email:'nora@example.com'}, {role:'cochair', full_name:'Tess Aggie', email:'tess@example.com'}, {role:'pastoral_sponsor', full_name:'Rev. Carl College', email:'carl@example.com', congregation:'Our Savior Lutheran Church', city:'Bryan', state:'TX'}]}
  ],
  change_log: []
};
var user = null, calls = [];
window.__fake = {DB: DB, calls: calls, failNext: null, user: function(){ return user; },
  /* tests can skip the emailed code: __fake.signIn('office@example.com') then WL.loadMe() */
  signIn: function(email){ var p = DB.profiles.find(function(x){ return x.email === email; }); if (!p){ p = {id:'u-' + email, role:'chair', full_name:'', email:email}; DB.profiles.push(p); } user = {id:p.id, email:email}; }};
function isOffice(){ if (!user) return false; var p = DB.profiles.find(function(x){ return x.id === user.id; }); return !!p && p.role === 'office'; }
function isChairOf(cid){ return !!user && DB.chapter_leaders.some(function(l){ return l.chapter_id === cid && l.profile_id === user.id && l.role !== 'pastoral_sponsor'; }); }
function published(cid){ var c = DB.chapters.find(function(x){ return x.id === cid; }); return !!c && c.published; }
function firstName(n){ return String(n).trim().replace(/^((the|rev|reverend|pastor|pr|dr|fr|mr|mrs|ms|miss)\.?\s+)+/i, '').split(' ')[0]; }
function table(name){
  if (name === 'chapters_public') return DB.chapters.filter(function(c){ return c.published; }).map(function(c){ var o = Object.assign({}, c); delete o.published; delete o.renewed_on; return o; });
  if (name === 'chapter_leaders_public') return DB.chapter_leaders.filter(function(l){ return published(l.chapter_id); }).map(function(l){ return {id:l.id, chapter_id:l.chapter_id, role:l.role, first_name:firstName(l.full_name)}; });
  return DB[name];
}
var OFFICE_ONLY = ['applications','inquiries','interests','email_aliases','alias_recipients','change_log'];   /* leader_changes is filtered per chapter below */
var ANON_INSERT = ['applications','inquiries','interests'];
var denied = {data:null, error:{message:'new row violates row-level security policy'}};
function Q(name){
  var q = {name:name, op:'select', filters:[], ord:null, lim:null, vals:null, ret:false};
  q.select = function(){ if (q.op !== 'select') q.ret = true; return q; };
  q.insert = function(v){ q.op='insert'; q.vals=v; return q; };
  q.update = function(v){ q.op='update'; q.vals=v; return q; };
  q.delete = function(){ q.op='delete'; return q; };
  q.eq = function(k,v){ q.filters.push(function(r){ return r[k] === v; }); return q; };
  q.in = function(k,v){ q.filters.push(function(r){ return v.indexOf(r[k]) >= 0; }); return q; };
  q.lt = function(k,v){ q.filters.push(function(r){ return r[k] < v; }); return q; };
  q.order = function(k,o){ q.ord=[k,!(o && o.ascending===false)]; return q; };
  q.limit = function(n){ q.lim=n; return q; };
  q.then = function(ok, no){ return Promise.resolve().then(run).then(ok, no); };
  function run(){
    calls.push(q.name + ':' + q.op);
    if (window.__fake.failNext){ var m = window.__fake.failNext; window.__fake.failNext = null; return {data:null, error:{message:m}}; }
    var rows = table(q.name); if (!rows) return {data:null, error:{message:'no table ' + q.name}};
    var office = isOffice();
    /* who may see which rows */
    if (!office){
      if (OFFICE_ONLY.indexOf(q.name) >= 0 && q.op !== 'insert') rows = [];
      if (q.name === 'profiles') rows = rows.filter(function(r){ return user && r.id === user.id; });
      if (q.name === 'chapters') rows = rows.filter(function(r){ return isChairOf(r.id); });
      if (q.name === 'chapter_leaders') rows = rows.filter(function(r){ return isChairOf(r.chapter_id); });
      if (q.name === 'leader_changes' && q.op !== 'insert') rows = rows.filter(function(r){ return isChairOf(r.chapter_id) && (q.op === 'select' || (q.op === 'delete' && r.status === 'Pending')); });
      if (q.name === 'leader_changes' && q.op === 'update') rows = [];
      if (q.name === 'events' && q.op === 'select') rows = rows.filter(function(r){ return !r.chapter_id || published(r.chapter_id); });
      if (q.name === 'events' && q.op !== 'select' && q.op !== 'insert') rows = rows.filter(function(r){ return r.chapter_id && isChairOf(r.chapter_id); });
    }
    var sel = rows.filter(function(r){ return q.filters.every(function(f){ return f(r); }); });
    if (q.op==='insert'){
      var list = Array.isArray(q.vals) ? q.vals : [q.vals], made = [];
      for (var i = 0; i < list.length; i++){
        var v = Object.assign({}, list[i]);
        if (!office){
          if (ANON_INSERT.indexOf(q.name) < 0 && !((q.name === 'events' || q.name === 'leader_changes') && v.chapter_id && isChairOf(v.chapter_id))) return denied;
          if (q.ret) return denied;   /* visitors cannot read back what they send */
        }
        if (q.name==='applications'){ if (!v.agreed || !v.ages_confirmed || !v.sponsor_name || !v.sponsor_email) return {data:null, error:{message:'violates check constraint'}}; v.id = 'WL-26-' + String(DB.applications.length + 1).padStart(3, '0'); v.stage=0; v.sponsor_verified=false; v.sponsor_verified_at=null; v.chapter_id=null; v.submitted_at=new Date().toISOString(); }
        if (q.name==='inquiries'){ v.id = nid('q'); v.answered=false; v.created_at=new Date().toISOString(); }
        if (q.name==='interests'){ if (!v.age_confirmed || !/^[A-Z]{2}$/.test(v.state)) return {data:null, error:{message:'violates check constraint'}}; v.id = nid('i'); v.status='New'; v.chapter_id=null; v.created_at=new Date().toISOString(); }
        if (q.name==='events'){ v.id = nid('e'); }
        if (q.name==='leader_changes'){ if (DB.leader_changes.some(function(x){ return x.chapter_id === v.chapter_id && x.status === 'Pending'; })) return {data:null, error:{code:'23505', message:'duplicate key value violates unique constraint "leader_changes_one_pending"'}}; v.id = nid('lc'); v.status = 'Pending'; v.decided_at = null; v.decision_note = ''; v.created_at = new Date().toISOString(); }
        if (q.name==='email_aliases'){ if (DB.email_aliases.some(function(a){ return a.local_part === v.local_part; })) return {data:null, error:{code:'23505', message:'duplicate key value violates unique constraint'}}; v.id = nid('al'); v.chapter_id = v.chapter_id || null; }
        if (q.name==='change_log'){ v.id=nid('c'); v.created_at=new Date().toISOString(); }
        DB[q.name].push(v); made.push(Object.assign({}, v));
      }
      return {data: q.ret ? made : null, error:null};
    }
    if (q.op==='update'){
      if (q.name === 'chapters' && !office){
        var locked = ['id','city','state','setting','school','status','published','church','lat','lon','renewed_on'];
        if (sel.some(function(r){ return locked.some(function(k){ return k in q.vals && q.vals[k] !== r[k]; }); })) return {data:null, error:{message:'Only the League office can change that field'}};
      }
      sel.forEach(function(r){ var real = DB[q.name].find(function(x){ return x.id === r.id; }) || r; Object.assign(real, q.vals); });
      return {data:null, error:null};
    }
    if (q.op==='delete'){ DB[q.name] = DB[q.name].filter(function(r){ return sel.indexOf(r) < 0; }); return {data:null, error:null}; }
    if (q.ord){ var k=q.ord[0], asc=q.ord[1]; sel = sel.slice().sort(function(a,b){ return (a[k]>b[k]?1:a[k]<b[k]?-1:0) * (asc?1:-1); }); }
    if (q.lim) sel = sel.slice(0,q.lim);
    return {data: sel.map(function(r){ return Object.assign({}, r); }), error:null};
  }
  return q;
}
window.WL_CLIENT = {
  from: Q,
  rpc: function(name, args){
    calls.push('rpc:' + name);
    return Promise.resolve().then(function(){
      if (name === 'interest_map'){
        var by = {};
        DB.interests.forEach(function(i){ if ((i.status !== 'New' && i.status !== 'Contacted') || i.lat == null) return; var k = [i.city, i.state, i.setting, i.school].join('|'); var g = by[k] = by[k] || {city:i.city, state:i.state, setting:i.setting, school:i.school, lat:Math.round(i.lat * 10) / 10, lon:Math.round(i.lon * 10) / 10, people:0}; g.people++; });
        return {data: Object.keys(by).map(function(k){ return by[k]; }), error:null};
      }
      if (name === 'claim_leadership'){ var n = 0; if (user) DB.chapter_leaders.forEach(function(l){ if (!l.profile_id && l.email === user.email && (l.role==='chair'||l.role==='cochair')){ l.profile_id = user.id; n++; } }); return {data:n, error:null}; }
      if (!isOffice()) return {data:null, error:{message:'Office only'}};
      if (name === 'approve_leader_change'){
        var ch = DB.leader_changes.find(function(x){ return x.id === args.change_id; }); if (!ch) return {data:null, error:{message:'Request not found'}};
        if (ch.status !== 'Pending') return {data:null, error:{message:'This request was already ' + ch.status.toLowerCase()}};
        var nsp = ch.leaders.filter(function(l){ return l.role === 'pastoral_sponsor'; })[0];
        var osp = DB.chapter_leaders.filter(function(l){ return l.chapter_id === ch.chapter_id && l.role === 'pastoral_sponsor'; })[0];
        if ((!osp || osp.email.toLowerCase() !== nsp.email.toLowerCase()) && !args.sponsor_verified) return {data:null, error:{message:'The new pastoral sponsor has not been verified as an active LCMS pastor'}};
        var old = DB.chapter_leaders.filter(function(l){ return l.chapter_id === ch.chapter_id; });
        DB.chapter_leaders = DB.chapter_leaders.filter(function(l){ return l.chapter_id !== ch.chapter_id; });
        ch.leaders.forEach(function(l){ var was = old.filter(function(o){ return o.email.toLowerCase() === l.email.toLowerCase() && o.role !== 'pastoral_sponsor'; })[0]; DB.chapter_leaders.push({id:nid('l'), chapter_id:ch.chapter_id, role:l.role, full_name:l.full_name, email:l.email.toLowerCase(), congregation:l.role === 'pastoral_sponsor' ? (l.congregation || '') : '', profile_id:(l.role !== 'pastoral_sponsor' && was) ? was.profile_id : null}); });
        DB.email_aliases.filter(function(a){ return a.chapter_id === ch.chapter_id; }).forEach(function(a){
          DB.alias_recipients = DB.alias_recipients.filter(function(r){ return r.alias_id !== a.id; });
          ch.leaders.forEach(function(l){ if ((a.kind === 'pastor') === (l.role === 'pastoral_sponsor')) DB.alias_recipients.push({alias_id:a.id, email:l.email.toLowerCase()}); });
        });
        DB.chapters.find(function(c){ return c.id === ch.chapter_id; }).renewed_on = iso(new Date());
        ch.status = 'Approved'; ch.decided_at = new Date().toISOString();
        DB.change_log.push({id:nid('c'), created_at:new Date().toISOString(), actor_name:'', summary:'Approved new leaders for ' + ch.chapter_id + ' and updated its email addresses'});
        return {data:null, error:null};
      }
      if (name === 'publish_application'){
        var ap = DB.applications.find(function(x){return x.id===args.app_id;}); if (!ap) return {data:null,error:{message:'Application not found'}};
        if (ap.stage < 3) return {data:null, error:{message:'Application is not approved yet'}};
        if (!ap.sponsor_verified) return {data:null, error:{message:'The pastoral sponsor has not been verified as an active LCMS pastor'}};
        var id = String(args.chapter_slug || (ap.setting === 'Campus' && ap.school) || ap.city).toLowerCase().replace(/[^a-z0-9]/g,'');
        if (DB.chapters.some(function(c){return c.id===id;})) return {data:null, error:{message:'A chapter with address "' + id + '" already exists; choose another'}};
        DB.chapters.push({id:id, city:ap.city, state:ap.state, lat:null, lon:null, setting:ap.setting, school:ap.school, meets:'', member_count:0, status:'Forming', chat_bases:ap.chat_bases, text_line:'', church:ap.church, about:'', renewed_on:iso(new Date()), published:true});
        DB.chapter_leaders.push({id:nid('l'), chapter_id:id, role:'chair', full_name:ap.chair_name, email:ap.chair_email, profile_id:null, congregation:''}, {id:nid('l'), chapter_id:id, role:'cochair', full_name:ap.cochair_name, email:ap.cochair_email, profile_id:null, congregation:''}, {id:nid('l'), chapter_id:id, role:'pastoral_sponsor', full_name:ap.sponsor_name, email:ap.sponsor_email, profile_id:null, congregation:ap.sponsor_congregation});
        var a1 = nid('al'), a2 = nid('al');
        DB.email_aliases.push({id:a1, local_part:id, kind:'chapter', chapter_id:id, active:true, note:''}, {id:a2, local_part:id + 'pastor', kind:'pastor', chapter_id:id, active:true, note:''});
        DB.alias_recipients.push({alias_id:a1, email:ap.chair_email}, {alias_id:a1, email:ap.cochair_email}, {alias_id:a2, email:ap.sponsor_email});
        DB.change_log.push({id:nid('c'), created_at:new Date().toISOString(), actor_name:'', summary:'Published chapter ' + id + ' (' + ap.city + ', ' + ap.state + ')'});
        ap.stage = 4; ap.chapter_id = id; return {data:id, error:null};
      }
      return {data:null, error:{message:'unknown rpc ' + name}};
    });
  },
  auth: {
    getSession: function(){ return Promise.resolve({data:{session: user ? {user:user} : null}, error:null}); },
    signInWithOtp: function(o){ calls.push('otp:' + o.email); return Promise.resolve({data:{}, error:null}); },
    verifyOtp: function(o){
      if (o.token !== '123456') return Promise.resolve({data:null, error:{message:'Token has expired or is invalid'}});
      window.__fake.signIn(o.email); return Promise.resolve({data:{}, error:null});
    },
    signOut: function(){ user = null; return Promise.resolve({error:null}); }
  }
};
})();
