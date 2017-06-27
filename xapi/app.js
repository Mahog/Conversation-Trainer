let TinCan = require("tincanjs");
let fs = require('fs');

let lrs = new TinCan.LRS (
  {
    endpoint: "https://cloud.scorm.com/tc/KT1NDMUAZ9/sandbox/",
    username: "AFoes62nHzAtr-bYSxk",
    password: "0UzGkEkydHVXy0bflW0",
    version: "1.0.0",
    allowFail: false
  }
);

lrs.queryStatements({
  params: {
    since: "2012-01-05T08:34:16Z"
  },
  callback: (err, sr) => {
    if (err !== null) {
      console.log("Failed to query statements: ", err);
      return;
    }

    let filtered = sr.statements.filter(function(d) {
      let isInit = d.verb.display['en-US'] === 'launched'
      let isAnswer = d.verb.display['en-US'] === 'answered'
      let isCompleted = d.verb.display['en-US'] === 'completed'

      return isInit || isAnswer || isCompleted;
    })

    let prettyData = JSON.stringify(filtered, null, 2);

    fs.writeFileSync('xAPIEvents.json', prettyData);
}});