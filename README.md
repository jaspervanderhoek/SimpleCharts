SimpleCharts
============
The simple chart widget allows to rapidly create charts using the Modeler. The widget is designed to be easy to configure and should be up and running.

Multiple chart rendering algorithms
 * Pie, Line, Curve, Stacked and Bar charts
 * Multiple series per chart
 * Dynamically create add series based on relationships
 * Up to two Y axises per chart
 * Several types of data aggregation supported
 * Onclick microflow for individual data points
 * Allows users to dynamically change the xpath constraints (dat filtering)
 * Supports date ranges
 * Supports linear and uniform scaling along the X-axis
 * Supports update intervals



Properties
=== 

 * Appearance
   * Height:     
     Height of the widget in pixels.
   * Width:   
     Width of the widget in pixels.
   * Chart
     Chart implementation (Flot (FREE) or Highcharts.com (NON FREE))
     Chart rendering engine. Either Flot (free) or Highcharts.com (non free). The latter one supports more features but requires a license for commercial use. See http://www.highcharts.com/license for more details.
     So without a proper license one is not free to use the 'highcarts' settings in commercial projects.
   * Chart type (Pie, Bar, Line, Curve, Stacked)
     Which kind of chart to display. Stacked is a line based graph, which sums up all series. Curve generates a smooth graph and is only supported by the Highcharts implementation.
   * Chart caption
     Caption of the chart.

   * Chart Serie Name
     The label of this serie
   * Entity
     The object which represents a single point in this serie
   * Constraint
     Constrain the objects to be shown using XPath
   * Category (x)
     The attribute which specifies the categorie or X value of a point in the chart. Note that all series should use a Category attribute which returns comparable values from the same domain, otherwise the X-axis might contain undesired values.
   * Value (y)
     The attribute which specifies the (Y) value of a point in the chart. Should be a numeric value. New in 2.0: ou can select values over a referenceset as well. The values will be aggregated using the selected  aggregate function.
   * Use primary Y axis
     If true, this serie uses the primary Y axis. If false, this serie uses the secondary Y axis, which has its own range. For the first serie, this value should always be true.
   * Aggregate function (Sum, Count, Average, Maximum, Minimum, Count, Plot individual, First only)
     Defines how data is aggregated when multiple Y values are available for a single X value.
     * Sum: Adds up the Y values and plot it on X.
     * Count: counts the number of Y values available for a single point. Note that this ignores the actual Y value, so it does not really matter which Y value is set.
     * Avg/Max/Min: Takes the average/maximum/minimum of the availble Y values.
     * Plot individual points: For each Y value a seperate 'column' appears.
     * First only: Only take the first value available, ignore the others.
   * Color
     Specifies a color for this serie. This color should be a valid css color. (for example: 'red', '#ff000' or rgb(255,0,0) are all valid). If empty, a default color will be assigned.

   * On click 
     This microflow will be invoked when a specific point of this serie is clicked. If an aggregation function is used, the onclick is triggered for the first object used in the aggregation.

   * Chart X Axis
     * X axis label
       Label of the X axis.
     * Date aggregation (No aggregation, per hour, per day, per month, per year) (new in 1.1)
       Use this field to determine in which time interval data should be aggregated.
       Use 'No aggregation' if events on different timestamps (in milliseconds) should be displayed as unique points.
       Use 'Hour' if all data within the same hour should be aggregated
       The aggregation function of the individual series is applied. Usually 'count' or 'sum' are the most useful options.
       Note that this options influences datetime based series only.
     * Date formatting (Full date, Day only, Month only, Month and day, Year only, Year and month, Time, Full date and time) The date format which should be used if applicable.
     * Use linear scaling (true/false)
       If true, the datapoints are scaled along the X Axis according to the x value, so gaps might be produces.
       If false,all data points are distributed uniformly. That is, the horizontal distance between two points is constant, regardless the x value. 
       Note that this property only applies for date or numeric X values.

Show X axis ticks (true/false)

Chart Y Axis
Y axis label

Label of the Y axis.

Y Axis unit

The unit of the first Y axis, for example: 'min.' or 'age'

Secondary Y axis label

Label of the secondary Y axis. This axis will be used when the 'use default axis' of a serie is set to false. (Highcharts only)

Secondary Y Axis unit

The unit of the first Y axis, for example: 'min.' or 'age'

Show Y axis ticks (true/false)

Filter
Filter entity

This should be the same entity as selectied in the 'Chart Series' and is required in order to use filtering. Leave this property empty is filtering should not be enabled.

Available Filters
Caption

The caption of the filter in the filter box.

 

Filter attribute

The attribute to filter. The type is determined automatically to create proper input widgets. New in 2.0: You can filter on a referenced attribute as well. Only items related to actual data can be selected.

Features
Show legend (true/ false)

Show hover (true/ false)

Enable zoom (true/ false)

Whether the user can zoom in on a subset of the data. Highcharts only.

Swap axes (true/ false)

Enabling this property will swap the x and y axis of the chart. Highcharts only.

Poll for updates

Refresh time in seconds.

Auto refresh (new in 2.1)

Reload the widget if the context object has changed (by using a Microflow for example). Defaults to false, since this property might have an impact on performance.

Extra options

In general, this property should be omitted. 
This property can be used to add additional options styling info (in JSON format) to the chart when constructing. This option is implementation specific.

For Flot see: http://people.iola.dk/olau/flot/API.txt

For Highcarts see: http://www.highcharts.com/ref/.

Example: to use steps in the graph, and a red border around the legend specify:

for Flot: "{legend: { labelBoxBorderColor: 'red' }, series : { lines : { steps : 'true' } } }"

for Highcharts: "{legend: { borderColor : 'red' }, plotOptions: { line : { step : true } } }"

http://atlantageek.com/2014/01/11/cheatsheet-for-flot/ 
