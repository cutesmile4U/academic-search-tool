// Global variables
let currentSearchMode = 'simple';
let searchHistory = JSON.parse(localStorage.getItem('searchHistory')) || [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeSearchMode();
    loadSearchHistory();
});

// Search Mode Toggle
function initializeSearchMode() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    const searchInterfaces = document.querySelectorAll('.search-interface');
    
    modeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const mode = this.dataset.mode;
            
            // Update active button
            modeButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Show correct interface
            searchInterfaces.forEach(interface => {
                interface.style.display = 'none';
            });
            
            document.getElementById(`${mode}-search`).style.display = 'block';
            currentSearchMode = mode;
        });
    });
}

// Simple Search
async function performSearch() {
    const query = document.getElementById('simple-query').value.trim();
    if (!query) {
        alert('Please enter a search query');
        return;
    }
    
    await executeSearch(query);
}

// Advanced Search
function performAdvancedSearch() {
    const queryBlocks = document.querySelectorAll('.query-block');
    let query = '';
    
    queryBlocks.forEach((block, index) => {
        const operator = block.querySelector('.operator-select').value;
        const term = block.querySelector('.query-input').value.trim();
        
        if (term) {
            if (index === 0) {
                query += term;
            } else {
                query += ` ${operator} ${term}`;
            }
        }
    });
    
    if (!query) {
        alert('Please enter at least one search term');
        return;
    }
    
    executeSearch(query);
}

// Query Builder Functions
function addQueryBlock(operator) {
    const queryBuilder = document.querySelector('.query-builder');
    const newId = Date.now();
    
    const queryBlock = document.createElement('div');
    queryBlock.className = 'query-block';
    queryBlock.dataset.id = newId;
    queryBlock.innerHTML = `
        <select class="operator-select">
            <option value="AND">AND</option>
            <option value="OR">OR</option>
            <option value="NOT">NOT</option>
        </select>
        <input type="text" class="query-input" placeholder="Enter search term...">
        <button class="remove-btn" onclick="removeQueryBlock(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    queryBuilder.appendChild(queryBlock);
}

function removeQueryBlock(button) {
    const queryBlocks = document.querySelectorAll('.query-block');
    if (queryBlocks.length > 1) {
        button.closest('.query-block').remove();
    }
}

// Main Search Execution
async function executeSearch(query) {
    showLoading();
    hideResults();
    
    try {
        const filters = getSearchFilters();
        const results = await searchAcademicAPIs(query, filters);
        displayResults(results, query);
        addToSearchHistory(query, results.length);
    } catch (error) {
        console.error('Search error:', error);
        showError('Search failed. Please try again.');
    } finally {
        hideLoading();
    }
}

// Get search filters
function getSearchFilters() {
    const sources = Array.from(document.querySelectorAll('input[name="source"]:checked'))
        .map(checkbox => checkbox.value);
    
    return {
        sources: sources,
        yearMin: document.getElementById('year-min').value,
        yearMax: document.getElementById('year-max').value,
        maxResults: document.getElementById('max-results').value
    };
}

// Search APIs
async function searchAcademicAPIs(query, filters) {
    const promises = [];
    
    if (filters.sources.includes('pubmed')) {
        promises.push(searchPubMed(query, filters));
    }
    
    if (filters.sources.includes('arxiv')) {
        promises.push(searchArxiv(query, filters));
    }
    
    if (filters.sources.includes('core')) {
        promises.push(searchCore(query, filters));
    }
    
    if (filters.sources.includes('crossref')) {
        promises.push(searchCrossref(query, filters));
    }
    
    const results = await Promise.allSettled(promises);
    const papers = [];
    
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            papers.push(...result.value);
        }
    });
    
    // Remove duplicates and limit results
    return removeDuplicates(papers).slice(0, filters.maxResults);
}

// PubMed Search
async function searchPubMed(query, filters) {
    try {
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${filters.maxResults}&retmode=json`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchData.esearchresult?.idlist?.length) {
            return [];
        }
        
        // For simplicity, return basic results
        // In a full implementation, you would fetch details for each ID
        return searchData.esearchresult.idlist.map(id => ({
            id: `pubmed_${id}`,
            title: `PubMed Result ${id}`,
            abstract: 'Abstract not available in demo',
            authors: ['Author information available in full implementation'],
            year: new Date().getFullYear(),
            journal: 'PubMed',
            source: 'pubmed',
            url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
            doi: null
        }));
    } catch (error) {
        console.error('PubMed search error:', error);
        return [];
    }
}

