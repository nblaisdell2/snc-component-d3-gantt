/**
 * D3GanttData — Script Include (global, accessible from all application scopes,
 * Client callable = false)
 * ---------------------------------------------------------------------------
 * Reusable transform that turns platform data into the JSON shape expected by
 * the x-2114311-gantt-chart-uic component's "Data · Tasks" property:
 *
 *   [ { id?, task, start, end, group?, color?, progress? }, ... ]
 *     - start/end : 'YYYY-MM-DD'
 *     - group     : color-by-group + legend
 *     - progress  : 0..1 (a 0..100 percent is normalised to 0..1)
 *
 * Each task is one record (a change, project task, story, etc.), so unlike the
 * aggregate-based charts this is a per-record PROJECTION — closest in spirit to
 * the scatter chart's row model. Two entry points:
 *   - fromQuery(cfg)      : GlideRecord a task table and project each record.
 *   - fromRows(rows, cfg) : project an array of already-fetched plain objects
 *                           (e.g. a "Look up records" data resource output).
 *
 * Written in ES5 for broad scoped/global compatibility (no let/const, arrow
 * functions, or template literals).
 */
var D3GanttData = Class.create();
D3GanttData.prototype = {
	initialize: function () {},

	/**
	 * Query a task/schedule table into Gantt rows.
	 * cfg: {
	 *   table, filter,
	 *   taskField   (the bar label, e.g. 'short_description'),
	 *   startField  (e.g. 'start_date' / 'planned_start_date'),
	 *   endField    (e.g. 'end_date' / 'due_date'),
	 *   groupField? (e.g. 'type' / phase / 'assignment_group' -> colour + legend),
	 *   progressField? (e.g. 'percent_complete'),
	 *   idField?    (defaults to sys_id),
	 *   colorField? (per-row colour override),
	 *   useDisplayValue (default true; labels/groups by display value),
	 *   maxTasks (setLimit; default 500),
	 *   sort ('start-asc' [default] | 'start-desc' | 'end-asc' | 'group' | 'none')
	 * }
	 * Returns: [ { id, task, start, end, group?, progress?, color? }, … ]
	 */
	fromQuery: function (cfg) {
		cfg = cfg || {};
		var table = this._str(cfg.table);
		var taskField = this._str(cfg.taskField);
		var startField = this._str(cfg.startField);
		var endField = this._str(cfg.endField);
		if (!table || !taskField || !startField || !endField) {
			return [];
		}
		var groupField = this._str(cfg.groupField);
		var progressField = this._str(cfg.progressField);
		var idField = this._str(cfg.idField);
		var colorField = this._str(cfg.colorField);
		var useDisplay =
			cfg.useDisplayValue !== false && cfg.useDisplayValue !== "false";
		var maxTasks = parseInt(cfg.maxTasks, 10);
		if (isNaN(maxTasks) || maxTasks <= 0) {
			maxTasks = 500;
		}

		var gr = new GlideRecord(table);
		if (this._str(cfg.filter)) {
			gr.addEncodedQuery(cfg.filter);
		}
		gr.addNotNullQuery(startField);
		gr.addNotNullQuery(endField);
		gr.orderBy(startField);
		gr.setLimit(maxTasks);
		gr.query();

		var out = [];
		while (gr.next()) {
			var start = this._dateOnly(gr.getValue(startField));
			var end = this._dateOnly(gr.getValue(endField));
			if (!start || !end) {
				continue;
			}
			var task = useDisplay
				? gr.getDisplayValue(taskField)
				: gr.getValue(taskField);
			var row = {
				id: idField ? "" + gr.getValue(idField) : "" + gr.getUniqueValue(),
				task: this._blank(task),
				start: start,
				end: end,
			};
			if (groupField) {
				var g = useDisplay
					? gr.getDisplayValue(groupField)
					: gr.getValue(groupField);
				g = this._blank(g);
				if (g !== "(empty)") {
					row.group = g;
				}
			}
			if (progressField) {
				var p = this._progress(gr.getValue(progressField));
				if (p !== null) {
					row.progress = p;
				}
			}
			if (colorField) {
				var c = this._str(gr.getValue(colorField));
				if (c) {
					row.color = c;
				}
			}
			out.push(row);
		}
		return this._sort(out, cfg);
	},

	/**
	 * Project already-fetched rows into Gantt rows.
	 * cfg: same field names as fromQuery (taskField, startField, endField,
	 *      groupField?, progressField?, idField?, colorField?, sort?).
	 */
	fromRows: function (rows, cfg) {
		cfg = cfg || {};
		rows = rows || [];
		var taskField = this._str(cfg.taskField) || "task";
		var startField = this._str(cfg.startField) || "start";
		var endField = this._str(cfg.endField) || "end";
		var groupField = this._str(cfg.groupField);
		var progressField = this._str(cfg.progressField);
		var idField = this._str(cfg.idField);
		var colorField = this._str(cfg.colorField);

		var out = [];
		for (var i = 0; i < rows.length; i++) {
			var r = rows[i] || {};
			var start = this._dateOnly(this._readField(r, startField));
			var end = this._dateOnly(this._readField(r, endField));
			if (!start || !end) {
				continue;
			}
			var row = {
				task: this._blank(this._readField(r, taskField)),
				start: start,
				end: end,
			};
			if (idField) {
				var id = this._str(this._readField(r, idField));
				if (id) {
					row.id = id;
				}
			}
			if (groupField) {
				var g = this._blank(this._readField(r, groupField));
				if (g !== "(empty)") {
					row.group = g;
				}
			}
			if (progressField) {
				var p = this._progress(this._readField(r, progressField));
				if (p !== null) {
					row.progress = p;
				}
			}
			if (colorField) {
				var c = this._str(this._readField(r, colorField));
				if (c) {
					row.color = c;
				}
			}
			out.push(row);
		}
		return this._sort(out, cfg);
	},

	// ----- internals -------------------------------------------------------

	_sort: function (rows, cfg) {
		var sort = (this._str(cfg.sort) || "start-asc").toLowerCase();
		if (sort === "none") {
			return rows;
		}
		var key = "start";
		if (sort.indexOf("end") === 0) {
			key = "end";
		}
		if (sort === "group") {
			rows.sort(function (a, b) {
				var ga = a.group || "";
				var gb = b.group || "";
				if (ga !== gb) {
					return ga < gb ? -1 : 1;
				}
				return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
			});
			return rows;
		}
		var desc = sort.indexOf("desc") > -1;
		rows.sort(function (a, b) {
			return a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
		});
		if (desc) {
			rows.reverse();
		}
		return rows;
	},

	/** Normalise a date/datetime string to 'YYYY-MM-DD'. */
	_dateOnly: function (raw) {
		if (raw === undefined || raw === null || raw === "") {
			return "";
		}
		var s = "" + raw;
		if (s.indexOf(" ") > -1) {
			s = s.split(" ")[0];
		}
		if (s.indexOf("T") > -1) {
			s = s.split("T")[0];
		}
		return s;
	},

	/** Parse a progress value to 0..1 (a 0..100 percent is divided by 100). */
	_progress: function (raw) {
		var n = parseFloat(raw);
		if (isNaN(n)) {
			return null;
		}
		if (n > 1) {
			n = n / 100;
		}
		if (n < 0) {
			n = 0;
		}
		if (n > 1) {
			n = 1;
		}
		return n;
	},

	_readField: function (obj, field) {
		if (!field) {
			return "";
		}
		var v = obj[field];
		if (v && typeof v === "object") {
			if (typeof v.getDisplayValue === "function") {
				return v.getDisplayValue();
			}
			if (v.displayValue !== undefined) {
				return v.displayValue;
			}
			if (v.value !== undefined) {
				return v.value;
			}
		}
		return v === undefined || v === null ? "" : v;
	},

	_str: function (v) {
		return v === undefined || v === null
			? ""
			: ("" + v).replace(/^\s+|\s+$/g, "");
	},

	_blank: function (v) {
		var s = v === undefined || v === null ? "" : "" + v;
		return s === "" ? "(empty)" : s;
	},

	type: "D3GanttData",
};
