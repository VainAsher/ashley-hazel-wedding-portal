/**
 * Synthetic Wedding Data Fixture
 *
 * This file contains realistic but entirely synthetic data for the Wedding Dashboard prototype.
 * No real guest names, contact details, addresses, dietary restrictions, or RSVP data are included.
 * All names, households, and responses are fictional for testing and demonstration purposes.
 */

const SYNTHETIC_FIXTURE = {
  // Guest list — synthetic household members
  guests: [
    {
      id: 'guest-001',
      name: 'Alex Palmer',
      description: 'Day guest · adult meal',
      attending: true,
      meal: 'Jerk chicken with rice & peas',
      notesLabel: 'Dietary/allergy notes',
      notesPlaceholder: 'e.g. nut allergy',
      notes: '',
    },
    {
      id: 'guest-002',
      name: 'Jordan Chen',
      description: 'Day guest · adult meal',
      attending: true,
      meal: 'Vegetarian celebration plate',
      notesLabel: 'Accessibility notes',
      notesPlaceholder: 'Optional',
      notes: '',
    },
  ],

  // Meal options available at the reception
  mealOptions: [
    'Jerk chicken with rice & peas',
    'Vegetarian celebration plate',
    "Children's meal",
  ],

  // Song requests submitted by guests
  songs: [
    {
      id: 'song-001',
      title: 'Candy',
      artist: 'Cameo',
      dedication: 'Requested by Alex Palmer',
      likes: 12,
    },
    {
      id: 'song-002',
      title: 'Could You Be Loved',
      artist: 'Bob Marley',
      dedication: 'Requested by Jordan Chen',
      likes: 9,
    },
    {
      id: 'song-003',
      title: 'Essence',
      artist: 'Wizkid ft. Tems',
      dedication: 'Requested by a synthetic guest',
      likes: 7,
    },
  ],

  // Blessings and well-wishes from guests
  blessings: [
    {
      id: 'blessing-001',
      author: 'Alex Palmer',
      message: 'May your home be full of laughter, music, patience, and good food. Blessings always.',
      likes: 18,
      pinned: true,
    },
    {
      id: 'blessing-002',
      author: 'The Chen Household',
      message: 'We cannot wait to celebrate with you both. Wishing you endless joy and beautiful moments together.',
      likes: 23,
      pinned: false,
    },
    {
      id: 'blessing-003',
      author: 'Synthetic Friend',
      message: 'A guestbook on the web — iconic and timeless. Here\'s to love, laughter, and a celebration none of us will forget.',
      likes: 15,
      pinned: false,
    },
  ],
};

/**
 * Initialize app state from the synthetic fixture.
 * Called once on page load to populate the dashboard.
 *
 * @returns {Object} App state object with all interactive data
 */
function createAppState() {
  return {
    rsvpSubmitted: false,
    guests: JSON.parse(JSON.stringify(SYNTHETIC_FIXTURE.guests)), // Deep copy to avoid mutating fixture
    songs: JSON.parse(JSON.stringify(SYNTHETIC_FIXTURE.songs)),
    blessings: JSON.parse(JSON.stringify(SYNTHETIC_FIXTURE.blessings)),
  };
}
