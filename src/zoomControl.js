let zoomControl = function() {
  let width = 200;
  let height = 40;

  let svg;
  let zoomInBtn;
  let zoomOutBtn;
  let levelText;

  let zoomClients = [];
  let zoomLevel = 1.0;

  function control(selection) {
    svg = selection;
    drawBackground();
    drawButtons();
  }

  function drawBackground() {
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'rgba(255,255,255,0.73)')
      .attr('stroke', 'none');

    levelText = svg.append('text')
      .attr('dx', width / 2)
      .attr('dy', height / 2 + 6)
      .attr('text-anchor', 'middle')
      .text('100%');
  }

  function drawButtons() {
    let radius = height / 2 - 5;

    zoomInBtn = svg.append('g')
      .attr('class', 'zoomBtn in')
      .attr('transform', 'translate('+(width*0.75)+','+(height/2)+')')
      .on('click', function() { zoom(+0.5); })
      .on('mouseover', function() { hoverEffect(this, 0.3); })
      .on('mouseout', function() { hoverEffect(this, 0); });

    zoomInBtn.append('circle')
      .attr('fill', 'transparent')
      .attr('stroke', 'teal')
      .attr('stroke-width', 2)
      .attr('fill', 'transparent')
      .attr('r', radius)
      .attr('cx', 0)
      .attr('cy', 0);

    zoomInBtn.append('text')
      .attr('dx', -1)
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .text('+');

    zoomOutBtn = svg.append('g')
      .attr('class', 'zoomBtn out')
      .attr('transform', 'translate('+(width*0.25)+','+(height/2)+')')
      .on('click', function() { zoom(-0.5); })
      .on('mouseover', function() { hoverEffect(this, 0.3); })
      .on('mouseout', function() { hoverEffect(this, 0); });

    zoomOutBtn.append('circle')
      .attr('fill', 'transparent')
      .attr('stroke', 'teal')
      .attr('stroke-width', 2)
      .attr('fill', 'transparent')
      .attr('r', radius)
      .attr('cx', 0)
      .attr('cy', 0);

    zoomOutBtn.append('text')
      .attr('dx', 0)
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('font-weight', 'bold')
      .text('-');
  }

  function zoom(k) {
    if (zoomLevel < 1.0) return;
    zoomLevel += k;

    zoomClients.forEach(function(c) { c.zoomBy(k); });
    levelText.text(parseInt(zoomLevel*100) + '%');
  }

  function hoverEffect(that, opacity) {
    d3.select(that).select('circle').transition().duration(100)
      .attr('fill', 'rgba(0, 128, 128,'+opacity+')');
  }

  control.registerZoomClient = function(c) {
    if (zoomClients.indexOf(c) === -1)
      zoomClients.push(c);
    return control;
  }

  control.zoomLevel = function(_) {
    if (!arguments.length) return zoomLevel;
    zoomLevel = _;
    levelText.text(parseInt(zoomLevel*100) + '%');
    return control;
  }

  return control;
}