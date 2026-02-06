/**
 * Patch file from ChartIQ v9.7 for v9.6.1 Fidelity
 * Volume underlay fix
 * 
 * 20260202 – ChartIQ Developer Relations
 * https://github.com/ChartIQ/stx/pull/3822/changes
 */

import { CIQ } from "./js/chartiq.js";

/**
 * <span class="injection">INJECTABLE</span>
 * <span class="animation">Animation Loop</span>
 *
 * This method draws the y-axis. It is typically called after {@link CIQ.ChartEngine.AdvancedInjectable#createYAxis}.
 *
 * Use css styles `stx_xaxis` to control colors and fonts for the dates. <br>
 * Use css styles `stx_xaxis_dark` to control **color only** for the divider dates. <br>
 * Use css styles `stx_grid_border`, `stx_grid` and `stx_grid_dark` to control the grid line colors. <br>
 * The dark styles are used for dividers; when the grid changes to a major point such as the start of a new day on an intraday chart, or a new month on a daily chart.
 *
 * See {@tutorial CSS Overview} for additional details.
 *
 * @param  {CIQ.ChartEngine.Panel} panel	   The panel to draw the y-axis
 * @param  {object} parameters Parameters for the y-axis (only used internally. Send {} when calling this method directly).
 * @param {array} [parameters.range] Optionally set the range of values to display on the y-axis. For instance [0,100] would only print from zero to one hundred, regardless of the actual height of the y-axis.
 *									 This is useful if you want to add some buffer space to the panel but don't want the y-axis to reveal nonsensical values.
 * @param {boolean} [parameters.noDraw]		If true then make all the calculations but don't draw the y-axis. Typically used when a study is going to draw its own y-axis.
 * @param {CIQ.ChartEngine.YAxis} [parameters.yAxis] The yAxis to use. Defaults to panel.yAxis.
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias drawYAxis
 */
