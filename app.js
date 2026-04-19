(function () {
  'use strict';

  // ---------- Tab switching ----------
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      panels.forEach(p => p.classList.toggle('active', p.id === target));
    });
  });

  // ---------- SERP Preview ----------
  const serpTitle = document.getElementById('serpTitle');
  const serpUrl = document.getElementById('serpUrl');
  const serpDesc = document.getElementById('serpDesc');
  const serpPreview = document.getElementById('serpPreview');
  const serpPreviewTitle = document.getElementById('serpPreviewTitle');
  const serpPreviewUrl = document.getElementById('serpPreviewUrl');
  const serpPreviewDesc = document.getElementById('serpPreviewDesc');
  const serpTitleCount = document.getElementById('serpTitleCount');
  const serpDescCount = document.getElementById('serpDescCount');
  const serpChecklist = document.getElementById('serpChecklist');
  const deviceDesktop = document.getElementById('serpDeviceDesktop');
  const deviceMobile = document.getElementById('serpDeviceMobile');

  function formatSerpUrl(raw) {
    if (!raw) return 'example.com › page';
    try {
      const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
      const parts = u.pathname.split('/').filter(Boolean);
      return [u.hostname].concat(parts).join(' › ');
    } catch (e) {
      return raw;
    }
  }

  function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 1).trimEnd() + '…' : str;
  }

  function updateCounter(el, current, max) {
    el.textContent = current + ' / ' + max;
    el.classList.toggle('warn', current > max * 0.9 && current <= max);
    el.classList.toggle('bad', current > max);
  }

  function renderSerp() {
    const title = serpTitle.value || 'Your page title';
    const url = serpUrl.value;
    const desc = serpDesc.value || 'A compelling description of the page...';
    const isMobile = serpPreview.classList.contains('mobile');
    const titleMax = isMobile ? 55 : 60;
    const descMax = isMobile ? 130 : 160;

    serpPreviewTitle.textContent = truncate(title, titleMax);
    serpPreviewUrl.textContent = formatSerpUrl(url);
    serpPreviewDesc.textContent = truncate(desc, descMax);

    updateCounter(serpTitleCount, serpTitle.value.length, 60);
    updateCounter(serpDescCount, serpDesc.value.length, 160);

    renderSerpChecklist();
  }

  function renderSerpChecklist() {
    const title = serpTitle.value;
    const desc = serpDesc.value;
    const checks = [];

    if (!title) {
      checks.push({ s: 'bad', t: 'Add a title tag' });
    } else if (title.length < 30) {
      checks.push({ s: 'warn', t: 'Title is short (aim for 30-60 characters)' });
    } else if (title.length > 60) {
      checks.push({ s: 'warn', t: 'Title may be truncated in search results' });
    } else {
      checks.push({ s: 'ok', t: 'Title length is optimal' });
    }

    if (!desc) {
      checks.push({ s: 'bad', t: 'Add a meta description' });
    } else if (desc.length < 70) {
      checks.push({ s: 'warn', t: 'Description is short (aim for 120-160 characters)' });
    } else if (desc.length > 160) {
      checks.push({ s: 'warn', t: 'Description may be truncated' });
    } else {
      checks.push({ s: 'ok', t: 'Description length is optimal' });
    }

    if (title && /[!?]/.test(title)) {
      checks.push({ s: 'ok', t: 'Title uses engaging punctuation' });
    }

    if (title && desc) {
      const titleWords = new Set(title.toLowerCase().match(/\b\w{4,}\b/g) || []);
      const descWords = new Set(desc.toLowerCase().match(/\b\w{4,}\b/g) || []);
      const overlap = [...titleWords].filter(w => descWords.has(w));
      if (overlap.length === 0) {
        checks.push({ s: 'warn', t: 'Title and description share no keywords' });
      } else {
        checks.push({ s: 'ok', t: 'Title and description share keywords (' + overlap.slice(0, 3).join(', ') + ')' });
      }
    }

    serpChecklist.innerHTML = checks.map(c => {
      const sym = c.s === 'ok' ? '✓' : c.s === 'warn' ? '!' : '✕';
      return '<li><span class="check-icon ' + c.s + '">' + sym + '</span><span>' + escapeHtml(c.t) + '</span></li>';
    }).join('');
  }

  [serpTitle, serpUrl, serpDesc].forEach(el => el.addEventListener('input', renderSerp));

  deviceDesktop.addEventListener('click', () => {
    serpPreview.classList.remove('mobile');
    serpPreview.classList.add('desktop');
    deviceDesktop.classList.add('active');
    deviceMobile.classList.remove('active');
    renderSerp();
  });

  deviceMobile.addEventListener('click', () => {
    serpPreview.classList.add('mobile');
    serpPreview.classList.remove('desktop');
    deviceMobile.classList.add('active');
    deviceDesktop.classList.remove('active');
    renderSerp();
  });

  renderSerp();

  // ---------- Meta Analyzer ----------
  const metaInput = document.getElementById('metaInput');
  const metaResults = document.getElementById('metaResults');

  document.getElementById('metaAnalyze').addEventListener('click', () => {
    const html = metaInput.value.trim();
    if (!html) {
      metaResults.innerHTML = '<p class="hint">Paste some HTML first.</p>';
      return;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const title = doc.querySelector('title')?.textContent?.trim() || '';
    const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '';
    const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const viewport = doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || '';
    const charset = doc.querySelector('meta[charset]')?.getAttribute('charset') || '';
    const lang = doc.querySelector('html')?.getAttribute('lang') || '';

    const og = {};
    doc.querySelectorAll('meta[property^="og:"]').forEach(m => {
      og[m.getAttribute('property')] = m.getAttribute('content');
    });

    const twitter = {};
    doc.querySelectorAll('meta[name^="twitter:"]').forEach(m => {
      twitter[m.getAttribute('name')] = m.getAttribute('content');
    });

    const headings = {
      h1: Array.from(doc.querySelectorAll('h1')).map(h => h.textContent.trim()),
      h2: Array.from(doc.querySelectorAll('h2')).map(h => h.textContent.trim())
    };

    const checks = [];
    checks.push(titleCheck(title));
    checks.push(descCheck(desc));
    checks.push({ s: canonical ? 'ok' : 'warn', t: canonical ? 'Canonical URL set' : 'No canonical URL — consider adding one' });
    checks.push({ s: viewport ? 'ok' : 'warn', t: viewport ? 'Viewport meta tag set' : 'Missing viewport meta tag (mobile)' });
    checks.push({ s: lang ? 'ok' : 'warn', t: lang ? 'HTML lang attribute: ' + lang : 'Missing html lang attribute' });
    checks.push({ s: og['og:title'] ? 'ok' : 'warn', t: og['og:title'] ? 'Open Graph title set' : 'Missing og:title' });
    checks.push({ s: og['og:description'] ? 'ok' : 'warn', t: og['og:description'] ? 'Open Graph description set' : 'Missing og:description' });
    checks.push({ s: og['og:image'] ? 'ok' : 'warn', t: og['og:image'] ? 'Open Graph image set' : 'Missing og:image' });
    checks.push({ s: headings.h1.length === 1 ? 'ok' : headings.h1.length === 0 ? 'bad' : 'warn',
                  t: headings.h1.length === 1 ? 'Exactly one H1 found' : headings.h1.length === 0 ? 'No H1 tag found' : 'Multiple H1 tags (' + headings.h1.length + ')' });

    let out = '<div class="meta-group"><h3>Summary</h3><ul class="checklist">';
    out += checks.map(c => {
      const sym = c.s === 'ok' ? '✓' : c.s === 'warn' ? '!' : '✕';
      return '<li><span class="check-icon ' + c.s + '">' + sym + '</span><span>' + escapeHtml(c.t) + '</span></li>';
    }).join('');
    out += '</ul></div>';

    out += '<div class="meta-group"><h3>Core tags</h3>';
    out += metaRow('Title', title + (title ? ' (' + title.length + ' chars)' : ''));
    out += metaRow('Description', desc + (desc ? ' (' + desc.length + ' chars)' : ''));
    out += metaRow('Canonical', canonical);
    out += metaRow('Robots', robots);
    out += metaRow('Viewport', viewport);
    out += metaRow('Charset', charset);
    out += metaRow('Lang', lang);
    out += '</div>';

    if (Object.keys(og).length) {
      out += '<div class="meta-group"><h3>Open Graph</h3>';
      Object.keys(og).forEach(k => { out += metaRow(k, og[k]); });
      out += '</div>';
    }

    if (Object.keys(twitter).length) {
      out += '<div class="meta-group"><h3>Twitter</h3>';
      Object.keys(twitter).forEach(k => { out += metaRow(k, twitter[k]); });
      out += '</div>';
    }

    out += '<div class="meta-group"><h3>Headings</h3>';
    out += metaRow('H1 (' + headings.h1.length + ')', headings.h1.join(' | ') || '—');
    out += metaRow('H2 (' + headings.h2.length + ')', headings.h2.slice(0, 10).join(' | ') || '—');
    out += '</div>';

    metaResults.innerHTML = out;
  });

  function titleCheck(title) {
    if (!title) return { s: 'bad', t: 'Missing <title> tag' };
    if (title.length < 30) return { s: 'warn', t: 'Title is short (' + title.length + ' chars)' };
    if (title.length > 60) return { s: 'warn', t: 'Title may be truncated (' + title.length + ' chars)' };
    return { s: 'ok', t: 'Title length is optimal (' + title.length + ' chars)' };
  }

  function descCheck(desc) {
    if (!desc) return { s: 'bad', t: 'Missing meta description' };
    if (desc.length < 70) return { s: 'warn', t: 'Description is short (' + desc.length + ' chars)' };
    if (desc.length > 160) return { s: 'warn', t: 'Description may be truncated (' + desc.length + ' chars)' };
    return { s: 'ok', t: 'Description length is optimal (' + desc.length + ' chars)' };
  }

  function metaRow(label, value) {
    return '<div class="meta-row"><div class="meta-row-label">' + escapeHtml(label) +
           '</div><div class="meta-row-value">' + escapeHtml(value || '—') + '</div></div>';
  }

  // ---------- Keyword Density ----------
  const STOPWORDS = new Set(('a an the and or but if then else for to of in on at by with about against between into ' +
    'through during before after above below from up down out over under again further once here there when where why how ' +
    'all any both each few more most other some such no nor not only own same so than too very can will just don should ' +
    'now i me my we our you your he him his she her it its they them their what which who this that these those am is ' +
    'are was were be been being have has had do does did doing would could should may might must shall as').split(' '));

  document.getElementById('kwAnalyze').addEventListener('click', () => {
    const text = document.getElementById('kwInput').value.trim();
    const n = parseInt(document.querySelector('input[name="ngram"]:checked').value, 10);
    const results = document.getElementById('kwResults');

    if (!text) {
      results.innerHTML = '<p class="hint">Paste some content first.</p>';
      return;
    }

    const words = text.toLowerCase().match(/\b[a-z][a-z'-]{1,}\b/g) || [];
    const filtered = words.filter(w => !STOPWORDS.has(w));
    const total = words.length;

    const counts = {};
    if (n === 1) {
      filtered.forEach(w => { counts[w] = (counts[w] || 0) + 1; });
    } else {
      for (let i = 0; i <= words.length - n; i++) {
        const gram = words.slice(i, i + n);
        if (gram.some(w => STOPWORDS.has(w))) continue;
        const key = gram.join(' ');
        counts[key] = (counts[key] || 0) + 1;
      }
    }

    const entries = Object.entries(counts)
      .filter(([, c]) => c > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);

    if (!entries.length) {
      results.innerHTML = '<p class="hint">No repeated ' + n + '-word phrases found.</p>';
      return;
    }

    let out = '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-num">' + total + '</div><div class="stat-label">Total words</div></div>' +
      '<div class="stat"><div class="stat-num">' + new Set(words).size + '</div><div class="stat-label">Unique words</div></div>' +
      '<div class="stat"><div class="stat-num">' + entries.length + '</div><div class="stat-label">Repeated phrases</div></div>' +
      '</div>';

    out += '<table><thead><tr><th>' + (n === 1 ? 'Word' : 'Phrase') + '</th><th>Count</th><th>Density</th></tr></thead><tbody>';
    entries.forEach(([k, c]) => {
      const density = ((c * n) / total * 100).toFixed(2) + '%';
      out += '<tr><td>' + escapeHtml(k) + '</td><td>' + c + '</td><td>' + density + '</td></tr>';
    });
    out += '</tbody></table>';
    results.innerHTML = out;
  });

  // ---------- Readability ----------
  document.getElementById('readAnalyze').addEventListener('click', () => {
    const text = document.getElementById('readInput').value.trim();
    const results = document.getElementById('readResults');

    if (!text) {
      results.innerHTML = '<p class="hint">Paste some content first.</p>';
      return;
    }

    const sentences = text.split(/[.!?]+(?:\s|$)/).filter(s => s.trim().length > 0);
    const words = text.match(/\b[a-zA-Z][a-zA-Z'-]*\b/g) || [];
    const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

    const sentCount = Math.max(sentences.length, 1);
    const wordCount = Math.max(words.length, 1);

    const flesch = 206.835 - 1.015 * (wordCount / sentCount) - 84.6 * (syllables / wordCount);
    const rounded = Math.max(0, Math.min(100, flesch)).toFixed(1);

    let grade, desc;
    if (flesch >= 90) { grade = '5th grade'; desc = 'Very easy to read.'; }
    else if (flesch >= 80) { grade = '6th grade'; desc = 'Easy to read.'; }
    else if (flesch >= 70) { grade = '7th grade'; desc = 'Fairly easy to read.'; }
    else if (flesch >= 60) { grade = '8th-9th grade'; desc = 'Plain English — recommended for web content.'; }
    else if (flesch >= 50) { grade = '10th-12th grade'; desc = 'Fairly difficult to read.'; }
    else if (flesch >= 30) { grade = 'College'; desc = 'Difficult to read.'; }
    else { grade = 'College graduate'; desc = 'Very difficult to read.'; }

    const avgWordsPerSentence = (wordCount / sentCount).toFixed(1);
    const avgSyllablesPerWord = (syllables / wordCount).toFixed(2);
    const readingTime = Math.max(1, Math.round(wordCount / 200));

    const out = '<div class="score-card">' +
      '<div><div class="score-value">' + rounded + '</div><div class="score-label">Flesch Score</div></div>' +
      '<div><div class="score-desc"><strong>' + grade + '</strong></div><div>' + desc + '</div></div>' +
      '</div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><div class="stat-num">' + wordCount + '</div><div class="stat-label">Words</div></div>' +
      '<div class="stat"><div class="stat-num">' + sentCount + '</div><div class="stat-label">Sentences</div></div>' +
      '<div class="stat"><div class="stat-num">' + avgWordsPerSentence + '</div><div class="stat-label">Words / sentence</div></div>' +
      '<div class="stat"><div class="stat-num">' + avgSyllablesPerWord + '</div><div class="stat-label">Syllables / word</div></div>' +
      '<div class="stat"><div class="stat-num">' + readingTime + ' min</div><div class="stat-label">Reading time</div></div>' +
      '</div>';

    results.innerHTML = out;
  });

  function countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const m = word.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  }

  // ---------- Slug Generator ----------
  const SLUG_STOPWORDS = new Set(('a an the and or but of in on at to for with by is are was were be been being ' +
    'that this these those').split(' '));

  const slugInput = document.getElementById('slugInput');
  const slugResult = document.getElementById('slugResult');
  const slugStopwords = document.getElementById('slugStopwords');

  function makeSlug() {
    const raw = slugInput.value.trim();
    if (!raw) {
      slugResult.textContent = 'your-slug-here';
      return;
    }
    let s = raw.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let parts = s.split(' ');
    if (slugStopwords.checked) {
      const filtered = parts.filter(w => !SLUG_STOPWORDS.has(w));
      if (filtered.length) parts = filtered;
    }
    slugResult.textContent = parts.join('-').replace(/-+/g, '-') || 'your-slug-here';
  }

  slugInput.addEventListener('input', makeSlug);
  slugStopwords.addEventListener('change', makeSlug);

  document.getElementById('slugCopy').addEventListener('click', () => {
    const text = slugResult.textContent;
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('slugCopy');
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1200);
    });
  });

  // ---------- Utils ----------
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }
})();
