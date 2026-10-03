const API_KEY = '073483b77d81f361fcb39a81a2299cf7'; // <--- Colle ta clé API TMDb ici

let myCollection = JSON.parse(localStorage.getItem('myMovieCollection')) || [];
let debounceTimer;

// DOM Elements
const movieInput = document.getElementById('movie-input');
const suggestionsBox = document.getElementById('suggestions-box');
const moviesGrid = document.getElementById('movies-grid');
const sortSelect = document.getElementById('sort-select');
const filterGenreSelect = document.getElementById('filter-genre');
const randomBtn = document.getElementById('random-btn');
const movieCountEl = document.getElementById('movie-count');

// Events
movieInput.addEventListener('input', handleAutocomplete);
sortSelect.addEventListener('change', renderCollection);
filterGenreSelect.addEventListener('change', renderCollection);
randomBtn.addEventListener('click', pickRandomMovie);

document.addEventListener('click', (e) => {
  if (!movieInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
    suggestionsBox.style.display = 'none';
  }
});

// 1. AUTOCOMPLÉTION LORS DE LA SAISIE
function handleAutocomplete() {
  clearTimeout(debounceTimer);
  const query = movieInput.value.trim();

  if (query.length < 2) {
    suggestionsBox.style.display = 'none';
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=fr-FR`;
      const res = await fetch(url);
      const data = await res.json();

      displaySuggestions(data.results ? data.results.slice(0, 6) : []);
    } catch (err) {
      console.error('Erreur autocomplétion:', err);
    }
  }, 300);
}

function displaySuggestions(results) {
  if (results.length === 0) {
    suggestionsBox.style.display = 'none';
    return;
  }

  suggestionsBox.innerHTML = '';
  results.forEach(movie => {
    const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
    const posterUrl = movie.poster_path 
      ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` 
      : 'https://via.placeholder.com/92x138?text=N/A';

    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.innerHTML = `
      <img src="${posterUrl}" alt="${movie.title}">
      <div class="suggestion-info">
        <strong>${movie.title}</strong>
        <span class="suggestion-year">${year}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      addMovieById(movie.id);
      suggestionsBox.style.display = 'none';
      movieInput.value = '';
    });

    suggestionsBox.appendChild(item);
  });

  suggestionsBox.style.display = 'block';
}

// 2. AJOUT DU FILM AVEC RÉCUPÉRATION DE L'ID IMDB
async function addMovieById(movieId) {
  try {
    // On ajoute external_ids à append_to_response pour récupérer l'ID IMDb
    const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits,external_ids&language=fr-FR`;
    const res = await fetch(detailsUrl);
    const film = await res.json();

    const directorObj = film.credits?.crew?.find(person => person.job === 'Director');
    const director = directorObj ? directorObj.name : 'Inconnu';

    const year = film.release_date ? film.release_date.split('-')[0] : 'N/A';
    const imdbId = film.external_ids ? film.external_ids.imdb_id : null;
    
    // Génération de l'URL Letterboxd via ID IMDb ou recherche de secours
    const letterboxdUrl = generateLetterboxdUrl(imdbId, film.title, year);

    const newMovie = {
      id: film.id,
      title: film.title,
      originalTitle: film.original_title,
      director: director,
      runtime: film.runtime || 0,
      genres: film.genres ? film.genres.map(g => g.name) : [],
      poster: film.poster_path ? `https://image.tmdb.org/t/p/w500${film.poster_path}` : 'https://via.placeholder.com/500x750?text=Pas+d+affiche',
      year: year,
      letterboxdUrl: letterboxdUrl,
      addedAt: Date.now()
    };

    if (myCollection.some(m => m.id === newMovie.id)) {
      alert('Ce film est déjà dans ta collection !');
      return;
    }

    myCollection.push(newMovie);
    saveAndRender();

  } catch (error) {
    console.error('Erreur lors de l\'ajout du film :', error);
  }
}