CIQ.ChartEngine.prototype.drawYAxis = function (panel, parameters) {
	if (!parameters) parameters = {};
	var yAxis = parameters.yAxis ? parameters.yAxis : panel.yAxis;
	if (panel.hidden || yAxis.isHidden()) return;
	// override existing axis settings for fractional quotes

	var fractional = yAxis.fractional;
	if (fractional) {
		if (!fractional.resolution) fractional.resolution = yAxis.minimumPrice;
		if (!fractional.formatter) fractional.formatter = "'";
		if (!yAxis.priceFormatter) {
			yAxis.setPriceFormatter(function (stx, panel, price) {
				if (!fractional) return;
				var sign = "";
				if (price < 0) {
					sign = "-";
					price = Math.abs(price);
				}
				var whole = Math.floor(
					Math.round(price / fractional.resolution) * fractional.resolution
				);
				var frac = Math.round((price - whole) / fractional.resolution);
				var _nds = Math.floor(frac);
				return (
					sign +
					whole +
					fractional.formatter +
					(_nds < 10 ? "0" : "") +
					_nds +
					(frac - _nds >= 0.5 ? "+" : "")
				);
			});
			yAxis.wasFractional = true;
		}
	} else if (yAxis.wasFractional) {
		const isComparisonFormatter =
			CIQ.Comparison && yAxis.priceFormatter === CIQ.Comparison.priceFormat;
		yAxis.setPriceFormatter(
			isComparisonFormatter ? null : false,
			isComparisonFormatter
		);
		yAxis.wasFractional = false;
	}

	var textColorOrStyle = this.colorOrStyle(yAxis.textStyle || "stx_yaxis");

	var draggable = this.highlightedDraggable,
		opacity = 0;
	if (draggable && this.yaxisMatches(draggable, yAxis)) {
		opacity = 0.15;
	} else if (yAxis.highlight) {
		opacity = 0.1;
		if (yAxis.showMenuToggle) {
			yAxis.showMenuToggle();
		}
	} else if (
		!Object.values(this.panels).some((panel) =>
			panel.yaxisLHS.concat(panel.yaxisRHS).some((yaxis) => yaxis.highlight)
		)
	) {
		if (yAxis.showMenuToggle) {
			yAxis.showMenuToggle(false);
		}
	}

	if (opacity) {
		var bgColor =
			textColorOrStyle.constructor == String
				? textColorOrStyle
				: textColorOrStyle.color;
		yAxis.setBackground(this, { color: bgColor, opacity: opacity });
	}

	if (yAxis.clamp && (yAxis.clamp.count || yAxis.clamp.count === 0))
		return this.drawYAxisFixed(panel, parameters);
	else if (yAxis.pretty) return this.drawYAxisPretty(panel, parameters);
	if (this.runPrepend("drawYAxis", arguments)) return;

	if (!parameters.noDraw && !yAxis.noDraw) {
		var yAxisPlotter = yAxis.yAxisPlotter;
		if (!yAxisPlotter || !parameters.noChange) {
			yAxisPlotter = yAxis.yAxisPlotter = new CIQ.Plotter(); // This plotter is saved as a member. We can re-use it to draw the exact same y-axis when noChange=true
			var chart = panel.chart;
			var isAChart =
				panel.name == chart.name && yAxis.name === panel.yAxis.name;
			if (!yAxis.priceTick) return;
			var shadow = yAxis.shadow;
			var range = parameters.range;
			if (range) {
				shadow = range[1] - range[0];
			}
			var verticalTicks = shadow / yAxis.priceTick;
			//if(isAChart)
			//	verticalTicks=Math.round(verticalTicks +.499);	// This will create one more tick's worth of vertical space at the top of charts
			// very useful for trending stocks which will otherwise touch the top of the chart
			verticalTicks = Math.round(verticalTicks);
			var logStart, logPriceTick;
			if (yAxis.semiLog) {
				logStart =
					Math.log(
						this.valueFromPixel(yAxis.flipped ? yAxis.top : yAxis.bottom, panel)
					) / Math.LN10;
				logPriceTick = (yAxis.logHigh - yAxis.logLow) / verticalTicks;
			}
			yAxisPlotter.newSeries("grid", "stroke", this.canvasStyle("stx_grid"));
			yAxisPlotter.newSeries("text", "fill", textColorOrStyle);
			yAxisPlotter.newSeries(
				"border",
				"stroke",
				this.canvasStyle("stx_grid_border")
			);

			var priceOffset = 0;
			var high = range ? range[1] : yAxis.high;
			var low = range ? range[0] : yAxis.low;
			var drawBorders =
				yAxis.displayBorder === null
					? chart.panel.yAxis.displayBorder
					: yAxis.displayBorder;
			// Master override
			if (this.axisBorders === false) drawBorders = false;
			if (this.axisBorders === true) drawBorders = true;
			var edgeOfAxis;
			var dynamicWidth = chart.dynamicYAxis;
			var labelWidth = dynamicWidth ? yAxis.width : NaN;

			var position = this.getYAxisCurrentPosition(yAxis, panel);
			if (position == "left") {
				edgeOfAxis = yAxis.left + yAxis.width;
			} else {
				edgeOfAxis = yAxis.left;
			}
			var borderEdge = Math.round(edgeOfAxis) + 0.5;
			var tickWidth = drawBorders ? 3 : 0; // pixel width of tick off edge of border
			if (position == "left") tickWidth = drawBorders ? -3 : 0;

			if (isAChart)
				if (yAxis.shadow < 1) {
					// This forces the y-axis on to even values
					// when dealing with very small decimal ranges, we need to have a slightly different formula to compute offset and make sure we start at a more suitable price.
					// This is needed to account for floating point issues that will otherwise cause the label to be placed at a location that if rounded ( using yAxis.decimalPlaces) will confuse the user. (price may be 9.4999999998; will show 9.500, but placed at 9.499 for example)
					priceOffset =
						(parseInt(low / yAxis.priceTick, 10) + 1) * yAxis.priceTick - low;
				} else {
					priceOffset =
						yAxis.priceTick -
						Math.round((low % yAxis.priceTick) * panel.chart.roundit) /
						panel.chart.roundit;
				}
			else priceOffset = high % yAxis.priceTick;
			var fontHeight = this.getCanvasFontSize("stx_yaxis");
			for (var i = 0; i < verticalTicks; i++) {
				var price;
				if (yAxis.semiLog) {
					var logPrice = logStart + i * logPriceTick;
					price = Math.pow(10, logPrice);
				} else {
					// Charts need a little extra space at the top while studies
					// want to show the high value right at the panel division line
					// so we reverse the order of our priceTicks depending on the situation
					if (isAChart) price = low + i * yAxis.priceTick + priceOffset;
					else price = high - i * yAxis.priceTick - priceOffset;
				}
				var y = this.pixelFromTransformedValue(price, panel, yAxis);

				var y2 = Math.floor(y) + 0.5;
				if (y2 + fontHeight / 2 > panel.bottom) continue; // Make sure we don't stray past the bottom of the panel
				if (y2 - fontHeight / 2 < panel.top) continue; // Make sure we don't stray past the top of the panel
				if (Math.abs(y2 - yAxis.bottom) < 1) continue; // don't draw gridline across bottom of panel
				if (yAxis.flipped) y2 = yAxis.top + yAxis.bottom - y2;
				if (yAxis.displayGridLines) {
					yAxisPlotter.moveTo("grid", panel.left + 1, y2);
					yAxisPlotter.lineTo("grid", panel.right - 1, y2);
				}
				if (drawBorders) {
					yAxisPlotter.moveTo("border", borderEdge - 0.5, y2);
					yAxisPlotter.lineTo("border", borderEdge + tickWidth, y2);
				}
				if (yAxis.priceFormatter) {
					price = yAxis.priceFormatter(this, panel, price);
				} else {
					price = this.formatYAxisPrice(price, panel, null, yAxis);
				}
				var backgroundColor = yAxis.textBackground ? this.containerColor : null;
				var extraPaddingBeforeText = 3;
				var textXPosition = edgeOfAxis + tickWidth + extraPaddingBeforeText;
				if (position == "left") {
					textXPosition = yAxis.left + extraPaddingBeforeText;
					if (yAxis.justifyRight !== false)
						textXPosition =
							yAxis.left + yAxis.width + tickWidth - extraPaddingBeforeText;
				} else {
					if (yAxis.justifyRight) textXPosition = edgeOfAxis + yAxis.width;
				}
				yAxisPlotter.addText(
					"text",
					price,
					textXPosition,
					y2,
					backgroundColor,
					null,
					fontHeight
				);
				if (dynamicWidth) {
					labelWidth = Math.max(
						labelWidth,
						chart.context.measureText(price).width +
						Math.abs(tickWidth) +
						extraPaddingBeforeText
					);
				}
			}
			if (drawBorders) {
				var b = Math.round(yAxis.bottom) + 0.5;
				yAxisPlotter.moveTo("border", borderEdge, yAxis.top);
				yAxisPlotter.lineTo("border", borderEdge, b);
				yAxisPlotter.draw(this.getBackgroundCanvas(chart).context, "border");
			}
			if (dynamicWidth && labelWidth > yAxis.width) {
				// the chart was initialized at an invalid width
				yAxis._dynamicWidth = labelWidth;
				this.calculateYAxisPositions(); // side effects
				throw new Error("reboot draw");
			} else if (!dynamicWidth && yAxis._dynamicWidth) {
				this.resetDynamicYAxis();
				throw new Error("reboot draw");
			}
		}
		this.plotYAxisGrid(panel, yAxis);
	}
	this.runAppend("drawYAxis", arguments);
};


