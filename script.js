// ==========================================
// CONFIG & STATE MANAGEMENT
// ==========================================
const API_KEY = '253d07de819451284c5ac48c5119b0d4';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280';

let currentLang = 'ja-JP'; // デフォルトは日本語 ('ja-JP' or 'en-US')
let currentCategory = 'trending'; // 'trending', 'top-rated', 'search', 'favorites'
let favorites = JSON.parse(localStorage.getItem('cinema_favs')) || [];

// ==========================================
// DOM ELEMENTS
// ==========================================
const movieGrid = document.getElementById('movie-grid');
const searchInput = document.getElementById('search-input');
const sectionTitle = document.getElementById('section-title');
const langBtn = document.getElementById('lang-btn');
const currentLangSpan = document.getElementById('current-lang');
const favCountSpan = document.getElementById('fav-count');
const genreSelect = document.getElementById('genre-select');
const tabTrending = document.getElementById('tab-trending');
const tabTopRated = document.getElementById('tab-top-rated');
const favTabBtn = document.getElementById('fav-tab-btn');
const modal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.getElementById('close-modal');

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  updateFavCount();
  fetchGenres();
  fetchMovies();
  setupFAQ();
});

// ==========================================
// API FETCH FUNCTIONS
// ==========================================
// 映画データの取得（カテゴリ/検索）
async function fetchMovies(query = '') {
  let endpoint = '';
  
  if (query) {
    endpoint = `${BASE_URL}/search/movie?api_key=${API_KEY}&language=${currentLang}&query=${encodeURIComponent(query)}`;
  } else if (currentCategory === 'top-rated') {
    endpoint = `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=${currentLang}`;
  } else {
    endpoint = `${BASE_URL}/trending/movie/day?api_key=${API_KEY}&language=${currentLang}`;
  }

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    renderMovies(data.results || []);
  } catch (error) {
    console.error('Data Fetch Error:', error);
    movieGrid.innerHTML = '<p class="error-msg">データの取得に失敗しました。</p>';
  }
}

