/**
 * Sanity test for the D3GanttData Script Include.
 * Run in System Definition → Scripts - Background (Global scope) AFTER creating
 * the D3GanttData Script Include. Logs the task JSON so you can confirm the shape
 * (and the date coercion) before wiring it in. Adjust cfg to your data.
 */
(function () {
	var api = new global.D3GanttData();

	gs.info("--- fromQuery: change requests as a schedule ---");
	gs.info(
		JSON.stringify(
			api.fromQuery({
				table: "change_request",
				filter: "active=true",
				taskField: "short_description",
				startField: "start_date",
				endField: "end_date",
				groupField: "type",
				progressField: "percent_complete",
				maxTasks: 50,
				sort: "start-asc",
			}),
			null,
			2,
		),
	);

	gs.info("--- fromRows: reshape plain objects ---");
	var rows = [
		{ key: "T1", name: "Design", g: "Plan", s: "2025-06-02", e: "2025-06-13", pct: 100 },
		{ key: "T2", name: "Build", g: "Build", s: "2025-06-14", e: "2025-07-04", pct: 40 },
	];
	gs.info(
		JSON.stringify(
			api.fromRows(rows, {
				idField: "key",
				taskField: "name",
				groupField: "g",
				startField: "s",
				endField: "e",
				progressField: "pct",
			}),
			null,
			2,
		),
	);
})();
