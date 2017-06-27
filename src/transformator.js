let transformator = function() {

  let rawGraph = null; // chemmedia conversation data
  let rawEventData = null; // xapi events on endpoint

  let nodes = [];
  let transformedGraph; // data transformed to be a node-link graph
  let transformedAnswers;

  let conversations = [];

  function transformator() {

  }

  function transformGraph() {
    if (!rawGraph) return false;

    let s = "";
    let statement = null;
    getGraphNodes();

    transformedGraph = {
      nodes: nodes,
      links: getGraphLinks()
    };
  }

  /**
   * Extract all nodes from the rawgraph. A node is either a statement by
   * the customer or an answer by the user. Both are treated equally and can
   * be differentiated by the 'type' property which is either 'a' (for answer)
   * or 's' (for statements).
   */
  function getGraphNodes() {
    let statementKeys = Object.keys(rawGraph.statements); // keys in statements
    let answerKeys = Object.keys(rawGraph.answers); // keys in answers

    let id = ""; // is set to the keys in answers and statements
    let node = null; // represents one answer or statement during iteration

    // every unique statement and every unique answer represent one node
    let index = 0;

    for (let i in statementKeys) {
      id = statementKeys[i];
      node = rawGraph.statements[id];

      nodes.push({
        id: id,
        name: index,
        text: node.value,
        value: 0,
        type: 's',
        mood: 'neutral'
      });

      index++;
    }

    for (let i in answerKeys) {
      id = answerKeys[i];
      node = rawGraph.answers[id];

      nodes.push({
        id: id,
        name: index,
        text: node.value,
        value: 1,
        type: 'a',
        mood: 'neutral'
      });

      index++;
    }

    return nodes;
  }

  /**
   * Extract all links between nodes from the raw data. A link can be found
   * in the 'responses' of statements or in the 'goto' property of answers.
   */
  function getGraphLinks() {
    let links = [];
    let statementKeys = Object.keys(rawGraph.statements); // keys in statements
    let answerKeys = Object.keys(rawGraph.answers); // keys in answers

    let id = ""; // is set to the keys in answers and statements
    let source = null; // represents one answer or statement during iteration
    let target = null;
    let node = null;
    let index = 1;
    let targetIndex;

    for (let i in statementKeys) {
      id = statementKeys[i];
      node = rawGraph.statements[id];
      source = nodes.find(function(n) { return n.id === id; })

      for (let j in node.responses) {
        target = nodes.find(function(d) {
          return d.id === node.responses[j]
        });

        links.push({
          dialogs: [],
          source: source,
          target: target,
          value: 1
        });
      }

      index++;
    }

    for (let i in answerKeys) {
      id = answerKeys[i];
      node = rawGraph.answers[id];
      source = nodes.find(function(n) { return n.id === id; });

      if (typeof node.goto === typeof undefined)
        continue;

      target = nodes.find(function(d) {
        return d.id === node.goto;
      });

      target.mood = node.mood;

      links.push({
        dialogs: [],
        source: source,
        target: target,
        value: 1
      });

      index++;
    }

    return links;
  }

  function updateLinkValues() {
    if (!rawGraph) {
      console.error('Graph data missing.');
      return;
    }

    let rawAnswers = rawEventData.filter(function(d) {
      return d.verb.display['en-US'] === 'answered';
    })

    transformedAnswers = [];
    rawAnswers.forEach(function(answer) {
      transformedAnswers.push({
        source: answer.result.extensions['chemmedia://expapi/dialog'].dialogId,
        target: answer.result.extensions['chemmedia://expapi/questionId']
      });
    });

    transformedAnswers.forEach(function(answer) {
      transformedGraph.links.map(function(link) {
        let aMatch = link.source.type === 'a' && link.source.id === answer.target;
        let qMatch = link.source.type === 'q' && link.target.id === answer.target;

        if(aMatch || qMatch)
          link.value++;
      });
    });
  }

  /**
   * Using the event data, extract single conversations that happened, using the
   * following assumptions:
   * - a conversation starts with a 'launched'event
   * - a conversation ends with a 'completed' event
   * - a conversation has 'answered' events in between, each represented by a
   *   node in the graph
   * - all events from the same user between 'launched' and 'completed' belong
   *   to a single conversation. There is no parallelism possible.
   */
  function updateConversations() {
    // sort the events by time to differentiate between conversations by the
    // same user (assuming one person cannot have parallel conversations)
    let sortedEvents = rawEventData.sort(function(d1, d2) {
      let date1 = new Date(d1.timestamp);
      let date2 = new Date(d2.timestamp);
      return date1 > date2;
    });

    let completions = sortedEvents.filter(function(d) {
      return d.verb.display['en-US'] === 'completed';
    });

    let trails = [];

    // starting from the "completed" event, find its matching starting event and
    // collect all events from the same user on the way there to create a
    // "converation-trail"
    completions.forEach(function(c) {
      let trail = [c];
      let index = sortedEvents.indexOf(c);

      // since the events are sorted by timestamp, start from the completion and
      // go back (i--) to the launching event
      for (let i = index - 1; i > 0; i--) {
        let event = sortedEvents[i];

        // check if the actor matches the on from the completion
        if (event.actor.mbox === c.actor.mbox) {
          // check if this event was the start of a conversation (>stop looking)
          if (event.verb.display['en-US'] === 'launched')
            break;
          else
            trail.push(event); // save the answer event
        }
      }
      if (trail.length > 1)
        trails.push(trail.reverse());
    });

    conversations = [];

    // transform the raw event trails into nodes in the graph
    trails.forEach(function(t) {
      let conversation = []; // holds nodes of the graph
      for (let i = 0; i < t.length; i++) {
        let c = t[i];

        // save score of conversation in property
        if (i === t.length - 1) {
          conversation['score'] = c.result.extensions['chemmedia://expapi/moodpoints/current'];
          conversation['timestamp'] = c.timestamp;
          continue;
        }

        // find the nodes in the graph and add them to the conversation
        let questionId = c.result.extensions['chemmedia://expapi/questionId'];
        let dialogId = c.result.extensions['chemmedia://expapi/dialog'].dialogId;

        let question = nodes.find(function(n) {
          return n.id === questionId;
        });

        let answer = nodes.find(function(n) {
          return n.id === dialogId;
        });

        conversation.push(question);
        conversation.push(answer);
      }
      conversations.push(conversation);
    });
    conversations.sort(function(c1, c2) {
      return parseInt(c1['score']) < parseInt(c2['score']);
    });
  }

  /**
  * Add the raw graph data to the transformator.
  */
  transformator.graph = function(_) {
    if (!arguments.length) return transformedGraph;
    rawGraph = _;
    transformGraph();
    return transformator;
  }

  /**
  * Add frequency data and update the values of links in the graph.
  */
  transformator.frequencyData = function(_) {
    if (!arguments.length) return rawEventData;
    rawEventData = _;
    console.log(rawEventData)
    updateLinkValues();
    updateConversations();
    return transformator;
  }

  transformator.conversations = function(_) {
    if (!arguments.length) return conversations;
    return transformator;
  }

  return transformator;
}