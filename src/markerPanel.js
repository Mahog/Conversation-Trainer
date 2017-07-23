let markerPanel = function() {
  let width = 55;
  let height = 100;

  let root;
  let marker;

  let timeAxis;

  let conversations;

  let y = d3.scaleLog()
    .range([height-30, 0]);

  const rankColor = d3.scaleQuantize()
    .domain([-20, 30])
    .range(['#c04741','#e9756f','#ffa49f','#e9d46f','#ffef9f','#e9d46f',
            '#8fd987','#64bf5b','#3f9d35']);

  function panel(selection) {
    root = selection;

    drawBackground();
    drawScale();
    drawMarkers();
  }

  function drawBackground() {
    // background to visually separate the conversation markers from the diagram
    root.append('rect')
      .attr('class', 'conv_background')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#fafafa')
      .attr('transform', 'translate(0, -15)');
  }

  function drawScale() {
    // draw the scale indicating the time spent on each conversations
    let minDuration = Infinity;
    let maxDuration = 0;

    conversations.forEach(function(c) {
      minDuration = c['duration'] < minDuration ? c['duration'] : minDuration;
      maxDuration = c['duration'] > maxDuration ? c['duration'] : maxDuration;
    });

    y
      .domain([minDuration / 1000, maxDuration / 1000])
      .base(10);

    root.append('g')
      .attr('class', 'y')
      .attr('transform', 'translate(30,0)')
      .call(d3.axisRight(y).tickFormat(d3.format(",.1r")))
  }

  function drawMarkers() {
    // add the conversation-identifier on the left side of the diagram,
    // which can be clicked to highlight the related path ontop of the diagram
    marker = root.selectAll('.marker').data(conversations).enter()
      .append('circle')
        .attr('class', 'marker')
        .attr('fill', function(d) { return d3.rgb(d.color=rankColor(d['score'])); })
        .style('stroke', function(d) { return  d.color; })
        .attr('cx', 15)
        .attr('cy', function(d, i) { return y(d['duration'] / 1000); })
        .attr('r', 7)
        .on('click', function(d) {
          let parent = null;
          d3.selectAll('g.conversation').each(function(e) {
            if (e === d) parent = d3.select(this);
          });
          d3.select(this).classed('active', !d3.select(this).classed('active'));
          highlightConversation(parent.node(), d);
        })
        .on('mouseover', function(d) {
          d3.select(this)
            .classed('hover', true)
            .style('stroke', '#1de9b6');

          let path = null;
          d3.selectAll('g.conversation').each(function(e) {
            if (e === d) path = d3.select(this).classed('hover', true);
          });
          path.node().parentNode.appendChild(path.node());
          timeAxis.highlight(d);
        })
        .on('mouseout', function(d) {
          d3.select(this)
            .classed('hover', false)
            .style('stroke', function(d) { return  d.color; });
          let path = null;
          d3.selectAll('g.conversation').each(function(e) {
            if (e === d) d3.select(this).classed('hover', false);
          });
          timeAxis.highlight(null);
        });

      marker.append('title')
        .text(function(d) { return d['score'] + 'pts in ' + new Date(d['duration']).getSeconds() + 'sec'; });
  }

  /**
   * Show or hide conversation paths on click.
   */
  function highlightConversation(that, d) {
    if (typeof d['active'] === typeof undefined)
      d['active'] = true;
    else
      d['active'] = !d['active'];

    if (d['active']) {
      d3.select(that).selectAll('path').style('display', 'block');
    } else {
      d3.select(that).selectAll('path').style('display', 'none');
    }
  }

  panel.filterConversations = function(activeConversations) {
    marker.transition().duration(200)
      .ease(d3.easePolyOut)
      .attr('r', function(d) {
        return activeConversations.indexOf(d) > -1 ? 7 : 1;
      });
  }

  panel.updateView = function() {
    marker.transition().duration(200).ease(d3.easePolyOut)
      .attr('fill', function(d) {
        return d['containsAllFilters']
          ? d3.rgb(d.color)
          : '#fff';
      });
  }

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////

  panel.conversations = function(_) {
    if (!arguments.length) return conversations;
    conversations = _;
    return panel;
  }

  panel.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    y.range([height-30, 0]);
    return panel;
  }

  panel.timeAxis = function(_) {
    if (!arguments.length) return timeAxis;
    timeAxis = _;
    return panel;
  }

  return panel;
}