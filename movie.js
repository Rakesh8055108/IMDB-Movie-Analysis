/* IMDb Movie Analysis Dashboard JS */
(function () {
    'use strict';

    // Elements
    const el = {
        file: () => document.getElementById('csvFile'),
        useSample: () => document.getElementById('useSample'),
        yearMin: () => document.getElementById('yearMin'),
        yearMax: () => document.getElementById('yearMax'),
        minVotes: () => document.getElementById('minVotes'),
        genreChips: () => document.getElementById('genreChips'),
        searchTitle: () => document.getElementById('searchTitle'),
        resetFilters: () => document.getElementById('resetFilters'),
        metricMovies: () => document.getElementById('metricMovies'),
        metricRating: () => document.getElementById('metricRating'),
        metricRevenue: () => document.getElementById('metricRevenue'),
        metricRuntime: () => document.getElementById('metricRuntime'),
        topN: () => document.getElementById('topN'),
        topTableBody: () => document.getElementById('topTableBody'),
    };

    // State
    let fullData = [];
    let filteredData = [];
    let genres = new Set();
    let activeGenres = new Set();

    // Charts
    const charts = {};

    // Utilities
    function parseNumberSafe(value) {
        if (value === undefined || value === null) return null;
        const cleaned = String(value).replace(/[$,\s]/g, '');
        const num = Number(cleaned);
        return Number.isFinite(num) ? num : null;
    }

    function toMillion(value) {
        if (!Number.isFinite(value)) return null;
        return value >= 1e6 ? value / 1e6 : value; // if dataset in dollars, show millions
    }

    function median(values) {
        if (!values.length) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function groupBy(arr, keyFn) {
        const map = new Map();
        for (const item of arr) {
            const key = keyFn(item);
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        }
        return map;
    }

    // Sample dataset (small) if user doesn't upload
    const sampleCsv = `title,year,genres,rating,votes,revenue,runtime
The Shawshank Redemption,1994,Drama,9.3,2700000,28341469,142
The Godfather,1972,Crime|Drama,9.2,1900000,134966411,175
The Dark Knight,2008,Action|Crime|Drama,9.0,2700000,1004558444,152
12 Angry Men,1957,Crime|Drama,9.0,900000,4360000,96
Schindler's List,1993,Biography|Drama|History,9.0,1400000,322161245,195
Pulp Fiction,1994,Crime|Drama,8.9,2100000,213928762,154
Inception,2010,Action|Adventure|Sci-Fi,8.8,2400000,836836967,148
Fight Club,1999,Drama,8.8,2000000,101209702,139
Forrest Gump,1994,Drama|Romance,8.8,2200000,678200000,142
The Matrix,1999,Action|Sci-Fi,8.7,1900000,463517383,136
3 Idiots,2009,Comedy|Drama|Bollywood,8.4,400000,85000000,170
Dangal,2016,Biography|Drama|Sport|Bollywood,8.4,200000,301000000,161
PK,2014,Comedy|Drama|Sci-Fi|Bollywood,8.1,190000,140000000,153
Bajrangi Bhaijaan,2015,Adventure|Comedy|Drama|Bollywood,8.0,120000,150000000,159
Gully Boy,2019,Drama|Music|Bollywood,7.9,80000,35000000,154
Andhadhun,2018,Crime|Thriller|Bollywood,8.2,130000,45000000,139
Lagaan,2001,Adventure|Drama|Sport|Bollywood,8.1,110000,39200000,224
Taare Zameen Par,2007,Drama|Family|Bollywood,8.3,180000,28000000,165
Drishyam,2015,Crime|Drama|Thriller|Bollywood,8.2,150000,30000000,163
Baahubali: The Beginning,2015,Action|Drama|Fantasy|Tollywood,8.0,120000,100000000,159
Baahubali 2: The Conclusion,2017,Action|Drama|Fantasy|Tollywood,8.2,160000,275000000,171
RRR,2022,Action|Drama|Tollywood,8.0,240000,155000000,187
Pushpa: The Rise,2021,Action|Crime|Drama|Tollywood,7.6,90000,155000000,179
Arjun Reddy,2017,Drama|Romance|Tollywood,8.0,88000,12000000,186
Jersey,2019,Drama|Sport|Tollywood,7.9,45000,10000000,157
Ala Vaikunthapurramuloo,2020,Action|Comedy|Drama|Tollywood,7.3,42000,28000000,165
Mahanati,2018,Biography|Drama|Tollywood,8.2,38000,15000000,177
Eega,2012,Action|Fantasy|Thriller|Tollywood,7.7,55000,12000000,145`;

    // Parsing
    function parseCsv(text) {
        const result = Papa.parse(text, { header: true, dynamicTyping: false, skipEmptyLines: true });
        if (result.errors?.length) {
            console.warn('CSV parse warnings', result.errors);
        }
        return result.data.map(row => ({
            title: row.title ?? row.Title ?? row.primaryTitle ?? '',
            year: parseNumberSafe(row.year ?? row.Year ?? row.startYear),
            genres: String(row.genres ?? row.Genre ?? '').split(/[,|]/).map(g => g.trim()).filter(Boolean),
            rating: parseNumberSafe(row.rating ?? row.imdb_rating ?? row.imdbRating ?? row.averageRating),
            votes: parseNumberSafe(row.votes ?? row.numVotes ?? row.imdbVotes),
            revenue: parseNumberSafe(row.revenue ?? row.gross ?? row.box_office),
            runtime: parseNumberSafe(row.runtime ?? row.runtimeMinutes ?? row.Runtime),
        })).filter(d => d.title);
    }

    function ingestData(rows) {
        fullData = rows;
        // Build genres set
        genres = new Set();
        for (const r of fullData) for (const g of r.genres || []) genres.add(g);
        // Render genre chips
        renderGenreChips();
        // Set year bounds
        const years = fullData.map(d => d.year).filter(Number.isFinite);
        const minY = years.length ? Math.min(...years) : '';
        const maxY = years.length ? Math.max(...years) : '';
        el.yearMin().value = minY;
        el.yearMax().value = maxY;
        // Apply filters and render
        applyFilters();
    }

    function renderGenreChips() {
        const container = el.genreChips();
        container.innerHTML = '';
        const sorted = [...genres].sort();
        sorted.forEach(g => {
            const b = document.createElement('button');
            b.className = 'chip';
            b.textContent = g;
            b.type = 'button';
            b.onclick = () => {
                if (activeGenres.has(g)) activeGenres.delete(g); else activeGenres.add(g);
                b.classList.toggle('active');
                applyFilters();
            };
            container.appendChild(b);
        });
    }

    function applyFilters() {
        const yearMin = parseNumberSafe(el.yearMin().value);
        const yearMax = parseNumberSafe(el.yearMax().value);
        const minVotes = parseNumberSafe(el.minVotes().value) ?? 0;
        const query = (el.searchTitle().value || '').toLowerCase();

        filteredData = fullData.filter(d => {
            if (Number.isFinite(yearMin) && Number.isFinite(d.year) && d.year < yearMin) return false;
            if (Number.isFinite(yearMax) && Number.isFinite(d.year) && d.year > yearMax) return false;
            if (Number.isFinite(minVotes) && Number.isFinite(d.votes) && d.votes < minVotes) return false;
            if (activeGenres.size) {
                const has = (d.genres || []).some(g => activeGenres.has(g));
                if (!has) return false;
            }
            if (query && !String(d.title).toLowerCase().includes(query)) return false;
            return true;
        });

        updateMetrics();
        updateCharts();
        updateTable();
    }

    function updateMetrics() {
        const n = filteredData.length;
        const avg = (arr) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const ratings = filteredData.map(d => d.rating).filter(Number.isFinite);
        const revenues = filteredData.map(d => d.revenue).filter(Number.isFinite);
        const runtimes = filteredData.map(d => d.runtime).filter(Number.isFinite);
        el.metricMovies().textContent = n.toLocaleString();
        el.metricRating().textContent = ratings.length ? avg(ratings).toFixed(2) : '0';
        el.metricRevenue().textContent = revenues.length ? avg(revenues.map(toMillion)).toFixed(2) : '0';
        el.metricRuntime().textContent = runtimes.length ? avg(runtimes).toFixed(0) : '0';
    }

    function ensureChart(id, config) {
        if (charts[id]) {
            charts[id].data = config.data;
            charts[id].options = config.options;
            charts[id].update();
            return charts[id];
        }
        const ctx = document.getElementById(id).getContext('2d');
        charts[id] = new Chart(ctx, config);
        return charts[id];
    }

    function updateCharts() {
        // Genre -> average rating
        const byGenre = new Map();
        for (const d of filteredData) {
            if (!Number.isFinite(d.rating)) continue;
            for (const g of d.genres || []) {
                const s = byGenre.get(g) || { sum: 0, n: 0 };
                s.sum += d.rating; s.n += 1; byGenre.set(g, s);
            }
        }
        const genreLabels = [...byGenre.keys()].sort();
        const genreValues = genreLabels.map(g => byGenre.get(g).sum / byGenre.get(g).n);
        ensureChart('chartGenreRating', {
            type: 'bar',
            data: { labels: genreLabels, datasets: [{ label: 'Avg Rating', data: genreValues, backgroundColor: 'rgba(99,102,241,0.6)' }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 10 } }, plugins: { legend: { display: false } } }
        });

        // Year -> average rating
        const byYear = groupBy(filteredData.filter(d => Number.isFinite(d.year) && Number.isFinite(d.rating)), d => d.year);
        const yearLabels = [...byYear.keys()].sort((a, b) => a - b);
        const yearValues = yearLabels.map(y => {
            const list = byYear.get(y);
            return list.reduce((a, b) => a + b.rating, 0) / list.length;
        });
        ensureChart('chartYearRating', {
            type: 'line',
            data: { labels: yearLabels, datasets: [{ label: 'Avg Rating', data: yearValues, borderColor: 'rgba(34,211,238,1)', backgroundColor: 'rgba(34,211,238,0.25)', fill: true, tension: 0.25 }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, max: 10 } }, plugins: { legend: { display: false } } }
        });

        // Runtime histogram
        const runtimes = filteredData.map(d => d.runtime).filter(Number.isFinite);
        const bins = buildHistogram(runtimes, 10);
        ensureChart('chartRuntimeHist', {
            type: 'bar',
            data: { labels: bins.labels, datasets: [{ label: 'Movies', data: bins.counts, backgroundColor: 'rgba(52,211,153,0.6)' }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });

        // Revenue vs Rating scatter
        const scatterPoints = filteredData.filter(d => Number.isFinite(d.revenue) && Number.isFinite(d.rating))
            .map(d => ({ x: d.rating, y: toMillion(d.revenue), r: Math.max(3, Math.min(8, (d.votes || 0) ** 0.25)), title: d.title }));
        ensureChart('chartRevenueScatter', {
            type: 'scatter',
            data: { datasets: [{ label: 'Revenue (M) vs Rating', data: scatterPoints, backgroundColor: 'rgba(239,68,68,0.7)' }] },
            options: { responsive: true, scales: { x: { min: 0, max: 10, title: { display: true, text: 'Rating' } }, y: { title: { display: true, text: 'Revenue (Millions)' } } }, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.title}: (${ctx.raw.x.toFixed(1)}, ${ctx.raw.y?.toFixed(1) ?? 'NA'})` } } } }
        });
    }

    function buildHistogram(values, numBins) {
        if (!values.length) return { labels: [], counts: [] };
        const min = Math.min(...values);
        const max = Math.max(...values);
        const step = Math.max(1, Math.ceil((max - min) / numBins));
        const edges = [];
        for (let v = Math.floor(min); v <= Math.ceil(max) + step; v += step) edges.push(v);
        const counts = Array(edges.length - 1).fill(0);
        for (const val of values) {
            const idx = Math.min(Math.floor((val - edges[0]) / step), counts.length - 1);
            counts[idx] += 1;
        }
        const labels = counts.map((_, i) => `${edges[i]}-${edges[i + 1]}`);
        return { labels, counts };
    }

    function updateTable() {
        const top = Number(el.topN().value) || 10;
        const sorted = [...filteredData].filter(d => Number.isFinite(d.rating)).sort((a, b) => (b.rating - a.rating) || (b.votes || 0) - (a.votes || 0)).slice(0, top);
        const tbody = el.topTableBody();
        tbody.innerHTML = '';
        if (!sorted.length) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7; td.textContent = 'No data for current filters.'; td.className = 'no-css-fallback';
            tr.appendChild(td); tbody.appendChild(tr); return;
        }
        for (const d of sorted) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.title}</td>
                <td>${Number.isFinite(d.year) ? d.year : ''}</td>
                <td>${(d.genres || []).join(', ')}</td>
                <td>${Number.isFinite(d.rating) ? d.rating.toFixed(1) : ''}</td>
                <td>${Number.isFinite(d.votes) ? d.votes.toLocaleString() : ''}</td>
                <td>${Number.isFinite(d.revenue) ? toMillion(d.revenue).toFixed(1) : ''}</td>
                <td>${Number.isFinite(d.runtime) ? d.runtime : ''}</td>`;
            tbody.appendChild(tr);
        }
    }

    // Events
    function bindEvents() {
        el.file().addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => { ingestData(parseCsv(String(reader.result))); };
            reader.readAsText(file);
        });
        el.useSample().addEventListener('click', () => { ingestData(parseCsv(sampleCsv)); });
        el.yearMin().addEventListener('input', applyFilters);
        el.yearMax().addEventListener('input', applyFilters);
        el.minVotes().addEventListener('input', applyFilters);
        el.searchTitle().addEventListener('input', applyFilters);
        el.resetFilters().addEventListener('click', () => {
            el.yearMin().value = '';
            el.yearMax().value = '';
            el.minVotes().value = 0;
            el.searchTitle().value = '';
            activeGenres.clear();
            // Clear chip active class
            el.genreChips().querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            applyFilters();
        });
        el.topN().addEventListener('change', updateTable);
    }

    // Init
    window.addEventListener('DOMContentLoaded', () => {
        bindEvents();
        // Load sample by default for quick demo
        ingestData(parseCsv(sampleCsv));
    });
})();