/**
 * <span class="injection">INJECTABLE</span>
 * <span class="animation">Animation Loop</span>
 *
 * This method initializes display variables for the chart.
 *
 * It is part of the animation loop and called with every [draw]{@link CIQ.ChartEngine#draw} operation.<br>
 * The high and low values for the visible section of the primary chart are calculated and corresponding values stored as follows:
 * - `chart.highValue` - The highest value on the chart
 * - `chart.lowValue` - The lowest value on the chart
 *
 * See {@link CIQ.ChartEngine.Chart#includeOverlaysInMinMax} and  {@link CIQ.ChartEngine#determineMinMax}
 *
 * Those values are subsequently used by {@link CIQ.ChartEngine.AdvancedInjectable#createYAxis} which is called from within this method.<br>
 * This method also calls {@link CIQ.ChartEngine.AdvancedInjectable#createCrosshairs}.
 *
 * @param  {CIQ.ChartEngine.Chart} chart The chart to initialize
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias initializeDisplay
 * @since 5.2.0. It now also calculates the minimum and maximum points in all study panels. This calculation was previously done using {@link CIQ.Studies.determineMinMax}, now deprecated.
 */
CIQ.ChartEngine.prototype.initializeDisplay = function (chart) {
	if (this.runPrepend("initializeDisplay", arguments)) return;
	let fields = [],
		useSum = [],
		checkArray = false;
	const self = this;
	const baseOHLCFields = ["Close", "Open", "High", "Low"];
	const baseLineFields = [chart.defaultPlotField || "Close"];
	const { mainSeriesRenderer } = this;
	const { dataSegment, seriesRenderers } = chart;
	function setYAxisFields(yAxis, panel) {
		// first see if this is an axis for a study; if so, get the fields
		let isStudyAxis = false;
		const sd =
			self.layout && self.layout.studies && self.layout.studies[yAxis.name];
		const isStudyPanel = sd && (!panel || panel.name == sd.panel);
		if (
			isStudyPanel &&
			!(sd.disabled || (sd.signalData && !sd.signalData.reveal))
		) {
			for (const j in sd.outputMap) {
				fields.push(j);
				if (sd.study) {
					if (sd.study.renderer) {
						// if there is a study renderer, just assume it requires OHLC regardless of the renderer type
						fields = fields.concat(
							CIQ.createObjectChainNames(j, baseOHLCFields)
						);
					} else if (!sd.study.seriesFN) {
						// no seriesFN, assume it's a line and needs only Close
						fields = fields.concat(
							CIQ.createObjectChainNames(j, baseLineFields)
						);
					}
				}
			}
			for (let h = 0; h <= 2; h++)
				fields.push(sd.name + "_hist" + (h ? h : ""));
		}
		if (isStudyPanel) isStudyAxis = true;
		if (!panel) return; //to end recursion from includeOverlaysInMinMax below

		yAxis.studies = [];
		yAxis.renderers = [];
		if (isStudyAxis) {
			yAxis.studies.push(yAxis.name);
		}
		// then check renderers and add fields for each series in the renderer using this yaxis
		for (const id in seriesRenderers) {
			const renderer = seriesRenderers[id],
				params = renderer.params,
				panelName = params.panel;
			if (
				(params.yAxis ||
					!self.panels[panelName] ||
					self.panels[panelName].yAxis) != yAxis
			)
				continue;
			if (panelName != panel.name) continue;
			const baseFields = renderer.highLowBars ? baseOHLCFields : baseLineFields;
			checkArray = renderer.bounded;
			for (let id2 = 0; id2 < renderer.seriesParams.length; id2++) {
				// Find any series that share the y-axis
				const seriesParams = renderer.seriesParams[id2];
				if (seriesParams.hidden || seriesParams.disabled) continue;
				let fieldNamesToConcat;
				if (seriesParams.subField) {
					fieldNamesToConcat = CIQ.createObjectChainNames(seriesParams.symbol, [
						seriesParams.subField
					]).concat(seriesParams.symbol);
				} else if (seriesParams.symbol) {
					fieldNamesToConcat = CIQ.createObjectChainNames(
						seriesParams.symbol,
						baseFields
					).concat(seriesParams.symbol);
				} else if (seriesParams.field) {
					fieldNamesToConcat = seriesParams.field;
				} else if (yAxis == chart.panel.yAxis) {
					// only if the main chart panel's yAxis include baseFields
					fieldNamesToConcat = baseFields;
				}
				if (fieldNamesToConcat) fields = fields.concat(fieldNamesToConcat);
				if (renderer.useSum) useSum = useSum.concat(fieldNamesToConcat);
			}
			yAxis.renderers.push(id);
		}
		// Finally add any fields used by overlay studies
		for (const overlay in self.overlays) {
			const o = self.overlays[overlay];
			if (o.panel != panel.name) continue;
			if (o.name == yAxis.name) continue; // don't loop thru the same axis twice and create duplicates
			const oAxis = o.getYAxis(self);
			if (oAxis != yAxis) continue;
			yAxis.studies.push(o.name);
			if (chart.includeOverlaysInMinMax) {
				setYAxisFields({ name: o.name });
			}
		}
	}
	let minMax;
	let length = null;

	// We often have an extra tick hanging off the edge of the screen. We don't want this
	// tick to affect the high and low calculation though. That causes jumpiness when
	// zooming because the chart is alternately including and excluding that tick
	let ticksOnScreen = Math.floor(
		(chart.width - this.micropixels) / this.layout.candleWidth
	);
	if (chart.scroll > chart.maxTicks && chart.maxTicks > ticksOnScreen + 1)
		length = dataSegment.length - 1;

	let arr = [];
	for (const p in this.panels) {
		const myPanel = this.panels[p];
		arr = myPanel.yaxisLHS.concat(myPanel.yaxisRHS);
		for (let y = 0; y < arr.length; y++) {
			const yAxis = arr[y];
			fields = [];
			useSum = [];
			const doTransform = this.getTransformFunction(yAxis);
			setYAxisFields(yAxis, myPanel);
			const wasDisabled = !!yAxis.isDisabled;
			yAxis.isDisabled = yAxis !== chart.panel.yAxis && !fields.length;
			// maintenance of axes here
			if (
				!this.currentlyImporting &&
				!yAxis.renderers.length &&
				!yAxis.studies.length
			) {
				this.deleteYAxisIfUnused(myPanel, yAxis);
				continue;
			}
			if (wasDisabled !== yAxis.isDisabled) {
				this.resetDynamicYAxis({ positionRecalculate: true });
				if (yAxis.isDisabled) continue;
			}
			if (mainSeriesRenderer.determineMax) {
				minMax = mainSeriesRenderer.determineMax(
					dataSegment,
					fields,
					useSum,
					!doTransform,
					length,
					checkArray,
					myPanel,
					yAxis
				);
			} else {
				minMax = this.determineMinMax(
					dataSegment,
					fields,
					useSum,
					!doTransform,
					length,
					checkArray,
					myPanel,
					yAxis
				);
			}

			if (this.baselineHelper) minMax = this.setBaselineMinMax(minMax, yAxis);

			yAxis.lowValue = minMax[0];
			yAxis.highValue = minMax[1];
			if (yAxis == chart.panel.yAxis) {
				chart.lowValue = yAxis.lowValue;
				chart.highValue = yAxis.highValue;
			}
		}
	}
	const aggregation = chart.state.aggregation;
	if (aggregation && aggregation.box) {
		// Make room for X and O rendering since half of it lies beyond the high/low
		chart.lowValue -= aggregation.box / 2;
		chart.highValue += aggregation.box / 2;
	}

	this.runAppend("initializeDisplay", arguments);
};


