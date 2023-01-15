function listenForClicks() {
  document.addEventListener("click", (e) => {
    function go(tabs) {
      var currMinutes = document.getElementById("amount-minutes").value;
      var currHours = document.getElementById("amount-hours").value;  

      // irregular expression checks that currMinutes and currHours contain only numbers
      if(!(/^\d+$/.test(currMinutes))){
        document.getElementById("amount-minutes").value = 0;
      }
      if(!(/^\d+$/.test(currHours))){
        document.getElementById("amount-hours").value = 0;
      }

      if(document.getElementById("start-time").value == ""){
        document.getElementById("start-time").value = "00:00";
      }

      if(document.getElementById("end-time").value == ""){
        document.getElementById("end-time").value = "00:00";
      }

        browser.tabs.sendMessage(tabs[0].id, {
          from: "popup",
          command: "processRequestFromPopup",
          startTime: document.getElementById("start-time").value,
          endTime: document.getElementById("end-time").value,
          amountTime: +currMinutes + +(currHours * 60) ,
          anyTime: document.getElementById("any-times-box").checked,
          fullRange: document.getElementById("full-range-box").checked
        });

        // loading dot animation of go button while request is being processed
        var loadingState = 1;
        var timer = 0;
        var dot = ".";

        document.getElementById("go-button").textContent = "Loading" + dot.repeat(loadingState);
        
        timer = setInterval(() => {
          if(timer) {
              loadingState = (loadingState % 3) + 1
              document.getElementById("go-button").textContent = "Loading" + dot.repeat(loadingState);
          }
        }, 1000);

        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if(message.from == "content" && message.subject == "done"){
            clearInterval(timer);
            timer = 0;
            document.getElementById("go-button").textContent = "Go";
          }
        });
    }

    function reportError(error) {
      console.error(`Could not: ${error}`);
    }

    function toggleAmount(){
      document.getElementById("amount-hours").disabled = !document.getElementById("amount-hours").disabled;
      document.getElementById("amount-minutes").disabled = !document.getElementById("amount-minutes").disabled;

    }

    function toggleRange(){
      if(document.getElementById("any-times-box").checked) {
        document.getElementById("start-time").value = "00:00";
        document.getElementById("end-time").value = "00:00";
        
      } else {
        initializeRange();
      }

      document.getElementById("start-time").disabled = !document.getElementById("start-time").disabled;
      document.getElementById("end-time").disabled = !document.getElementById("end-time").disabled;
    }
    if (e.target.id == "go-button") {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(go)
        .catch(reportError);

    } else if (e.target.id == "full-range-box") {
      browser.tabs
      .query({ active: true, currentWindow: true })
      .then(toggleAmount)
      .catch(reportError);

    } else if (e.target.id == "any-times-box") {
      browser.tabs
      .query({ active: true, currentWindow: true })
      .then(toggleRange)
      .catch(reportError);
    }
  });
}

function listenForChanges() {
  document.addEventListener('change', (e) => {
    if (document.getElementById("full-range-box").checked){
      browser.tabs
      .query({ active: true, currentWindow: true })
      .then(updateAmount)
      .catch(reportError);
    }
    if (e.target.id == "amount-hours" || e.target.id == "amount-minutes"){
      browser.tabs
      .query({ active: true, currentWindow: true })
      .then(checkAmount)
      .catch(reportError);
    }
  });
}

// ensures amount of time in amount box is valid
function checkAmount(){
  var currMinutes = document.getElementById("amount-minutes").value;
  var currHours = document.getElementById("amount-hours").value;

  if(currHours < 0){
    document.getElementById("amount-hours").value = 0;
  }

  if(currMinutes < 0){
    document.getElementById("amount-minutes").value = 0;
  }

  currMinutes = document.getElementById("amount-minutes").value;
  currHours = document.getElementById("amount-hours").value;

  if(currMinutes >= 60) {
    document.getElementById("amount-hours").value = +currHours + +Math.floor(currMinutes / 60);
    document.getElementById("amount-minutes").value = currMinutes % 60;
  }
  currHours = document.getElementById("amount-hours").value;
  if(currHours >= 24) {
    document.getElementById("amount-hours").value = 24;
  }
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
  document.querySelector("#popup-content").classList.add("hidden");
  document.querySelector("#error-content").classList.remove("hidden");
  console.error(`Failed to execute content script: ${error.message}`);
}

/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */

function updateAmount() {
  if(document.getElementById("start-time").value != "" && document.getElementById("end-time").value != "") {
    start = document.getElementById("start-time").value;
    end = document.getElementById("end-time").value;

    if(start == "00:00" && end == "00:00"){
      var minutes = 1440;
    } else {
      start = start.split(":");
      end = end.split(":");
      var startDate = new Date(0, 0, 0, start[0], start[1], 0);
      var endDate = new Date(0, 0, 0, end[0], end[1], 0);
      var diff = endDate.getTime() - startDate.getTime();
      var minutes = Math.floor(diff / 60000);
    }

    if (minutes >= 0){
      document.getElementById("amount-hours").value = Math.floor(minutes / 60);
      document.getElementById("amount-minutes").value = minutes % 60;  
    }
  } else {
    document.getElementById("amount-minutes").value = null;
    document.getElementById("amount-hours").value = null;
  }
}

// initializes time range to be the current time for the beginning
// and null for the end
function initializeRange(){
  var date = new Date();

  var hour = date.getHours(),
      min  = date.getMinutes();

  hour = (hour < 10 ? "0" : "") + hour;
  min = (min < 10 ? "0" : "") + min;

  var displayTime = hour + ":" + min; 

  document.getElementById("start-time").value = displayTime;
  document.getElementById("end-time").value = "";
}

initializeRange();
listenForChanges();
browser.tabs
  .executeScript({ file: "/content.js" })
  .then(listenForClicks)
  .catch(reportError);