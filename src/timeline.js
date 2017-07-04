let timeline = function() {
  let width = 960;
  let height = 100;

  let svg;
  let line;
  let marker; // a marker representing a conversation taking place at this time
  let markers; // <g> of all markers
  let trainer = null;

  let data;
  let markersPerDate = {};

  const time = d3.scaleTime()
    .domain([new Date('2017-06-01'), new Date('2017-07-31')])
    .range([0, width]);

  const brush = d3.brushX()
    .on("brush end", brushed);

  const rankColor = d3.scaleQuantize()
    .domain([-20, 30])
    .range(['#c04741','#e9756f','#ffa49f','#e9d46f','#ffef9f','#e9d46f',
            '#8fd987','#64bf5b','#3f9d35']);

  /**
   * Timeline generator.
   * @param Selection the d3 selection the generator was called on
   */
  function timeline(selection) {
    svg = selection.append('g')
      .attr('class', 'timeline');

    // draw components to canvas
    drawBackground();
    drawMarkers();
    drawTimeline();

    svg.append('g')
      .attr('class', 'brush')
      .call(brush);
  }

  function drawBackground() {
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#fafafa');
  }

  function drawTimeline() {
    line = svg.append('g')
      .attr('class', 'timeline')
      .call(d3.axisBottom(time));
  }

  function drawMarkers() {
    let maximumMarkersPerDay = 0;
    markers = svg.append('g').attr('class', 'markers');

    marker = markers.selectAll('.marker').data(data).enter()
      .append('line')
        .attr('class', 'marker')
        .attr('stroke', function(d) { return rankColor(d['score']); })
        .attr('stroke-width', 2)
        .attr('x1', -7)
        .attr('x2', 7)
        .each(function(d) {
          let date = new Date(d['timestamp']).toDateString();

          if (typeof markersPerDate[date] === typeof undefined)
            markersPerDate[date] = 0;

          d['rankInTimeline'] = markersPerDate[date]++;
          maximumMarkersPerDay = maximumMarkersPerDay < markersPerDate[date]
            ? markersPerDate[date] : maximumMarkersPerDay;
        });

      let y = d3.scaleLinear()
        .domain([0, maximumMarkersPerDay])
        .range([2, height]);

      marker
        .attr('transform', function(d) {
          let date = new Date(d['timestamp']).toDateString();
          return 'translate('+time(new Date(date))+','+y(d['rankInTimeline'])+')';
        });
  }

  function brushed() {
    // when the brush is cleared, return all conversations
    if (!d3.event.selection) {
      trainer.filterConversations(data);
      return;
    };

    // get the range of dates that is defined by the brushed area
    let min = new Date(time.invert(d3.event.selection[0]));
    let max = new Date(time.invert(d3.event.selection[1]));

    // find all conversations that happened inside that timeframe
    let active = data.filter(function(d) {
      let completed = new Date(d['timestamp']);
      return completed > min && completed < max;
    });

    // notify the trainer
    trainer.filterConversations(active);
  }

  timeline.highlight = function(conversation) {
    if (!arguments.length) return;

    marker
      .attr('stroke', function(d) {
        return d === conversation ? '#2196f3' : rankColor(d['score']);
      })
      .attr('stroke-width', function(d) {
        return d === conversation ? 3 : 1;
      })
      .attr('x1', function(d) {
        return d === conversation ? -12 : -7;
      })
      .attr('x2', function(d) {
        return d === conversation ? 12 : 7;
      })
  }

  timeline.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    time.range([0, width])
    return timeline;
  }

  timeline.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return timeline;
  }

  timeline.data = function(_) {
    if (!arguments.length) return data;
    data = _;
    return timeline;
  }

  timeline.trainer = function(_) {
    if (!arguments.length) return trainer;
    trainer = _;
    return timeline;
  }

  return timeline;
}