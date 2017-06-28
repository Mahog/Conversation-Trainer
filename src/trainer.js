d3.trainer = function() {
  let width = 1890; // default width
  let height = 600; // default height

  const margin = {
    top: 1,
    right: 10,
    bottom: 10,
    left: 10
  }; // default margins

  const conversationMargin = 200;

  const minNodeDistance = 100;
  const minZoomLevelLabel = 5;
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

  let sankey; // sankey diagram object
  let fisheye; // fisheye plugin

  let transform = d3.zoomIdentity; // the current zoom transform
  let shiftX = 0;

  let timelineX = d3.scaleLinear().domain([0, 100]);

  const formatNumber = d3.format(',.0f');

  const format = function(d) { return formatNumber(d) + ' TWh'; };

  const color = d3.scaleOrdinal()
    .domain(['negative', 'neutral', 'positive'])
    .range(['#ef5350', '#ffee58', '#66bb6a']);

  const rankColor = d3.scaleLinear()
    .domain([0, 20])
    .range(['#f33', '#3f3']);

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
      d3.select(this).transition().attr('fill', '#cef').attr('stroke', '#8fa7b3');
    })
    .on('drag', scrolled)
    .on('end', function() {
      d3.select(this).transition().attr('fill', '#fff').attr('stroke', '#ccc');
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
      .size([width - conversationMargin, height-margin.bottom])
      .nodes(data.nodes)
      .links(data.links)
      .layout(32);

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

    drawSinks();
    drawLinks();
    drawConversations();
    drawNodes();
    drawScrollbar();
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
      .style('fill-opacity', function(d) {
        if (d.selected && !d.active) return 0.73;
        if (d.active === null) return 1.0;
        return d.active ? '1.0' : '0.15';
      })
      .selectAll('.box').transition()
        .attr('width', function(d) {
          if (d.active === null) return sankey.nodeWidth();
          return d.selected ? 3*sankey.nodeWidth() : sankey.nodeWidth();
        })
        .attr('x', function(d) {
          return d.selected ? -sankey.nodeWidth() : 0;
        })
        .style('stroke', function(d) {
          let c = d3.rgb(d.color);
          return d.active ? c.darker(5) : c.darker(1);
        });

    link.style('stroke', function(d) {
      if (d.source.active === null) return '#333';
      if (d.source.active && d.target.active) return '#333';
      else return '#ccc';
    });

    // indicate whether or not a conversation contains all active filters by
    // changing the fill: fill if true, don't fill else.
    conversation
      .each(function(d) {
        d.containsAllFilters = true;

        for (let f = 0; f < filters.length && d.containsAllFilters; f++)
          d.containsAllFilters = d.indexOf(filters[f]) > -1;
      })
      .select('rect')
        .attr('fill', function(d) {
          return d['containsAllFilters']
            ? d3.rgb(d.color).brighter(1)
            : 'none';
        });

    label.style('display', displayLabel);
  }

  /**
  * Draws nodes, each representing one conversation option in the trainer
  */
  function drawNodes() {
    node = diagram.append('g')
      .attr('transform', 'translate('+conversationMargin+',0)')
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
      .on('mouseover', function() {
        d3.select(this).transition()
          .attr('width', 3*sankey.nodeWidth())
          .attr('x', -sankey.nodeWidth());
        })
      .on('mouseout', function(d) {
        if (!d.selected)
          d3.select(this).transition()
            .attr('width', sankey.nodeWidth())
            .attr('x', 0);
        })
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
      .attr('fill-opacity', 0.73)
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
      .attr('transform', 'translate('+conversationMargin+',0)')
      .selectAll('.link')
      .data(data.links)
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', path)
      .style('stroke-width', function(d) {
        return Math.max(1, d.dy);
      })
      .sort(function(a, b) {
        return b.dy - a.dy;
      });

    link.append('title')
      .text(function(d) {
        return d.source.name + ' → ' + d.target.name + '\n' + format(d.value);
      });
  }

  /**
  * Draws sinks, which are vertical axes that hold a set of nodes.
  */
  function drawSinks() {
    sink = diagram.append('g')
      .attr('transform', 'translate('+conversationMargin+',0)')
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
    conversation = diagram.append('g')
      .attr('class', 'conversations')
      .selectAll('.conversation').data(conversations).enter()
        .append('g')
          .attr('class', 'conversation');

    // add the conversation-identifier on the left side of the diagram,
    // which can be clicked to highlight the related path ontop of the diagram
    conversation.append('rect')
      .attr('stroke', function(d) { return d.color = rankColor(d['score']); })
      .attr('fill', function(d) { return d3.rgb(d.color).brighter(1)})
      .attr('width', conversationMargin/3)
      .attr('height', 10)
      .attr('transform', function(d, i) {
        d['y'] = i*20;
        return 'translate(0,'+i*20+')';
      })
      .on('mouseover', function(d) {
        d3.select(this).attr('height', 20);
        d3.select(this).attr('transform', 'translate(0,'+(d['y']-5)+')');
      })
      .on('mouseout', function(d) {
        d3.select(this).attr('height', 10);
        d3.select(this).attr('transform', 'translate(0,'+(d['y'])+')');
       })
      .on('click', highlightConversation);

    // add path, which connects the diagram to the rects on the left side
    conversation.append('path')
      .attr('stroke', function(d) { return d.color = rankColor(d['score']); })
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .style('display', 'none')
      .attr('transform', 'translate('+conversationMargin+',0)')
      .attr('d', function(d) {
        let p = {
          source: { x: -conversationMargin, y: d['y'], dx: conversationMargin/3 },
          target: d[1], // root nodes sits there whyever
          dx: 10,
          dy: 1.3,
          sy: 1.3,
          ty: 1.3,
          x: 0,
          y: 0
        }
        return sankey.link()(p)
      });

    // add the path, which consists of segments of links that are joined in
    // one d-path
    conversation.append('path')
      .attr('class', 'highlight')
        .attr('stroke', function(d) { return d.color = rankColor(d['score']); })
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .style('display', 'none')
      .attr('transform', 'translate('+conversationMargin+',0)')
      .attr('d', conversationPath);
  }

  function highlightConversation(d) {
    if (transform.k < minZoomLevelPath) return;

    if (typeof d['active'] === typeof undefined)
      d['active'] = true;
    else
      d['active'] = !d['active'];

    if (d['active']) {
      d3.select(this.parentNode).selectAll('path').style('display', 'block');
    } else {
      d3.select(this.parentNode).selectAll('path').style('display', 'none');
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
      .attr('stroke', '#ccc')
      .attr('fill', '#fff')
      .call(scroll);
  }

  /**
  * Draw a path between two nodes only if they are apart at least
  * minNodeDistance. If not, draw nothing.
  */
  function path(d) {

    // if(Math.abs(d.source.x - d.target.x) > minNodeDistance)
    //   return sankey.link()(d);
    //
    // else if (typeof d.source.fisheye !== typeof undefined) {
    //   // get the screen coordinates after zoom transform
    //   let srcX = transform.applyX(d.source.fisheye.x);
    //   let trgX = transform.applyX(d.target.fisheye.x);
    //
    //   // check if distance is sufficient
    //   if (Math.abs(srcX - trgX) > minNodeDistance)
    //     return sankey.link()(d);
    // }

    if (transform.k > minZoomLevelPath)
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
    // if (!d.fisheye.distorted) return 'none';

    if (transform.k > minZoomLevelLabel)
      return 'block';
    else
      return 'none';
    // let srcX = d.fisheye.x;
    // let trgX = d.sourceLinks[0].target.fisheye.x;
    //
    // if (Math.abs(srcX - trgX) > minNodeDistance) {
    //   this.parentNode.appendChild(this);
    //   return 'block'
    // }
    // else
    //   return 'none';
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
    sankey.relayout();
    link.transition().duration(200).attr('d', path);

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
    if (d.type === 's') {
      return d.color = color(d.mood);
    }
    else
      return d.color = 'white';
  }

  /**
  * Uses the .color value set by the fill method and gets a darker version
  * of this value for the stroke
  */
  function strokeNode(d) {
    return d3.rgb(d.color).darker(0.73);
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
  }

  /**
  * Called on zoom events, changes the distance between sinks so that more/less
  * paths are displayed
  */
  function zoomed() {
    let dragging = transform.k === d3.event.transform.k;

    transform = d3.event.transform;

    diagram.attr('transform', 'translate('+transform.x+',0)');

    fisheye.distortion(1/transform.k * 10);
    if (!dragging) {
      node.attr('transform', function(d) {
        let zoomedX = transform.applyX(d.x) - transform.x;
        d.fisheye = {x: zoomedX};
        return 'translate(' + zoomedX + ',' + d.y + ')';
      });

      sink.attr('transform', function(d) {
        let x = transform.applyX(d[0].x) - transform.x;
        return 'translate('+x+',0)'
      });

      link.attr('d', path);

      label
        .style('display', displayLabel)
        .selectAll('rect')
          .attr('width', widthLabel);

      conversation.select('.highlight')
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
    // fisheye.focus([d3.mouse(this)[0], 0]);
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
    //
    // label.select('text')
    //   .html(function(d) {
    //     let dummyText = 'Bitte setzen Sie sich mit Ihrem Arzt zusammen, um das weitere Vorgehen bei der Behandlung Ihrer Schmerzen zu besprechen.';
    //     let w = widthLabel(d) | Math.abs;
    //
    //     return d.text.substring(0, w / 10) + '...';
    //
    //    })
  }

  trainer.filterConversations = function(activeConversations) {
    conversation.attr('display', function(d) {
      return activeConversations.indexOf(d) > -1
        ? 'block'
        : 'none';
    });

    return trainer
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