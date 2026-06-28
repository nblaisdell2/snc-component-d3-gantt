/**
 * D3 Gantt / timeline renderer.
 *
 * `drawChart` fully (re)renders the chart into `container` on every call. It owns
 * the SVG subtree imperatively while the Seismic/snabbdom view only provides the
 * stable host container. Re-rendering on each property change keeps the
 * look-and-feel fully driven by the UI Builder property panel.
 *
 * NAMED d3 submodule imports only (never `import * as d3`): the ServiceNow
 * production build tree-shakes a namespace object that's passed around, which
 * would strip methods like `select`. No `d3-transition` -- it gets tree-shaken
 * out of the prod bundle; the grow-in animation runs on `requestAnimationFrame`.
 *
 * DATA SHAPE: an array of tasks
 *   [ { id?, task, start, end, group?, color?, progress? }, ... ]
 * where start/end are date strings ('YYYY-MM-DD' or ISO), Date objects, or epoch
 * numbers. Each task is one row. Invalid / missing start or end -> dropped; if
 * end < start they are swapped. `progress` is 0..1 (or 0..100; normalized).
 */
import { select } from 'd3-selection';
import { scaleTime, scaleBand, scaleOrdinal } from 'd3-scale';
import { axisTop, axisBottom } from 'd3-axis';
import { timeDay } from 'd3-time';
import { timeParse, timeFormat, isoParse } from 'd3-time-format';
import {
	schemeCategory10, schemeTableau10, schemeSet2, schemeSet3,
	schemePaired, schemeDark2, schemePastel1, schemeAccent
} from 'd3-scale-chromatic';
import { color as d3color } from 'd3-color';
import {
	easeLinear, easeCubicOut, easeCubicInOut, easeQuadOut,
	easeExpOut, easeBackOut, easeBounceOut, easeElasticOut
} from 'd3-ease';

// Categorical color schemes selectable via the `colorScheme` property.
const SCHEMES = {
	category10: schemeCategory10,
	tableau10: schemeTableau10,
	set2: schemeSet2,
	set3: schemeSet3,
	paired: schemePaired,
	dark2: schemeDark2,
	pastel1: schemePastel1,
	accent: schemeAccent
};

// Easing curves selectable via the `animationEasing` property.
const EASINGS = {
	linear: easeLinear,
	cubicOut: easeCubicOut,
	cubicInOut: easeCubicInOut,
	quadOut: easeQuadOut,
	expOut: easeExpOut,
	backOut: easeBackOut,
	bounceOut: easeBounceOut,
	elasticOut: easeElasticOut
};

const num = (v, fallback) => {
	const n = typeof v === 'string' ? parseFloat(v) : v;
	return Number.isFinite(n) ? n : fallback;
};

const isBlank = (v) => v === undefined || v === null || v === '';

