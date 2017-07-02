d3.trainer = function() {
  let width = 1890; // default width
  let height = 600; // default height

  const margin = {
    top: 1,
    right: 10,
    bottom: 10,
    left: 10
  }; // default margins

  const minNodeDistance = 100;
  const minZoomLevelLabel = 3;
  const minZoomLevelPath = 1;

  let data; // graph
  let conversations; // dialogues

  let filters = [];

  let svg;
  let diagram; // holds all diagram components
  let node; // a node representing one conversation option
  let link; // links between nodes
  let sink; // holds a set of nodes
  let label; // a label right next to a node with a brief message
  let scrollbar;
  let scrollHandle;
  let zoomPanel;

  let sankey; // sankey diagram object
  let fisheye; // fisheye plugin

  let transform = d3.zoomIdentity; // the current zoom transform
  let shiftX = 0;

  let timelineX = d3.scaleLinear().domain([0, 100]);

  const formatNumber = d3.format(',.0f');

  const format = function(d) { return formatNumber(d) + ' TWh'; };

  const color = d3.scaleOrdinal()
    .domain(['negative', 'neutral', 'positive'])
    .range(['#eb665f', '#ebd35f', '#58c14d']);

  const rankColor = d3.scaleQuantize()
    .domain([0, 35])
    .range(['#c04741','#e9756f','#ffa49f','#e9d46f','#ffef9f','#e9d46f',
            '#b8bab3','#8fd987','#64bf5b','#3f9d35']);

  const zoom = d3.zoom()
    .scaleExtent([1, 15])
    .translateExtent([[0, 0], [width, 0]])
    .on('start', function() {
      svg.on('mousemove', null);
    })
    .on('zoom', zoomed)
    .on('end', function() {
      svg.on('mousemove', fisheyeEffect);
    });

  const scroll = d3.drag()
    .on('start', function() {
      d3.select(this).attr('data-x', d3.mouse(this.parentNode)[0]);
      d3.select(this).transition().attr('fill', 'rgba(0, 128, 128, 0.12)');
    })
    .on('drag', scrolled)
    .on('end', function() {
      d3.select(this).transition().attr('fill', 'rgba(0, 128, 128, 0)');
    });


  /**
  * Initialize trainer object, draw all components
  */
  function trainer(selection) {
    svg = selection;

    timelineX.range([0, width]);

    sankey = d3.sankey()
      .nodeWidth(10)
      .nodePadding(10)
      .size([width, height-margin.bottom])
      .nodes(data.nodes)
      .links(data.links)
      .layout(50);

    fisheye = d3.fisheye.circular()
      .radius(2 * minNodeDistance)
      .distortion(10);

    svg.on('mousemove', fisheyeEffect);

    svg.call(zoom);

    drawDiagram();
  }

  /**
  * Draws the diagram, consisting of sinks, nodes and links using the d3.sankey
  * plugin.
  */
  function drawDiagram() {

    diagram = svg.append('g');

    let timeAxis = timeline()
      .trainer(trainer)
      .data(conversations)
      .width(width)
      .height(50);

    svg.append('g')
      .attr('transform', 'translate(0,'+(height+50)+')')
      .call(timeAxis);

    zoomPanel = zoomControl()
      .registerZoomClient(trainer);

    svg.append('g')
      .attr('transform', 'translate('+(width-200)+','+(height-50)+')')
      .call(zoomPanel);

    drawSinks();
    drawLinks();
    drawNodes();
    drawConversations();
    drawScrollbar();
    updateQuery();
  }

  function updateQuery() {
    let sinks = sankey.sinks();
    let andQuery = [];

    // Get a set of all nodes that are reachable from the active nodes on
    // each sink. this creates a set [n1, n2, ..., nN] for the first sink.
    // Intersect the sink from every following sink with the set that was
    // created before. This realizes an OR-query on every sink and an AND-query
    // between sinks.
    let i;
    for (i = 0; i < sinks.length; i++) {
      // finds all nodes that are currently selected/active on this sink
      let sink = sinks[i].filter(function(s) {
        s.active = false;
        return (typeof s.selected !== typeof undefined && s.selected);
      });

      // if no nodes are active on this sink, go to the next sink
      if (sink.length === 0) continue;

      // all nodes as input for the next iteration
      let nextNodes = [].concat(sink);
      // all nodes reachable from selected nodes on this sink
      let orQuery = [].concat(nextNodes);
      // all nodes that were added in the current iteration
      let freshNodes = [].concat(nextNodes);

      // check before (all targetLinks)
      while (nextNodes.length) {
        freshNodes = [];
        for (let j = 0; j < nextNodes.length; j++) {
          let n = nextNodes[j];
          n.targetLinks.forEach(function(link) {
            // only store new nodes once
            if (orQuery.indexOf(link.source) === -1) {
              orQuery.push(link.source);
              freshNodes.push(link.source);
            }
          });
        }
        nextNodes = freshNodes;
      }

      // reset to active nodes on this sink
      nextNodes = sink;

      // check after (all sourceLinks), same procedure as before
      while(nextNodes.length) {
        freshNodes = [];
        for (let j = 0; j < nextNodes.length; j++) {
          let n = nextNodes[j];
          n.sourceLinks.forEach(function(link) {
            if (orQuery.indexOf(link.target) === -1) {
              orQuery.push(link.target);
              freshNodes.push(link.target);
            }
          });
        }
        nextNodes = freshNodes;
      }

      // intersect the or- with the and-query to get the result-set of
      // reachable nodes
      if (i > 0 && andQuery.length > 0)
        andQuery = andQuery.filter(function(q) {
          return orQuery.indexOf(q) > -1
        });
      else
        andQuery = [].concat(orQuery);
    }
    if (andQuery.length)
      andQuery.map(function(d) { d.active = true; });
    else
      sinks.forEach(function(s) { s.forEach(function(d) { d.active = null; })});

    updateView();
  }

  function updateView() {
    node.transition().duration(100)
      .selectAll('.box').transition().duration(250)
        .style('fill', fillNode)
        .attr('stroke-width', function(d) {
          return (d.active) ? 2 : 1;
        });

    link.attr('stroke', strokeLink);

    // indicate whether or not a conversation contains all active filters by
    // changing the fill: fill if true, don't fill else.
    conversation
      .each(function(d) {
        // group all filters by their sinks, then check if the conversation
        // contains at least one filter per sink

        let sinkFilters = {};
        filters.forEach(function(f) {
          if (typeof sinkFilters[f.sink] === typeof undefined)
            sinkFilters[f.sink] = [];

          sinkFilters[f.sink].push(f);
        });

        d.containsAllFilters = true;

        for (let s in sinkFilters) {
          let sf = sinkFilters[s]; // array of filters on this sink
          let hasFilterOnSink = false;
          for (let f = 0; f < sf.length; f++) {
            hasFilterOnSink = d.indexOf(sf[f]) > -1 || hasFilterOnSink;
          }
          d.containsAllFilters = d.containsAllFilters && hasFilterOnSink;
        }
      });
    conversation.select('circle')
      .attr('fill', function(d) {
        return d['containsAllFilters']
          ? d3.rgb(d.color)
          : '#fff';
      });
    conversation.selectAll('path')
      .attr('stroke-dasharray', function(d) {
        return d.containsAllFilters ? '' : '10,10';
      })

    label.style('display', displayLabel);
  }

  /**
  * Draws nodes, each representing one conversation option in the trainer
  */
  function drawNodes() {
    node = diagram.append('g')
      .selectAll('.node')
      .data(data.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', function(d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      })
      .on('click', function(d) {
        if (typeof d.selected === typeof undefined)
          d.selected = true;
        else
          d.selected = !d.selected;

        if (filters.indexOf(d) > -1)
          filters.splice(filters.indexOf(d), 1);
        else
          filters.push(d);

        updateQuery();
      })
      .call(d3.drag()
        .subject(function(d) {
          return d;
        })
        .on('start', function() {
          this.parentNode.appendChild(this);
        })
        .on('drag', dragmove));

    // the rectangle filled with a color, visually identifying the node
    node.append('rect')
      .attr('class', 'box')
      .attr('height', function(d) { return d.dy; })
      .attr('width', sankey.nodeWidth())
      .style('fill', fillNode)
      .style('stroke', strokeNode)
      .attr('stroke-width', 1)
      .append('title')
        .text(function(d) {
          return d.text
        });

    // holds the text-label and a background rect for readability
    label = node.append('g')
      .attr('width', widthLabel)
      .attr('class', 'label')
      .style('display', displayLabel)
      .on('click', updateLabelText);
    // the label's background rect
    label.append('rect')
      .attr('width', widthLabel)
      .attr('x', sankey.nodeWidth() + 10)
      .attr('y', 0)
      .attr('height', 25)
      .attr('fill', '#fff')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#ccc');
    // the label's text
    label.append('text')
      .attr('x', sankey.nodeWidth() + 15)
      .attr('y', 18)
      .text(function(t) {
        let w = widthLabel(t);
        if (t.text.length < w / 9.5)
          return t.text;
        else
          return t.text.substring(0, w / 9.5) + '...';
      });
  }

  /**
  * Draws links, which are a bezier curve between two nodes, whose stroke-width
  * indicate the frequency, in which this path was chosen in the data.
  */
  function drawLinks() {
    link = diagram.append('g')
      .selectAll('.link')
      .data(data.links)
      .enter().append('path')
      .attr('class', 'link')
      .attr('stroke', strokeLink)
      .attr('stroke-width', function(d) {
        return Math.max(1, d.dy);
      })
      .attr('d', path)
      .sort(function(a, b) {
        return b.dy - a.dy;
      });

    link.append('title')
      .text(function(d) {
        return d.source.name + ' → ' + d.target.name + '\n' + format(d.value);
      });
  }

  function strokeLink(d) {
    if (transform.k > minZoomLevelPath) {
      if (d.source.active === null) return '#555';
      if (d.source.active && d.target.active) return '#555';
      else return '#eee';
    }
    else
      return 'rgba(0,0,0,0)'
  }

  /**
  * Draws sinks, which are vertical axes that hold a set of nodes.
  */
  function drawSinks() {
    sink = diagram.append('g')
      .selectAll('.sink')
      .data(sankey.sinks()).enter().append('path')
        .attr('stroke', '#333')
        .attr('stroke-dasharray', '2,2')
        .attr('d', function(d) {
          let x = sankey.nodeWidth() / 2;
          return 'M'+x+','+(margin.top-10)+'L'+x+','+(height-margin.bottom+10);
        })
        .attr('transform', function(d) {
          return 'translate('+d[0].x+',0)'
        });
  }

  function drawConversations() {
    // conversation is a group containing the rect and the path
    let root = diagram.append('g')
      .attr('class', 'conversations')
      .attr('transform', 'translate(0, 10)');

    root.append('rect')
      .attr('class', 'conv_background')
      .attr('width', 30)
      .attr('y', -25)
      .attr('height', (conversations.length+1) * 25)
      .attr('fill', 'rgba(255,255,255,0.73)');

    conversation = root.selectAll('.conversation').data(conversations).enter()
        .append('g')
          .attr('class', 'conversation')
          .on('mouseover', function(d) {
            d3.select(this).classed('hover', true)
              .select('circle').style('stroke', '#1de9b6')
            this.parentNode.appendChild(this);
          })
          .on('mouseout', function(d) {
            d3.select(this).classed('hover', false)
              .select('circle').style('stroke', function(d) { return  d.color; })
          });

    // add the conversation-identifier on the left side of the diagram,
    // which can be clicked to highlight the related path ontop of the diagram
    conversation.append('circle')
      .attr('fill', function(d) { return d3.rgb(d.color=rankColor(d['score'])); })
      .style('stroke', function(d) { return  d.color; })
      .attr('cx', 15)
      .attr('cy', function(d, i) { return d['y'] = i * 25; })
      .attr('r', 7)
      .on('click', function(d) {
        let parent = d3.select(this.parentNode);
        parent.classed('active', !parent.classed('active'));
        highlightConversation(this, d);
      })

    // add a tooltip with the score for this conversation
    conversation.append('title')
      .text(function(d) { return d['score']; });

    // add the path, which consists of segments of links that are joined in
    // one d-path
    conversation.append('path')
      .attr('class', 'highlight')
      .attr('stroke-width', 1)
      .attr('fill', 'none')
      .style('display', 'none')
      .attr('d', conversationPath);
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
      d3.select(that.parentNode).selectAll('path').style('display', 'block');
    } else {
      d3.select(that.parentNode).selectAll('path').style('display', 'none');
    }
  }

  /**
  * Draws a scrollbar below the diagram. The scrollbar selection is not part
  * of the diagram an can therefore be positioned independently.
  */
  function drawScrollbar() {
    scrollbar = svg.append('g')
      .attr('class', 'scrollbar')
      .attr('transform', 'translate(0,'+(height+margin.bottom)+')')
      .style('opacity', '0.0');

    scrollbar.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', 20)
      .attr('fill', '#fafafa')
      .attr('stroke', '#efefef');

    scrollHandle = scrollbar.append('rect')
      .attr('class', 'handle')
      .attr('x', 0)
      .attr('y', 0)
      .attr('data-x', 0)
      .attr('height', 20)
      .attr('stroke', 'teal')
      .attr('fill', '#fff')
      .call(scroll);
  }

  /**
  * Draw a path between two nodes.
  */
  function path(d) {
    return sankey.link()(d);
  }

  /**
   * Takes an array of nodes and returns a svg-path connecting those nodes
   * with links from the diagram.
   */
  function conversationPath(d) {
    let cLinks = [];

    // find all links connected to the nodes of the conversation
    link.each(function(l) {
      if (d.indexOf(l.source) !== -1 && d.indexOf(l.target) !== -1)
        cLinks.push(l);
    });

    // generate a path from the paths of each link connected to the nodes
    return cLinks.map(path).join('');
  }

  /**
   * Based on the distance to neighboring nodes, decide whether to display the
   * label of each node. Returns block or none respectively.
   */
  function displayLabel(d) {
    if (d.active === false) return 'none';
    if (typeof d.fisheye === typeof undefined) return 'none';

    if (transform.k > minZoomLevelLabel)
      return 'block';
    else
      return 'none';
  }

  function widthLabel(d) {
    if (d.sourceLinks.length === 0) return 250;
    // if (typeof d.fisheye === typeof undefined) return 100;
    if (d.fullLabel) {
      let maxS = 0;
      d.segments.forEach(function(d) { maxS = d.length > maxS ? d.length : maxS });
      return maxS * 9.5;
    }

    if (d.text.length * 9.5 < 250)
      return d.text.length * 9.5;
    else
      return 250;
  }

  function updateLabelText(d) {
    d3.event.stopPropagation();

    let maxDistance = 75;

    if (d.sourceLinks.length)
      maxDistance = Math.abs(d.x - d.sourceLinks[0].target.x) * transform.k;

    maxDistance = parseInt(maxDistance / 20);

    // segment text
    let regex = new RegExp('.{'+maxDistance+'}\\S*\\s+', 'g')
    d.segments = d.text.replace(regex, "$&@").split(/\s+@/);
    d.segments = d.segments.filter(function(s) { return s.length > 0; });

    // ROADMAP:
    // a) make room for the full text label
    // b) display the full text in <tspan> segments

    // flag indicating if the full label for this node is visible
    d.fullLabel = (typeof d.fullLabel === typeof undefined)
      ? true
      : !d.fullLabel;

    // set the y value up or down depending on the textlabel
    node.each(function(n) {
      if (!(n.x !== d.x || n.y >= d.y))
        n.y += d.fullLabel ? -d.segments.length*20 : +d.segments.length*20;
    });

    // rearrange nodes and links (up or down)
    node.transition().duration(200).attr('transform', function(n) {
      let zoomedX = transform.applyX(n.x) - transform.x;
      return 'translate(' +zoomedX+ ',' + n.y + ')';
    });

    // update paths
    sankey.relayout();
    link.transition().duration(200)
      .attr('d', path);
    conversation.selectAll('path').transition().duration(200)
      .attr('d', conversationPath);

    let labelText = d3.select(this).select('text');
    if (!d.fullLabel) { // show only short version of the text
      labelText.selectAll('tspan').remove();

      labelText
        .attr('transform', 'translate(0,0)')
        .text(function(t) {
          let w = widthLabel(d);
          if (d.text.length < w / 9.5)
            return d.text
          else
            return d.text.substring(0, w / 9.5) + '...';
        });

      // reset background to default
      d3.select(this).select('rect')
        .attr('y', 0)
        .attr('height', 25)
        .attr('width', widthLabel);

    } else { // display the long version in segments
      labelText
        .attr('transform', 'translate(0,'+d.segments.length*-20+')')
        .text('');

      labelText.selectAll('tspan').data(d.segments).enter().append('tspan')
        .attr('x', sankey.nodeWidth() + 15)
        .attr('dy', '20')
        .text(function(d) { return d; });

      d3.select(this).select('rect')
        .attr('y', -d.segments.length*20+10)
        .attr('height', d.segments.length*20+20)
        .attr('width', widthLabel);
    }
  }

  /**
  * If the node is an 'answer', i.e. the reaction of the client, pick a color
  * representing the  mood. For questions, return uniform fill color.
  */
  function fillNode(d) {
    d.color = (d.type === 's') ? color(d.mood) : '#333';
    let fillColor = '#fff';

    if (typeof d.selected !== typeof undefined && d.selected)
      fillColor = (d.type === 'a') ? '#aaa' : d3.color(d.color).brighter(0.5);


    return fillColor;
  }

  /**
  * Uses the .color value set by the fill method and gets a darker version
  * of this value for the stroke
  */
  function strokeNode(d) {
    return d3.rgb(d.color);
  }

  /**
  * Allows dragging nodes along the y-axis.
  */
  function dragmove(d) {
    d.y = Math.max(0, Math.min(height - d.dy, d3.event.y));

    let zoomedX = transform.applyX(d.x) - transform.x;
    d3.select(this).attr('transform', 'translate(' +zoomedX+ ',' + d.y + ')');

    sankey.relayout();
    link.attr('d', path);
    conversation.selectAll('path').attr('d', conversationPath);
  }

  /**
  * Called on zoom events, changes the distance between sinks so that more/less
  * paths are displayed
  */
  function zoomed() {
    let dragging = transform.k === d3.event.transform.k;

    transform = d3.event.transform;

    fisheye.distortion(1/transform.k * 10);
    if (dragging) {
      diagram.attr('transform', 'translate('+transform.x+',0)');
      svg.selectAll('.conv_background')
        .attr('transform', 'translate('+-transform.x+',0)');
      conversation.selectAll('circle')
        .attr('transform', 'translate('+-transform.x+',0)');
    } else {
      diagram.transition().duration(250)
        .attr('transform', 'translate('+transform.x+',0)');
      svg.selectAll('.conv_background').transition().duration(250)
        .attr('transform', 'translate('+-transform.x+',0)');
      conversation.selectAll('circle').transition().duration(250)
        .attr('transform', 'translate('+-transform.x+',0)');

      node.transition().duration(250)
        .attr('transform', function(d) {
          let zoomedX = transform.applyX(d.x) - transform.x;
          d.fisheye = {x: zoomedX};
          return 'translate(' + zoomedX + ',' + d.y + ')';
        });

      sink.transition().duration(250)
        .attr('transform', function(d) {
          let x = transform.applyX(d[0].x) - transform.x;
          return 'translate('+x+',0)'
        });

      link.transition().duration(250)
        .attr('d', path)
        .attr('stroke', strokeLink);

      label
        .style('display', displayLabel)
        .selectAll('rect')
          .attr('width', widthLabel);

      conversation.select('.highlight').transition().duration(250)
        .attr('d', conversationPath)
    }

    if (transform.k >= 1) {
      let x = -transform.x / transform.k;
      let w = width / transform.k;

      scrollHandle
        .attr('width', w)
        .attr('transform', 'translate('+x+',0)');

      if (w < width)
        scrollbar.transition().style('opacity', 1.0);
      else
        scrollbar.transition().style('opacity', 0.0);
    }

    zoomPanel.zoomLevel(transform.k);
  }

  /**
  * Called when the scrollbar is dragged around. Updates the position of the
  * scrollbar and moves the diagram accordingly.
  */
  function scrolled() {
    let x = d3.mouse(this.parentNode)[0];
    let mouseOffset = d3.select(this).attr('data-x');
    d3.select(this).attr('data-x', x);

    x -= mouseOffset; // current position - old position

    zoom.translateBy(svg, -x, 0); // yields 'zoom' event
  }

  /**
  * Stretch and compress the sinks depending on the mouse poisition to create
  * space for texts.
  */
  function fisheyeEffect() {
    // fisheye.focus([d3.mouse(this)[0] - transform.x - conversationMargin, 0]);
    //
    // node.each(function(d) {
    //   d.fisheye = fisheye({x: transform.applyX(d.x), y: 0});
    //   d.fisheye.distorted = !(d.fisheye.x === transform.applyX(d.x));
    // });
    // node
    //   .attr('transform', function(d) {
    //     let x = d.fisheye.x - sankey.nodeWidth() / 2;
    //     return 'translate('+x+','+d.y+')'
    //   });
    //
    // sink.each(function(d) {
    //   d.fisheye = fisheye({x: transform.applyX(d[0].x), y: 0});
    // });
    // sink
    //   .attr('transform', function(d) {
    //     let x = d.fisheye.x - sankey.nodeWidth() / 2
    //     return 'translate(' +x+ ',0)';
    //   })
    //
    // link.attr('d', path);
    //
    // label
    //   .attr('width', widthLabel)
    //   .style('display', displayLabel)
    //   .select('rect')
    //     .attr('width', widthLabel);
  }

  /**
   * Show or hide full conversations including the circle on the left.
   */
  trainer.filterConversations = function(activeConversations) {
    conversation.selectAll('circle').transition().duration(200)
      .ease(d3.easePolyOut)
      .attr('r', function(d) {
        return activeConversations.indexOf(d) > -1 ? 7 : 1;
      });

    return trainer
  }

  trainer.zoomBy = function(k) {
    if (!arguments.length) trainer;

    let targetZoom = transform.k * k;

    zoom.scaleTo(svg, targetZoom, 0); // yields 'zoom' event
    return trainer;
  }

  // GETTERS AND SETTERS ///////////////////////////////////////////////////////

  trainer.data = function(_) {
    if (!arguments.length) return data;
    data = _;
    return trainer;
  }

  trainer.conversations = function(_) {
    if (!arguments.length) return conversations;
    conversations = _;
    return trainer;
  }

  trainer.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return trainer;
  }

  trainer.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return trainer;
  }

  return trainer;
}