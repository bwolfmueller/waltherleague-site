/* Walther League shared constants, helpers, and the in-page data store.
   The lists below start empty and are filled from the database by api.js. */

var slug = function(s){ return s.toLowerCase().replace(/[^a-z]/g, ''); };
var DOMAIN = '@waltherleague.site';
var aliasFor = function(c, kind){ var a = aliases.find(function(x){ return x.kind === kind && x.chapter === c.id; }); return (a ? a.local : c.id + (kind === 'pastor' ? 'pastor' : '')) + DOMAIN; };
var aliasOf = function(c){ return aliasFor(c, 'chapter'); };
var pastorAliasOf = function(c){ return aliasFor(c, 'pastor'); };

/* filled from the database */
var chapters = [];
var events = [];
var applications = [];
var inquiries = [];
var aliases = [];
var changes = [];
var interests = [];      /* office only: the people behind the interest map */
var leaderRows = [];      /* leaders with emails: all chapters for the office, their own chapter for a chair */
var leaderChanges = [];   /* leader change requests, newest first */
var interestSpots = [];  /* public: places and head counts only */

var STAGES = ['Received','Pastor verified','Recommendations confirmed','Approved'];
/* how many people in one place before the office is prompted to connect them */
var CLUSTER_MIN = 3;
var INTEREST_STATUSES = ['New','Contacted','Joined chapter','Started chapter','Closed'];
var CONFESS = [
  'We confess and hold to the three ecumenical creeds (Apostles’, Nicene, and Athanasian).',
  'We hold all the prophetic and apostolic Scriptures to be the inspired Word of God.',
  'We confess the doctrine of the Evangelical Lutheran Church, drawn from the Scriptures, as learned in the Small Catechism, to be faithful and true.',
  'We acknowledge and rejoice in God’s created order and design for man and woman.'
];
var AGREE = [
  'Our members are young adults, ages 18 to 35. Married couples are welcome until they have children.',
  'We have an active LCMS pastor in our city as our chapter’s pastoral sponsor.',
  'We have a chair and at least one co-chair, and we keep them listed with the Walther League.',
  'We update our pastor, chair, and co-chair information with the League every year.',
  'We meet at least quarterly for fellowship.',
  'We keep our chapter’s activities up to date on the Walther League website.'
];

function aliasLabel(a){
  if (a.kind === 'general') return a.note || 'General';
  var c = chapters.find(function(x){ return x.id === a.chapter; });
  return (c ? c.city + ', ' + c.st : 'Chapter') + ' \u00b7 ' + (a.kind === 'pastor' ? 'pastoral sponsor' : 'chairs');
}

/* Known city positions (latitude, longitude). New chapters look themselves up if the city is not listed. */
var GEO = {omaha:[41.26,-95.93], seward:[40.91,-97.1], portland:[45.52,-122.68], columbus:[39.96,-83.0], kansascity:[39.1,-94.58], atlanta:[33.75,-84.39], lincoln:[40.81,-96.7], seattle:[47.61,-122.33], orlando:[28.54,-81.38], indianapolis:[39.77,-86.16], milwaukee:[43.04,-87.91], madison:[43.07,-89.4], cleveland:[41.5,-81.7], pittsburgh:[40.44,-80.0], boston:[42.36,-71.06], newyork:[40.71,-74.0], philadelphia:[39.95,-75.17], charlotte:[35.23,-80.84], neworleans:[29.95,-90.07], oklahomacity:[35.47,-97.52], tulsa:[36.15,-95.99], saltlakecity:[40.76,-111.89], losangeles:[34.05,-118.24], sandiego:[32.72,-117.16], sacramento:[38.58,-121.49], sanfrancisco:[37.77,-122.42], elpaso:[31.76,-106.49], lubbock:[33.58,-101.86], waco:[31.55,-97.15]};
