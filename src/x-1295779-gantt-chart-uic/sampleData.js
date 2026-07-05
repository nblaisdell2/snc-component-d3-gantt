/**
 * Built-in sample data so the component renders on drop, before `data` is bound.
 * Shape: Array<{ id?, task, start, end, group?, color?, progress? }>
 *   - start/end: 'YYYY-MM-DD' (also accepts ISO strings, Date objects, epoch ms)
 *   - group: used for color-by-group + the legend
 *   - progress: 0..1 (or 0..100); drives the progress overlay
 *
 * A small change/project schedule spanning ~15 weeks, generated relative to the
 * current date so "today" always lands mid-schedule (during Core development)
 * and the today reference line is visible out of the box.
 */

// Anchor day 0 ≈ 29 days ago; format as local 'YYYY-MM-DD' (matches DAY_PARSE).
const day = (offset) => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - 29 + offset);
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${d.getFullYear()}-${mm}-${dd}`;
};

export const SAMPLE_DATA = [
	{ id: 'T1', task: 'Requirements & scoping', group: 'Planning', start: day(0), end: day(11), progress: 1 },
	{ id: 'T2', task: 'Solution design', group: 'Planning', start: day(9), end: day(22), progress: 0.9 },
	{ id: 'T3', task: 'Environment provisioning', group: 'Build', start: day(21), end: day(30), progress: 0.75 },
	{ id: 'T4', task: 'Core development', group: 'Build', start: day(28), end: day(53), progress: 0.5 },
	{ id: 'T5', task: 'Integrations', group: 'Build', start: day(42), end: day(60), progress: 0.3 },
	{ id: 'T6', task: 'Unit & functional testing', group: 'Test', start: day(56), end: day(74), progress: 0.1 },
	{ id: 'T7', task: 'UAT', group: 'Test', start: day(70), end: day(81), progress: 0 },
	{ id: 'T8', task: 'Cutover rehearsal', group: 'Deploy', start: day(79), end: day(86), progress: 0 },
	{ id: 'T9', task: 'Production deployment', group: 'Deploy', start: day(87), end: day(91), progress: 0 },
	{ id: 'T10', task: 'Hypercare & handover', group: 'Deploy', start: day(91), end: day(102), progress: 0 }
];
