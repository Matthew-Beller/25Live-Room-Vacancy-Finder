(() => {
    /**
     * Check and set a global guard variable.
     * If this content script is injected into the same page again,
     * it will do nothing next time.
     */
    if (window.hasRun) {
      return;
    }
    window.hasRun = true;

    messageInfo = null;

    var roomsData = {};

    var range = {};

    // checks for frames of available and unavailable times using availabity data and user parameters
    function checkRooms(availabilityData, startTime, endTime, amountOfTime){
      return new Promise((resolve, reject) => {
        var prevTime;
        var firstTime;
        for (const currRoom of availabilityData["subjects"]) {
          prevTime = null;
          firstTime = true;
          var times = currRoom["items"];
          if(times == null){
            times = [];
          }

          // used to solve cases of slots beginning or ending at end of days
          // handle case of room never closing
          times.unshift(
            {
            "itemId": 0,
            "itemName": "Closed",
            "itemId2": 0,
            "has_perm": 0,
            "type_id": 3,
            "start": availabilityData["headers"]["data"][0].header_id,
            "end": availabilityData["headers"]["data"][0].header_id,
            "itemTypeId": 1
            }
          )
            times.push(
              {
              "itemId": 0,
              "itemName": "Closed",
              "itemId2": 0,
              "has_perm": 0,
              "type_id": 3,
              "start": availabilityData["headers"]["data"][availabilityData["headers"]["data"].length-1].header_id+1,
              "end": availabilityData["headers"]["data"][availabilityData["headers"]["data"].length-1].header_id+1,
              "itemTypeId": 1
              }
            )

          // time range of results provided by availabitiy data
          range = {start: availabilityData["headers"]["data"][0].header_id, end: availabilityData["headers"]["data"][availabilityData["headers"]["data"].length-1].header_id+1};

          times.sort((a,b) => {
            if (parseFloat(a.start) <= parseFloat(b.start)) {
              return -1;
            }
            if (parseFloat(a.start) > parseFloat(b.start)) {
              return 1;
            }
          });

          for (const currTime of times) {
            if (!firstTime) {
              var enoughTime = (((parseFloat(currTime.start) - parseFloat(prevTime.end)) * 60) >= parseInt(amountOfTime));

              // checks validity of start and end times of time slot
              // based on time range provided by user in extension
              var validStart = (+parseFloat(currTime.start) - (+(parseFloat(amountOfTime)/60) ) >= startTime);
              var validEnd = ((+(parseFloat(amountOfTime)/60) + +parseFloat(prevTime.end)) <= endTime);

              if(roomsData[currRoom.itemName] == null){
                roomsData[currRoom.itemName] = [];
              }

              if (enoughTime && validStart && validEnd){
                roomsData[currRoom.itemName].push({isValid: true, startTime: parseFloat(prevTime.end), endTime: parseFloat(currTime.start), isPlaced: false});
              } else {
                if((parseFloat(prevTime.end) < parseFloat(currTime.start))){
                  roomsData[currRoom.itemName].push({isValid: false, startTime: parseFloat(prevTime.end), endTime: parseFloat(currTime.start), isPlaced: false});
                }
              }
            }

            if (firstTime || (parseFloat(currTime.start) >= parseFloat(prevTime.end))) {
              prevTime = currTime;
            }

            // firstTime is necessary because there is no previous on the first iteration of the loop
            firstTime = false;
          }
        }
        resolve();
      });
    }

    // updates chart using data from a list of URLs
    function highlightRooms(URLs, startTime, endTime, amountOfTime) {
      return new Promise((resolve, reject) => {
        var dataURLs = JSON.parse(URLs);
        var counter = 0;
        dataURLs.forEach((URL) => {
          counter = counter + 1;
          fetch(URL)
          .then(res => res.json())
          .then(res => checkRooms(res, startTime, endTime, amountOfTime))
          .then(res => checkDone(dataURLs, counter))
          .then(res => updateHighlights());
        });
        resolve();
      });
    }
    
    // tells popup that processing roomData is complete
    // used to mark end of loading animation
    function checkDone(dataURLs, counter) {
      return new Promise((resolve, reject) => {
          if(counter == dataURLs.length){
          browser.runtime.sendMessage({from: "content", subject: "done"}, function(response) {});
        }
        resolve();
      });
    }

    browser.runtime.onMessage.addListener((message, sender, response) => {
      if (message.from == "popup" && message.command == "processRequestFromPopup") {
          browser.runtime.sendMessage({from: "content", command: "sendDataURLsList"}, function(response) {});  
          messageInfo = message;

      } else if(message.command == "sentDataOneURL" && messageInfo != null){
        updateUsingOneURL(message.URL, messageInfo);

      } else if (message.command == "processListOfURLs") {
        // calculates beginning and endtimes submitted in the extension
        var startTime = messageInfo.startTime.split(":");
        startTime = parseFloat(startTime[0]) + parseFloat(startTime[1] / 60); 

        if(messageInfo.endTime == "00:00"){
          var endTime = 24;
        } else {
          var endTime = messageInfo.endTime.split(":");
          endTime = parseFloat(endTime[0]) + parseFloat(endTime[1] / 60); 
        }

        removeOldTimeBoxes()
        .then(res => highlightRooms(message.URLs, startTime, endTime, messageInfo.amountTime))
        .then(res => setHighlightInterval());

      } else if (messageInfo != null && message.from == "background" && message.command == "initializeURLs"){ 
        initalizeData()
        .then(res => removeOldTimeBoxes())
        .then(res => updateUsingOneURL(message.URL, messageInfo));
      }
    });

    // sets interval to update highlighting on graph
    // this is important because hightlighting at times may become offloaded
    // when scrolled past
    function setHighlightInterval(){
      setInterval(updateHighlights,100);
    }
    
    // updates the chart when given on URL
    function updateUsingOneURL(URL, messageInfo){
      return new Promise((resolve, reject) => {
        // calculates beginning and endtimes submitted in the extension
        var startTime = messageInfo.startTime.split(":");
        startTime = parseFloat(startTime[0]) + parseFloat(startTime[1] / 60); 
        if(messageInfo.endTime == "00:00"){
          var endTime = 24;
        } else {
          var endTime = messageInfo.endTime.split(":");
          endTime = parseFloat(endTime[0]) + parseFloat(endTime[1] / 60); 
        }

        fetch(URL)
          .then(res => res.json())
          .then(res => checkRooms(res, startTime, endTime, messageInfo.amountTime))
          .then(res => updateHighlights());
        resolve();
    });
    }

    // removes coloring in the schedule that had been placed by this extension
    function removeOldTimeBoxes() {
      return new Promise((resolve, reject) => {
        var addedElements = document.getElementsByClassName("addedByExtension");
        while(addedElements[0]){
          addedElements[0].parentElement.removeChild(addedElements[0]);
        }
        resolve();
      });
    }

    // initializes room and range data
    function initalizeData(){
      return new Promise((resolve, reject) => {
        roomsData = {};
        range = {};
        resolve();
      });
    }

    // updates highlights on schedule to mark valid times and rooms
    // that match user search criteria
    function updateHighlights(){
      return new Promise((resolve, reject) => {
        for(var key in roomsData){
          try{
            // trick used to locate and highlight rows of certain rooms
            // this method must be used because aria-labels are the only elements which contain
            // room codes in plaintext
            var roomLabelBox = document.querySelector(`div[aria-label="${key}"]`).parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
            var topLayer = roomLabelBox.parentElement.parentElement.parentElement;

            var validFound = false;

            // handles case where builiding is closed over complete time frame
            if (roomsData[key].length == 0){
              roomLabelBox.style.backgroundColor = 'pink';
            }

            for(i = 0; i < roomsData[key].length; i++){
              if(!roomsData[key][i].isPlaced){
                // calculates the location of where the boxes should be placed
                // the is a constant of 17% margin used to place the room codes in the chart
                // remaining 83% of the chart is open for boxes, which are moved and sized
                // proportionally to the size of the time fram displayed
                var margin_left = 100 - ((100-17) / (range.end-range.start)) * (range.end-roomsData[key][i].startTime);
                var width = ((100-17) / (range.end-range.start)) * (roomsData[key][i].endTime-roomsData[key][i].startTime);
                var timeBox = document.createElement("div");
                timeBox.classList.add("addedByExtension");

                if(roomsData[key][i].isValid){
                  validFound = true;
                  timeBox.style.cssText = `visibility = visible; position: absolute; color: lightgreen;background-color: lightgreen;width: ${width}%; margin-left: ${margin_left}%; top: 0px; min-height: 100%;`;
                } else {
                  timeBox.style.cssText = `visibility = visible; position: absolute; color: pink;background-color: pink;width: ${width}%; margin-left: ${margin_left}%; top: 0px; min-height: 100%;`;
                }
                topLayer.appendChild(timeBox);
                roomsData[key][i].isPlaced = true;
                if(validFound){
                  roomLabelBox.style.backgroundColor = 'lightgreen';
                } else {
                  roomLabelBox.style.backgroundColor = 'pink';
                }
              }
            }
            // when a box is not currently on screen, it throws an exception when finding the element
            // catching and continuing works around this issue
          } catch {
            continue;
          }
        }
        resolve();
      });
    }

  })()