/**
 * <span class="injection">INJECTABLE</span>
 *
 * This method initializes the chart container events, such as window `resize` events,
 * and the [resizeTimer]{@link CIQ.ChartEngine#setResizeTimer} to ensure the chart adjusts as its container size changes.
 * It also initializes various internal variables, the canvas and creates the chart panel.
 *
 * This is called by {@link CIQ.ChartEngine#loadChart} and should rarely be called directly.
 *
 * Note that the candle width will be reset to 8px if larger than 50px. Even if the value comes from a layout import.
 * This is done to ensure a reasonable candle size is available across devices that may have different screen size.
 *
 * @param {HTMLElement} [container] Node that contains the chart.
 * @memberof CIQ.ChartEngine
 *
 */
CIQ.ChartEngine.prototype.initializeChart = function (container) {
	if (this.runPrepend("initializeChart", arguments)) return;
	var chart = this.chart;
	if (!chart.symbolObject.symbol) chart.symbolObject.symbol = chart.symbol; // for backwards compatibility so the symbol object is always initialized in case we don't use loadChart()
	if (this.locale) this.setLocale(this.locale);
	if (!this.displayZone && CIQ.ChartEngine.defaultDisplayTimeZone) {
		this.setTimeZone(null, CIQ.ChartEngine.defaultDisplayTimeZone);
	}
	this.resetDynamicYAxis({ positionRecalculate: true });
	this.micropixels = 0;

	if (container) chart.container = container;
	else container = chart.container;
	container.stx = this;
	if (!container.CIQRegistered) {
		container.CIQRegistered = true;
		CIQ.ChartEngine.registeredContainers.push(container);
		CIQ.ChartEngine.attachGlobalEventHandlers();
	}
	if (this.registerHTMLElements) this.registerHTMLElements(); // Sets all of the internal HTML elements to those in the container

	// Just make sure the candleWidth is sane
	this.setCandleWidth(this.layout.candleWidth);

	var self = this;
	function createCanvas(name, hide) {
		var canv = document.createElement("canvas");
		canv.context = canv.getContext("2d");
		canv.context.lineWidth = 1;
		if (name === "canvas" && !self.linkedChartEngine) {
			canv.role = "img";
			canv.tabIndex = -1;
		} else {
			canv.ariaHidden = "true";
		}
		var canvasStyle = canv.style;
		canvasStyle.position = "absolute";
		canvasStyle.left = "0px";
		if (hide) canvasStyle.display = "none";
		container.appendChild(canv);
		return canv;
	}

	if (!chart.backgroundCanvas) {
		chart.backgroundCanvas = createCanvas("backgroundCanvas");
		chart.canvas = createCanvas("canvas");
		chart.tempCanvas = createCanvas("tempCanvas", true);
		this.floatCanvas = createCanvas("floatCanvas", true);

		chart.context = chart.canvas.context;
		chart.canvasShim = document.createElement("div");
		chart.canvasShim.className = "stx-canvas-shim";
		container.insertBefore(chart.canvasShim, chart.canvas);
	}

	this.resizeCanvas();

	if (CIQ.isAndroid) {
		var ontouchstart = function (e) {
			if (e.preventDefault) e.preventDefault();
		};
		chart.tempCanvas.addEventListener("touchstart", ontouchstart, {
			passive: false
		});
		this.floatCanvas.addEventListener("touchstart", ontouchstart, {
			passive: false
		});
	}

	var panels = this.panels;
	chart.panel.display = chart.symbol;
	if (chart.symbolDisplay) chart.panel.display = chart.symbolDisplay;
	this.adjustPanelPositions();
	chart.panel = panels[chart.name];

	for (var p in panels) {
		var yAxes = panels[p].yaxisLHS.concat(panels[p].yaxisRHS);
		for (var a = 0; a < yAxes.length; a++) {
			yAxes[a].height = panels[p].yAxis.height; // set the [overlay] yAxis height to the panel's main yAxis height...
			this.calculateYAxisMargins(yAxes[a]); // ...so this will work
		}
	}

	this.initialWhitespace = this.preferences.whitespace;
	if (chart.dataSet && chart.dataSet.length > 0) {
		chart.scroll = Math.floor(chart.width / this.layout.candleWidth); //chart.maxTicks;
		var wsInTicks = Math.round(
			this.preferences.whitespace / this.layout.candleWidth
		);
		chart.scroll -= wsInTicks;
	}
	if (CIQ.touchDevice) {
		var overlayEdit = container.querySelector(".overlayEdit");
		var overlayText = container.querySelector(".overlayText");
		var overlayTrashCan = container.querySelector(".overlayTrashCan");
		var vectorTrashCan = container.querySelector(".vectorTrashCan");
		var cb = function (self, callRightClick, forceEdit, forceText) {
			return function (e) {
				self.deleteHighlighted(callRightClick, forceEdit, forceText);
			};
		};
		if (overlayText) {
			CIQ.safeClickTouch(overlayText, cb(this, true, false, true));
		}
		if (overlayEdit) {
			CIQ.safeClickTouch(overlayEdit, cb(this, true, true, false));
			if (overlayTrashCan) {
				CIQ.safeClickTouch(overlayTrashCan, cb(this, false));
			}
		} else if (overlayTrashCan) {
			CIQ.safeClickTouch(overlayTrashCan, cb(this, true));
		}
		if (vectorTrashCan) {
			CIQ.safeClickTouch(vectorTrashCan, cb(this, true));
		}
	}
	if (this.manageTouchAndMouse) {
		this.registerTouchAndMouseEvents();
	}
	if (this.handleMouseOut) {
		container.onmouseout = (function (self) {
			return function (e) {
				self.handleMouseOut(e);
			};
		})(this);
		CIQ.smartHover(container.ownerDocument);
	}

	if (this.abortDrawings) this.abortDrawings();
	this.undoStamps = [];
	for (var panelName in panels) {
		var panel = panels[panelName];
		if (panel.markerHolder) {
			container.removeChild(panel.markerHolder);
			panel.markerHolder = null;
		}
	}
	for (var i in this.plugins) {
		var plugin = this.plugins[i];
		if (plugin.display) {
			if (plugin.initializeChart) plugin.initializeChart(this);
		}
	}

	// This sets a resize listener for when the screen itself is resized.
	if (!this.resizeListenerInitialized) {
		this.resizeListenerInitialized = true;
		var resizeListener = function () {
			return function (e) {
				self.resizeChart();
			};
		};
		this.addDomEventListener(
			container.ownerDocument.defaultView,
			"resize",
			resizeListener(),
			true
		);
	}
	if (chart.baseline.userLevel) chart.baseline.userLevel = null;
	this.setResizeTimer();
	this.runAppend("initializeChart", arguments);
};

