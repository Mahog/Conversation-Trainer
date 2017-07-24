# Readme
Project for Graph Visualization of dialogue training data

## Dependencies
* NodeJS version 4 or greater
* Free Trial Account on cloud.scorm.org (optional)

## Generate dialoge training data
Change your working directory ``` cd PharmaGespraech/ ```. Launch the dummy application ``` node app.js ```. This will start an HTTP-server listening on port 3000.

In your browser, navigate to this URL:
[http://localhost:3000/static/index.html](http://localhost:3000/static/index.html?endpoint=https://cloud.scorm.com/tc/KT1NDMUAZ9/sandbox/&auth=Basic%20QUZvZXM2Mm5IekF0ci1iWVN4azowVXpHa0VreWRIVlh5MGJmbFcw%20&actor={%22name%22:[%22ExampleActor%22],%22mbox%22:[%22mailto:example@test.de%22]}&activity_id=http://cloud.scorm.com/example/simplestatement). The full URL contains the BASE64 encoded Basic-Auth parameters for the Scorm Endpoint (see _&auth=Basic[...]_). To use your own Scorm endpoint, BASE64-encode the statement ```Key:Secret``` using your endpoint's Key and Secret (including the colon). Replace the ```endpoint``` URL-parameter with your endpoint's URL.

Your browser should now show a friendly face, offering you to start a conversation. Follow the instructions until you get a result-page. You have now generated one conversation.

Repeat the last step until satisfied. Quit the HTTP-server in your terminal.

## Get the Training data
Change your working directory again ```cd ../xapi/```. Run the app.js script using node: ```node app.js```. If there are no error messages and the application closes after a few seconds, everything went according to plan. If there are error messages, deal with them.

## Start the Visualization
In the root directory, double-click ```index.html``` to display the file inside your browser. Your conversations should show on the left side.