// HELPER : Générer l'URL Letterboxd précise via l'ID IMDb
function generateLetterboxdUrl(imdbId, title, year) {
  if (imdbId) {
    return `https://letterboxd.com/imdb/${imdbId}/`;
  }
  // Secours si pas d'ID IMDb disponible
  const query = encodeURIComponent(`${title} ${year}`);
  return `https://letterboxd.com/search/${query}/`;
}

// HELPER : Extraire le nom de famille pour le tri par réalisateur
function getLastName(fullName) {
  if (!fullName || fullName === 'Inconnu') return 'ZZZ';
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

// 3. SÉLECTION ALÉATOIRE AVEC ANIMATION
function pickRandomMovie() {
  if (myCollection.length === 0) {
    alert('Ta collection est vide !');
    return;
  }

  const cards = document.querySelectorAll('.movie-card');
  if (cards.length === 0) return;

  cards.forEach(c => c.classList.remove('highlight'));

  let counter = 0;
  const maxCycles = 20;
  const interval = setInterval(() => {
    const randomIndex = Math.floor(Math.random() * cards.length);
    cards.forEach(c => c.classList.remove('highlight'));
    cards[randomIndex].classList.add('highlight');
    cards[randomIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    counter++;
    if (counter >= maxCycles) {
      clearInterval(interval);
    }
  }, 100);
}

// 4. SUPPRESSION D'UN FILM
function deleteMovie(id, e) {
  e.stopPropagation();
  myCollection = myCollection.filter(movie => movie.id !== id);
  saveAndRender();
}

// 5. SAUVEGARDE ET RAFRAÎCHISSEMENT
function saveAndRender() {
  localStorage.setItem('myMovieCollection', JSON.stringify(myCollection));
  updateGenreFilterOptions();
  renderCollection();
}

function updateGenreFilterOptions() {
  const allGenres = new Set();
  myCollection.forEach(movie => movie.genres.forEach(g => allGenres.add(g)));
  
  const currentFilter = filterGenreSelect.value;
  filterGenreSelect.innerHTML = '<option value="all">Tous les genres</option>';
  
  allGenres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre;
    option.textContent = genre;
    if (genre === currentFilter) option.selected = true;
    filterGenreSelect.appendChild(option);
  });
}

// 6. TRI ET RENDU DE LA COLLECTION
function renderCollection() {
  moviesGrid.innerHTML = '';

  let filtered = [...myCollection];

  // Filtre Genre
  const selectedGenre = filterGenreSelect.value;
  if (selectedGenre !== 'all') {
    filtered = filtered.filter(m => m.genres.includes(selectedGenre));
  }

  // Compteur dynamique
  const total = filtered.length;
  movieCountEl.textContent = `(${total} ${total > 1 ? 'films' : 'film'})`;

  // Algorithmes de Tri
  const sortMode = sortSelect.value;
  if (sortMode === 'added-desc') {
    filtered.sort((a, b) => b.addedAt - a.addedAt);
  } else if (sortMode === 'added-asc') {
    filtered.sort((a, b) => a.addedAt - b.addedAt);
  } else if (sortMode === 'year-desc') {
    filtered.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
  } else if (sortMode === 'year-asc') {
    filtered.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(a.year) || 0));
  } else if (sortMode === 'director') {
    filtered.sort((a, b) => getLastName(a.director).localeCompare(getLastName(b.director)));
  } else if (sortMode === 'duration-asc') {
    filtered.sort((a, b) => a.runtime - b.runtime);
  } else if (sortMode === 'duration-desc') {
    filtered.sort((a, b) => b.runtime - a.runtime);
  } else if (sortMode === 'title') {
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  }

  // Rendu HTML
  filtered.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.id = movie.id;

    card.innerHTML = `
      <a href="${movie.letterboxdUrl}" target="_blank" rel="noopener noreferrer" title="Voir sur Letterboxd">
        <img src="${movie.poster}" alt="${movie.title}">
        <div class="movie-info">
          <div class="movie-title">${movie.title} (${movie.year})</div>
          <div class="movie-meta"><strong>RÉAL :</strong> ${movie.director}</div>
          <div class="movie-meta"><strong>DURÉE :</strong> ${movie.runtime} min</div>
          <div class="movie-meta"><strong>GENRES :</strong> ${movie.genres.join(', ')}</div>
          <div class="letterboxd-link">LETTERBOXD</div>
        </div>
      </a>
      <button class="delete-btn" onclick="deleteMovie(${movie.id}, event)">Supprimer</button>
    `;

    moviesGrid.appendChild(card);
  });
}