// arXiv Search
async function searchArxiv(query, filters) {
    try {
        const searchUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${filters.maxResults}`;
        
        const response = await fetch(searchUrl);
        const xmlText = await response.text();
        
        // Parse XML response (simplified)
        const papers = [];
        const entries = xmlText.split('<entry>');
        
        for (let i = 1; i < entries.length; i++) {
            const entry = entries[i];
            const titleMatch = entry.match(/<title[^>]*>([^<]*)<\/title>/);
            const summaryMatch = entry.match(/<summary[^>]*>([^<]*)<\/summary>/);
            const authors = entry.match(/<name>([^<]*)<\/name>/g) || [];
            const publishedMatch = entry.match(/<published>([^<]*)<\/published>/);
            
            papers.push({
                id: `arxiv_${i}`,
                title: titleMatch ? titleMatch[1].replace(/\n/g, ' ').trim() : 'No title',
                abstract: summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : 'No abstract',
                authors: authors.map(author => author.replace(/<name>|<\/name>/g, '')),
                year: publishedMatch ? new Date(publishedMatch[1]).getFullYear() : new Date().getFullYear(),
                journal: 'arXiv',
                source: 'arxiv',
                url: `https://arxiv.org/abs/${i}`,
                pdf_url: `https://arxiv.org/pdf/${i}.pdf`,
                doi: null
            });
        }
        
        return papers;
    } catch (error) {
        console.error('arXiv search error:', error);
        return [];
    }
}

// CORE Search (placeholder)
async function searchCore(query, filters) {
    // CORE API requires registration for free tier
    // This is a placeholder for implementation
    return [];
}

// Crossref Search (placeholder)
async function searchCrossref(query, filters) {
    // Crossref API free tier implementation
    // This is a placeholder
    return [];
}

