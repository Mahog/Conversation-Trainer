var TinCan = require("tincanjs"),
    source,
    stream;

//TinCan.enableDebug();

source = new TinCan.LRS (
    {
        endpoint: "https://cloud.scorm.com/tc/public/",
        username: "test",
        password: "pass"
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
                    /*activity: {
                        id: ""
                    },
                    related_activities: true*/
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
            return;
        }

        if (sr.statements.length > 0) {
            console.log("Stream.processStatementsResult - printing batch of statements: ", sr.statements.length);

            this.printStatements(sr.statements);
        }

        console.log("Stream.processStatementsResult - more link: ", sr.more);
        if (sr.more !== null) {
            this.fetchStatements(sr.more);
        }
    },

    printStatements: function (sts) {
        console.log("Stream.printStatements");
        var i;
        for (i = 0; i < sts.length; i += 1) {
            console.log(i, sts[i].id, sts[i].timestamp, sts[i].actor.mbox, sts[i].verb.id, sts[i].target.id);
        }
    }
};

stream = new Stream ();
stream.fetchStatements(null);
