/**
 * Script for the "D3 Gantt Data" Transform data resource
 * (table: sys_ux_data_broker_transform, "Mutates server data" = false).
 *
 * Paste this into the data resource's Script field. `input` is an object whose
 * keys are the data resource's Properties (see d3-gantt-data.properties.json).
 * The returned value is the data resource output, bound in UI Builder via
 *   @data.<data_resource_name>.output
 * to the component's "Data · Tasks" property.
 *
 * Default: query the table directly (fromQuery). To feed rows you already fetched
 * with a "Look up records" resource, bind that resource's results to a `rows`
 * input and change the body to:
 *   return new global.D3GanttData().fromRows(input.rows, input);
 *
 * Logic lives in the global D3GanttData Script Include.
 */
function transform(input) {
	return new global.D3GanttData().fromQuery(input);
}