// Remove duplicate papers
function removeDuplicates(papers) {
    const seen = new Set();
    return papers.filter(paper => {
        const key = paper.title.toLowerCase().trim();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

// Display Results
function displayResults(papers, query) {
    const resultsContainer = document.getElementById('results-container');
    const resultsCount = document.getElementById('results-count');
    const resultsSection = document.getElementById('results-section');
    const noResults = document.getElementById('no-results');
    
    if (papers.length === 0) {
        resultsSection.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }
    
    resultsCount.textContent = `Found ${papers.length} papers for "${query}"`;
    resultsContainer.innerHTML = '';
    
    papers.forEach(paper => {
        const paperElement = createPaperElement(paper);
        resultsContainer.appendChild(paperElement);
    });
    
    resultsSection.classList.remove('hidden');
    noResults.classList.add('hidden');
}

// Create paper element
function createPaperElement(paper) {
    const div = document.createElement('div');
    div.className = 'paper-card';
    
    const authors = Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors;
    const abstract = paper.abstract || 'No abstract available';
    
    div.innerHTML = `
        <div class="paper-header">
            <h3 class="paper-title">
                <a href="${paper.url}" target="_blank" rel="noopener noreferrer">
                    ${paper.title}
                </a>
            </h3>
            <div class="paper-badges">
                <span class="source-badge">${paper.source}</span>
                ${paper.score ? `<span class="score-badge"><i class="fas fa-star"></i> ${Math.round(paper.score * 100)}%</span>` : ''}
            </div>
        </div>
        
        <div class="paper-meta">
            <div class="meta-item">
                <i class="fas fa-users"></i>
                <span>${authors || 'Unknown authors'}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-calendar"></i>
                <span>${paper.year || 'Unknown year'}</span>
            </div>
            <div class="meta-item">
                <i class="fas fa-book"></i>
                <span>${paper.journal || 'Unknown journal'}</span>
            </div>
        </div>
        
        <p class="paper-abstract">${abstract.length > 300 ? abstract.substring(0, 300) + '...' : abstract}</p>
        
        <div class="paper-actions">
            <a href="${paper.url}" class="action-link" target="_blank" rel="noopener noreferrer">
                <i class="fas fa-external-link-alt"></i> View Paper
            </a>
            ${paper.pdf_url ? `
            <a href="${paper.pdf_url}" class="action-link pdf-link" target="_blank" rel="noopener noreferrer">
                <i class="fas fa-file-pdf"></i> PDF
            </a>
            ` : ''}
            ${paper.doi ? `
            <span class="doi-text">DOI: ${paper.doi}</span>
            ` : ''}
        </div>
    `;
    
    return div;
}

// Export to CSV
function exportToCSV() {
    const papers = Array.from(document.querySelectorAll('.paper-card'));
    if (papers.length === 0) {
        alert('No results to export');
        return;
    }
    
    let csvContent = 'Title,Authors,Year,Journal,Source,URL\n';
    
    papers.forEach(paper => {
        const title = paper.querySelector('.paper-title').textContent.replace(/,/g, ';');
        const authors = paper.querySelector('.meta-item:nth-child(1)').textContent.replace(/,/g, ';');
        const year = paper.querySelector('.meta-item:nth-child(2)').textContent;
        const journal = paper.querySelector('.meta-item:nth-child(3)').textContent.replace(/,/g, ';');
        const source = paper.querySelector('.source-badge').textContent;
        const url = paper.querySelector('.action-link').href;
        
        csvContent += `"${title}","${authors}","${year}","${journal}","${source}","${url}"\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic-search-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Save Search
function saveSearch() {
    const query = currentSearchMode === 'simple' 
        ? document.getElementById('simple-query').value
        : buildAdvancedQuery();
    
    if (!query) {
        alert('No search to save');
        return;
    }
    
    const searchData = {
        id: Date.now(),
        query: query,
        timestamp: new Date().toISOString(),
        results: document.querySelectorAll('.paper-card').length
    };
    
    searchHistory.unshift(searchData);
    if (searchHistory.length > 10) {
        searchHistory = searchHistory.slice(0, 10);
    }
    
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    alert('Search saved to history');
}

function buildAdvancedQuery() {
    const queryBlocks = document.querySelectorAll('.query-block');
    let query = '';
    
    queryBlocks.forEach((block, index) => {
        const operator = block.querySelector('.operator-select').value;
        const term = block.querySelector('.query-input').value.trim();
        
        if (term) {
            if (index === 0) {
                query += term;
            } else {
                query += ` ${operator} ${term}`;
            }
        }
    });
    
    return query;
}

// Search History
function loadSearchHistory() {
    // Could implement a history panel
    console.log('Search history loaded:', searchHistory);
}

function addToSearchHistory(query, resultCount) {
    const searchData = {
        id: Date.now(),
        query: query,
        timestamp: new Date().toISOString(),
        results: resultCount
    };
    
    searchHistory.unshift(searchData);
    if (searchHistory.length > 10) {
        searchHistory = searchHistory.slice(0, 10);
    }
    
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

// UI Helper Functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function hideResults() {
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('no-results').classList.add('hidden');
}

function showError(message) {
    alert(message); // In production, use a better error display
}

// Demo data for testing
function loadDemoData() {
    const demoPapers = [
        {
            id: 'demo_1',
            title: 'Digital Twin Technology for Geriatric Fall Prediction: A Systematic Review',
            abstract: 'This systematic review examines the current state of digital twin applications in predicting and preventing falls among elderly populations. We analyzed 25 studies demonstrating the efficacy of virtual patient models in fall risk assessment.',
            authors: ['Smith, J.', 'Johnson, A.', 'Brown, M.'],
            year: 2023,
            journal: 'Journal of Geriatric Medicine',
            source: 'pubmed',
            url: '#',
            score: 0.95
        },
        {
            id: 'demo_2',
            title: 'Machine Learning Approaches for Polypharmacy Optimization in Elderly Patients',
            abstract: 'Our research explores computational models for medication management in geriatric patients with multiple comorbidities. The digital twin approach showed 40% improvement in adverse drug event prediction.',
            authors: ['Wang, L.', 'Zhang, K.', 'Chen, R.'],
            year: 2024,
            journal: 'arXiv',
            source: 'arxiv',
            url: '#',
            pdf_url: '#',
            score: 0.87
        }
    ];
    
    displayResults(demoPapers, 'digital twin geriatric');
}
