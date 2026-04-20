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
      if (target === 'halflife') renderHalfLife();
    });
  });

  // ---------- Reconstitution Calculator ----------
  const reconVialMg = document.getElementById('reconVialMg');
  const reconWaterMl = document.getElementById('reconWaterMl');
  const reconDoseMcg = document.getElementById('reconDoseMcg');
  const reconSyringe = document.getElementById('reconSyringe');
  const reconConc = document.getElementById('reconConc');
  const reconVol = document.getElementById('reconVol');
  const reconUnits = document.getElementById('reconUnits');
  const reconDoses = document.getElementById('reconDoses');
  const reconWarn = document.getElementById('reconWarn');

  const vialLiquid = document.getElementById('vialLiquid');
  const vialMeniscus = document.getElementById('vialMeniscus');
  const vialLabel = document.getElementById('vialLabel');
  const vialSubLabel = document.getElementById('vialSubLabel');
  const vialCaption = document.getElementById('vialCaption');
  const VIAL_MAX_ML = 10;
  const VIAL_TOP = 30, VIAL_BOTTOM = 188;

  function updateVial(ml, mgPerMl) {
    if (!vialLiquid) return;
    const pct = Math.min(1, ml / VIAL_MAX_ML);
    const height = (VIAL_BOTTOM - VIAL_TOP) * pct;
    const y = VIAL_BOTTOM - height;
    vialLiquid.setAttribute('y', y);
    vialLiquid.setAttribute('height', height);
    vialMeniscus.setAttribute('cy', y);
    if (ml > 0 && mgPerMl > 0) {
      vialLabel.textContent = mgPerMl.toFixed(mgPerMl < 1 ? 2 : 1);
      vialSubLabel.textContent = 'mg/mL';
      vialCaption.textContent = ml.toFixed(1) + ' mL of water, ' + (mgPerMl * ml).toFixed(1) + ' mg peptide dissolved';
    } else {
      vialLabel.textContent = '—';
      vialSubLabel.textContent = 'mg/mL';
      vialCaption.textContent = 'Adjust inputs to see fill.';
    }
  }

  function renderRecon() {
    const mg = parseFloat(reconVialMg.value) || 0;
    const ml = parseFloat(reconWaterMl.value) || 0;
    const doseMcg = parseFloat(reconDoseMcg.value) || 0;
    const unitsPerMl = parseFloat(reconSyringe.value);

    if (mg <= 0 || ml <= 0 || doseMcg <= 0) {
      reconConc.textContent = '—';
      reconVol.textContent = '—';
      reconUnits.textContent = '—';
      reconDoses.textContent = '—';
      reconWarn.hidden = true;
      updateVial(ml, mg / Math.max(ml, 0.01));
      return;
    }

    const mcgPerMl = (mg * 1000) / ml;
    const doseVolMl = doseMcg / mcgPerMl;
    const drawUnits = doseVolMl * unitsPerMl;
    const totalDoses = Math.floor((mg * 1000) / doseMcg);

    reconConc.textContent = mcgPerMl.toFixed(0) + ' mcg/mL (' + (mcgPerMl / 1000).toFixed(3) + ' mg/mL)';
    reconVol.textContent = doseVolMl.toFixed(3) + ' mL';
    reconUnits.textContent = drawUnits.toFixed(1) + ' units';
    reconDoses.textContent = totalDoses + ' doses';
    updateVial(ml, mg / ml);

    const syringeMax = unitsPerMl === 100 ? 100 : unitsPerMl;
    if (drawUnits > syringeMax) {
      reconWarn.textContent = 'Draw volume (' + drawUnits.toFixed(1) + ' units) exceeds selected syringe capacity (' + syringeMax + ' units). Consider a larger syringe or less water in the reconstitution.';
      reconWarn.hidden = false;
    } else if (drawUnits < 1) {
      reconWarn.textContent = 'Draw volume is under 1 unit — small measurement errors will have a large proportional impact. Consider using less water to increase volume per dose.';
      reconWarn.hidden = false;
    } else {
      reconWarn.hidden = true;
    }
  }

  [reconVialMg, reconWaterMl, reconDoseMcg, reconSyringe].forEach(el => {
    el.addEventListener('input', renderRecon);
    el.addEventListener('change', renderRecon);
  });
  renderRecon();

  // ---------- Half-Life Simulator ----------
  const hlDose = document.getElementById('hlDose');
  const hlFreq = document.getElementById('hlFreq');
  const hlCustom = document.getElementById('hlCustom');
  const hlCustomWrap = document.getElementById('hlCustomWrap');
  const hlHalf = document.getElementById('hlHalf');
  const hlDuration = document.getElementById('hlDuration');
  const hlCanvas = document.getElementById('hlChart');
  const hlCmax = document.getElementById('hlCmax');
  const hlCmin = document.getElementById('hlCmin');
  const hlSteady = document.getElementById('hlSteady');

  hlFreq.addEventListener('change', () => {
    hlCustomWrap.hidden = hlFreq.value !== 'custom';
    renderHalfLife();
  });

  function getInterval() {
    return hlFreq.value === 'custom' ? parseFloat(hlCustom.value) || 24 : parseFloat(hlFreq.value);
  }

  function renderHalfLife() {
    const dose = parseFloat(hlDose.value) || 0;
    const interval = getInterval();
    const halfLife = parseFloat(hlHalf.value) || 1;
    const days = Math.min(60, Math.max(1, parseFloat(hlDuration.value) || 7));
    const totalHours = days * 24;
    const k = Math.log(2) / halfLife;
    const step = Math.max(0.25, totalHours / 500);

    const points = [];
    let conc = 0;
    let lastDose = -interval;
    let cmax = 0, cmin = Infinity;
    let steadyReachedAt = null;
    const steadyTarget = dose / (1 - Math.exp(-k * interval));

    for (let t = 0; t <= totalHours; t += step) {
      while (t >= lastDose + interval) {
        lastDose += interval;
        const decay = Math.exp(-k * (t - lastDose));
        conc = conc * Math.exp(-k * (lastDose - (lastDose - interval > 0 ? lastDose - interval : 0)));
      }
    }

    const doseTimes = [];
    for (let d = 0; d <= totalHours; d += interval) doseTimes.push(d);

    const sampled = [];
    for (let t = 0; t <= totalHours; t += step) {
      let c = 0;
      for (const dt of doseTimes) {
        if (t >= dt) c += dose * Math.exp(-k * (t - dt));
      }
      sampled.push({ t, c });
      if (c > cmax) cmax = c;
    }

    if (steadyTarget > 0) {
      for (let i = 0; i < sampled.length; i++) {
        if (sampled[i].c >= 0.95 * steadyTarget) { steadyReachedAt = sampled[i].t; break; }
      }
    }

    const tailStart = sampled.findIndex(p => p.t >= totalHours - interval);
    if (tailStart >= 0) {
      cmin = Infinity;
      for (let i = tailStart; i < sampled.length; i++) {
        if (sampled[i].c < cmin) cmin = sampled[i].c;
      }
    }

    drawChart(hlCanvas, sampled, totalHours, cmax);

    hlCmax.textContent = cmax.toFixed(2);
    hlCmin.textContent = (cmin === Infinity ? 0 : cmin).toFixed(2);
    hlSteady.textContent = steadyReachedAt === null ? '> ' + days + ' d' : (steadyReachedAt / 24).toFixed(1) + ' d';
  }

  function drawChart(canvas, points, maxX, maxY) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 500;
    const cssH = 280;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = { l: 44, r: 12, t: 12, b: 28 };
    const w = cssW - pad.l - pad.r;
    const h = cssH - pad.t - pad.b;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = '#e3e6ee';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#6b7391';
    ctx.font = '11px -apple-system, sans-serif';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
      const y = pad.t + h - (h * i / yTicks);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + w, y);
      ctx.stroke();
      ctx.fillText((maxY * i / yTicks).toFixed(1), 4, y + 3);
    }

    const days = maxX / 24;
    const dayTicks = Math.min(days, 10);
    for (let i = 0; i <= dayTicks; i++) {
      const x = pad.l + (w * i / dayTicks);
      const dayLabel = Math.round(days * i / dayTicks);
      ctx.fillText('d' + dayLabel, x - 8, cssH - 8);
    }

    if (!points.length || maxY <= 0) return;

    ctx.strokeStyle = '#0b7a6b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad.l + (p.t / maxX) * w;
      const y = pad.t + h - (p.c / maxY) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(11, 122, 107, 0.12)';
    ctx.lineTo(pad.l + w, pad.t + h);
    ctx.lineTo(pad.l, pad.t + h);
    ctx.closePath();
    ctx.fill();
  }

  [hlDose, hlCustom, hlHalf, hlDuration].forEach(el => el.addEventListener('input', renderHalfLife));
  window.addEventListener('resize', () => { if (document.getElementById('halflife').classList.contains('active')) renderHalfLife(); });

  // ---------- Cycle Planner ----------
  const cycleName = document.getElementById('cycleName');
  const cycleOn = document.getElementById('cycleOn');
  const cycleOff = document.getElementById('cycleOff');
  const cycleCount = document.getElementById('cycleCount');
  const cycleStart = document.getElementById('cycleStart');
  const cycleTimeline = document.getElementById('cycleTimeline');
  const cycleSummary = document.getElementById('cycleSummary');

  cycleStart.valueAsDate = new Date();

  function renderCycle() {
    const name = cycleName.value || 'Cycle';
    const on = Math.max(1, parseInt(cycleOn.value) || 0);
    const off = Math.max(0, parseInt(cycleOff.value) || 0);
    const count = Math.max(1, Math.min(10, parseInt(cycleCount.value) || 1));
    const start = cycleStart.valueAsDate || new Date();

    cycleTimeline.innerHTML = '';
    const totalWeeks = (on + off) * count;
    const weeksPerWidth = totalWeeks;

    let cursor = new Date(start);
    for (let i = 1; i <= count; i++) {
      const row = document.createElement('div');
      row.className = 'timeline-row';
      const label = document.createElement('div');
      label.className = 'timeline-label';
      label.textContent = name + ' #' + i;
      const bar = document.createElement('div');
      bar.className = 'timeline-bar';

      const onPart = document.createElement('div');
      onPart.className = 'timeline-on';
      onPart.style.width = (on / (on + off) * 100) + '%';
      onPart.textContent = on + 'w on';

      const offPart = document.createElement('div');
      offPart.className = 'timeline-off';
      offPart.style.width = (off / (on + off) * 100) + '%';
      offPart.textContent = off > 0 ? off + 'w off' : '';

      bar.appendChild(onPart);
      if (off > 0) bar.appendChild(offPart);
      row.appendChild(label);
      row.appendChild(bar);
      cycleTimeline.appendChild(row);
    }

    const endDate = new Date(start);
    endDate.setDate(endDate.getDate() + totalWeeks * 7);

    cycleSummary.innerHTML =
      '<div class="result-row"><span class="result-label">Total duration</span><span class="result-value">' + totalWeeks + ' weeks</span></div>' +
      '<div class="result-row"><span class="result-label">Total on-time</span><span class="result-value">' + (on * count) + ' weeks</span></div>' +
      '<div class="result-row"><span class="result-label">Total off-time</span><span class="result-value">' + (off * count) + ' weeks</span></div>' +
      '<div class="result-row"><span class="result-label">End date</span><span class="result-value">' + endDate.toLocaleDateString() + '</span></div>';
  }

  [cycleName, cycleOn, cycleOff, cycleCount, cycleStart].forEach(el => {
    el.addEventListener('input', renderCycle);
    el.addEventListener('change', renderCycle);
  });
  renderCycle();

  // ---------- Unit Converter ----------
  const massValue = document.getElementById('massValue');
  const massFrom = document.getElementById('massFrom');
  const massTo = document.getElementById('massTo');
  const massResult = document.getElementById('massResult');

  function renderMass() {
    const v = parseFloat(massValue.value) || 0;
    const from = parseFloat(massFrom.value);
    const to = parseFloat(massTo.value);
    const result = v * from / to;
    const toUnit = massTo.options[massTo.selectedIndex].text;
    massResult.textContent = formatNumber(result) + ' ' + toUnit;
  }
  [massValue, massFrom, massTo].forEach(el => el.addEventListener('input', renderMass));
  [massFrom, massTo].forEach(el => el.addEventListener('change', renderMass));
  renderMass();

  const volMl = document.getElementById('volMl');
  const volSyringe = document.getElementById('volSyringe');
  const volUnits = document.getElementById('volUnits');

  function renderVol() {
    const ml = parseFloat(volMl.value) || 0;
    const upm = parseFloat(volSyringe.value);
    volUnits.textContent = (ml * upm).toFixed(1) + ' units';
  }
  [volMl, volSyringe].forEach(el => { el.addEventListener('input', renderVol); el.addEventListener('change', renderVol); });
  renderVol();

  const iuValue = document.getElementById('iuValue');
  const iuFactor = document.getElementById('iuFactor');
  const iuDir = document.getElementById('iuDir');
  const iuResult = document.getElementById('iuResult');

  function renderIu() {
    const v = parseFloat(iuValue.value) || 0;
    const f = parseFloat(iuFactor.value) || 1;
    if (iuDir.value === 'iu2mg') {
      iuResult.textContent = (v / f).toFixed(4) + ' mg';
    } else {
      iuResult.textContent = (v * f).toFixed(3) + ' IU';
    }
  }
  [iuValue, iuFactor, iuDir].forEach(el => { el.addEventListener('input', renderIu); el.addEventListener('change', renderIu); });
  renderIu();

  function formatNumber(n) {
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toFixed(0);
    if (abs >= 1) return n.toFixed(3);
    if (abs >= 0.001) return n.toFixed(4);
    return n.toExponential(3);
  }

  // ---------- Stack Timing Explorer ----------
  const STACK_COLORS = ['#0b7a6b', '#7b3eff', '#d4351c', '#d48806', '#1a73e8', '#c026d3'];
  const stackEntries = document.getElementById('stackEntries');
  const stackCanvas = document.getElementById('stackChart');
  const stackLegend = document.getElementById('stackLegend');
  let stackData = [
    { name: 'Compound A', half: 6, dose: 100, times: '08:00' },
    { name: 'Compound B', half: 24, dose: 100, times: '08:00,20:00' }
  ];

  function renderStackEntries() {
    stackEntries.innerHTML = '';
    stackData.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'stack-entry';
      row.innerHTML =
        '<label>Name<input type="text" data-field="name" value="' + escapeAttr(item.name) + '" /></label>' +
        '<label>Half-life (h)<input type="number" data-field="half" min="0.1" step="0.1" value="' + item.half + '" /></label>' +
        '<label>Dose (a.u.)<input type="number" data-field="dose" min="0" step="10" value="' + item.dose + '" /></label>' +
        '<label>Times (24h, comma-sep)<input type="text" data-field="times" placeholder="08:00,20:00" value="' + escapeAttr(item.times) + '" /></label>' +
        '<button class="remove" data-idx="' + idx + '" aria-label="Remove">×</button>';

      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
          const field = inp.dataset.field;
          stackData[idx][field] = field === 'half' || field === 'dose' ? parseFloat(inp.value) || 0 : inp.value;
          renderStackChart();
        });
      });
      row.querySelector('.remove').addEventListener('click', () => {
        stackData.splice(idx, 1);
        renderStackEntries();
        renderStackChart();
      });
      stackEntries.appendChild(row);
    });
  }

  function escapeAttr(s) { return String(s || '').replace(/"/g, '&quot;'); }

  function parseTimes(str) {
    return (str || '').split(',').map(t => {
      const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      return parseInt(m[1]) + parseInt(m[2]) / 60;
    }).filter(v => v !== null);
  }

  function renderStackChart() {
    const ctx = stackCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = stackCanvas.clientWidth || 600;
    const cssH = 320;
    stackCanvas.width = cssW * dpr;
    stackCanvas.height = cssH * dpr;
    stackCanvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = { l: 44, r: 14, t: 14, b: 30 };
    const w = cssW - pad.l - pad.r;
    const h = cssH - pad.t - pad.b;
    const totalHours = 48;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = '#e3e6ee';
    ctx.fillStyle = '#6b7391';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + h - (h * i / 4);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
      ctx.fillText((i * 25) + '%', 8, y + 3);
    }
    for (let i = 0; i <= 8; i++) {
      const x = pad.l + (w * i / 8);
      ctx.fillText((i * 6) + 'h', x - 8, cssH - 10);
    }

    ctx.strokeStyle = '#bbb';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    const midX = pad.l + w * 0.5;
    ctx.moveTo(midX, pad.t); ctx.lineTo(midX, pad.t + h); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('24h', midX - 10, pad.t + 10);

    let legendHtml = '';
    stackData.forEach((item, idx) => {
      const color = STACK_COLORS[idx % STACK_COLORS.length];
      const times = parseTimes(item.times);
      const k = Math.log(2) / (item.half || 1);
      if (!times.length || item.dose <= 0) {
        legendHtml += legendItem(color, item.name + ' (no valid times)');
        return;
      }

      const points = [];
      const step = 0.25;
      for (let t = 0; t <= totalHours; t += step) {
        let c = 0;
        for (const base of times) {
          for (let cycle = 0; cycle < 3; cycle++) {
            const dt = base + cycle * 24;
            if (t >= dt) c += item.dose * Math.exp(-k * (t - dt));
          }
        }
        points.push({ t, c });
      }
      const peak = Math.max(...points.map(p => p.c)) || 1;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = pad.l + (p.t / totalHours) * w;
        const y = pad.t + h - (p.c / peak) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      legendHtml += legendItem(color, item.name + ' — t½ ' + item.half + 'h, ' + times.length + ' dose(s)/24h');
    });

    stackLegend.innerHTML = legendHtml;
  }

  function legendItem(color, label) {
    return '<span class="stack-legend-item"><span class="stack-legend-dot" style="background:' + color + '"></span>' + escapeHtml(label) + '</span>';
  }

  document.getElementById('stackAdd').addEventListener('click', () => {
    if (stackData.length >= 6) return;
    stackData.push({ name: 'Compound ' + String.fromCharCode(65 + stackData.length), half: 12, dose: 100, times: '08:00' });
    renderStackEntries();
    renderStackChart();
  });

  renderStackEntries();
  renderStackChart();
  window.addEventListener('resize', () => {
    if (document.getElementById('stack').classList.contains('active')) renderStackChart();
  });

  // ---------- Injection Schedule ----------
  const schedFreq = document.getElementById('schedFreq');
  const schedCustom = document.getElementById('schedCustom');
  const schedCustomWrap = document.getElementById('schedCustomWrap');
  const schedStart = document.getElementById('schedStart');
  const schedTime = document.getElementById('schedTime');
  const schedWeeks = document.getElementById('schedWeeks');
  const schedCalendar = document.getElementById('schedCalendar');
  const schedSummary = document.getElementById('schedSummary');

  schedStart.valueAsDate = new Date();

  schedFreq.addEventListener('change', () => {
    schedCustomWrap.hidden = schedFreq.value !== 'custom';
    renderSchedule();
  });

  function renderSchedule() {
    const interval = schedFreq.value === 'custom' ? parseFloat(schedCustom.value) || 24 : parseFloat(schedFreq.value);
    const weeks = Math.max(1, Math.min(8, parseInt(schedWeeks.value) || 2));
    const startDate = schedStart.valueAsDate || new Date();
    const [hh, mm] = (schedTime.value || '08:00').split(':').map(Number);
    const start = new Date(startDate);
    start.setHours(hh || 0, mm || 0, 0, 0);

    const totalHours = weeks * 7 * 24;
    const events = [];
    for (let t = 0; t <= totalHours; t += interval) {
      const when = new Date(start.getTime() + t * 3600 * 1000);
      events.push(when);
    }

    const firstDay = new Date(start);
    firstDay.setHours(0, 0, 0, 0);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());

    let html = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
      html += '<div class="calendar-head">' + d + '</div>';
    });

    const totalDays = weeks * 7 + ((start.getDay()));
    for (let i = 0; i < totalDays; i++) {
      const cellDate = new Date(firstDay);
      cellDate.setDate(firstDay.getDate() + i);
      const dayEvents = events.filter(e =>
        e.getFullYear() === cellDate.getFullYear() &&
        e.getMonth() === cellDate.getMonth() &&
        e.getDate() === cellDate.getDate()
      );
      const muted = cellDate < firstDay || cellDate < start && cellDate.getDate() !== start.getDate();
      const cls = 'calendar-day' + (dayEvents.length ? ' has-event' : '') + (cellDate < new Date(start.getFullYear(), start.getMonth(), start.getDate()) ? ' muted' : '');
      html += '<div class="' + cls + '">';
      html += '<div class="calendar-date">' + cellDate.getDate() + '</div>';
      dayEvents.slice(0, 3).forEach(e => {
        html += '<div class="calendar-event">' + String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0') + '</div>';
      });
      if (dayEvents.length > 3) html += '<div class="calendar-event">+' + (dayEvents.length - 3) + '</div>';
      html += '</div>';
    }
    schedCalendar.innerHTML = html;

    const perWeek = (7 * 24) / interval;
    schedSummary.innerHTML =
      '<div class="result-row"><span class="result-label">Interval</span><span class="result-value">' + interval + ' hours</span></div>' +
      '<div class="result-row"><span class="result-label">Administrations / week</span><span class="result-value">' + perWeek.toFixed(2) + '</span></div>' +
      '<div class="result-row"><span class="result-label">Total in window</span><span class="result-value">' + events.length + '</span></div>';
  }

  [schedCustom, schedStart, schedTime, schedWeeks].forEach(el => {
    el.addEventListener('input', renderSchedule);
    el.addEventListener('change', renderSchedule);
  });
  renderSchedule();

  // ---------- Vial Duration ----------
  const durMg = document.getElementById('durMg');
  const durMl = document.getElementById('durMl');
  const durDose = document.getElementById('durDose');
  const durPerDay = document.getElementById('durPerDay');
  const durBac = document.getElementById('durBac');
  const durDoses = document.getElementById('durDoses');
  const durDays = document.getElementById('durDays');
  const durEmpty = document.getElementById('durEmpty');
  const durWaste = document.getElementById('durWaste');
  const durWarn = document.getElementById('durWarn');

  function renderDuration() {
    const mg = parseFloat(durMg.value) || 0;
    const ml = parseFloat(durMl.value) || 0;
    const dose = parseFloat(durDose.value) || 0;
    const perDay = parseFloat(durPerDay.value) || 0;
    const bac = parseInt(durBac.value) || 28;

    if (mg <= 0 || dose <= 0 || perDay <= 0 || ml <= 0) {
      durDoses.textContent = '—'; durDays.textContent = '—'; durEmpty.textContent = '—'; durWaste.textContent = '—';
      durWarn.hidden = true;
      return;
    }

    const totalDoses = Math.floor((mg * 1000) / dose);
    const days = totalDoses / perDay;
    const emptyDate = new Date();
    emptyDate.setDate(emptyDate.getDate() + Math.round(days));

    durDoses.textContent = totalDoses;
    durDays.textContent = days.toFixed(1) + ' days';
    durEmpty.textContent = emptyDate.toLocaleDateString();

    if (days > bac) {
      const wastedDays = days - bac;
      const wastedDoses = Math.round(wastedDays * perDay);
      durWaste.textContent = wastedDoses + ' doses (~' + wastedDays.toFixed(1) + ' d past ' + bac + '-day BAC window)';
      durWarn.textContent = 'Vial would outlast the ' + bac + '-day BAC reference shelf life by ~' + wastedDays.toFixed(1) + ' days. Adjust water volume or vial size to reduce waste.';
      durWarn.hidden = false;
    } else {
      durWaste.textContent = '0 doses (within BAC window)';
      durWarn.hidden = true;
    }
  }

  [durMg, durMl, durDose, durPerDay, durBac].forEach(el => {
    el.addEventListener('input', renderDuration);
    el.addEventListener('change', renderDuration);
  });
  renderDuration();

  // ---------- Research Topics Quiz ----------
  const quizStage = document.getElementById('quizStage');

  const QUIZ_QUESTIONS = [
    {
      id: 'focus',
      q: 'Which research area are you exploring?',
      opts: [
        { v: 'recovery', t: 'Tissue repair & recovery' },
        { v: 'metabolic', t: 'Metabolic & body composition' },
        { v: 'sleep', t: 'Sleep & circadian research' },
        { v: 'cognitive', t: 'Cognitive & neuropeptide research' },
        { v: 'longevity', t: 'Longevity & senescence' },
        { v: 'general', t: 'General pharmacology' }
      ]
    },
    {
      id: 'depth',
      q: 'What level of background do you have?',
      opts: [
        { v: 'new', t: 'New to the topic' },
        { v: 'some', t: 'Some familiarity' },
        { v: 'experienced', t: 'Experienced reader' }
      ]
    }
  ];

  const TOPIC_MAP = {
    recovery: {
      title: 'Tissue repair & recovery literature',
      areas: [
        { h: 'Wound healing peptide research', p: 'Literature covers peptides studied in wound-healing models, tendon and ligament repair research, and gastrointestinal tissue studies. Search terms: "pentadecapeptide", "body protection compound", "tissue repair peptide".' },
        { h: 'Angiogenesis research', p: 'Focuses on compounds studied for their role in blood vessel formation — a core topic in recovery literature.' }
      ],
      glossary: ['Bioavailability', 'Half-life (t½)', 'Subcutaneous (SC)'],
      tools: ['recon', 'halflife', 'duration']
    },
    metabolic: {
      title: 'Metabolic research literature',
      areas: [
        { h: 'Incretin & glucose regulation', p: 'Well-studied class in the peer-reviewed literature. Search terms: "GLP-1 receptor agonist", "GIP", "dual agonist peptide".' },
        { h: 'Growth hormone secretagogue research', p: 'Literature examines secretagogue peptides and their effects on endogenous GH pulsatility in controlled studies.' }
      ],
      glossary: ['Bioavailability', 'Cmax', 'Steady state', 'Volume of distribution (Vd)'],
      tools: ['halflife', 'stack', 'schedule']
    },
    sleep: {
      title: 'Sleep & circadian literature',
      areas: [
        { h: 'GH pulsatility & sleep architecture', p: 'Research explores the relationship between GH pulsatility and slow-wave sleep in sleep-lab studies.' },
        { h: 'Orexin / hypocretin research', p: 'A neuropeptide system heavily studied in narcolepsy and sleep regulation literature.' }
      ],
      glossary: ['Half-life (t½)', 'Cmax', 'Steady state'],
      tools: ['halflife', 'schedule']
    },
    cognitive: {
      title: 'Neuropeptide research literature',
      areas: [
        { h: 'Nootropic peptide research', p: 'Includes compounds studied in cognitive-enhancement and neuroprotection models. Search terms: "noopept", "semax", "selank", "cerebrolysin" — all discussed in peer-reviewed sources.' },
        { h: 'Neurotrophic factor research', p: 'Peptide mimetics studied in the context of BDNF and NGF signaling pathways.' }
      ],
      glossary: ['Bioavailability', 'Volume of distribution (Vd)'],
      tools: ['recon', 'halflife', 'duration']
    },
    longevity: {
      title: 'Longevity & senescence literature',
      areas: [
        { h: 'Mitochondrial peptide research', p: 'Compounds studied for their role in mitochondrial function and oxidative stress pathways. Search terms: "MOTS-c", "humanin", "SS-31".' },
        { h: 'Telomere biology', p: 'Peptides referenced in telomerase-related research. This is an early-stage field in the literature.' }
      ],
      glossary: ['Half-life (t½)', 'Steady state'],
      tools: ['halflife', 'cycle']
    },
    general: {
      title: 'General pharmacology background',
      areas: [
        { h: 'Pharmacokinetics fundamentals', p: 'Absorption, distribution, metabolism, elimination (ADME), half-life, and volume of distribution are the foundational concepts. Goodman & Gilman\'s textbook is the standard reference.' },
        { h: 'Reconstitution & sterility', p: 'Laboratory handling practices for lyophilized compounds, including bacteriostatic vs sterile water, storage, and aliquoting.' }
      ],
      glossary: ['Bioavailability', 'Cmax', 'Half-life (t½)', 'Lyophilization', 'Reconstitution', 'Steady state', 'Volume of distribution (Vd)'],
      tools: ['recon', 'halflife', 'convert']
    }
  };

  const TOOL_LABELS = {
    recon: 'Reconstitution Calculator',
    halflife: 'Half-Life Simulator',
    stack: 'Stack Timing',
    schedule: 'Injection Schedule',
    duration: 'Vial Duration',
    cycle: 'Cycle Planner',
    convert: 'Unit Converter'
  };

  let quizState = { step: 0, answers: {} };

  function renderQuiz() {
    if (quizState.step >= QUIZ_QUESTIONS.length) {
      renderQuizResults();
      return;
    }
    const q = QUIZ_QUESTIONS[quizState.step];
    let html = '<div class="quiz-question"><h3>' + escapeHtml(q.q) + '</h3><div class="quiz-options">';
    q.opts.forEach(opt => {
      html += '<button class="quiz-option" data-v="' + escapeAttr(opt.v) + '">' + escapeHtml(opt.t) + '</button>';
    });
    html += '</div></div>';
    quizStage.innerHTML = html;
    quizStage.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        quizState.answers[q.id] = btn.dataset.v;
        quizState.step++;
        renderQuiz();
      });
    });
  }

  function renderQuizResults() {
    const focus = quizState.answers.focus || 'general';
    const data = TOPIC_MAP[focus];
    const depth = quizState.answers.depth || 'some';

    let html = '<div class="quiz-results">';
    html += '<h3>' + escapeHtml(data.title) + '</h3>';
    html += '<p class="hint" style="margin:6px 0 0">Navigation only — not a recommendation. Read peer-reviewed literature (PubMed, Google Scholar) for evidence on any specific compound.</p>';

    if (depth === 'new') {
      html += '<div class="quiz-topic"><h4>Start here</h4><p>Before diving in, familiarize yourself with fundamentals: half-life, bioavailability, steady state, and reconstitution. The Glossary tab defines these.</p></div>';
    }

    data.areas.forEach(a => {
      html += '<div class="quiz-topic"><h4>' + escapeHtml(a.h) + '</h4><p>' + escapeHtml(a.p) + '</p></div>';
    });

    html += '<h3 style="margin-top:22px">Suggested tools</h3><div class="quiz-suggested-tools">';
    data.tools.forEach(t => {
      html += '<button class="quiz-tool-chip" data-tool="' + t + '">' + escapeHtml(TOOL_LABELS[t]) + ' →</button>';
    });
    html += '</div>';

    html += '<h3 style="margin-top:22px">Relevant glossary terms</h3><div class="quiz-suggested-tools">';
    data.glossary.forEach(g => {
      html += '<span class="quiz-tool-chip" style="cursor:default">' + escapeHtml(g) + '</span>';
    });
    html += '</div>';

    html += '<button class="quiz-restart">Start over</button></div>';
    quizStage.innerHTML = html;

    quizStage.querySelectorAll('.quiz-tool-chip[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        const targetTab = document.querySelector('.tab[data-tab="' + tool + '"]');
        if (targetTab) targetTab.click();
      });
    });
    quizStage.querySelector('.quiz-restart').addEventListener('click', () => {
      quizState = { step: 0, answers: {} };
      renderQuiz();
    });
  }

  renderQuiz();

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  renderHalfLife();
})();