/**
 * <span class="injection">INJECTABLE</span>
 *
 * Closes the panel opened with {@link CIQ.ChartEngine.AdvancedInjectable#createPanel}.
 * This is called when a chart panel is closed manually or programmatically.
 * For example, after removing a study panel with the {@link CIQ.Studies.removeStudy} function, or when a user clicks on the "X" for a panel.
 * @param  {CIQ.ChartEngine.Panel} panel The panel to close
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias panelClose
 *
 */
CIQ.ChartEngine.prototype.panelClose = function (panel) {
	if (!panel) return;
	if (this.runPrepend("panelClose", arguments)) return;
	this.cancelTouchSingleClick = true;
	CIQ.ChartEngine.drawingLine = false;
	if (panel.soloing) this.panelSolo(panel);

	// If we're deleting a panel with a chart in it
	if (this.charts[panel.name]) {
		// Then delete all the panels that reference that chart
		for (var panelName in this.panels) {
			var subPanel = this.panels[panelName];
			if (subPanel.chart.name == panel.name) {
				this.privateDeletePanel(subPanel);
			}
		}
		// and delete the chart itself
		delete this.charts[panel.name];
	} else {
		// otherwise just delete the panel
		this.privateDeletePanel(panel);
	}
	if (!this.currentlyImporting) {
		// silent mode while importing
		this.showCrosshairs();
		//this.createDataSet();  // commented, why would we do this?
		this.resetDynamicYAxis({ positionRecalculate: true });
		this.draw();
		this.savePanels();
	}
	// IE11 on Win7 hack. We do this in case the mouseup is lost when we removed the panel.close from the DOM
	this.userPointerDown = this.grabbingScreen = false;
	if (this.openDialog) this.openDialog = "";
	this.runAppend("panelClose", arguments);
};

/**
 * This "solos" the panel (when the user clicks the solo button). All panels other than this panel and the chart
 * are temporarily hidden. If the solo panel is the chart then all other panels will be hidden.
 * Note if {@link CIQ.ChartEngine#soloPanelToFullScreen} is set than even the chart panel may be hidden
 * @param  {CIQ.ChartEngine.Panel} panel The panel to be soloed.
 * @memberof CIQ.ChartEngine
 */
CIQ.ChartEngine.prototype.panelSolo = function (panel) {
	this.cancelTouchSingleClick = true;
	CIQ.ChartEngine.drawingLine = false;
	this.showCrosshairs();
	var hideOrNot = true;
	var p;
	if (panel.soloing) {
		hideOrNot = false;
		panel.soloing = false;
		panel.solo.classList.remove("stx_solo_lit");
		panel.percent = panel.oldPercent;
		if (panel.name != "chart") {
			if (this.soloPanelToFullScreen) {
				if (panel.percent == 1) {
					for (p in this.panels) {
						var otherPanel = this.panels[p];
						if (otherPanel != panel) panel.percent -= otherPanel.percent;
					}
				}
			} else {
				this.chart.panel.percent = this.chart.panel.oldPercent;
			}
		}
		if (this.soloPanelToFullScreen) {
			this.xAxisAsFooter = this.chart.panel.oldXAxisAsFooter;
		}
	} else {
		panel.soloing = true;
		panel.solo.classList.add("stx_solo_lit");
		panel.oldPercent = panel.percent;
		this.chart.panel.oldXAxisAsFooter = this.xAxisAsFooter;
		if (panel.name != "chart") {
			if (this.soloPanelToFullScreen) {
				this.xAxisAsFooter = true;
			} else {
				this.chart.panel.oldPercent = this.chart.panel.percent;
				panel.percent = 1 - this.chart.panel.percent;
			}
		}
	}
	for (p in this.panels) {
		if (panel === this.panels[p]) continue;
		if (p === "chart" && !this.soloPanelToFullScreen) continue;
		this.panels[p].hidden = hideOrNot;
	}
	this.resetDynamicYAxis({ positionRecalculate: true });
	this.draw();
	this.savePanels();
};

/**
 * <span class="injection">INJECTABLE</span>
 * <span class="animation">Animation Loop</span>
 *
 * Draws the panels for the chart and chart studies. CSS style stx_panel_border can be modified to change the color
 * or width of the panel dividers.
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias drawPanels
 */
