// Events for events.html and the flier pop-up shown on every page (flier-popup.js).
//
// To add an event, add an entry to COMMONWILD_EVENTS. Times are local Cincinnati time ("YYYY-MM-DDTHH:MM").
// Once an event's `end` has passed it moves to "Past events", and its flier (if it has one) moves into the
// flier archive at the bottom of events.html. The pop-up always shows the flier of the next upcoming event.
// `host` must be one of the keys in COMMONWILD_HOSTS.

window.COMMONWILD_HOSTS = {
  commonwild: {
    name: 'CommonWild',
    blurb: 'Events we host in Northside.'
  },
  millcreek: {
    name: 'Mill Creek Alliance',
    logo: 'events/logos/mill-creek-alliance.webp',
    url: 'https://www.themillcreekalliance.org/'
  },
  langland: {
    name: 'Langland Wildway'
  },
  northside: {
    name: 'Northside Greenspace Inc.',
    url: 'https://www.northsidegreenspace.org/'
  }
};

window.COMMONWILD_EVENTS = [
  {
    id: '2026-10-14-native-plant-party',
    host: 'commonwild',
    cohost: 'The Village Green Foundation',
    title: 'Native Plant Party and Potluck',
    start: '2026-10-14T17:00',
    end: '2026-10-14T21:00',
    location: 'The Village Green, 1413 Knowlton St, Cincinnati, OH 45223',
    summary: 'A skill share at 5pm, followed by a potluck dinner, live music, and a bonfire. Bring food or drink to share, and bring home native plants and seeds!',
    details: [
      'Composting Basics',
      'Native Plant Seed Collection 101',
      'Urban Native Garden Design',
      'Making T-Shirt Yarn',
      'Processing Native Nut Crops'
    ],
    detailsHeading: 'Skill share at 5pm',
    flier: 'events/fliers/2026-10-14-native-plant-party-and-potluck.webp',
    flierAlt: 'Flier: CommonWild Cincy and The Village Green Foundation present the Native Plant Party and Potluck at The Village Green, Wednesday, October 14 from 5-9pm. Skill share at 5pm, then a potluck dinner, live music and a bonfire.'
  },
  {
    id: '2026-10-25-wildway-workday',
    host: 'langland',
    title: 'Wildway Workday',
    start: '2026-10-25T10:00',
    end: '2026-10-25T13:00',
    summary: 'The focus is planting lots of native perennials, with some tree planting, invasive plant maintenance, and site prep for next year’s perennial planting.'
  },
  {
    id: '2026-10-31-freedom-grove-workday',
    host: 'millcreek',
    title: 'Workday at the Freedom Grove',
    start: '2026-10-31T09:00',
    end: '2026-10-31T12:00',
    location: 'Freedom Grove'
  }
];
