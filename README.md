# Academic Search Pro

A free, open-source academic research search tool built for systematic reviews.

## Features

- 🔍 **Multi-source search** across PubMed, arXiv, and more
- 🎯 **Advanced search builder** with AND/OR logic
- 📊 **Filter results** by year, source, and study type
- 💾 **Export results** to CSV format
- 💰 **Completely free** - no subscription required
- 📱 **Responsive design** works on all devices

## Quick Start

1. **Fork this repository**
2. **Enable GitHub Pages** in repository settings
3. **Access your tool** at `https://yourusername.github.io/academic-search-tool`

## APIs Used

- **PubMed E-utilities** - Free medical literature
- **arXiv API** - Free pre-print server
- **CORE API** - Free open access research
- **CrossRef API** - Free scholarly metadata

## Customization

### Adding New APIs
Edit `script.js` and add new search functions:

```javascript
async function searchNewAPI(query, filters) {
    // Implement your API integration
    return papers;
}