CIQ.ChartEngine.prototype.drawPanels = function () {
	if (this.runPrepend("drawPanels", arguments)) return;
	var first = false;
	for (var p in this.panels) {
		var panel = this.panels[p];
		panel.state = {}; // reset the drawing state

		var textToDisplay = this.translateIf(panel.display);
		if (panel.title && panel.title.textContent != textToDisplay) {
			panel.title.innerHTML = "";
			panel.title.appendChild(document.createTextNode(textToDisplay));
		}
		if (panel.icons) panel.icons.classList.add("stx-show");
		if (panel.hidden) {
			if (panel.icons) panel.icons.classList.remove("stx-show");
			if (panel.handle) panel.handle.style.display = "none";
			panel.holder.style.display = "none";
			continue;
		} else {
			if (panel.name != "chart") {
				var manageTouchAndMouse = this.manageTouchAndMouse;
				if (panel.up)
					panel.up.style.display =
						this.displayIconsUpDown && manageTouchAndMouse ? "" : "none";
				if (panel.down)
					panel.down.style.display =
						this.displayIconsUpDown && manageTouchAndMouse ? "" : "none";
				if (panel.solo)
					panel.solo.style.display =
						this.displayIconsSolo && manageTouchAndMouse ? "" : "none";
				if (panel.close)
					panel.close.style.display =
						this.displayIconsClose && manageTouchAndMouse ? "" : "none";
				if (panel.edit)
					panel.edit.style.display =
						panel.editFunction && manageTouchAndMouse ? "" : "none";
			}
			panel.holder.style.display = "block";
		}
		if (panel.displayEdgeIfPadded) {
			var x = Math.round(panel.left) + 0.5,
				t = panel.yAxis.top - 0.5,
				b = panel.yAxis.bottom + 0.5;
			// Display top and bottom panel borders
			for (var yy of [t, b]) {
				this.plotLine(
					this.left,
					this.right,
					yy,
					yy,
					this.canvasStyle("stx_panel_border"),
					"segment",
					this.chart.context,
					false,
					{ lineWidth: 1 }
				);
			}
			if (panel.yaxisCalculatedPaddingLeft && !panel.yaxisTotalWidthLeft)
				this.plotLine(
					x,
					x,
					t,
					b,
					this.canvasStyle("stx_grid_border"),
					"segment",
					this.chart.context,
					false,
					{ lineWidth: 1 }
				);
			x = Math.round(panel.right) + 0.5;
			if (panel.yaxisCalculatedPaddingRight && !panel.yaxisTotalWidthRight)
				this.plotLine(
					x,
					x,
					t,
					b,
					this.canvasStyle("stx_grid_border"),
					"segment",
					this.chart.context,
					false,
					{ lineWidth: 1 }
				);
		}
		if (!first) {
			if (panel.handle) panel.handle.style.display = "none";
			first = true;
			continue;
		}
		var y = panel.top;
		y = Math.round(y) + 0.5;
		this.plotLine(
			panel.left - 0.5,
			panel.right + 0.5,
			y,
			y,
			this.canvasStyle("stx_panel_border"),
			"segment",
			this.chart.context,
			false,
			{}
		);
		if (panel.handle) {
			if (!this.displayPanelResize) {
				panel.handle.style.display = "none";
			} else {
				panel.handle.style.display = "";
			}
			panel.handle.style.top = y - panel.handle.offsetHeight / 2 + "px";
			//panel.handle.style.left=panel.left+ "px";
		}
	}
	this.runAppend("drawPanels", arguments);
};

/**
 * Convenience function for checking whether an axis is hidden.
 *
 * @return {boolean} True if y-axis is hidden.
 * @memberof CIQ.ChartEngine.YAxis
 * @since TBD KB 53035
 */
CIQ.ChartEngine.YAxis.prototype.isHidden = function () {
	return this.isDisabled || this.noDraw || !this.width;
};

/**
 * <span class="injection">INJECTABLE</span>
 *
 * Resets the y-axis width to the default, {@link CIQ.ChartEngine.YAxis#width}.
 *
 * Called internally whenever the y-axis label width might change. This function can also be
 * called programmatically at any time if the default behavior needs to be altered.
 *
 * @param {object} [params] Function parameters.
 * @param {boolean} [params.noRecalculate=false] ** Deprecated: use positionRecalculate** When true,
 * 		{@link CIQ.ChartEngine#calculateYAxisPositions} will never be called..
 * @param {boolean} [params.positionRecalculate] When true, {@link CIQ.ChartEngine#calculateYAxisPositions} will always be called.
 * 		When trfalseue, {@link CIQ.ChartEngine#calculateYAxisPositions} will never be called.
 *
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias resetDynamicYAxis
 * @see {@link CIQ.ChartEngine.Chart#dynamicYAxis}, the flag that enables this feature.
 * @since
 * - 6.0.0
 * - 9.4.0 Removed `chartName` parameter.
 * - TBD KB 53035 Added `positionRecalculate` parameter, deprecated `noRecalculate` parameter
 */
CIQ.ChartEngine.prototype.resetDynamicYAxis = function (params) {
	if (this.runPrepend("resetDynamicYAxis", arguments)) return;

	if (!params) params = {};
	if (params.noRecalculate && !params.positionRecalculate)
		params.positionRecalculate = false;

	var resetting = false;

	for (var panelName in this.panels) {
		var panel = this.panels[panelName];

		if (!panel.yaxisLHS || !panel.yaxisRHS) continue;

		var yaxis = panel.yaxisLHS.concat(panel.yaxisRHS);

		for (var i = 0; i < yaxis.length; i++) {
			if (yaxis[i]._dynamicWidth) {
				// NaN is falsy, see the {@link CIQ.ChartEngine.YAxis#width} getter for context
				yaxis[i]._dynamicWidth = NaN;
				if (yaxis[i].hasOwnProperty("_width")) delete yaxis[i]._width;
				resetting = true;
			}
		}
	}

	if (
		params.positionRecalculate ||
		(resetting && params.positionRecalculate !== false)
	) {
		this.calculateYAxisPositions();
	}

	this.runAppend("resetDynamicYAxis", arguments);
};

