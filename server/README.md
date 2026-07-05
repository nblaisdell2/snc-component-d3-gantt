# server/

Platform-side sources for binding real data to the **D3 Gantt Chart** component.
Create these as records on the instance — they are NOT shipped by
`snc ui-component deploy`; the `server/` files are the version-controlled source.

The component's `data` property is a flat array of TASKS:
`[ { id?, task, start, end, group?, color?, progress? } ]` (`start`/`end` are
`YYYY-MM-DD`; `progress` is 0..1). Each task is one record, so this is a per-record
PROJECTION (like the scatter chart's row model), not an aggregate — hence its own
Script Include, **`D3GanttData`**.

| File | What it is |
|---|---|
| `D3GanttData.js` | Script Include — `fromQuery()`, `fromRows()` |
| `d3-gantt-data.transform.js` | Task-projection data resource script |
| `d3-gantt-data.properties.json` | Task-projection inputs (bare array) |
| `sanity-test.background.js` | Logs the task JSON to verify the shape + dates |

## One data broker (two script options)

`d3-gantt-data` ships with `fromQuery` (the resource queries the table itself).
If you'd rather feed rows from a **Look up records** resource, bind its results to
a `rows` input and change the transform body to
`return new global.D3GanttData().fromRows(input.rows, input);`. Either way the
output is the same task array.

The broker needs its own execute ACL.

## Setup (one time)

1. **Create the Script Include.** *System Definition → Script Includes → New*.
   Name it `D3GanttData`, **Accessible from = All application scopes**,
   **Client callable = false**, paste `D3GanttData.js`. Save.
2. **Create the Transform data resource.** In UI Builder: **Add data resource →
   Transform**, **Mutates server data** unchecked. Name it e.g. `D3 Gantt Data`,
   paste `d3-gantt-data.transform.js` into **Script** and the **bare JSON array**
   from `d3-gantt-data.properties.json` into **Properties** (must be just the
   `[ … ]` array — a wrapping object or a `"readOnly"` entry leaves the panel
   blank).
3. **Create the execute ACL** (required — else "ACL failed for databroker"):
   broker **sys_id** from `sys_ux_data_broker_transform.list`; elevate to
   **security_admin**; **System Security → Access Control (ACL) → New**: Type =
   `ux_data_broker`, Operation = `execute`, Name = the broker sys_id (padlock →
   free text), Active = true, one permissive criterion (e.g. `UserIsAuthenticated`).

## Bind it

In UI Builder, set the component's **Data · Tasks** property to
`@data.d3_gantt_data.output`.

## Use it

- **Change schedule:** `table` = `change_request`, `taskField` =
  `short_description`, `startField` = `start_date`, `endField` = `end_date`,
  `groupField` = `type`, `progressField` = `percent_complete`.
- **Project plan:** `table` = `pm_project_task`, `startField` =
  `planned_start_date`, `endField` = `planned_end_date`, `groupField` = `phase`,
  `progressField` = `percent_complete`.

`fromQuery(cfg)` / `fromRows(rows, cfg)` inputs: `table`, `filter`, `taskField`,
`startField`, `endField`, `groupField?`, `progressField?`, `idField?`,
`colorField?`, `useDisplayValue`, `maxTasks`, `sort`
(`start-asc`/`start-desc`/`end-asc`/`group`/`none`).

## Verify

Run `sanity-test.background.js` in *Scripts - Background* (Global scope) to log
the task JSON before wiring it into a page.

> These are **platform records** (Script Include / data resource / ACL), not part
> of the component bundle. The `server/` files are the version-controlled source.