// Lancement au chargement de la page
saveAndRender();

// ==========================================
// SCAN AUTOMATIQUE DE DOSSIER DISQUE DUR
// ==========================================

const folderInput = document.getElementById('folder-input');

if (folderInput) {
  folderInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files);
    const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.m4v'];

    // Filtrer pour garder uniquement les vidéos
    const videoFiles = files.filter(file => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      return videoExtensions.includes(ext);
    });

    if (videoFiles.length === 0) {
      alert('Aucun fichier vidéo trouvé dans ce dossier.');
      return;
    }

    alert(`Début de l'analyse de ${videoFiles.length} fichier(s) vidéo...`);

    for (const file of videoFiles) {
      const cleanTitle = cleanFileName(file.name);
      await searchAndAddByTitle(cleanTitle);
      
      // Pause de 200ms entre chaque film pour ne pas surcharger l'API TMDb
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    alert('Scan terminé ! Ta collection a été mise à jour.');
    folderInput.value = ''; // Réinitialiser le champ
  });
}

// Nettoyage des tags parasites dans le nom du fichier (1080p, x264, mkv, etc.)
function cleanFileName(name) {
  return name
    .replace(/\.[^/.]+$/, "") // Enlève l'extension (.mkv, .mp4...)
    .replace(/\b(1080p|720p|4k|2160p|bluray|brrip|web-dl|webrip|hdrip|dvdrip|x264|x265|hevc|multi|french|truefrench|vostfr)\b/gi, "") // Enlève les tags vidéo/audio
    .replace(/[._-]/g, " ") // Remplace les points, tirets et underscores par des espaces
    .replace(/\s+/g, " ") // Supprime les espaces en double
    .trim();
}

// Recherche sur TMDb et ajout automatique du 1er résultat
async function searchAndAddByTitle(cleanTitle) {
  if (!cleanTitle) return;

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(cleanTitle)}&language=fr-FR`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      await addMovieById(match.id);
    } else {
      console.warn(`Aucun résultat trouvé sur TMDb pour : "${cleanTitle}"`);
    }
  } catch (err) {
    console.error(`Erreur lors de la recherche pour "${cleanTitle}":`, err);
  }
}


// ==========================================
// EXPORT ET IMPORT DE LA COLLECTION
// ==========================================

const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');

// 1. EXPORTER LA LISTE EN FICHIER JSON
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (myCollection.length === 0) {
      alert("Ta collection est vide ! Rien à exporter.");
      return;
    }

    // Conversion de la collection en chaîne JSON formatée
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(myCollection, null, 2));
    
    // Création d'un lien de téléchargement temporaire
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cacanisette_collection_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    
    // Déclenchement du téléchargement
    downloadAnchor.click();
    downloadAnchor.remove();
  });
}

// 2. IMPORTER LA LISTE DEPUIS UN FICHIER JSON
if (importInput) {
  importInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        if (!Array.isArray(importedData)) {
          alert("Le fichier importé n'est pas valide.");
          return;
        }

        // Fusion sans doublons (en se basant sur l'ID du film)
        let addedCount = 0;
        importedData.forEach(importedMovie => {
          if (importedMovie.id && !myCollection.some(m => m.id === importedMovie.id)) {
            myCollection.push(importedMovie);
            addedCount++;
          }
        });

        saveAndRender();
        alert(`${addedCount} film(s) ajouté(s) à ta collection !`);

      } catch (err) {
        console.error("Erreur lors de l'importation :", err);
        alert("Erreur lors de la lecture du fichier JSON.");
      }
    };

    reader.readAsText(file);
    importInput.value = ''; // Réinitialisation du champ de fichier
  });
}
