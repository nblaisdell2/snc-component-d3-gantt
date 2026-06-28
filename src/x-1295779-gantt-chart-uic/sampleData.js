/**
 * Built-in sample data so the component renders on drop, before `data` is bound.
 * Shape: Array<{ id?, task, start, end, group?, color?, progress? }>
 *   - start/end: 'YYYY-MM-DD' (also accepts ISO strings, Date objects, epoch ms)
 *   - group: used for color-by-group + the legend
 *   - progress: 0..1 (or 0..100); drives the progress overlay
 *
 * A small change/project schedule across ~7 weeks of mid-2025, with a few
 * overlapping tasks so the timeline reads as a real Gantt.
 */
export const SAMPLE_DATA = [
	{ id: 'T1', task: 'Requirements & scoping', group: 'Planning', start: '2025-06-02', end: '2025-06-13', progress: 1 },
	{ id: 'T2', task: 'Solution design', group: 'Planning', start: '2025-06-11', end: '2025-06-24', progress: 0.9 },
	{ id: 'T3', task: 'Environment provisioning', group: 'Build', start: '2025-06-23', end: '2025-07-02', progress: 0.75 },
	{ id: 'T4', task: 'Core development', group: 'Build', start: '2025-06-30', end: '2025-07-25', progress: 0.5 },
	{ id: 'T5', task: 'Integrations', group: 'Build', start: '2025-07-14', end: '2025-08-01', progress: 0.3 },
	{ id: 'T6', task: 'Unit & functional testing', group: 'Test', start: '2025-07-28', end: '2025-08-15', progress: 0.1 },
	{ id: 'T7', task: 'UAT', group: 'Test', start: '2025-08-11', end: '2025-08-22', progress: 0 },
	{ id: 'T8', task: 'Cutover rehearsal', group: 'Deploy', start: '2025-08-20', end: '2025-08-27', progress: 0 },
	{ id: 'T9', task: 'Production deployment', group: 'Deploy', start: '2025-08-28', end: '2025-09-01', progress: 0 },
	{ id: 'T10', task: 'Hypercare & handover', group: 'Deploy', start: '2025-09-01', end: '2025-09-12', progress: 0 }
];
