import { parseFollowers, parseFollowing } from './parser.js';
import { compareRelationshipSets } from './comparator.js';
import { SAMPLE_FOLLOWERS_JSON, SAMPLE_FOLLOWING_JSON } from './sampleData.js';

// --- STATE MANAGEMENT ---
let followersSet = new Set();
let followingSet = new Set();
let followersFilesCount = 0;
let followingFileLoaded = false;
let currentTab = 'notFollowingBack'; // 'notFollowingBack' | 'notFollowedBack' | 'mutuals'
let currentComparison = null;
let searchQuery = '';

// --- DOM ELEMENTS ---
const followersInput = document.getElementById('followers-file-input');
const followingInput = document.getElementById('following-file-input');
const followersDropzone = document.getElementById('followers-dropzone');
const followingDropzone = document.getElementById('following-dropzone');
const followersStatus = document.getElementById('followers-status');
const followingStatus = document.getElementById('following-status');
const demoBtn = document.getElementById('demo-btn');
const searchInput = document.getElementById('search-input');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const toastEl = document.getElementById('toast');

// Stats elements
const statFollowers = document.getElementById('stat-followers');
const statFollowing = document.getElementById('stat-following');
const statNotFollowingBack = document.getElementById('stat-not-following-back');
const statNotFollowedBack = document.getElementById('stat-not-followed-back');
const statMutuals = document.getElementById('stat-mutuals');

// Tab buttons
const tabBtns = document.querySelectorAll('.tab-btn');
const tabCountNotFollowingBack = document.getElementById('count-not-following-back');
const tabCountNotFollowedBack = document.getElementById('count-not-followed-back');
const tabCountMutuals = document.getElementById('count-mutuals');

// List container
const listContainer = document.getElementById('list-container');

// --- HELPER FUNCTIONS ---
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2500);
}

function updateDashboard() {
  if (!currentComparison) {
    statFollowers.textContent = '0';
    statFollowing.textContent = '0';
    statNotFollowingBack.textContent = '0';
    statNotFollowedBack.textContent = '0';
    statMutuals.textContent = '0';
    tabCountNotFollowingBack.textContent = '0';
    tabCountNotFollowedBack.textContent = '0';
    tabCountMutuals.textContent = '0';
    renderList();
    return;
  }

  const { stats } = currentComparison;
  statFollowers.textContent = stats.followersCount.toLocaleString();
  statFollowing.textContent = stats.followingCount.toLocaleString();
  statNotFollowingBack.textContent = stats.notFollowingBackCount.toLocaleString();
  statNotFollowedBack.textContent = stats.notFollowedBackCount.toLocaleString();
  statMutuals.textContent = stats.mutualsCount.toLocaleString();

  tabCountNotFollowingBack.textContent = stats.notFollowingBackCount.toLocaleString();
  tabCountNotFollowedBack.textContent = stats.notFollowedBackCount.toLocaleString();
  tabCountMutuals.textContent = stats.mutualsCount.toLocaleString();

  renderList();
}

function recalculateComparison() {
  if (followersSet.size > 0 || followingSet.size > 0) {
    currentComparison = compareRelationshipSets(followersSet, followingSet);
  } else {
    currentComparison = null;
  }
  updateDashboard();
}

function renderList() {
  if (!currentComparison) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">□</div>
        <div class="empty-state-title">Ready to compare</div>
        <div class="empty-state-desc">
          Upload your Instagram followers and following files above, or click "Try Demo Data" to see how it works.
        </div>
      </div>
    `;
    return;
  }

  const rawList = currentComparison.lists[currentTab] || [];
  const query = searchQuery.trim().toLowerCase();
  const filteredList = query
    ? rawList.filter(name => name.toLowerCase().includes(query))
    : rawList;

  if (filteredList.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">ø</div>
        <div class="empty-state-title">No accounts found</div>
        <div class="empty-state-desc">
          ${query ? 'No usernames matched your search filter.' : 'No accounts in this relationship category.'}
        </div>
      </div>
    `;
    return;
  }

  let badgeText = 'Not following you back';
  if (currentTab === 'notFollowedBack') badgeText = "You don't follow back";
  if (currentTab === 'mutuals') badgeText = 'Mutual follower';

  const ul = document.createElement('ul');
  ul.className = 'user-list';

  filteredList.forEach((username, index) => {
    const li = document.createElement('li');
    li.className = 'user-item';

    const leftDiv = document.createElement('div');
    const idxSpan = document.createElement('span');
    idxSpan.className = 'user-index';
    idxSpan.textContent = `#${String(index + 1).padStart(3, '0')}`;

    const link = document.createElement('a');
    link.className = 'user-name-link';
    link.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.innerHTML = `@${username} <span class="user-ext-icon">↗</span>`;

    leftDiv.appendChild(idxSpan);
    leftDiv.appendChild(link);

    const rightBadge = document.createElement('span');
    rightBadge.className = 'user-badge-right';
    rightBadge.textContent = badgeText;

    li.appendChild(leftDiv);
    li.appendChild(rightBadge);
    ul.appendChild(li);
  });

  listContainer.innerHTML = '';
  listContainer.appendChild(ul);
}

