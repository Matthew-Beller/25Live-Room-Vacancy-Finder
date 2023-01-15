var dataURLs = [];

var firstAvailabilityURL = null;

// handles all incoming webReuests
// logs URLs for future use and signals changes in search settings
// based on contents of the URL
function handleRequest(requestDetails) {
    // when search terms and dates of webRequest change, the first set of availability data never includes &page= in the URL
    // while all other requests for availabiltiy data do include &page=
    // we use this to find when search terms are changed
    changeInSearchTerms = requestDetails.url.includes("availabilitydata.json") && !requestDetails.url.includes("&page=") && !dataURLs.includes(requestDetails.url);

    // an availablity data URL into dataURLs
    // then sends this URL to content.js to be processed and displayed
    if(requestDetails.url.includes("availabilitydata.json") && !dataURLs.includes(requestDetails.url)) {
        dataURLs.push(requestDetails.url);
        browser.tabs.query({active: true, currentWindow: true}, function(tabs){
            browser.tabs.sendMessage(tabs[0].id, {from: "background",command: "sentDataOneURL", URL: requestDetails.url}, function(response) {});  
        });
    }

    // when a change in search terms is detected
    // all URLs under the old search terms will be erased
    // and the first URL under the new terms will be the only element
    // of the refreshed dataURLs list

    // a message will be sent with this first URL
    // content.js will initialize the display to show new data
    if(changeInSearchTerms){
        dataURLs = [];
        dataURLs.push(requestDetails.url);
        firstAvailabilityURL = requestDetails.url;
        browser.tabs.query({active: true, currentWindow: true}, function(tabs){
            browser.tabs.sendMessage(tabs[0].id, {from: "background", command: "initializeURLs", URL: requestDetails.URL}, function(response) {});  
        });
    }

    // when changes in display preferences are sent via webRequest
    // all URLS under the old preferences will be erased
    // and the first URL under the new prefences will be the only
    // elleemnt of the refreshedURLs list


    // a message will be sent with this first URL
    // content.js will initialize the display to show new data
    if(requestDetails.url.includes("setPreference")) {
        dataURLs = [];
        dataURLs.push(firstAvailabilityURL);
        browser.tabs.query({active: true, currentWindow: true}, function(tabs){
            browser.tabs.sendMessage(tabs[0].id, {from: "background", command: "initializeURLs", URL: firstAvailabilityURL}, function(response) {});  
        });
    }
}

// messages a stringified version of dataURLs
function sendDataURLsList(){
    browser.tabs.query({active: true, currentWindow: true}, function(tabs){
        browser.tabs.sendMessage(tabs[0].id, {from: "background", command: "processListOfURLs", URLs: JSON.stringify(dataURLs)}, function(response) {});  
    });
}

// adds listener to handle all webRequests before they are sent
browser.webRequest.onBeforeRequest.addListener(
handleRequest,
{ urls: ["<all_urls>"] }
);

// listens for requests for dataURLs by content.js
browser.runtime.onMessage.addListener((message) => {
    if (message.from == "content" && message.command === "sendDataURLsList") {
        sendDataURLsList();
    }
  });