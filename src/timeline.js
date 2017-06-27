let timeline = function() {
  let width = 960;
  let height = 100;

  let svg;
  let tick; // visual identifier for a date along the timeline
  let marker; // a marker representing a conversation taking place at this time
  let markers; // <g> of all markers
  let trainer = null;

  let data;

  const time = d3.scaleTime()
    .domain([new Date('2017-05-01'), new Date('2017-07-31')])
    .range([0, width]);

  const brush = d3.brushX()
    .on("brush end", brushed);


  function timeline(selection) {
    svg = selection.append('g')
      .attr('class', 'timeline');

    drawTimeline();
    drawMarkers();

    svg.append('g')
      .attr('class', 'brush')
      .call(brush);
  }


  function drawTimeline() {
    let timeTicks = time.ticks(15);

    svg.append('rect')
      .attr('x', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'transparent')
      .attr('stroke', '#ccc');

    ticks = svg.append('g').attr('class', 'ticks');

    tick = ticks.selectAll('marker').data(timeTicks).enter()
      .append('g')
        .attr('transform', function(d) { return 'translate('+time(d)+',0)'});

    tick.append('path')
      .attr('stroke', '#888')
      .attr('stroke-width', '2px')
      .attr('stroke-dasharray', '2,2')
      .attr('d', 'M0,0L0,'+height+'');

    tick.append('text')
      .attr('font-size', 12)
      .attr('text-anchor', 'middle')
      .attr('dy', height - 5)
      .text(function(d) { return d.toDateString(); })
  }

  function drawMarkers() {
    markers = svg.append('g').attr('class', 'markers');

    marker = markers.selectAll('.marker').data(data).enter()
      .append('path')
        .attr('class', 'marker')
        .attr('stroke', 'red')
        .attr('d', 'M0,0L0,'+height)
        .attr('transform', function(d) {
          return 'translate('+time(new Date(d['timestamp']))+',0)';
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