// Twin Peaks — the made-up test city of here-core (Steve, 2026-11-05: "I want to
// use twin peaks as the base test"). Every shared script's tests run against
// this file and the fixed events.json beside it, so a test never changes
// because a real venue did. Nothing here is fetched: the URLs sit on the
// reserved .example domain and the clubs' league ids are invented.
//
// It has the same shape as a real city's city.js (see lqa-events'), so it is
// also the starting point for a new one. Loaded before filter.js: it sets
// globalThis.LQACity.
(function (global) {
  'use strict';

  var X = 'https://twinpeaks.example/';
  // The home clubs, one per kind of season reader the tests touch: a summer
  // baseball season (mlb), a winter one that straddles the new year (nhl),
  // a football season named by its first year (espn + wiki.startYear), and
  // a club whose bare nickname turns up in show titles (owls).
  var TEAMS = [
    { slug: 'loggers', label: 'Loggers', re: /loggers/i, sport: 'football', venue: 'Packard Field', colors: ['#3b2a1a', '#c8a24a'],
      espn: { sport: 'football', league: 'nfl', id: '9901' }, season: { kind: 'espn' }, form: { kind: 'espn' },
      schedule: X + 'loggers/schedule', club: 'Twin Peaks Loggers', opens: 'September',
      wiki: { title: 'Twin Peaks Loggers', startYear: true } },
    { slug: 'timbermen', label: 'Timbermen', re: /timbermen/i, sport: 'baseball', venue: 'Packard Field', colors: ['#1d3b2a', '#d9cfa8'],
      espn: { sport: 'baseball', league: 'mlb', id: '9902' }, season: { kind: 'mlb', id: 9902 }, form: { kind: 'espn' },
      schedule: X + 'timbermen/schedule', club: 'Twin Peaks Timbermen', opens: 'late March',
      wiki: { title: 'Twin Peaks Timbermen' }, division: ['BUC', 'SPO', 'YAK'] },
    { slug: 'steelheads', label: 'Steelheads', re: /steelheads/i, sport: 'hockey', venue: 'Timber Arena', colors: ['#0f2f3f', '#8fb8c8'],
      espn: { sport: 'hockey', league: 'nhl', id: '9903' }, season: { kind: 'nhl', abbrev: 'TPS' }, form: { kind: 'espn' },
      schedule: X + 'steelheads/schedule', club: 'Twin Peaks Steelheads', opens: 'early October',
      wiki: { title: 'Twin Peaks Steelheads' } },
    { slug: 'owls', label: 'Owls', re: /twin peaks owls/i, sport: 'soccer', venue: 'Packard Field', colors: ['#2a1f3d', '#e0c060'],
      espn: { sport: 'soccer', league: 'usa.1', id: '9904' }, season: { kind: 'espn' }, form: { kind: 'espn' },
      schedule: X + 'owls/schedule', club: 'Twin Peaks Owls', opens: 'March',
      wiki: { title: 'Twin Peaks Owls FC' } },
  ];
  var VENUES = {
    'Timber Arena': { geo: [47.4958, -121.7841], capacity: 8000, type: 'concert', cssVar: '--v-timber', color: '#4da3f0', url: X + 'timber-arena/events' },
    'Great Northern Hotel': { geo: [47.5412, -121.8370], capacity: 600, type: 'arts', cssVar: '--v-gnorth', color: '#d158a7', url: X + 'great-northern/events' },
    'Roadhouse': { geo: [47.4889, -121.7716], capacity: 300, type: 'concert', cssVar: '--v-roadhouse', color: '#a26be6', url: X + 'roadhouse/shows' },
    'Double R Diner': { geo: [47.4927, -121.7869], capacity: 60, type: 'bar', cssVar: '--v-doubler', color: '#5fb3a1', url: X + 'double-r/events' },
    'Bijou Cinema': { geo: [47.4941, -121.7853], capacity: 200, type: 'community', cssVar: '--v-bijou', color: '#b596e0', url: X + 'bijou/calendar' },
    'Grange Hall': { geo: [47.4969, -121.7898], capacity: 400, type: 'community', cssVar: '--v-grange', color: '#6a72e6', url: X + 'grange/events' },
    'Packard Field': { geo: [47.5103, -121.7602], capacity: 5000, area: 'town', type: 'concert', cssVar: '--v-packard', color: '#8ad8e0', url: X + 'packard-field/events' },
    'Expo Barn': { geo: [47.4705, -121.7350], capacity: 3000, area: 'town', type: 'expo', cssVar: '--v-expo', color: '#7fa7cc', url: X + 'expo-barn/events' },
    'Packard Mill Days': { url: X + 'mill-days', festival: true, cssVar: '--v-mill', color: '#c47a2b' },
    'Miss Twin Peaks': { url: X + 'miss-twin-peaks', festival: true, cssVar: '--v-pageant', color: '#c04a8a' },
  };
  var DEFAULT_ON = ['Timber Arena', 'Great Northern Hotel', 'Roadhouse', 'Packard Field', 'Grange Hall'];
  var DEFAULT_OFF = ['Double R Diner', 'Bijou Cinema', 'Expo Barn', 'Packard Mill Days', 'Miss Twin Peaks'];
  var PREFS_KNOWN_FROM = 'Packard Mill Days';
  var TYPES = [
    { key: 'concert', label: 'Concerts', title: 'Live music — the arena to the Roadhouse' },
    { key: 'sports', label: 'Sports', title: 'The home clubs' },
    { key: 'arts', label: 'Arts & Theater', title: 'Plays, recitals, dance' },
    { key: 'movie', label: 'Movies', title: 'Films at the Bijou — unchecked by default' },
    { key: 'expo', label: 'Conventions', title: 'Shows and fairs at the Expo Barn' },
    { key: 'bar', label: 'Neighborhood', title: 'Pie nights and specials at the Double R' },
  ];
  var CODE_LENGTH = 6;
  var REGISTRY = [ // append only: a bit's place is its meaning in every share code ever given out
    ['venue', 'Timber Arena'], ['venue', 'Great Northern Hotel'], ['venue', 'Roadhouse'], ['venue', 'Packard Field'],
    ['venue', 'Grange Hall'], ['venue', 'Bijou Cinema'],
    ['badge', 'concert'], ['badge', 'sports'], ['badge', 'arts'], ['badge', 'movie'], ['badge', 'community'],
    ['team', 'loggers'], ['team', 'timbermen'], ['team', 'steelheads'], ['team', 'owls'],
    ['badge', 'expo'], ['venue', 'Expo Barn'], ['badge', 'bar'], ['venue', 'Double R Diner'],
    ['cap', 'stadium'], ['cap', 'arena'], ['cap', 'hall'], ['cap', 'room'],
    ['venue', 'Packard Mill Days'], ['venue', 'Miss Twin Peaks'],
  ];
  var WORDS = {
    teamCity: 'Twin Peaks',
    presetDefault: 'The big venues — ' + DEFAULT_ON.join(', ') + ' — every team and type except Movies',
    presetNeighborhood: 'Just the town — no Packard Field or Expo Barn',
    presetBig: 'Only the places that hold 2,000 or more',
    phrases: { all: 'Showing everything.', none: 'Showing nothing yet — open Filter and pick some venues.', neighborhood: 'Showing the town only.', big: 'Showing the big venues only.' },
  };
  global.LQACity = {
    key: 'twinpeaks',
    name: 'Twin Peaks',
    site: X,
    userAgent: 'Mozilla/5.0 (compatible; here-core-test/1.0)',
    tz: 'America/Los_Angeles', tzName: 'Pacific',
    state: 'Washington',
    ics: { name: 'Twin Peaks Events', short: 'Twin Peaks Events', teams: 'Twin Peaks home clubs — every season', prodid: '-//here.events//here-core//EN', uidDomain: 'twinpeaks.example',
      desc: 'Upcoming events in Twin Peaks — the Timber Arena\\, the Great Northern\\, the Roadhouse' },
    teams: TEAMS,
    map: {
      kind: 'urban',
      bbox: [47.40, -121.95, 47.60, -121.65],
      home: [47.47, -121.82, 47.53, -121.74],
      roads: ['motorway', 'trunk', 'primary'],
      tolerance: 0.8,
      labels: [
        { name: 'Twin Peaks', lat: 47.4945, lon: -121.786, anchor: 'end' },
        { name: 'White Tail Falls', lat: 47.5412, lon: -121.837, kind: 'water', anchor: 'middle' },
      ],
    },
    venues: VENUES,
    defaultOn: DEFAULT_ON,
    defaultOff: DEFAULT_OFF,
    prefsKnownFrom: PREFS_KNOWN_FROM,
    types: TYPES,
    movieVenue: 'Bijou Cinema',
    groundsVenue: 'Grange Hall',
    codeLength: CODE_LENGTH,
    registry: REGISTRY,
    words: WORDS,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
