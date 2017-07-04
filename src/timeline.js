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

  const rankColor = d3.scaleLinear()
    .domain([0, 20])
    .range(['#f33', '#3f3']);

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
    markers = svg.append('g').attr('class', 'markers');

    marker = markers.selectAll('.marker').data(data).enter()
      .append('line')
        .attr('class', 'marker')
        .attr('stroke', 'teal')
        .attr('fill', 'teal')
        .attr('stroke-width', 5)
        .attr('x1', -7)
        .attr('x2', 7)
        .attr('transform', function(d) {
          let date = new Date(d['timestamp']).toDateString();

          if (typeof markersPerDate[date] === typeof undefined)
            markersPerDate[date] = 0;

          markersPerDate[date]++;

          return 'translate('+time(new Date(date))+','+(markersPerDate[date] * 7)+')';
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
        return d === conversation ? '#ff5722' : 'teal';
      });
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