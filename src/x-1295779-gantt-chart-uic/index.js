import { createCustomElement, actionTypes } from '@servicenow/ui-core';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';
import { drawChart } from './chart';
import { SAMPLE_DATA } from './sampleData';

const { COMPONENT_RENDERED, COMPONENT_DOM_READY, COMPONENT_PROPERTY_CHANGED, COMPONENT_DISCONNECTED } = actionTypes;

const view = () => <div className="gc-root" />;

const getContainer = (host) =>
	host && host.shadowRoot
		? host.shadowRoot.querySelector('.gc-root') || host.shadowRoot.querySelector('div')
		: null;

const cssLen = (v, fallback) => {
	if (v === undefined || v === null || v === '') return fallback;
	return /^\d+(\.\d+)?$/.test(String(v)) ? `${v}px` : String(v);
};

const render = ({ host, properties, dispatch }) => {
	const container = getContainer(host);
	if (!container) return;
	host.style.display = 'block';
	host.style.boxSizing = 'border-box';
	host.style.width = cssLen(properties.componentWidth, '100%');
	host.style.maxWidth = '100%';
	host.style.padding = cssLen(properties.componentPadding, '0');
	const hasData = Array.isArray(properties.data) && properties.data.length;
	const data = hasData ? properties.data : SAMPLE_DATA;
	const effectiveProps = { ...properties, data };
	host._last = { container, props: effectiveProps, dispatch };
	try {
		drawChart(container, effectiveProps, dispatch);
		host._w = container.getBoundingClientRect().width || container.clientWidth || 0;
	} catch (e) {
		container.textContent = `Chart error: ${e && e.message ? e.message : String(e)}`;
		if (typeof console !== 'undefined') console.error('[gc] render failed', e);
	}
};

createCustomElement('x-1295779-gantt-chart-uic', {
	renderer: { type: snabbdom },
	view,
	styles,
	properties: {
		// Keep in sync with now-ui.json. JSON-typed defaults (data, palette) live HERE.
		data: { default: SAMPLE_DATA },
		// Header & border
		chartTitle: { default: 'Change Schedule' },
		titleFontSize: { default: 18 },
		titleColor: { default: '#374151' },
		componentWidth: { default: '100%' },
		componentPadding: { default: '12px' },
		backgroundColor: { default: 'transparent' },
		borderColor: { default: '' },
		borderWidth: { default: 0 },
		borderRadius: { default: 0 },
		// Display
		chartHeight: { default: 360 },
		rowHeight: { default: 26 },
		barPadding: { default: 0.25 },
		barRadius: { default: 3 },
		barColor: { default: '#2E93fA' },
		barOpacity: { default: 0.9 },
		showProgress: { default: true },
		progressColor: { default: '' },
		groupBy: { default: true },
		showRowLabels: { default: true },
		rowLabelWidth: { default: 140 },
		rowLabelColor: { default: '#374151' },
		showTaskLabels: { default: false },
		labelPosition: { default: 'right' },
		labelColor: { default: '#374151' },
		// Axis / time
		axisPosition: { default: 'top' },
		dateFormat: { default: '%b %-d' },
		showGridlines: { default: true },
		gridColor: { default: '#e5e7eb' },
		showToday: { default: true },
		todayDate: { default: '' },
		todayColor: { default: '#ef4444' },
		showWeekends: { default: false },
		weekendColor: { default: '#f3f4f6' },
		axisColor: { default: '#6b7280' },
		axisTextColor: { default: '#6b7280' },
		axisFontSize: { default: 12 },
		// Colors
		useSeriesColors: { default: true },
		colorScheme: { default: 'tableau10' },
		colorPalette: { default: ['#2E93fA', '#66DA26', '#546E7A', '#E91E63', '#FF9800', '#9C27B0'] },
		// Legend
		showLegend: { default: true },
		legendPosition: { default: 'bottom' },
		// Font / animation / interaction
		fontFamily: { default: '' },
		animate: { default: true },
		animationDuration: { default: 800 },
		animationEasing: { default: 'cubicOut' },
		hoverHighlight: { default: true },
		hoverDimOthers: { default: false },
		// Tooltip
		showTooltip: { default: true },
		tooltipTemplate: { default: '{swatch}<strong>{task}</strong><br/>{start} → {end} ({duration}d)' },
		tooltipFollowCursor: { default: true },
		tooltipBackground: { default: 'rgba(17,24,39,0.92)' },
		tooltipTextColor: { default: '#ffffff' },
		tooltipFontSize: { default: 12 }
	},
	actionHandlers: {
		[COMPONENT_RENDERED]: render,
		[COMPONENT_PROPERTY_CHANGED]: render,
		[COMPONENT_DOM_READY]: (coeffects) => {
			const { host } = coeffects;
			render(coeffects);
			if (typeof ResizeObserver !== 'undefined' && !host._ro) {
				const ro = new ResizeObserver(() => {
					const last = host._last;
					if (!last || !last.container) return;
					const wNow = last.container.getBoundingClientRect().width || last.container.clientWidth || 0;
					const prev = host._w || 0;
					if (Math.abs(wNow - prev) < 1) return;
					const wasUnsized = prev < 1;
					host._w = wNow;
					drawChart(last.container, { ...last.props, animate: wasUnsized ? last.props.animate : false }, last.dispatch);
				});
				const target = getContainer(host);
				if (target) { ro.observe(target); host._ro = ro; }
			}
		},
		[COMPONENT_DISCONNECTED]: ({ host }) => { if (host._ro) { host._ro.disconnect(); host._ro = null; } }
	}
});