const escapeHtml = (s) => String(s)
	.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
	.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const swatchHtml = (cssColor) => {
	const safe = String(cssColor).replace(/[^a-zA-Z0-9#(),.%\s-]/g, '');
	return `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle;background:${safe}"></span>`;
};

const DAY_PARSE = timeParse('%Y-%m-%d');

/** Coerce a value (Date / epoch number / date string) into a Date, or null. */
const toDate = (v) => {
	if (v === undefined || v === null || v === '') return null;
	if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
	if (typeof v === 'number' && Number.isFinite(v)) return new Date(v);
	const s = String(v).trim();
	// numeric epoch string
	if (/^\d+$/.test(s)) return new Date(parseInt(s, 10));
	// plain YYYY-MM-DD (parse as local midnight to avoid TZ drift)
	let d = DAY_PARSE(s);
	if (d) return d;
	// ISO / other parseable
	d = isoParse(s);
	if (d) return d;
	const t = Date.parse(s);
	return Number.isFinite(t) ? new Date(t) : null;
};

/** Darken a CSS color by mixing toward black; fallback if unparseable. */
const darken = (cssColor, amount) => {
	const c = d3color(cssColor);
	if (!c) return cssColor;
	return c.darker(amount).formatRgb();
};

/** Normalize the `data` prop into a clean array of task records. */
const normalizeTasks = (raw) => {
	const arr = Array.isArray(raw) ? raw : [];
	const out = [];
	for (let i = 0; i < arr.length; i += 1) {
		const t = arr[i];
		if (!t || typeof t !== 'object') continue;
		let start = toDate(t.start);
		let end = toDate(t.end);
		if (!start || !end) continue;
		if (end < start) { const tmp = start; start = end; end = tmp; }
		let progress = num(t.progress, NaN);
		if (Number.isFinite(progress)) {
			if (progress > 1) progress /= 100;
			progress = Math.max(0, Math.min(1, progress));
		} else {
			progress = null;
		}
		out.push({
			id: t.id !== undefined && t.id !== null ? t.id : (out.length + 1),
			task: t.task !== undefined && t.task !== null ? String(t.task) : `Task ${out.length + 1}`,
			group: isBlank(t.group) ? '' : String(t.group),
			color: isBlank(t.color) ? '' : String(t.color),
			start,
			end,
			progress,
			raw: t
		});
	}
	return out;
};

export function drawChart(container, props, dispatch) {
	const tasks = normalizeTasks(props.data);

	// ----- look-and-feel props -----
	const backgroundColor = props.backgroundColor || 'transparent';
	const chartTitle = props.chartTitle || '';
	const titleColor = props.titleColor || '#374151';
	const titleFontSize = num(props.titleFontSize, 18);
	const fontFamily = props.fontFamily || 'inherit';

	const rowHeight = Math.max(8, num(props.rowHeight, 26));
	const barPadding = Math.max(0, Math.min(0.9, num(props.barPadding, 0.25)));
	const barRadius = Math.max(0, num(props.barRadius, 3));
	const barColor = props.barColor || '#2E93fA';
	const barOpacity = Math.max(0, Math.min(1, num(props.barOpacity, 0.9)));

	const showProgress = props.showProgress !== false;
	const progressColor = props.progressColor || '';

	const groupBy = props.groupBy !== false;
	const showRowLabels = props.showRowLabels !== false;
	const rowLabelWidth = Math.max(0, num(props.rowLabelWidth, 140));
	const rowLabelColor = props.rowLabelColor || '#374151';

	const showTaskLabels = props.showTaskLabels === true;
	const labelPosition = props.labelPosition === 'inside' ? 'inside' : 'right';
	const labelColor = props.labelColor || '#374151';

	const axisPosition = ['top', 'bottom', 'both'].indexOf(props.axisPosition) > -1 ? props.axisPosition : 'top';
	const dateFormat = isBlank(props.dateFormat) ? '%b %-d' : props.dateFormat;
	const showGridlines = props.showGridlines !== false;
	const gridColor = props.gridColor || '#e5e7eb';

	const showToday = props.showToday !== false;
	const todayColor = props.todayColor || '#ef4444';
	const showWeekends = props.showWeekends === true;
	const weekendColor = props.weekendColor || '#f3f4f6';

	const useSeriesColors = props.useSeriesColors !== false;
	const colorScheme = SCHEMES[props.colorScheme] ? props.colorScheme : 'tableau10';
	const palette = (Array.isArray(props.colorPalette) && props.colorPalette.length)
		? props.colorPalette
		: ['#2E93fA', '#66DA26', '#546E7A', '#E91E63', '#FF9800', '#9C27B0'];

	const axisColor = props.axisColor || '#6b7280';
	const axisTextColor = props.axisTextColor || '#6b7280';
	const axisFontSize = num(props.axisFontSize, 12);

	const showLegend = props.showLegend !== false;
	const legendPosition = ['top', 'right', 'bottom'].indexOf(props.legendPosition) > -1 ? props.legendPosition : 'bottom';

	const animationDuration = Math.max(0, num(props.animationDuration, 800));
	const animate = props.animate !== false && animationDuration > 0;
	const easeFn = EASINGS[props.animationEasing] || easeCubicOut;

	const hoverHighlight = props.hoverHighlight !== false;
	const hoverDimOthers = props.hoverDimOthers === true;

	const showTooltip = props.showTooltip !== false;
	const tooltipTemplate = isBlank(props.tooltipTemplate)
		? '{swatch}<strong>{task}</strong><br/>{start} → {end} ({duration}d)'
		: props.tooltipTemplate;
	const tooltipFollowCursor = props.tooltipFollowCursor !== false;
	const tooltipBackground = props.tooltipBackground || 'rgba(17,24,39,0.92)';
	const tooltipTextColor = props.tooltipTextColor || '#ffffff';
	const tooltipFontSize = num(props.tooltipFontSize, 12);

	const fmtDate = (() => {
		try { return timeFormat(dateFormat); } catch (e) { return timeFormat('%b %-d'); }
	})();

	// ----- group color scale -----
	const groups = [];
	const groupSeen = {};
	tasks.forEach((t) => { if (t.group && !groupSeen[t.group]) { groupSeen[t.group] = true; groups.push(t.group); } });
	const hasGroups = groups.length > 0;
	const schemePalette = (props.colorScheme && SCHEMES[props.colorScheme]) ? SCHEMES[colorScheme] : palette;
	const groupColorScale = scaleOrdinal().domain(groups).range(schemePalette);

	// resolve the base fill color for a task
	const colorFor = (t) => {
		if (useSeriesColors && t.color) return t.color;
		if (groupBy && hasGroups && t.group) return groupColorScale(t.group);
		return barColor;
	};

	// ----- clear previous render -----
	const root = select(container);
	root.selectAll('*').remove();

	// ----- dimensions -----
	const rect = container.getBoundingClientRect();
	const measuredW = Math.floor(rect.width) || container.clientWidth || 0;
	const width = Math.max(220, measuredW || 600);
	const minHeight = Math.max(120, num(props.chartHeight, 360));

	// ----- root svg + chart-level click target -----
	const svg = root.append('svg')
		.attr('class', 'gc-svg')
		.style('font-family', fontFamily)
		.style('display', 'block')
		.on('click', () => { dispatch('CHART_CLICKED', { taskCount: tasks.length }); });

	const drawEmpty = (w, h) => {
		svg.attr('width', w).attr('height', h).attr('viewBox', `0 0 ${w} ${h}`);
		svg.append('rect').attr('class', 'gc-bg').attr('width', w).attr('height', h).attr('fill', backgroundColor);
		if (chartTitle) {
			svg.append('text').attr('class', 'gc-title')
				.attr('x', w / 2).attr('y', titleFontSize + 2)
				.attr('text-anchor', 'middle').attr('fill', titleColor)
				.style('font-size', `${titleFontSize}px`).style('font-weight', '600').text(chartTitle);
		}
		svg.append('text')
			.attr('x', w / 2).attr('y', h / 2)
			.attr('text-anchor', 'middle').attr('fill', axisColor)
			.style('font-size', `${axisFontSize}px`).text('No data to display');
	};

	if (!tasks.length) {
		drawEmpty(width, minHeight);
		return;
	}

	// ----- layout margins -----
	const margin = { top: 8, right: 16, bottom: 8, left: 8 };
	if (chartTitle) margin.top += titleFontSize + 16;
	if (showRowLabels) margin.left += rowLabelWidth;

	const axisRoom = axisFontSize + 14;
	if (axisPosition === 'top' || axisPosition === 'both') margin.top += axisRoom;
	if (axisPosition === 'bottom' || axisPosition === 'both') margin.bottom += axisRoom;

	// legend sizing
	const legendItemH = axisFontSize + 8;
	const showLegendNow = showLegend && hasGroups && (groupBy || useSeriesColors);
	const legendRowsTop = (showLegendNow && legendPosition === 'top') ? legendItemH : 0;
	const legendRowsBottom = (showLegendNow && legendPosition === 'bottom') ? legendItemH : 0;
	margin.top += legendRowsTop;
	margin.bottom += legendRowsBottom;
	let legendRightWidth = 0;
	if (showLegendNow && legendPosition === 'right') {
		const longest = groups.reduce((m, g) => Math.max(m, g.length), 0);
		legendRightWidth = Math.min(200, Math.max(60, longest * axisFontSize * 0.6 + 24));
		margin.right += legendRightWidth + 12;
	}

	// ----- row band scale + natural height -----
	const innerW = Math.max(10, width - margin.left - margin.right);
	const naturalInnerH = tasks.length * rowHeight;
	const baseInnerH = Math.max(naturalInnerH, minHeight - margin.top - margin.bottom);
	const innerH = Math.max(10, baseInnerH);
	const height = Math.max(minHeight, innerH + margin.top + margin.bottom);

	svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);
	svg.append('rect').attr('class', 'gc-bg').attr('width', width).attr('height', height).attr('fill', backgroundColor);

	const plot = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

	// ----- time (x) scale, padded -----
	const minStart = tasks.reduce((m, t) => (t.start < m ? t.start : m), tasks[0].start);
	const maxEnd = tasks.reduce((m, t) => (t.end > m ? t.end : m), tasks[0].end);
	const span = Math.max(1, maxEnd.getTime() - minStart.getTime());
	const pad = span * 0.03;
	const domStart = new Date(minStart.getTime() - pad);
	const domEnd = new Date(maxEnd.getTime() + pad);
	const x = scaleTime().domain([domStart, domEnd]).range([0, innerW]);

	const rowIds = tasks.map((t, i) => i);
	const y = scaleBand().domain(rowIds).range([0, innerH]).paddingInner(barPadding).paddingOuter(barPadding / 2);
	const band = Math.max(1, y.bandwidth());

	// ----- weekend shading (behind everything) -----
	if (showWeekends) {
		const days = timeDay.range(timeDay.floor(domStart), timeDay.offset(timeDay.floor(domEnd), 1));
		const wk = plot.append('g').attr('class', 'gc-weekends').style('pointer-events', 'none');
		days.forEach((d) => {
			const dow = d.getDay();
			if (dow !== 0 && dow !== 6) return;
			const x0 = x(d);
			const x1 = x(timeDay.offset(d, 1));
			wk.append('rect')
				.attr('x', Math.max(0, x0)).attr('y', 0)
				.attr('width', Math.max(0, Math.min(innerW, x1) - Math.max(0, x0)))
				.attr('height', innerH)
				.attr('fill', weekendColor);
		});
	}

	// ----- gridlines + time axis/axes -----
	const axisGenTop = axisTop(x).tickSizeOuter(0).tickFormat(fmtDate);
	const axisGenBottom = axisBottom(x).tickSizeOuter(0).tickFormat(fmtDate);
	const ticks = x.ticks();

	if (showGridlines) {
		const grid = plot.append('g').attr('class', 'gc-grid').style('pointer-events', 'none');
		ticks.forEach((t) => {
			const gx = x(t);
			grid.append('line')
				.attr('x1', gx).attr('x2', gx).attr('y1', 0).attr('y2', innerH)
				.attr('stroke', gridColor).attr('stroke-width', 1);
		});
	}

	const styleAxis = (g) => {
		g.select('.domain').attr('stroke', axisColor);
		g.selectAll('line').attr('stroke', axisColor);
		g.selectAll('text').attr('fill', axisTextColor)
			.style('font-size', `${axisFontSize}px`).style('font-family', fontFamily);
	};
	if (axisPosition === 'top' || axisPosition === 'both') {
		const g = plot.append('g').attr('class', 'gc-axis gc-axis-top').attr('transform', 'translate(0,0)').call(axisGenTop);
		styleAxis(g);
	}
	if (axisPosition === 'bottom' || axisPosition === 'both') {
		const g = plot.append('g').attr('class', 'gc-axis gc-axis-bottom').attr('transform', `translate(0,${innerH})`).call(axisGenBottom);
		styleAxis(g);
	}

	// ----- row (left gutter) labels -----
	if (showRowLabels) {
		const rl = svg.append('g').attr('class', 'gc-row-labels').style('pointer-events', 'none');
		tasks.forEach((t, i) => {
			const cy = margin.top + y(i) + band / 2;
			rl.append('text')
				.attr('x', margin.left - 8).attr('y', cy)
				.attr('text-anchor', 'end').attr('dominant-baseline', 'central')
				.attr('fill', rowLabelColor)
				.style('font-size', `${Math.min(axisFontSize, band)}px`).style('font-family', fontFamily)
				.text(ellipsize(t.task, rowLabelWidth - 4, Math.min(axisFontSize, band)));
		});
	}

	// ----- tooltip -----
	const tooltipEl = showTooltip
		? root.append('div').attr('class', 'gc-tooltip')
			.style('background', tooltipBackground).style('color', tooltipTextColor)
			.style('font-size', `${tooltipFontSize}px`).style('font-family', fontFamily)
			.style('opacity', 0).style('display', 'none')
		: null;

	const renderTemplate = (t) => {
		const fill = colorFor(t);
		const durationDays = Math.max(0, Math.round((t.end.getTime() - t.start.getTime()) / 86400000));
		const ctx = Object.assign({}, t.raw || {}, {
			id: t.id,
			task: t.task,
			group: t.group,
			start: fmtDate(t.start),
			end: fmtDate(t.end),
			duration: durationDays,
			progress: t.progress === null ? '' : `${Math.round(t.progress * 100)}%`,
			color: fill
		});
		return tooltipTemplate.replace(/\{(\w+)\}/g, (m, key) => {
			if (key === 'swatch') return swatchHtml(fill);
			const v = ctx[key];
			return (v === undefined || v === null) ? '' : escapeHtml(v);
		});
	};

	const placeTooltip = (clientX, clientY, anchorPx, anchorPy) => {
		if (!tooltipEl) return;
		const cr = container.getBoundingClientRect();
		const node = tooltipEl.node();
		const tw = node.offsetWidth;
		const th = node.offsetHeight;
		let xPos;
		let yPos;
		if (tooltipFollowCursor) {
			xPos = clientX - cr.left + 14;
			yPos = clientY - cr.top + 14;
			if (yPos + th > cr.height) yPos = clientY - cr.top - th - 14;
		} else {
			xPos = margin.left + anchorPx - tw / 2;
			yPos = margin.top + anchorPy - th - 10;
			if (yPos < 0) yPos = margin.top + anchorPy + 10;
		}
		if (xPos + tw > cr.width) xPos = cr.width - tw - 4;
		if (xPos < 0) xPos = 4;
		if (yPos < 0) yPos = 4;
		tooltipEl.style('left', `${xPos}px`).style('top', `${yPos}px`);
	};

	// ----- task bars -----
	const barLayer = plot.append('g').attr('class', 'gc-bars');
	const rows = tasks.map((t, i) => {
		const x0 = x(t.start);
		const x1 = x(t.end);
		return {
			t, i,
			x0, x1,
			w: Math.max(1, x1 - x0),
			yPos: y(i),
			fill: colorFor(t)
		};
	});

	const groupSel = barLayer.selectAll('g.gc-bar').data(rows).join('g')
		.attr('class', 'gc-bar')
		.style('cursor', 'pointer');

	groupSel.append('rect')
		.attr('class', 'gc-bar-rect')
		.attr('x', (d) => d.x0).attr('y', (d) => d.yPos)
		.attr('width', (d) => d.w).attr('height', band)
		.attr('rx', Math.min(barRadius, band / 2)).attr('ry', Math.min(barRadius, band / 2))
		.attr('fill', (d) => d.fill)
		.attr('fill-opacity', barOpacity);

	// progress overlay
	if (showProgress) {
		groupSel.filter((d) => d.t.progress !== null && d.t.progress > 0).append('rect')
			.attr('class', 'gc-bar-progress')
			.attr('x', (d) => d.x0).attr('y', (d) => d.yPos)
			.attr('width', (d) => Math.max(0, d.w * d.t.progress)).attr('height', band)
			.attr('rx', Math.min(barRadius, band / 2)).attr('ry', Math.min(barRadius, band / 2))
			.attr('fill', (d) => (progressColor ? progressColor : darken(d.fill, 0.9)))
			.attr('fill-opacity', Math.min(1, barOpacity + 0.1))
			.style('pointer-events', 'none');
	}

	// in-bar / right-of-bar task labels
	if (showTaskLabels) {
		groupSel.append('text')
			.attr('class', 'gc-bar-label')
			.attr('y', (d) => d.yPos + band / 2)
			.attr('dominant-baseline', 'central')
			.attr('fill', labelColor)
			.style('font-size', `${Math.min(axisFontSize, band - 2)}px`).style('font-family', fontFamily)
			.style('pointer-events', 'none')
			.each(function (d) {
				const sel = select(this);
				const fs = Math.min(axisFontSize, band - 2);
				if (labelPosition === 'inside') {
					const avail = d.w - 8;
					sel.attr('x', d.x0 + 4).attr('text-anchor', 'start')
						.attr('fill', pickContrast(d.fill, labelColor))
						.text(ellipsize(d.t.task, avail, fs));
				} else {
					sel.attr('x', d.x1 + 6).attr('text-anchor', 'start').text(d.t.task);
				}
			});
	}

	// hover outline overlay
	const hoverRect = hoverHighlight
		? plot.append('rect').attr('class', 'gc-hover').style('pointer-events', 'none')
			.attr('fill', 'none').attr('stroke-width', 2)
			.attr('rx', Math.min(barRadius, band / 2)).style('opacity', 0)
		: null;

	groupSel
		.on('mouseenter', function (event, d) {
			if (hoverRect) {
				hoverRect.attr('x', d.x0).attr('y', d.yPos)
					.attr('width', d.w).attr('height', band)
					.attr('stroke', darken(d.fill, 1)).style('opacity', 1);
			}
			if (hoverDimOthers) {
				groupSel.style('opacity', (o) => (o.i === d.i ? 1 : 0.3));
			}
			if (tooltipEl) {
				tooltipEl.html(renderTemplate(d.t)).style('display', 'block').style('opacity', 1);
				placeTooltip(event.clientX, event.clientY, d.x0 + d.w / 2, d.yPos);
			}
			dispatch('TASK_HOVERED', { id: d.t.id, task: d.t.task });
		})
		.on('mousemove', function (event, d) {
			if (tooltipEl) placeTooltip(event.clientX, event.clientY, d.x0 + d.w / 2, d.yPos);
		})
		.on('mouseleave', function () {
			if (hoverRect) hoverRect.style('opacity', 0);
			if (hoverDimOthers) groupSel.style('opacity', 1);
			if (tooltipEl) tooltipEl.style('opacity', 0).style('display', 'none');
		})
		.on('click', function (event, d) {
			event.stopPropagation();
			dispatch('TASK_CLICKED', {
				id: d.t.id, task: d.t.task, group: d.t.group,
				start: fmtDate(d.t.start), end: fmtDate(d.t.end)
			});
		});

	// ----- today reference line -----
	if (showToday) {
		const todayD = isBlank(props.todayDate) ? new Date() : toDate(props.todayDate);
		if (todayD && todayD >= domStart && todayD <= domEnd) {
			const tx = x(todayD);
			plot.append('line').attr('class', 'gc-today')
				.attr('x1', tx).attr('x2', tx).attr('y1', 0).attr('y2', innerH)
				.attr('stroke', todayColor).attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3')
				.style('pointer-events', 'none');
		}
	}

	// ----- title -----
	if (chartTitle) {
		svg.append('text').attr('class', 'gc-title')
			.attr('x', width / 2).attr('y', titleFontSize + 2)
			.attr('text-anchor', 'middle').attr('fill', titleColor)
			.style('font-size', `${titleFontSize}px`).style('font-weight', '600').text(chartTitle);
	}

	// ----- legend (groups) -----
	if (showLegendNow) {
		const legend = svg.append('g').attr('class', 'gc-legend');
		const swSize = Math.min(12, axisFontSize);
		if (legendPosition === 'right') {
			const lx = width - margin.right + 12;
			let ly = margin.top;
			groups.forEach((g) => {
				const row = legend.append('g').attr('transform', `translate(${lx},${ly})`);
				row.append('rect').attr('width', swSize).attr('height', swSize).attr('rx', 2)
					.attr('y', -swSize / 2).attr('fill', groupColorScale(g));
				row.append('text').attr('x', swSize + 6).attr('dominant-baseline', 'central')
					.attr('fill', axisTextColor).style('font-size', `${axisFontSize}px`).style('font-family', fontFamily)
					.text(g);
				ly += legendItemH;
			});
		} else {
			// top or bottom: lay out horizontally, centered
			const items = groups.map((g) => ({ g, w: g.length * axisFontSize * 0.6 + swSize + 18 }));
			const totalW = items.reduce((s, it) => s + it.w, 0);
			let lx = Math.max(0, (width - totalW) / 2);
			const ly = legendPosition === 'top'
				? (chartTitle ? titleFontSize + 16 + legendItemH / 2 : legendItemH / 2 + 4)
				: height - legendItemH / 2 - 4;
			items.forEach((it) => {
				const row = legend.append('g').attr('transform', `translate(${lx},${ly})`);
				row.append('rect').attr('width', swSize).attr('height', swSize).attr('rx', 2)
					.attr('y', -swSize / 2).attr('fill', groupColorScale(it.g));
				row.append('text').attr('x', swSize + 6).attr('dominant-baseline', 'central')
					.attr('fill', axisTextColor).style('font-size', `${axisFontSize}px`).style('font-family', fontFamily)
					.text(it.g);
				lx += it.w;
			});
		}
	}

	// ----- grow-in animation (clip width 0 -> full) via requestAnimationFrame -----
	if (animate && typeof requestAnimationFrame === 'function') {
		const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : new Date().getTime());
		const t0 = now();
		const barRects = groupSel.selectAll('.gc-bar-rect');
		const progRects = groupSel.selectAll('.gc-bar-progress');
		barRects.attr('width', 0);
		progRects.attr('width', 0);
		const tick = () => {
			const elapsed = now() - t0;
			const k = easeFn(Math.max(0, Math.min(1, elapsed / animationDuration)));
			barRects.attr('width', function () {
				const d = select(this.parentNode).datum();
				return d.w * k;
			});
			progRects.attr('width', function () {
				const d = select(this.parentNode).datum();
				return Math.max(0, d.w * d.t.progress) * k;
			});
			if (elapsed < animationDuration) {
				requestAnimationFrame(tick);
			} else {
				barRects.attr('width', function () { return select(this.parentNode).datum().w; });
				progRects.attr('width', function () {
					const d = select(this.parentNode).datum();
					return Math.max(0, d.w * d.t.progress);
				});
			}
		};
		requestAnimationFrame(tick);
	}
}

/** Truncate text to fit pixel width, adding an ellipsis. Approximate. */
function ellipsize(text, maxPx, fontPx) {
	const s = String(text);
	if (maxPx <= 0) return '';
	const charW = fontPx * 0.58;
	const maxChars = Math.floor(maxPx / charW);
	if (s.length <= maxChars) return s;
	if (maxChars <= 1) return '';
	return `${s.slice(0, Math.max(1, maxChars - 1))}…`;
}

/** Pick a readable text color against a fill, falling back to the given default. */
function pickContrast(fill, fallback) {
	const c = d3color(fill);
	if (!c) return fallback;
	const rgb = c.rgb();
	const L = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
	return L > 0.6 ? '#1f2937' : '#ffffff';
}
