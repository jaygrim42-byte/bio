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

  renderHalfLife();
})();
