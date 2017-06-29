let margin = {
        top: 1,
        right: 10,
        bottom: 100,
        left: 10
      },
      width = document.body.clientWidth - margin.left - margin.right,
      height = window.innerHeight - margin.top - margin.bottom - 20;

svg = d3.select('#chart').append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

let trainer = d3.trainer()
  .width(width)
  .height(height);

svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'transparent')

d3.json('./data/conversation_chemmedia.json', function(energy) {
  d3.json('./xapi/xAPIEvents.json', function(xapiData) {
    let trans = transformator()
      .graph(energy)
      .frequencyData(xapiData);

    trainer
      .data(trans.graph())
      .conversations(trans.conversations());

    svg.call(trainer);
  })
});