// ジャンル一覧の取得
async function fetchGenres() {
  try {
    const res = await fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=${currentLang}`);
    const data = await res.json();
    populateGenreSelect(data.genres || []);
  } catch (error) {
    console.error('Genre Fetch Error:', error);
  }
}

// 予告編（YouTube）キーの取得
async function fetchTrailerKey(movieId) {
  try {
    const res = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${API_KEY}&language=${currentLang}`);
    const data = await res.json();
    const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.results[0];
    return trailer ? trailer.key : null;
  } catch (error) {
    return null;
  }
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderMovies(movies) {
  movieGrid.innerHTML = '';

  if (movies.length === 0) {
    movieGrid.innerHTML = '<p class="no-results">該当する作品が見つかりませんでした。</p>';
    return;
  }

  movies.forEach(movie => {
    const posterPath = movie.poster_path 
      ? `${IMAGE_BASE_URL}${movie.poster_path}` 
      : 'https://via.placeholder.com/500x750?text=NO+IMAGE';
    
    const isFav = favorites.some(f => f.id === movie.id);
    const vote = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
    
    // スコアに応じたカラー判定
    let scoreClass = 'low';
    if (movie.vote_average >= 8.0) scoreClass = 'high';
    else if (movie.vote_average >= 6.0) scoreClass = 'mid';

    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${posterPath}" alt="${movie.title}" loading="lazy">
        <button class="fav-heart-btn ${isFav ? 'active' : ''}" data-id="${movie.id}">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
        </button>
      </div>
      <div class="movie-info">
        <h3 class="movie-title">${movie.title}</h3>
        <div class="movie-meta">
          <span>${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'}</span>
          <span class="score ${scoreClass}"><i class="fa-solid fa-star"></i> ${vote}</span>
        </div>
      </div>
    `;

    // カードクリックで詳細表示
    card.addEventListener('click', (e) => {
      if (e.target.closest('.fav-heart-btn')) return; // お気に入り押下時はモーダルを開かない
      openModal(movie);
    });

    // お気に入りボタン押下時
    const heartBtn = card.querySelector('.fav-heart-btn');
    heartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(movie);
    });

    movieGrid.appendChild(card);
  });
}

// モーダル（詳細画面）オープン
async function openModal(movie) {
  const backdropPath = movie.backdrop_path 
    ? `${BACKDROP_BASE_URL}${movie.backdrop_path}` 
    : `${IMAGE_BASE_URL}${movie.poster_path}`;

  const trailerKey = await fetchTrailerKey(movie.id);

  modalBody.innerHTML = `
    <img class="modal-backdrop" src="${backdropPath}" alt="${movie.title}">
    <div class="modal-details">
      <h2>${movie.title}</h2>
      <p style="margin: 0.5rem 0; color: #aaa;">公開日: ${movie.release_date || '不明'} | 評価: ★ ${movie.vote_average.toFixed(1)}</p>
      <p style="margin-top: 1rem; font-size: 0.95rem; line-height: 1.6;">${movie.overview || 'あらすじ情報がありません。'}</p>
      ${trailerKey ? `
        <div class="video-container">
          <iframe src="https://www.youtube.com/embed/${trailerKey}" allowfullscreen></iframe>
        </div>
      ` : ''}
    </div>
  `;

  modal.classList.remove('hidden');
}

// ==========================================
// LOCALSTORAGE & FAVORITES
// ==========================================
function toggleFavorite(movie) {
  const index = favorites.findIndex(f => f.id === movie.id);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(movie);
  }
  localStorage.setItem('cinema_favs', JSON.stringify(favorites));
  updateFavCount();

  if (currentCategory === 'favorites') {
    renderMovies(favorites);
  } else {
    fetchMovies(searchInput.value.trim());
  }
}

function updateFavCount() {
  favCountSpan.textContent = favorites.length;
}

// ==========================================
// GENRE & FAQ LOGIC
// ==========================================
function populateGenreSelect(genres) {
  genreSelect.innerHTML = `<option value="">${currentLang === 'ja-JP' ? 'すべてのジャンル' : 'All Genres'}</option>`;
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    genreSelect.appendChild(option);
  });
}

function setupFAQ() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      item.classList.toggle('open');
    });
  });
}

// ==========================================
// EVENT LISTENERS
// ==========================================
// 検索窓入力（ENTER押下で実行）
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (query) {
      currentCategory = 'search';
      sectionTitle.textContent = currentLang === 'ja-JP' ? `検索結果: "${query}"` : `Search Results: "${query}"`;
      fetchMovies(query);
    }
  }
});

// トレンドタブ
tabTrending.addEventListener('click', () => {
  currentCategory = 'trending';
  tabTrending.classList.add('active');
  tabTopRated.classList.remove('active');
  sectionTitle.textContent = currentLang === 'ja-JP' ? '人気の映画・アニメ' : 'Trending Movies';
  searchInput.value = '';
  fetchMovies();
});

// 高評価タブ
tabTopRated.addEventListener('click', () => {
  currentCategory = 'top-rated';
  tabTopRated.classList.add('active');
  tabTrending.classList.remove('active');
  sectionTitle.textContent = currentLang === 'ja-JP' ? '歴代の高評価作品' : 'Top Rated Movies';
  searchInput.value = '';
  fetchMovies();
});

// お気に入りタブ
favTabBtn.addEventListener('click', () => {
  currentCategory = 'favorites';
  tabTrending.classList.remove('active');
  tabTopRated.classList.remove('active');
  sectionTitle.textContent = currentLang === 'ja-JP' ? 'お気に入り作品' : 'Your Favorites';
  renderMovies(favorites);
});

// 多言語切り替え（JP / EN）
langBtn.addEventListener('click', () => {
  if (currentLang === 'ja-JP') {
    currentLang = 'en-US';
    currentLangSpan.textContent = 'EN';
  } else {
    currentLang = 'ja-JP';
    currentLangSpan.textContent = 'JP';
  }
  fetchGenres();
  if (currentCategory === 'favorites') {
    renderMovies(favorites);
  } else {
    fetchMovies(searchInput.value.trim());
  }
});

// モーダル閉じる
closeModal.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});
// ジャンル選択時の絞り込み処理
genreSelect.addEventListener('change', (e) => {
  const selectedGenreId = e.target.value;
  const cards = document.querySelectorAll('.movie-card');

  // すべてのジャンルが選ばれた場合は全表示
  if (!selectedGenreId) {
    cards.forEach(card => card.style.display = 'block');
    return;
  }

  // 選択されたジャンルが含まれる映画のみ表示
  // ※取得済みデータから絞り込む処理
  fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&language=${currentLang}&with_genres=${selectedGenreId}`)
    .then(res => res.json())
    .then(data => {
      sectionTitle.textContent = `${genreSelect.options[genreSelect.selectedIndex].text} 一覧`;
      renderMovies(data.results || []);
    });
});
