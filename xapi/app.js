var TinCan = require("tincanjs"),
    source,
    stream;

let fs = require('fs');

let data = [];

source = new TinCan.LRS (
  {
    endpoint: "https://cloud.scorm.com/tc/KT1NDMUAZ9/sandbox/",
    username: "AFoes62nHzAtr-bYSxk",
    password: "0UzGkEkydHVXy0bflW0",
    version: "1.0.0",
    allowFail: false
  }
);

Stream = function () {
  console.log("Stream.constructor");
};
Stream.prototype = {
  fetchStatements: function (moreUrl) {
    console.log("Stream.fetchStatements");
    var self = this;

    if (moreUrl !== null) {
      source.moreStatements(
        {
          url: moreUrl,
          callback: this.processStatementsResult.bind(this)
        }
      );

      return;
    }

    source.queryStatements(
      {
        params: {
          // since: '2017-06-01T00:00:00Z'
        },
        callback: this.processStatementsResult.bind(this)
      }
    );
  },

  processStatementsResult: function (err, sr) {
    console.log("Stream.processStatementsResult");
    var i,
        batch;

    if (err !== null) {
      console.log("Stream.processStatementsResult query/more failed: ", err, sr);
      fs.writeFileSync('events.json', JSON.stringify(data, null, 0));
      return;
    }

    if (sr.statements.length > 0) {
      console.log("Stream.processStatementsResult - printing batch of statements: ", sr.statements.length);

      this.printStatements(sr.statements);

      console.log(data.length)
    }

    console.log("Stream.processStatementsResult - more link: ", sr.more);
    if (sr.more !== null) {
      this.fetchStatements(sr.more);
    } else {
      fs.writeFileSync('xAPIEvents.json', JSON.stringify(data, null, 0));
    }
  },

  printStatements: function (sts) {
    let filtered = sts.filter(d => {
      if (d.verb.display === null) return false;

    let isInit = d.verb.display['en-US'] === 'launched';
      let isAnswer = d.verb.display['en-US'] === 'answered';
      let isCompletion = d.verb.display['en-US'] === 'completed';


    return isInit || isAnswer || isCompletion;
    });

    data = data.concat(filtered);
  }
};

stream = new Stream ();
stream.fetchStatements(null);