/**
 * <span class="injection">INJECTABLE</span>
 * <span class="animation">Animation Loop</span>
 *
 * Plots the text on the y-axis.
 * @param  {CIQ.ChartEngine.Panel} panel The panel for the y-axis
 * @memberof CIQ.ChartEngine.AdvancedInjectable#
 * @alias plotYAxisText
 */
CIQ.ChartEngine.prototype.plotYAxisText = function (panel) {
	if (this.runPrepend("plotYAxisText", arguments)) return;
	var context = this.getBackgroundCanvas().context;
	this.canvasFont("stx_yaxis", context);
	this.canvasColor("stx_yaxis", context);
	context.textBaseline = "middle";
	function drawText(yAxis) {
		if (!yAxis.yAxisPlotter || yAxis.isHidden()) return;
		if (yAxis.justifyRight) context.textAlign = "right";
		else if (yAxis.justifyRight === false) context.textAlign = "left";
		yAxis.yAxisPlotter.draw(context, "text");
	}
	var arr = panel.yaxisLHS,
		i;
	for (i = 0; i < arr.length; i++) {
		context.textAlign = "right";
		drawText(arr[i]);
	}
	arr = panel.yaxisRHS;
	for (i = 0; i < arr.length; i++) {
		context.textAlign = "left";
		drawText(arr[i]);
	}
	context.textAlign = "left";
	context.textBaseline = "alphabetic";
	this.runAppend("plotYAxisText", arguments);
};

/**
 * Removes the yAxis from the panel if it is not being used by any current renderers. This could be the case
 * if a renderer has been removed. It could also be the case if a renderer is not attached to any series.
 * @param  {CIQ.ChartEngine.Panel|string} panel The panel
 * @param  {CIQ.ChartEngine.YAxis} yAxis The axis to be removed
 * @memberof CIQ.ChartEngine
 * @since
 * - 07/01/2015
 * - 7.1.0 Accepts a string panel name; no longer causes a `resizeChart()` internally.
 */
CIQ.ChartEngine.prototype.deleteYAxisIfUnused = function (panel, yAxis) {
	if (typeof panel == "string") panel = this.panels[panel];
	if (!yAxis || !panel) return;
	for (var r = 0; r < yAxis.renderers.length; r++) {
		var renderer = this.chart.seriesRenderers[yAxis.renderers[r]];
		if (renderer && renderer.params.panel == panel.name) return;
	}
	if (yAxis.name === panel.yAxis.name) {
		if (
			panel === this.chart.panel ||
			panel.yaxisRHS.length + panel.yaxisLHS.length === 1
		)
			return;
	}

	function denull(y) {
		return y !== null;
	}
	var i, replacementYAxis;
	for (i = 0; panel.yaxisRHS && i < panel.yaxisRHS.length; i++) {
		if (panel.yaxisRHS[i] === yAxis) {
			yAxis.unsetTransform(this);
			panel.yaxisRHS[i] = null;
		} else if (!replacementYAxis) replacementYAxis = panel.yaxisRHS[i];
	}
	for (i = 0; panel.yaxisLHS && i < panel.yaxisLHS.length; i++) {
		if (panel.yaxisLHS[i] === yAxis) {
			yAxis.unsetTransform(this);
			panel.yaxisLHS[i] = null;
		} else if (!replacementYAxis) replacementYAxis = panel.yaxisLHS[i];
	}
	panel.yaxisRHS = panel.yaxisRHS.filter(denull);
	panel.yaxisLHS = panel.yaxisLHS.filter(denull);

	if (replacementYAxis && yAxis.name === panel.yAxis.name) {
		panel.yAxis = replacementYAxis;
	}

	this.resetDynamicYAxis({ positionRecalculate: true });
};

/**
 * Calculates the width and left/right position of all y-axes.
 *
 * When modifying a y-axis width or left/right position setting after the axis has been rendered,
 * call this function followed by {@link CIQ.ChartEngine#draw} to activate the change.
 *
 * @memberof CIQ.ChartEngine
 * @since 8.3.0 Adjusts the `candleWidth`, not the `maxTicks`, when the chart width changes.
 */