// --- FILE READING HANDLERS ---
async function handleFollowersFiles(files) {
  if (!files || files.length === 0) return;
  followersFilesCount += files.length;
  followersStatus.textContent = `${followersFilesCount} file(s) loaded`;
  followersStatus.classList.add('loaded');

  for (const file of files) {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const newUsers = parseFollowers(json);
      for (const u of newUsers) {
        followersSet.add(u);
      }
    } catch (err) {
      console.error('Error parsing follower file:', file.name, err);
      showToast(`Error reading file: ${file.name}`);
    }
  }

  recalculateComparison();
  showToast(`Followers loaded (${followersSet.size} total accounts)`);
}

async function handleFollowingFile(file) {
  if (!file) return;
  followingFileLoaded = true;
  followingStatus.textContent = file.name;
  followingStatus.classList.add('loaded');

  try {
    const text = await file.text();
    const json = JSON.parse(text);
    followingSet = parseFollowing(json);
    recalculateComparison();
    showToast(`Following loaded (${followingSet.size} total accounts)`);
  } catch (err) {
    console.error('Error parsing following file:', file.name, err);
    showToast(`Error reading file: ${file.name}`);
  }
}

// --- DEMO DATA TOGGLE ---
function loadDemoData() {
  followersSet = parseFollowers(SAMPLE_FOLLOWERS_JSON);
  followingSet = parseFollowing(SAMPLE_FOLLOWING_JSON);

  followersStatus.textContent = 'Demo data loaded';
  followersStatus.classList.add('loaded');
  followingStatus.textContent = 'Demo data loaded';
  followingStatus.classList.add('loaded');

  recalculateComparison();
  showToast('Sample Demo Data Loaded!');
}

// --- DRAG & DROP EVENT BINDINGS ---
function setupDropzone(dropEl, inputEl, onFilesCallback) {
  dropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropEl.classList.add('dragover');
  });

  dropEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropEl.classList.remove('dragover');
  });

  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropEl.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (inputEl.multiple) {
        onFilesCallback(e.dataTransfer.files);
      } else {
        onFilesCallback(e.dataTransfer.files[0]);
      }
    }
  });

  inputEl.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (inputEl.multiple) {
        onFilesCallback(e.target.files);
      } else {
        onFilesCallback(e.target.files[0]);
      }
    }
  });
}

// --- INITIALIZE EVENT LISTENERS ---
function init() {
  setupDropzone(followersDropzone, followersInput, handleFollowersFiles);
  setupDropzone(followingDropzone, followingInput, handleFollowingFile);

  demoBtn.addEventListener('click', () => {
    loadDemoData();
  });

  // Tab switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-tab');
      renderList();
    });
  });

  // Live search
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  // Copy list button
  copyBtn.addEventListener('click', () => {
    if (!currentComparison) {
      showToast('No list to copy yet.');
      return;
    }
    const list = currentComparison.lists[currentTab] || [];
    if (list.length === 0) {
      showToast('List is empty.');
      return;
    }
    const textToCopy = list.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToast(`Copied ${list.length} username(s) to clipboard!`);
    }).catch(() => {
      showToast('Failed to copy to clipboard.');
    });
  });

  // Download list button
  downloadBtn.addEventListener('click', () => {
    if (!currentComparison) {
      showToast('No list to download yet.');
      return;
    }
    const list = currentComparison.lists[currentTab] || [];
    if (list.length === 0) {
      showToast('List is empty.');
      return;
    }
    const textContent = list.map((u, i) => `#${String(i + 1).padStart(3, '0')} ${u} (https://www.instagram.com/${u}/)`).join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instagram_${currentTab}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${currentTab}.txt!`);
  });

  // Initial dashboard render
  updateDashboard();
}

window.addEventListener('DOMContentLoaded', init);
