dojo.registerModulePath("SimpleChart", "../../widgets/SimpleChart");
/**
	SimpleChart
	========================

	@file      : SimpleChart.js
	@author    : Michel Weststrate
	@date      : 19-8-2010
	@copyright : Mendix
	@license   : Please contact our sales department.

	Documentation
	=============


	Open Issues
	===========


	File is best readable with tabwidth = 2;
*/
dojo.provide("SimpleChart.widget.SimpleChart");
if (!dojo.getObject("widgets.widgets"))
    mxui.dom.addCss(mx.moduleUrl("SimpleChart.widget", "ui/SimpleChart250.css"));

mendix.widget.declare('SimpleChart.widget.SimpleChart', {

	//DECLARATION
	addons: [mendix.addon._Contextable],
	inputargs: {
	    tabindex: 0,
	    wwidth: '400px',
	    wheight: '400px',
	    charttype: 'pie',
	    caption: '',
	    polltime: 0,
	    seriesnames: '',
	    seriesentity: '',
	    seriesconstraint: '',
	    seriescategory: '',
	    seriesvalues: '',
	    seriescolor: '',
	    seriesshowpoint: '',
	    seriesclick: '',
	    seriesaggregate: '',
	    seriesextraoptions: '',
	    seriesdynamicserieentity: '',
	    seriesdynamicserieattribute: '',
	    seriesdynamicserieconstraint: '',
	    xastitle: '',
	    yastitle: '',
	    yastitle2: '',
	    seriesyaxis: '',
	    enablezoom: false,
	    inverted: false,
	    chartprovider: 'flot',
	    extraoptions: '',
	    showlegend: true,
	    showxticks: true,
	    showyticks: true,
	    showhover: true,
	    autorefresh: false,
	    dateaggregation: 'none', // or hour/day/month/year
	    dateformat: '',
	    yunit1: '',
	    yunit2: '',
	    uselinearscaling: true,
	    constraintentity: '',
	    filtername: '',
	    filterattr: ''
	},

	 //IMPLEMENTATION
	dataobject: null,
	series: null,
	serieConfigurations: null,
	usecontext: false,
	hasDynamicSerie: false,
	chart: null,
	firstrun: true,
	isdate: false, //use dates as x axis?
	isLocalizedDate: true,
	iscategories: false, //use categories as x axis
	uselabel: false, //use categories as x axis
	categoriesArray: [],
	rangeNode: null,
	refreshing: 0,

    splitprop : function(prop) {
		return this[prop] !== "" ? this[prop].split(";") : [""] ; 		
	},
	
	postCreate : function(){
		dojo.style(this.domNode, { width : ( this.isNumeric(this.wwidth) ? this.wwidth + 'px' : this.wwidth), height : ( this.isNumeric(this.wheight) ? this.wheight + 'px' : this.wheight)});
		dojo.addClass(this.domNode, "SimpleChartOuter");
        
		//create series object
		this.series = [];
		this.serieConfigurations = [];
		for (var i = 0; i < this.doesnotmatter2.length; i++) {
		    var serie = this.doesnotmatter2[i];
		    if (serie.seriesconstraint.indexOf('[%CurrentObject%]') > -1 || serie.seriesdynamicserieconstraint.indexOf('[%CurrentObject%]') > -1) {
		        this.usecontext = true;
		    }

		    if (serie.seriesdynamicserieentity != '' && serie.seriesdynamicserieattribute != '') {
		        serie.isDynamic = true;
                serie.loaded = false;
		        this.hasDynamicSerie = true;
		    } else {
		        serie.isDynamic = false;
                serie.loaded = true;
		        this.series[i] = serie;
		    }
		    this.serieConfigurations[i] = serie;
		}

		//create the filters object
		this.filters = [];
		for(var i = 0; i < this.stilldoesntmatter.length; i++) {
			this.filters[i] = this.stilldoesntmatter[i];
        }

		// We load the jquery that we need for flot.
		dojo.require("SimpleChart.widget.lib.flot.jquery_min"); //required by both implementations

		//mix chart implementations in as kind of addon, but lazy loaded..
		if (this.chartprovider == 'flot'){
			dojo.require("SimpleChart.widget.flot");
			dojo.mixin(this, SimpleChart.widget.flot);
		}
		else if (this.chartprovider == 'highcharts') {
			dojo.require("SimpleChart.widget.highcharts");
			dojo.mixin(this, SimpleChart.widget.highcharts);
		}

        // Repair jquery to other version
        jQuery.noConflict();
		
		
		this.categoriesArray = [];
		
		//create the chart
		this.renderChart();
 
        //trigger data loading
        this.isresumed = true;
		if (!this.usecontext) {
            this.hascontext = true;
			this.refresh(); //Note: causes charts in dataviews which do not use context to be loaded twice
        } else {
			this.initContext();
        }

		this.start();
		this.createrangeNode();
		this.actRendered();
	},
	
	start : function() {
		if(this.polltime > 0 && this.refreshhandle == null)
			this.refreshhandle = setInterval(dojo.hitch(this, function() {
				this.refresh();
			}), this.polltime * 1000);
	},
	
	stop : function() {
		if (this.refreshhandle != null)
			clearInterval(this.refreshhandle);
        this.refreshhandle = null;
	},
	
	suspended : function() {
		this.stop();
        this.isresumed = false;
	},
	
	resumed : function() {
		this.start();
        this.isresumed = true;
        this.refresh();
	},
	
	applyContext : function(context, callback){
		logger.debug(this.id + ".applyContext"); 
		
        if (this.dataobject && this.autorefresh)
            mx.processor.unSubscribeFromGUID(this, this.dataobject);
        
        if (context && context.getTrackID() !== "" && this.usecontext) {
			this.dataobject = context.getTrackID();
			this.hascontext = true;
            this.refresh();
            
            if (this.autorefresh)
                mx.processor.subscribeToGUID(this, this.dataobject);
		}
		else
			this.showWarning(this.id + ".applyContext received empty context");
		callback && callback();
	},
    
    objectUpdate : function(newobject, callback) {
        this.refresh();
        callback && callback();
    },
    
	refresh: function () {
	    if (!this.isresumed || !this.hascontext)
	        return;

	    if (this.refreshing > 0 || this.waitingForVisible) {
	        console.log(this.id + " is already busy fetching new data");
	        return;
	    }
	    this.waitingForVisible = true;
	    this.categoriesArray = [];

	    /*
	     * When we are using Dynamic Series, we will load the Dynamic Series first
	     * Once we have the Dynamic Series, the load Dynamic series process will setup all Serie Data
	     */
	    if (this.hasDynamicSerie) {
	        this.loadDynamicSeries();
	    }

	    var loadfunc = dojo.hitch(this, function () {
	        this.setupSeries();
	    });

	    mendix.lang.runOrDelay(
	        loadfunc,
	        dojo.hitch(this, function () {
	                try {
	                    var allLoaded = true;
	                    for (var serieIndex = 0; serieIndex < this.serieConfigurations.length && allLoaded; serieIndex++) {
	                        if (this.serieConfigurations[serieIndex].loaded !== true)
	                            allLoaded = false;
	                    }
	                    return allLoaded;
	                } catch (e) {
	                    //we would rather like to terminate...
	                    return false;
	                }
	            })
	    );
	},

    
    loadDynamicSeries: function () {
        var serieIndex, serie, entityName, entityPath;
        this.series = [];

        for (serieIndex = 0; serieIndex < this.serieConfigurations.length; serieIndex++) {
            if (this.serieConfigurations[serieIndex].isDynamic == true) {
                serie = this.serieConfigurations[serieIndex];
                serie.seriesdynamicserieentity.split("/");

                entityPath = serie.seriesdynamicserieentity.split("/");
                if (entityPath.length == 1) {
                    entityName = entityPath[0];
                } else if (entityPath.length == 2) {
                    entityName = entityPath[1];
                } else {
                    this.showError(" Unsupported Dynamic serie configuration for serie: " + serieIndex + " the entity path is incorrect ");
                }
                this.serieConfigurations[serieIndex].loaded = false;


                //execute the get.
                mx.processor.get({
                    xpath: "//" + entityName + serie.seriesdynamicserieconstraint.replace(/\[\%CurrentObject\%\]/gi, this.dataobject),
                    //filter: serie.schema, 
                    callback: dojo.hitch(this, this.updateDynamicSerie, serieIndex),
                    sort: serie.seriesdynamicserieattribute,
                    async: false,
                    error: dojo.hitch(this, function (err) {
                        console.error("Unable to retrieve data for xpath '" + xpath + "': " + err, err);
                    })
                });
            } else {
                this.series[this.series.length] = this.serieConfigurations[serieIndex];
            }
        }
    },

    updateDynamicSerie: function (serieIndex, objects) {
        try {
            //aggregate all data to the rawdata object
            var len = objects.length,
                attrValue, serie, entityPath, constraint;
            for (var i = 0; i < len; i++) {
                serie = jQuery.extend({}, this.serieConfigurations[serieIndex]);

                attrValue = objects[i].getAttribute(serie.seriesdynamicserieattribute);
                serie.seriesnames = (attrValue === null || attrValue === '' ? '(undefined' + serieIndex + ')' : attrValue);


                entityPath = serie.seriesdynamicserieentity.split("/");
                if (entityPath.length == 2) {
                    serie.seriesconstraint += '[' + entityPath[0] + '=' + objects[i]._guid + ']';
                }
                serie.loaded = true;

                this.series[this.series.length] = serie;
            }

            this.serieConfigurations[serieIndex].loaded = true;
        } catch (e) {
            this.showError(" Error while retrieving Dynamic Series for serie index: " + serieIndex + ", error: " + e, e);
        }
    },
    
    setupSeries: function () {
        var loadfunc = dojo.hitch(this, function () {
            for (var i = 0; i < this.series.length; i++) {
                this.series[i].loaded = false;
                this.series[i].data = null;

                this.loadSerie(i);
            }
            this.waitingForVisible = false;
        });

        if (dojo.marginBox(this.domNode).h === 0) { //postpone update if hidden
            mendix.lang.runOrDelay(
                loadfunc,
                dojo.hitch(this, function () {
                    try {
                        return dojo.marginBox(this.domNode).h > 0;
                    } catch (e) {
                        //we would rather like to terminate...
                        return false;
                    }
                })
            );
        } else {
            loadfunc();
        }
    },

    loadSerie: function (index) {

        if (this.usecontext && !this.dataobject)
            return; //no context yet, abort

        this.refreshing++;
        var serie = this.series[index];

        if (serie.schema == null) {
            serie.schema = {
                attributes: [],
                references: {},
                sort: [[serie.seriescategory, 'asc']]
            };

            var cat = serie.seriescategory.split("/");
            if (cat.length == 1)
                serie.schema.attributes.push(serie.seriescategory);
            else {
            	if( serie.schema.references[cat[0]] == null )
            		serie.schema.references[cat[0]] = { attributes: [cat[2]] };
            	else
					serie.schema.references[cat[0]].attributes.push( cat[2] );
				
                serie.seriesconstraint += "[" + cat[0] + "/" + cat[1] + "]";
            }
			
            if( serie.seriescategorylabel != null && serie.seriescategorylabel != "" ) {
				var catLabel = serie.seriescategorylabel.split("/");
				if (catLabel.length == 1)
					serie.schema.attributes.push(serie.seriescategorylabel);
				else {
					if( serie.schema.references[catLabel[0]] == null )
						serie.schema.references[catLabel[0]] = { attributes: [catLabel[2]] };
					else
						serie.schema.references[catLabel[0]].attributes.push( catLabel[2] );
					
					serie.seriesconstraint += "[" + catLabel[0] + "/" + catLabel[1] + "]";
				}
            }

            if (serie.seriesvalues) {
                var path = serie.seriesvalues.split("/");
                if (path.length == 1)
                    serie.schema.attributes.push(serie.seriesvalues);
                else {
					if( serie.schema.references[path[0]] == null )
						serie.schema.references[path[0]] = { attributes: [path[2]] };
					else
						serie.schema.references[path[0]].attributes.push( path[2] );
				}
            }
        }

        //execute the get. 
        mx.processor.get({
            xpath: "//" + serie.seriesentity + this.getActiveConstraint(index) + serie.seriesconstraint.replace(/\[\%CurrentObject\%\]/gi, this.dataobject),
            filter: serie.schema,
            callback: dojo.hitch(this, this.retrieveData, index),
            sort: serie.seriescategory,
            error: dojo.hitch(this, function (err) {
                console.error("Unable to retrieve data for xpath '" + xpath + "': " + err, err);
            })
        });
    },
    
    getMetaDataPropertyOwner : function (baseObject, attribute) {
        if (attribute.length == 1)
            return baseObject.metaData;
        var sub = baseObject.getChild(attribute[0]);
        if (sub == null || sub._guid == 0)
            throw "Reference to category attribute cannot be empty!";
        return sub.metaData;
    },
    
	retrieveData : function(serieIndex, objects) {
		try {
            try {
                var serie = this.series[serieIndex];
                serie.data = [];
                var valueattr = serie.seriesvalues ? serie.seriesvalues.split("/") : null;
                var labelattr = serie.seriescategory.split("/");
				var displayattr = serie.seriescategorylabel.split("/");
				
                var rawdata = []; //[[xvalue, yvalue, originalobject, xDisplayValue]]

				if( displayattr.length > 0 )
					this.uselabel = true;
				
                //aggregate all data to the rawdata object
                var len = objects.length;
                for(var i = 0; i < len; i++) {
                    //check the data category type
                    if (i === 0 && this.firstrun ) {
						try {
							var mdOwner = this.getMetaDataPropertyOwner(objects[i], labelattr);
							if( mdOwner !== null ) {
								this.firstrun = false;
								this.isdate = mdOwner.isDate(labelattr[labelattr.length -1]);
								if( this.isdate )
									this.isLocalizedDate = mdOwner.isLocalizedDate(labelattr[labelattr.length -1]);
									
								this.iscategories = !this.isdate && !mdOwner.isNumber(labelattr[labelattr.length -1]);
								
								if( this.charttype == 'bar' || this.charttype == 'stackedbar' )
									this.iscategories = true;
								
								if( this.iscategories && this.uselinearscaling ) {
									this.uselinearscaling = false;
									this.showWarning( "Linear scaling is not supported in combination with categories, linear scaling is only possible for dates and numbers" );
								}
							}
						}
						catch(e) {
							this.firstrun = true;
							this.isdate =false;
							this.iscategories = true;
						}
                    }

					var xDisplay;
                    if (displayattr.length == 1)
                        xDisplay = objects[i].getAttribute(displayattr[0]);
                    else {
                        var sub = objects[i].getChild(displayattr[0]);
                        if (sub == null || sub._guid == 0)
                            xDisplay = "(undefined)"
                        else 
							xDisplay = sub.getAttribute(displayattr[2]);
                    }
					
/*					if( xDisplay != null ) {
						x = xDisplay;
					} 
					else {*/
						//get the x value
						var x;
						if (labelattr.length == 1)
							x = this.dateRound(objects[i].getAttribute(labelattr[0]));
						else {
							var sub = objects[i].getChild(labelattr[0]);
							if (sub === null || sub._guid === 0)
								x = "(undefined)";
							else 
								x = this.dateRound(sub.getAttribute(labelattr[2]));
						}
//					}

                    //get the y value
                    if (!valueattr) //not defined
                      rawdata.push([x, 1, objects[i], xDisplay]);
                    else if (valueattr.length == 1) //attr
                      rawdata.push([x, parseFloat(objects[i].getAttribute(valueattr[0])), objects[i], xDisplay]);
                    else { //reference
                      var subs = objects[i].getChildren(valueattr[0]);
                      for(var j = 0; j < subs.length; j++)
                        rawdata.push([x, parseFloat(subs[j].getAttribute(valueattr[2])), objects[i], xDisplay]);
                    }
                }

                //loop raw data to aggregate
                var currenty = [];
                len = rawdata.length;
                for(var i = 0; i < len; i++) {
                    var currentx = rawdata[i][0];
                    currenty.push(rawdata[i][1]);

                    if (i < len -1 && currentx === rawdata[i + 1][0] && serie.seriesaggregate != 'none')
                        continue;
                    else {
                        //calculate the label, which, can be a referred attr...
                        var labelx = "";
						
						//For dates, and numbers get the formatted value
                        if (this.isdate || !this.iscategories)
                          labelx = this.getFormattedXValue(currentx);
                        
						//In case of enumerations we need to format the attribute value
						else if (labelattr.length == 1)
                          labelx = mx.parser.formatAttribute(rawdata[i][2], labelattr[0]);
                        else {
                          var sub = rawdata[i][2].getChild(labelattr[0]);
                          if (sub === null || sub._guid === 0)
                            labelx = "(undefined)";
                          else 
							labelx = mx.parser.formatAttribute(sub, labelattr[2]);
                        }


						var catValue = labelx;
						if( this.uselabel && rawdata[i][3] != null) 
							catValue = rawdata[i][3];     //(this.iscategories ? labelx : parseFloat(currentx));

						if( this.iscategories ) {
							var pos = jQuery.inArray( catValue, this.categoriesArray );

							if( pos < 0 ) {
								pos = this.categoriesArray.length;
							}
							if( this.charttype != 'pie' ) {
								currentx = pos;
							}
						}
						this.categoriesArray[currentx] = catValue;
						
                        var newitem = {
                            index : this.iscategories ? currentx : serie.data.length,
                            origx : this.iscategories ? currentx : parseFloat(currentx),
                            labelx : ( rawdata[i][3] != null ? rawdata[i][3] : labelx ),
                            guid : rawdata[i][2].getGUID(),
                            y : this.aggregate(serie.seriesaggregate, currenty)
                        };

                        newitem.labely = dojo.trim(this.getFormattedYValue(serie, newitem.y));
                        if (this.charttype == 'pie') { //#ticket 9446, show amounts if pie
                            newitem.labelx += " ("  + newitem.labely + ")";
							
							this.categoriesArray[pos] = newitem.labelx;
                        }

                        serie.data.push(newitem);
                        currenty = [];
                    }
                }

                //sort
                //this.sortdata(serieIndex);

                //if (dojo.marginBox(this.domNode).h > 0) //bugfix: do not draw if the element is hidden
                 //   this.renderSerie(serieIndex);
				 
				serie.loaded = true;
				 
				this.sortAndRenderSeries();
            }
            catch(e) {
                this.showError(" Error while rendering chart data " + e, e);
            }
        } finally {
			this.refreshing--;
		}
	},
	
	sortAndRenderSeries : function()  {
		var allSeriesLoaded = true;
		for( var i in this.series ) {
			if( this.series[i].loaded !== true ) {
				allSeriesLoaded = false;
				break;	 
			}
		}

		if( allSeriesLoaded ) {
			this.sortdata();

			if (dojo.marginBox(this.domNode).h > 0) { //bugfix: do not draw if the element is hidden
				for( var i in this.series ) {
					this.renderSerie(i);
				}
			}
		}
	},
    
    // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
    resize: function (box) {
        /* Make sure we are not waiting for visible, that means the widget is still rendering
         * The client will trigger this function when the widget or page hasn't even showed up yet.
         */
    	if ( !this.waitingForVisible )
            this.sortAndRenderSeries();
    },
    
	sortdata : function() {
        if (this.iscategories) {
			
			this.categoriesArray.sort();
			
			for( var serieIndex = 0; serieIndex<this.series.length; serieIndex++ ) {
				var serie = this.series[serieIndex];
				var labelattr = serie.seriescategory.split("/");
				var attrname = labelattr[labelattr.length -1];
				var meta = mx.metadata.getMetaEntity({ 
					className: labelattr.length == 1 ? serie.seriesentity : labelattr[1]
				});

				//put them in a maps
				var targetmap = {};
				dojo.forEach(serie.data, function(item) {
				  targetmap[item.origx] = item;
				});

				//create new list
				var result = [];
				var i = 0;
				for( var val in targetmap) {
					var pos = jQuery.inArray( targetmap[val].labelx, this.categoriesArray );
					if( pos >= 0 ) {
						result.push(targetmap[val]);
						targetmap[val].index = pos; //update index!
					}
					else 
						this.showError("Invalid configuration for chart: (" + this.id + "), unable to find " + targetmap[val].labelx + " in the categories array");
				}

				serie.data = result;
			}
        }
        else if ( this.isdate ) {
			//this.categoriesArray.sort();
        }
    },
    
	aggregate : function(aggregate, vals) {
		var result = 0;
		switch(aggregate) {
			case 'sum' :
            case 'logsum':
				dojo.forEach(vals, function(value) {
					if( !isNaN( value ) )
						result += value;
				});
                if (aggregate == 'logsum')
                  result = Math.log(result);
				break;
			case 'count':
				dojo.forEach(vals, function(value) {
					result += 1;
				});				
				break;
			case 'avg':
				dojo.forEach(vals, function(value) {
					if( !isNaN( value ) )
						result += value;
				});				
				break;
			case 'min':
				result = Number.MAX_VALUE;
				dojo.forEach(vals, function(value) {
					if(value < result)
						result = value;
				});				
				break;
			case 'max':
				result = Number.MIN_VALUE;
				dojo.forEach(vals, function(value) {
					if( !isNaN( value ) )
						if(value > result)
							result = value;
				});								
				break;
			case 'none':
			case 'first':
				result = vals[0];
				break;
            case 'last':
                result = vals.length > 0 ? vals[vals.length-1] : 0;
                break;
			default:
				this.showError("Unimplemented aggregate: " + aggregate);
		}
		if (aggregate == "avg")
			return vals.length > 0 ? result / vals.length : 0;
		return result;
	},
	
	clickCallback : function(serie, itemindex, clientX, clientY) {
        if (this.series[serie].seriesclick) mx.processor.xasAction({
			error       : function() {
				logger.error(this.id + "error: XAS error executing microflow");
			},
			actionname  : this.series[serie].seriesclick,
			applyto     : 'selection',
			guids       : [this.series[serie].data[itemindex].guid]
		});		
	},
	
	uninitialize : function(){
		this.stop();
		this.uninitializeChart();
	},
	
	showError : function (msg) {
		dojo.empty(this.domNode);
		dojo.html.set(this.domNode, "SimpleChart error: " + msg);
		console.error(this.id + "SimpleChart error: " + msg);
		return null;
	},
	
	showWarning : function (msg) {
		console.warn(this.id + msg);
	},
	
		//////// SECTION LABEL FORMATTING
	
	/** maps a domain X value to a label */
	getFormattedXValue : function(value) {
		if (this.isdate) {
			var date = new Date(value);
			if( !isNaN( date ) )
				return this.getFormattedDateTime( date );
			
			return "(Undefined)";
		}
		
		if (this.iscategories) { //if categories, than value equals index
			if (value < this.categoriesArray.length)
				return this.categoriesArray[value];
			return "";
		}
		if (!this.uselinearscaling)
			return dojo.number.round(this.series[0].data[value].origx,2);
		return dojo.number.round(value, 2);
	},
	
	/** maps a plot X value to a label */
	getXLabelForValue : function(value) {
		if (this.isdate) {
			var date = new Date(value);
			if( !isNaN( date ) )
				return this.getFormattedDateTime( date );
			
			return "(Undefined)";
		}
		else if (this.iscategories) {
			if (value < this.categoriesArray.length)
				return this.categoriesArray[value];
			return "";
		}
		else if (this.uselinearscaling && !this.iscategories)
			return this.getFormattedXValue(value);
		else {
			for(var i = 0; i < this.series.length; i++) {
				if (value < this.series[i].data.length) 
				return this.series[i].data[
					  !isNaN(value-0) ?
					  Math.round(value) :
					  value
					].labelx; //value is the index for non linear data!
				//round is required for flot to map to the closest concrete point in the data. Its a bit annoying though since the label does not match exactly. Should be a better way
			}
        }
		return "";
	},

	getFormattedYValue : function(serie, value) {
		return ("" + dojo.number.round(value, 2)) + " " +(serie.seriesyaxis === true ? this.yunit1 : this.yunit2);
	},

	
	getFormattedDateTime : function( date ) {
		
		var format = null;
		switch(this.dateformat) {
			case 'fulldate': 
				return date.toLocaleDateString(); /*format = { selector : 'date', datePattern : "y-MM-dd"};*/
			case 'datetime': 
				return date.toLocaleDateString() + " " + dojo.date.locale.format(date, { selector : 'time', timePattern : "HH:mm"} ); /*format = { datePattern : "y-MM-dd", timePattern : "HH:mm"};*/
			case 'day': 
				format = { selector : 'date', datePattern : "EEE"};
				break;
			case 'month': 
				format = { selector : 'date', datePattern : "MMM"};
				break;
			case 'monthday': 
				format = { selector : 'date', datePattern : "dd MMM"};
				break;
			case 'year': 
				format = { selector : 'date', datePattern : "y"};
				break;
			case 'yearmonth': 
				format = { selector : 'date', datePattern : "MMM y"};
				break;
			case 'weekyear': 
				//format = { selector : 'date', datePattern : "w - y"};
				return this.getWeekNr(date) + ' - ' + this.getWeekYear(date);
			case 'time': 
				format = { selector : 'time', timePattern : "HH:mm"};
				break;
			default: this.showError("Unknown dateformat: " + this.dateformat);
		}
		
		
		return dojo.date.locale.format(date, format);
	},
	
	getWeekNr : function(date) {
		date.setHours(0, 0, 0, 0);
		// Thursday in current week decides the year.
		date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
		// January 4 is always in week 1.
		var week1 = new Date(date.getFullYear(), 0, 4);
		// Adjust to Thursday in week 1 and count number of weeks from date to week1.
		return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
	},

	// Returns the four-digit year corresponding to the ISO week of the date.
	getWeekYear : function(date) {
		date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
		return date.getFullYear();
	},

	
	dateRound : function(x) {
		if (!this.isdate || this.dateaggregation == 'none')
			return x;
		
		var d = new Date(x);
		if( isNaN(d) )
			return x;
		
		if( this.isLocalizedDate ) {
			switch(this.dateaggregation) {
				case 'year':
					d.setMonth(0);
				case 'month':
					d.setDate(1);
				case 'day':
					d.setHours(0);
				case 'hour':
					d.setMinutes(0);
					d.setSeconds(0);
					d.setMilliseconds(0);
					break;
				case 'week':
					var distance = 1 - d.getDay();
					d.setDate(d.getDate() + distance);
					d.setHours(0);
					d.setMinutes(0);
					d.setSeconds(0);
					d.setMilliseconds(0);
					break;
			}
		}
		else {
			switch(this.dateaggregation) {
				case 'year':
					d.setUTCMonth(0);
				case 'month':
					d.setUTCDate(1);
				case 'day':
					d.setUTCHours(0);
				case 'hour':
					d.setUTCMinutes(0);
					d.setUTCSeconds(0);
					d.setUTCMilliseconds(0);
					break;
				case 'week':
					var distance = 1 - d.getDay();
					d.setUTCDate(d.getDate() + distance);
					d.setUTCHours(0);
					d.setUTCMinutes(0);
					d.setUTCSeconds(0);
					d.setUTCMilliseconds(0);
					break;
			}
		}

		return d.getTime();
	},
	
	//////// SECTION FILTER IMPLEMENTATION
	
	getActiveConstraint : function(index) {
		if (this.series[index].seriesentity != this.constraintentity)
			return "";
		var res = "";
		for(var i = 0; i < this.filters.length; i++) {
			var filter = this.filters[i];
			if (filter.value && filter.value != {} && filter.value !== '') {
				if (filter.filterattr.indexOf("/") > -1) {
                    for (var key in filter.value)
                        if (filter.value[key] === true) {
                            var attr = filter.filterattr.split("/");
                            res += "[" + filter.filterattr + " = '" + this.escapeQuotes(key) + "']";
                            break;
                        }
                  continue;
                }   
                switch(filter.type) {
					case "Integer":
					case "DateTime":
						if (filter.value.start)
							res += "[" + filter.filterattr + ">="+ filter.value.start + "]";
						if (filter.value.end)
							res += "[" + filter.filterattr + "<="+ filter.value.end + "]";
						break;
					case "String":
						if (dojo.isString(filter.value))
							res += "[contains(" + filter.filterattr + ",'" + this.escapeQuotes(filter.value) + "')]";
						break;
					case "Boolean":
					case "Enum":
						var enums = "";
						var all = true; //if all are checked, include null values
						for( var key in filter.value) {
							if (filter.value[key] === true)
								enums += "or " + filter.filterattr + "= " + (filter.type=="Enum" ? "'" + key + "'" : key) + " ";
							else
								all = false;
						}
						if (enums!== "" && !all)
							res += "[" + enums.substring(2) + "]";
						break;
					default:
						return this.showError("Type not supported in filters: " + filter.type);
				}
			}
		}
		return res;
	},
	
	clearConstraint : function() {
		for(var i = 0; i < this.filters.length; i++) {
			var filter = this.filters[i];
			switch(filter.type) {
				case "Boolean":
				case "Enum":
					for( var key in filter.value) 
						filter.value[key] = true;
					break;
				default:
					filter.value = {};
					break;
			}
		}
		
		for(var i = 0; i < this.inputs.length; i++) {
			var input = this.inputs[i];
			if (input.declaredClass == "dijit.form.CheckBox")
				input.setValue(true);
			else if (input.nodeName == "SELECT")
				input.value = '';
			else
				input.setValue(null);
		}
		
		this.refresh();
	},
	
	createrangeNode : function() {
		if (this.constraintentity === "")
			return;
		
		var open = mxui.dom.create('span',{'class': "SimpleChartFilterOpen"}, "(filter)");
		this.connect(open, "onclick", function() { dojo.style(this.rangeNode, {display : 'block'}); });
		dojo.place(open, this.domNode);		
		
		var n = this.rangeNode = mxui.dom.create('div',{ 'class' : 'SimpleChartRangeNode' });
		dojo.place(n, this.domNode);
		
		//retrieve the type and then construct the inputs
		mx.metadata.getMetaEntity({ 
			className :this.constraintentity,
			callback : dojo.hitch(this, this.addFilterInputs)
		});
	},
	
	inputs : null,
	
	addFilterInputs : function(meta) {
		try {
			this.inputs = [];
			dojo.require("dijit.form.DateTextBox");
			dojo.require("dijit.form.NumberTextBox");
			dojo.require("dijit.form.TextBox");
			dojo.require("dijit.form.CheckBox");
			dojo.require("dijit.form.Button");		
			
			var close = mxui.dom.create('span',{'class': "SimpleChartFilterClose"}, "x");
			this.connect(close, "onclick", this.closeFilterBox);
			dojo.place(close, this.rangeNode);
				
			for(var i = 0; i < this.filters.length; i++) {
				var filter = this.filters[i];

				filter.value = {};
				var catNode = mxui.dom.create('div',{'class': "SimpleChartFilterCat"});
				dojo.place(catNode, this.rangeNode);

                if (filter.filterattr.indexOf("/") > -1) {
                  if (this.usecontext)
                    this.connect(this, 'applyContext', dojo.hitch(this, this.addReferencedFilterAttr, filter, catNode));//wait for context
                  else
                    this.addReferencedFilterAttr(filter, catNode);
                  continue;
                }

                dojo.place(mxui.dom.create('span',{'class': "SimpleChartFilterLabel"}, filter.filtername),catNode);
				filter.type = meta.getAttributeClass(filter.filterattr);
                
				if (meta.isDate(filter.filterattr))
						this.createDateRangeSelector(catNode, filter);
				
				else if (meta.isNumber(filter.filterattr))
					this.createNumberRangeSelector(catNode, filter);	

				else if (meta.isEnum(filter.filterattr)) {
					var enums = meta.getEnumMap(filter.filterattr);
					if (enums.length < 5) {
						for(var j = 0; j < enums.length; j++)
							this.createCheckbox(catNode, filter, enums[j].key, enums[j].caption);
					} else {
						this.createDropdown(catNode, filter, enums);
					}
				}
				else if (meta.isBoolean(filter.filterattr)) {
					this.createCheckbox(catNode, filter, "true()",  "True");
					this.createCheckbox(catNode, filter, "false()", "False");
				}
				else if (filter.type == "String") {
					var widget = new dijit.form.TextBox();
					widget.onChange = dojo.hitch(this, function(filter, value){
						filter.value = value;
					}, filter);
					dojo.place(widget.domNode, catNode);
					this.inputs.push(widget);
				}				
				else
					this.showError("Unimplemented filter attribute type: " + filter.type);
			}

			for(var i = 0; i < this.inputs.length; i++)
				dojo.addClass(this.inputs[i].domNode, "SimpleChartFilterInput");

			var update = new dijit.form.Button({'class': "btn mx-button btn-default SimpleChartFilterUpdate", label : "update", onClick : dojo.hitch(this, function() {
				this.refresh();
				this.closeFilterBox();
			})});
			dojo.place(update.domNode, this.rangeNode);
			var clear = new dijit.form.Button({'class': "btn mx-button btn-default SimpleChartFilterClear", label : "clear", onClick : dojo.hitch(this, this.clearConstraint)});
			dojo.place(clear.domNode, this.rangeNode);
		}
		catch(e) {
			this.showError("Unable to create filter inputs: " + e);
		}
	},
	
    addReferencedFilterAttr : function(filter, catNode) {
        if (!this.dataobject && this.usecontext)
            return; //we are waiting for context...
            
        dojo.empty(catNode);
        
        dojo.place(mxui.dom.create('span',{'class': "SimpleChartFilterLabel"}, filter.filtername),catNode);
        
        var attrparts = filter.filterattr.split("/");
        var ref = attrparts[0];
        var entity = attrparts[1];
        var attr = attrparts[2];
        
        var dataconstraint = "";
        
        for(var i = 0; i< this.series.length; i++)
          if (this.series[i].seriesentity == this.constraintentity)
            dataconstraint += this.series[i].seriesconstraint; //apply constraint of the data to the selectable items.
        
        mx.processor.get({
            xpath : ("//" + entity + "[" + ref + "/" + this.constraintentity +  dataconstraint + "]").replace(/\[\%CurrentObject\%\]/gi, this.dataobject),
            filter : {
			  attributes : [ attr ],
              references : {},
			  sort    : [[attr, 'asc']]
			},
            callback : dojo.hitch(this, this.retrieveFilterData, filter, catNode),
            error : dojo.hitch(this, this.showError)
        });
    },
    
    retrieveFilterData : function(filter, catNode, objects) {
        var attr = filter.filterattr.split("/")[2];
        var enums = dojo.map(objects, function(item) {
          var val = item.getAttribute(attr);
          return { key : val, caption : val };
        }, this);
        this.createDropdown(catNode, filter, enums);
    },
    
	closeFilterBox : function() {
		dojo.style(this.rangeNode, {display : 'none'});		
	},
	
	createCheckbox : function(catNode, filter, value, caption) {
		filter.value[value] = true;
		var checkBox = new dijit.form.CheckBox({value: value, checked: true});
		dojo.place(checkBox.domNode, catNode);
		dojo.place(mxui.dom.create('label',{"class" : "SimpleChartFilterCheckboxLabel"}, caption), catNode);
		checkBox.onChange = dojo.hitch(this, function(filter, value, checked) {
			filter.value[value] = checked;
		}, filter, value);
		this.inputs.push(checkBox);
	},
	
	createDropdown : function(catNode, filter, valueArr) {
		var selectNode = mxui.dom.create('select');
		var optionNode = mxui.dom.create('option',{ value : ''}, '');
		selectNode.appendChild(optionNode);
		for (var i = 0; i < valueArr.length; i++) 
            if (!filter.value[valueArr[i].key]) { //avoid items to appear twice
                var optionNode = mxui.dom.create('option',{ value : valueArr[i].key}, valueArr[i].caption);
                filter.value[valueArr[i].key] = false;
                selectNode.appendChild(optionNode);
            }
            
		dojo.place(selectNode, catNode);
		this.connect(selectNode, "onchange", dojo.hitch(selectNode, function (filter, e) {
			for (var key in filter.value)
				filter.value[key] = key == this.value;
		}, filter));
		selectNode['domNode'] = selectNode;
		this.inputs.push(selectNode);
	},
	
	createDateRangeSelector : function(catNode, filter) {
		//create two date inputs
				
		var widget = new dijit.form.DateTextBox({});
		widget.onChange = dojo.hitch(this, function(filter, value) {
			filter.value.start = value == null ? null : value.getTime();
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
		
		widget = new dijit.form.DateTextBox({});
		widget.onChange = dojo.hitch(this, function(filter, value) {
			filter.value.end = value == null ? null : value.getTime();
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
	},
	
	createNumberRangeSelector : function(catNode, filter) {
		var widget = new dijit.form.NumberTextBox();
		widget.onChange = dojo.hitch(this, function(filter, value){
			filter.value.start = value;
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
		
		widget = new dijit.form.NumberTextBox();
		widget.onChange = dojo.hitch(this, function(filter, value){
			filter.value.end = value;
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
	},
    
    escapeQuotes : function(value) { //MWE: fix the fact that mxcompat is not correct for escapeQuotes in 3.0.0.
        if ((typeof (mxui) != "undefined") && mxui.html)
            return mxui.html.escapeQuotes(value);
        else
            return mx.parser.escapeQuotesInString(value);
    },
    
    isNumeric : function(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    },
    
    objectmix : function(base, toadd) {
      //MWE: because console.dir(dojo.mixin({ a : { b : 3 }}, { a : { c : 5 }})); -> { a : { c : 5 }}, but i want to keep b
      if (toadd) {
        /*console.log("in");
        console.dir(base);
        console.log("add");
        console.dir(toadd);*/
        for(var key in toadd) {
            if ((key in base) &&
                ((dojo.isArray(toadd[key]) != dojo.isArray(base[key])) || 
                 (dojo.isObject(toadd[key]) != dojo.isObject(base[key]))))
                throw "Cannot mix object properties, property '" + key + "' has different type in source and destination object";
                
           //mix array
          if (key in base && dojo.isArray(toadd[key])) { //base is checked in the check above
            var src = toadd[key];
            var target = base[key];
            for(var i = 0; i < src.length; i++) {
                if (i < target.length) {
                    if (dojo.isObject(src[i]) && dojo.isObject(target[i]))
                        this.objectmix(target[i], src[i]);
                    else
                        target[i] = src[i];
                }
                else 
                    target.push(src[i]);
            }     
          }
          //mix object
          else if (key in base && dojo.isObject(toadd[key])) //base is checked in the check above
            this.objectmix(base[key], toadd[key]);
          //mix primitive
          else
            base[key] = toadd[key];
        }
      }
      /*console.log("out");
      console.dir(base);*/
    }
});
