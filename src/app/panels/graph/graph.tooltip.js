define([
  'jquery',
],
function ($) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series,last) {
      var ps = series.datapoints.pointsize;
      var initial = last*ps;
      var len = series.datapoints.points.length;
      for (var j = initial; j < len; j += ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    };

    this.findHoverIndexFromDataPoints2 = function(posX, series) {
      var min=0;
      var data = series.datapoints.points;
      var ps = series.datapoints.pointsize;
      var max = data.length / ps - 1;

      var pindex = 0;
      if (data[max * ps] < posX){
        return max * ps;
      }
      while (min < max)
      {
        var middle = Math.floor(((max - min)/2) + min);
        if (max - min <= 1) {
          pindex=min;
          break;
        }
        if (data[middle * ps] > posX) {
          max = middle;
        }
        else if (data[middle * ps] < posX) {
          min = middle;
        }
        else {
          pindex = middle;
          break;
        }
      }
      console.log("position", posX, data[pindex * ps], data[pindex * ps + 1 ], data[pindex * ps + 2]);
      return {"index": pindex, "value": data[pindex * ps + 1 ], "timestamp": data[pindex * ps] };
    };

    this.showTooltip = function(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series, hoverIndex;
      var results = [];

      /*var pointCount;
      for (i = 0; i < seriesList.length; i++) {
        seriesTmp = seriesList[i];
        if (!seriesTmp.data.length) { continue; }

        if (!pointCount) {
          series = seriesTmp;
          pointCount = series.data.length;
          continue;
        }

        if (seriesTmp.data.length !== pointCount) {
          results.pointCountMismatch = true;
          return results;
        }
      }*/

      
      var last_value = 0; //needed for stacked values
      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];
        
        var hoverdata = this.findHoverIndexFromDataPoints2(pos.x, series);
        var lasthoverIndex = 0;
        if(!scope.panel.steppedLine) {
          lasthoverIndex = hoverdata.index;
        }

        //now we know the current X (j) position for X and Y values
        results.time = hoverdata.timestamp;

        if (!series.data.length || (scope.panel.legend.hideEmpty && series.allIsNull)) {
          results.push({ hidden: true });
          continue;
        }

        if (scope.panel.stack) {
          if (scope.panel.tooltip.value_type === 'individual') {
            value = hoverdata.value;
          } else {
            last_value += hoverdata.value;
            value = last_value;
          }
        } else {
          value = hoverdata.value;
        }

        // Highlighting multiple Points depending on the plot type
        if (scope.panel.steppedLine || (scope.panel.stack && scope.panel.nullPointMode == "null")) {
          // stacked and steppedLine plots can have series with different length.
          // Stacked series can increase its length  on each new stacked serie if null points found,
          // to speed the index search we begin always on the las found hoverIndex.
          //var newhoverIndex = this.findHoverIndexFromDataPoints(pos.x, series,lasthoverIndex);
          // update lasthoverIndex depends also on the plot type.
          //if(!scope.panel.steppedLine) {
          //  // on stacked graphs new will be always greater than last
          //  //lasthoverIndex = newhoverIndex;
          //} else {
          //  // if steppeLine, not always series increases its length, so we should begin
          //  // to search correct index from the original hoverIndex on each serie.
          //  lasthoverIndex = hoverIndex;
          //}

          results.push({ value: value, hoverIndex: hoverdata.index});
        } else {
          results.push({ value: value, hoverIndex: hoverdata.index});
        }
      }

      return results;
    };

    elem.mouseleave(function () {
      if (scope.panel.tooltip.shared || dashboard.sharedCrosshair) {
        var plot = elem.data().plot;
        if (plot) {
          $tooltip.detach();
          plot.unhighlight();
          scope.appEvent('clearCrosshair');
        }
      }
    });

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var plotData = plot.getData();
      var seriesList = getSeriesFn();
      var group, value, timestamp, hoverInfo, i, series, seriesHtml;

      if(dashboard.sharedCrosshair){
        scope.appEvent('setCrosshair',  { pos: pos, scope: scope });
      }

      if (seriesList.length === 0) {
        return;
      }

      if (scope.panel.tooltip.shared) {
        plot.unhighlight();

        var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);
        if (seriesHoverInfo.pointCountMismatch) {
          self.showTooltip('Shared tooltip error', '<ul>' +
            '<li>Series point counts are not the same</li>' +
            '<li>Set null point mode to null or null as zero</li>' +
            '<li>For influxdb users set fill(0) in your query</li></ul>', pos);
          return;
        }

        seriesHtml = '';
        timestamp = dashboard.formatDate(seriesHoverInfo.time);

        for (i = 0; i < seriesHoverInfo.length; i++) {
          hoverInfo = seriesHoverInfo[i];

          if (hoverInfo.hidden) {
            continue;
          }

          series = seriesList[i];
          value = series.formatValue(hoverInfo.value);

          seriesHtml += '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
          seriesHtml += '<i class="fa fa-minus" style="color:' + series.color +';"></i> ' + series.label + ':</div>';
          seriesHtml += '<div class="graph-tooltip-value">' + value + '</div></div>';
          plot.highlight(i, hoverInfo.hoverIndex);
        }

        self.showTooltip(timestamp, seriesHtml, pos);
      }
      // single series tooltip
      else if (item) {
        series = seriesList[item.seriesIndex];
        group = '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
        group += '<i class="fa fa-minus" style="color:' + item.series.color +';"></i> ' + series.label + ':</div>';

        if (scope.panel.stack && scope.panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = series.formatValue(value);
        timestamp = dashboard.formatDate(item.datapoint[0]);
        group += '<div class="graph-tooltip-value">' + value + '</div>';

        self.showTooltip(timestamp, group, pos);
      }
      // no hit
      else {
        $tooltip.detach();
      }
    });
  }

  return GraphTooltip;
});