CIQ.ChartEngine.prototype.calculateYAxisPositions = function () {
	// We push all the charts to the fore because panel widths will depend on what is calculated for their chart
	const panelsInOrder = [];
	for (const chartName in this.charts) {
		if (this.charts[chartName].hidden || this.charts[chartName].panel.hidden)
			continue;
		panelsInOrder.push(chartName);
	}
	for (const panelName in this.panels) {
		const p = this.panels[panelName];
		if (p.name === p.chart.name || p.hidden) continue;
		panelsInOrder.push(panelName);
	}

	let maxTotalWidthLeft = 0,
		maxTotalWidthRight = 0,
		i,
		j,
		panel,
		yaxis;
	for (j = 0; j < panelsInOrder.length; j++) {
		panel = this.panels[panelsInOrder[j]];
		if (!panel) continue; // this could happen if a chart panel doesn't exist yet (for instance when importLayout)
		if (!panel.yaxisLHS) {
			// initialize the arrays of y-axis. This will only happen once.
			panel.yaxisLHS = [];
			panel.yaxisRHS = [];
		}
		let lhs = panel.yaxisLHS,
			rhs = panel.yaxisRHS;
		// Our default y-axis goes into the array
		let position = panel.yAxis.position; // get default position of the yaxis for the chart
		if (!position || position == "none")
			position = panel.chart.panel.yAxis.position || "right"; // Unless specified, the y-axis position for panels will follow the chart default

		if (!lhs.length && !rhs.length) {
			// put default yAxis into array
			if (position == "left") lhs.push(panel.yAxis);
			else rhs.push(panel.yAxis);
		}

		let axesToRight = [],
			axesToLeft = [];
		for (i = lhs.length - 1; i >= 0; i--) {
			if (
				lhs[i].position == "right" ||
				(lhs[i].position != "left" && position == "right")
			) {
				axesToRight = axesToRight.concat(lhs.splice(i, 1));
			}
		}
		for (i = rhs.length - 1; i >= 0; i--) {
			if (
				rhs[i].position == "left" ||
				(rhs[i].position != "right" && position == "left")
			) {
				axesToLeft = axesToLeft.concat(rhs.splice(i, 1));
			}
		}
		panel.yaxisLHS = axesToLeft.concat(lhs);
		panel.yaxisRHS = rhs.concat(axesToRight);

		if (!panel.yAxis.width && panel.yAxis.width !== 0)
			panel.yAxis.width = this.yaxisWidth; // legacy default for main axis

		// Calculate the total amount of space to be allocated to the yaxis
		panel.yaxisTotalWidthRight = 0;
		panel.yaxisTotalWidthLeft = 0;
		const arr = panel.yaxisLHS.concat(panel.yaxisRHS);
		for (i = 0; i < arr.length; i++) {
			yaxis = arr[i];
			this.applyGetYAxisTitleEnabled(yaxis);
			if (yaxis.isHidden()) continue;
			if (yaxis.position == "left" || (position == "left" && !yaxis.position)) {
				panel.yaxisTotalWidthLeft += yaxis.width;
			} else {
				panel.yaxisTotalWidthRight += yaxis.width;
			}
		}
		if (panel.yaxisTotalWidthLeft > maxTotalWidthLeft)
			maxTotalWidthLeft = panel.yaxisTotalWidthLeft;
		if (panel.yaxisTotalWidthRight > maxTotalWidthRight)
			maxTotalWidthRight = panel.yaxisTotalWidthRight;
	}
	for (j = 0; j < panelsInOrder.length; j++) {
		panel = this.panels[panelsInOrder[j]];
		if (!panel) continue; // this could happen if a chart panel doesn't exist yet (for instance when importLayout)
		const isAChart = panel.name === panel.chart.name;

		// Now calculate the position of each axis within the canvas
		let x = maxTotalWidthLeft;
		let len = panel.yaxisLHS.length;
		let visibleIndices = [];
		for (i = len - 1; i >= 0; i--) {
			yaxis = panel.yaxisLHS[i];
			if (yaxis.isHidden()) continue;
			x -= yaxis.width;
			yaxis.left = x;
			visibleIndices.unshift(i);
		}
		let prorate;
		len = visibleIndices.length;
		if (x) {
			prorate = x / len;
			for (let j = 0; j < len; j++) {
				const yax = panel.yaxisLHS[visibleIndices[j]];
				yax.left -= (len - j) * prorate;
				//if (this.chart.dynamicYAxis) yax._dynamicWidth += Math.floor(prorate);
			}
		}
		x = this.width - maxTotalWidthRight;
		len = panel.yaxisRHS.length;
		visibleIndices = [];
		for (i = 0; i < len; i++) {
			yaxis = panel.yaxisRHS[i];
			if (yaxis.isHidden()) continue;
			yaxis.left = x;
			x += yaxis.width;
			visibleIndices.push(i);
		}
		len = visibleIndices.length;
		if (x < this.width) {
			prorate = (this.width - x) / len;
			for (let j = 0; j < len; j++) {
				const yax = panel.yaxisRHS[visibleIndices[j]];
				yax.left += j * prorate;
				//if (this.chart.dynamicYAxis) yax._dynamicWidth += Math.floor(prorate);
			}
		}

		if (typeof this.yaxisLeft != "undefined")
			panel.chart.yaxisPaddingRight = this.yaxisLeft; // support legacy use of yaxisLeft
		// Calculate the padding. This is enough space for the y-axis' unless overridden by the developer.
		panel.yaxisCalculatedPaddingRight = maxTotalWidthRight;
		if (panel.chart.yaxisPaddingRight || panel.chart.yaxisPaddingRight === 0)
			panel.yaxisCalculatedPaddingRight = panel.chart.yaxisPaddingRight;
		panel.yaxisCalculatedPaddingLeft = maxTotalWidthLeft;
		if (panel.chart.yaxisPaddingLeft || panel.chart.yaxisPaddingLeft === 0)
			panel.yaxisCalculatedPaddingLeft = panel.chart.yaxisPaddingLeft;

		if (isAChart || panel.chart.panel.hidden) {
			panel.left = panel.yaxisCalculatedPaddingLeft;
			panel.right = this.width - panel.yaxisCalculatedPaddingRight;
		} else {
			panel.left = panel.chart.panel.left;
			panel.right = panel.chart.panel.right;
		}
		panel.width = panel.right - panel.left;
		if (panel.handle) {
			panel.handle.style.left = panel.left + "px";
			panel.handle.style.width = panel.width + "px";
		}

		if (isAChart || panel.chart.panel.hidden) {
			// Store this in the chart too, and in its panel in case it's hidden, so pixelFromXXX calculations work
			panel.chart.panel.left = panel.chart.left = panel.left;
			panel.chart.panel.right = panel.chart.right = panel.right;
			panel.chart.panel.width = panel.chart.width = Math.max(
				panel.right - panel.left,
				0
			); // negative chart.width creates many problems
		}
	}

	const nextYAxisSet = new Set(),
		prevYAxisSet = this.yAxisSet || new Set();

	Object.values(this.panels).forEach((panel) =>
		panel.yaxisLHS.concat(panel.yaxisRHS).forEach((yaxis) => {
			nextYAxisSet.add(yaxis);

			if (!prevYAxisSet.has(yaxis)) {
				yaxis.onAttach(this);
			}
		})
	);

	prevYAxisSet.forEach((yaxis) => {
		if (!nextYAxisSet.has(yaxis)) {
			yaxis.onRemove(this);
		}
	});

	this.yAxisSet = nextYAxisSet;

	//this will force readjustment of the candleWidth as well.
	if (this.preserveCandleWidthOnResize)
		this.setCandleWidth(this.layout.candleWidth);
	else this.setMaxTicks(this.chart.maxTicks);
	this.adjustPanelPositions(); // fixes the subholder dimensions in light of possible axis position changes
};
