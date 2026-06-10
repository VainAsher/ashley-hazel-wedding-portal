const buttons = document.querySelectorAll('[data-screen]');
const screens = document.querySelectorAll('.screen');
const mainContent = document.querySelector('main');

// Load state from synthetic fixture
const mealOptions = SYNTHETIC_FIXTURE.mealOptions;
const state = createAppState();

function showScreen(id, focusContent = false) {
  screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
  document.querySelectorAll('.sidebar nav button').forEach((button) => {
    const active = button.dataset.screen === id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (focusContent && mainContent) mainContent.focus({ preventScroll: true });
}

function setupAccessibility() {
  document.querySelectorAll('button:not([type])').forEach((button) => {
    button.type = 'button';
  });
  buttons.forEach((button) => {
    if (!button.dataset.screen) return;
    button.setAttribute('aria-controls', button.dataset.screen);
    button.setAttribute('aria-current', button.classList.contains('active') ? 'page' : 'false');
  });
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function setFeedback(element, message, type = 'success') {
  if (!element) return;
  element.textContent = message;
  element.dataset.type = type;
}

function attendingCount() {
  return state.guests.filter((guest) => guest.attending).length;
}

function updateRsvpSummary() {
  const count = attendingCount();
  const statusText = state.rsvpSubmitted
    ? `${count} of ${state.guests.length} guests marked attending in this browser-only preview.`
    : 'Not submitted yet.';

  const guestHomeStatus = document.querySelector('#guest-home .card.focus p');
  if (guestHomeStatus) guestHomeStatus.textContent = statusText;

  const rsvpMetric = Array.from(document.querySelectorAll('#dashboard .metric')).find((metric) => {
    return metric.querySelector('span')?.textContent.trim() === 'RSVPs';
  });

  if (rsvpMetric) {
    const value = rsvpMetric.querySelector('strong');
    const caption = rsvpMetric.querySelector('small');
    if (value) value.textContent = state.rsvpSubmitted ? `${count} / ${state.guests.length}` : '0 / 2';
    if (caption) caption.textContent = state.rsvpSubmitted ? 'Synthetic local replies saved' : 'Guest replies pending';
  }
}

function initRsvp() {
  const rsvpCard = document.querySelector('.rsvp-card');
  if (!rsvpCard) return;

  rsvpCard.querySelectorAll('.guest-row, .form-grid').forEach((element) => element.remove());

  const region = document.createElement('div');
  region.className = 'rsvp-guests';
  rsvpCard.insertBefore(region, rsvpCard.querySelector('.notice'));

  const feedback = document.createElement('div');
  feedback.className = 'form-feedback';
  feedback.setAttribute('aria-live', 'polite');
  rsvpCard.querySelector('.notice')?.after(feedback);

  function renderGuests() {
    region.innerHTML = state.guests.map((guest) => {
      const options = mealOptions.map((meal) => {
        const selected = meal === guest.meal ? ' selected' : '';
        return `<option${selected}>${escapeHtml(meal)}</option>`;
      }).join('');

      return `
        <div class="guest-row" data-guest-id="${escapeHtml(guest.id)}">
          <div>
            <h3>${escapeHtml(guest.name)}</h3>
            <p>${escapeHtml(guest.description)}</p>
          </div>
          <label><input type="checkbox" data-rsvp-field="attending" data-guest-id="${escapeHtml(guest.id)}" ${guest.attending ? 'checked' : ''} /> Attending</label>
        </div>
        <div class="form-grid">
          <label>Meal choice
            <select data-rsvp-field="meal" data-guest-id="${escapeHtml(guest.id)}">${options}</select>
          </label>
          <label>${escapeHtml(guest.notesLabel)}
            <input data-rsvp-field="notes" data-guest-id="${escapeHtml(guest.id)}" placeholder="${escapeHtml(guest.notesPlaceholder)}" value="${escapeHtml(guest.notes)}" />
          </label>
        </div>
      `;
    }).join('');
  }

  region.addEventListener('input', (event) => updateGuestFromControl(event.target));
  region.addEventListener('change', (event) => updateGuestFromControl(event.target));

  function updateGuestFromControl(control) {
    const guest = state.guests.find((item) => item.id === control.dataset.guestId);
    if (!guest) return;

    if (control.dataset.rsvpField === 'attending') guest.attending = control.checked;
    if (control.dataset.rsvpField === 'meal') guest.meal = control.value;
    if (control.dataset.rsvpField === 'notes') guest.notes = control.value.trim();

    updateRsvpSummary();
  }

  const submitButton = rsvpCard.querySelector('button.primary');
  submitButton?.addEventListener('click', (event) => {
    event.preventDefault();
    state.rsvpSubmitted = true;
    updateRsvpSummary();
    setFeedback(feedback, `Saved locally for preview: ${attendingCount()} of ${state.guests.length} guests attending.`, 'success');
  });

  renderGuests();
  updateRsvpSummary();
}

function initSongRequests() {
  const form = document.querySelector('.request-form');
  const wall = document.querySelector('.song-wall');
  if (!form || !wall) return;

  const titleInput = form.querySelector('input');
  const artistInput = form.querySelectorAll('input')[1];
  const dedicationInput = form.querySelector('textarea');
  const addButton = form.querySelector('button.primary');
  const feedback = document.createElement('div');
  feedback.className = 'form-feedback';
  feedback.setAttribute('aria-live', 'polite');
  form.appendChild(feedback);

  function renderSongs() {
    if (!state.songs.length) {
      wall.innerHTML = '<article class="empty-state">No songs yet. Add the first synthetic request.</article>';
      return;
    }

    wall.innerHTML = state.songs.map((song) => `
      <article>
        <strong>${escapeHtml(song.title)}</strong>
        <span>${escapeHtml(song.artist)}</span>
        <p>${escapeHtml(song.dedication)}</p>
        <button type="button" data-like-song="${escapeHtml(song.id)}" aria-label="Like ${escapeHtml(song.title)} by ${escapeHtml(song.artist)}">&hearts; ${song.likes}</button>
      </article>
    `).join('');
  }

  addButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const artist = artistInput.value.trim();
    const dedication = dedicationInput.value.trim();

    if (!title || !artist) {
      setFeedback(feedback, 'Add a song title and artist before saving.', 'error');
      return;
    }

    state.songs.unshift({
      id: makeId('song'),
      title,
      artist,
      dedication: dedication || 'Requested from the browser-only preview.',
      likes: 1,
    });

    titleInput.value = '';
    artistInput.value = '';
    dedicationInput.value = '';
    renderSongs();
    setFeedback(feedback, 'Song request added locally for this preview.', 'success');
  });

  wall.addEventListener('click', (event) => {
    const button = event.target.closest('[data-like-song]');
    if (!button) return;
    const song = state.songs.find((item) => item.id === button.dataset.likeSong);
    if (!song) return;
    song.likes += 1;
    renderSongs();
  });

  renderSongs();
}

function initBlessingsWall() {
  const posts = document.querySelector('.wall-posts');
  if (!posts) return;

  const form = document.createElement('article');
  form.className = 'card wall-form';
  form.innerHTML = `
    <h3>Leave a synthetic blessing</h3>
    <label>Your display name<input id="blessing-author" value="Family Friend" /></label>
    <label>Message<textarea id="blessing-message">Wishing you a home full of music, patience, and joy.</textarea></label>
    <button type="button" class="primary" id="add-blessing">Add blessing</button>
    <div class="form-feedback" aria-live="polite"></div>
  `;
  posts.parentElement.insertBefore(form, posts);

  const authorInput = form.querySelector('#blessing-author');
  const messageInput = form.querySelector('#blessing-message');
  const addButton = form.querySelector('#add-blessing');
  const feedback = form.querySelector('.form-feedback');

  function renderBlessings() {
    if (!state.blessings.length) {
      posts.innerHTML = '<article class="empty-state">No blessings yet. Add the first synthetic guestbook message.</article>';
      return;
    }

    posts.innerHTML = state.blessings.map((blessing) => `
      <article>
        ${blessing.pinned ? '<span class="pin">Pinned</span>' : ''}
        <h3>${escapeHtml(blessing.author)}</h3>
        <p>${escapeHtml(blessing.message)}</p>
        <button type="button" data-like-blessing="${escapeHtml(blessing.id)}" aria-label="Like blessing from ${escapeHtml(blessing.author)}">&hearts; ${blessing.likes}</button>
      </article>
    `).join('');
  }

  addButton?.addEventListener('click', (event) => {
    event.preventDefault();
    const author = authorInput.value.trim();
    const message = messageInput.value.trim();

    if (!author || !message) {
      setFeedback(feedback, 'Add a display name and message before saving.', 'error');
      return;
    }

    state.blessings.unshift({
      id: makeId('blessing'),
      author,
      message,
      likes: 1,
      pinned: false,
    });

    authorInput.value = '';
    messageInput.value = '';
    renderBlessings();
    setFeedback(feedback, 'Blessing added locally for this preview.', 'success');
  });

  posts.addEventListener('click', (event) => {
    const button = event.target.closest('[data-like-blessing]');
    if (!button) return;
    const blessing = state.blessings.find((item) => item.id === button.dataset.likeBlessing);
    if (!blessing) return;
    blessing.likes += 1;
    renderBlessings();
  });

  renderBlessings();
}

// Export functions for WD-004
function exportBudgetAsText() {
  const budgetItems = [
    { category: 'Venue', allocated: '£4,500', forecast: '£4,500', paid: '£1,000', variance: '£0', status: 'On track' },
    { category: 'Photography', allocated: '£1,200', forecast: '£1,650', paid: '£0', variance: '+£450', status: 'Review' },
    { category: 'Decor', allocated: '£900', forecast: '£1,270', paid: '£100', variance: '+£370', status: 'Forecast risk' },
  ];

  let csv = 'WEDDING BUDGET SUMMARY\n';
  csv += 'Ashley & Hazel - 19 June 2027\n';
  csv += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';
  csv += 'Category,Allocated,Forecast,Paid,Variance,Status\n';

  budgetItems.forEach((item) => {
    csv += `${item.category},${item.allocated},${item.forecast},${item.paid},${item.variance},${item.status}\n`;
  });

  downloadFile(csv, 'wedding-budget-' + new Date().toISOString().split('T')[0] + '.txt');
}

function exportPlanningAsText() {
  const planningTasks = {
    'To do': ['Draft travel page', 'Confirm meal options'],
    'Doing': ['Build guest list', 'Source profile photos'],
    'Waiting': ['Venue parking details', 'Photographer quote'],
    'Done': ['Core feature rules accepted'],
  };

  let text = 'WEDDING PLANNING BOARD\n';
  text += 'Ashley & Hazel - 19 June 2027\n';
  text += 'Generated: ' + new Date().toLocaleDateString() + '\n\n';

  Object.keys(planningTasks).forEach((status) => {
    text += status.toUpperCase() + ' (' + planningTasks[status].length + ')\n';
    planningTasks[status].forEach((task) => {
      text += '  • ' + task + '\n';
    });
    text += '\n';
  });

  downloadFile(text, 'wedding-planning-' + new Date().toISOString().split('T')[0] + '.txt');
}

function downloadFile(content, filename) {
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

setupAccessibility();
buttons.forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.screen, true)));
initRsvp();
initSongRequests();
initBlessingsWall();
