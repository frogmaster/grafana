define([
  'jquery',
],
function ($) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series) {
      var min=0;

      if (!series.datapoints || !series.datapoints.points || series.datapoints.points.length === 0) {
        return false;
      }

      var data = series.datapoints.points;
      var ps = series.datapoints.pointsize;
      var max = data.length / ps;

      var pindex = 0;
      if (data[max * ps] < posX){
        pindex = max * ps;
        min = max;
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
      return {"index": pindex, "value": data[pindex * ps + 1 ], "timestamp": data[pindex * ps] };
    };

    this.showTooltip = function(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series;
      var results = [];

      var last_value = 0; //needed for stacked values
      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];

        var hoverdata = this.findHoverIndexFromDataPoints(pos.x, series);
        if (!hoverdata) {
          continue;
        }

        var lasthoverIndex = 0;
        if(!scope.panel.steppedLine) {
          lasthoverIndex = hoverdata.index;
        }

        if (hoverdata.timestamp > pos.x) {
          results.push({ hidden: true });
          continue;
        }
        //find the closest timestamp to X
        if (!results.time || pos.x -  results.time >  pos.x - hoverdata.timestamp)
        {
          results.time = hoverdata.timestamp;
        }

        if (!series.datapoints.points.length || (scope.panel.legend.hideEmpty && series.allIsNull)) {
          results.push({ hidden: true });
          continue;
        }

        if (scope.panel.stack) {
          if (scope.panel.tooltip.value_type === 'individual') {
            value = hoverdata.value - last_value;
            last_value = hoverdata.value;
          } else {
            value = last_value;
          }
        } else {
          value = hoverdata.value;
        }
        results.push({ value: value, hoverIndex: hoverdata.index});
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
