/* Init */
var vrsServerUrl = "";
var zoom = 8;
var mapCenterLatLong = new LatLong(47.5, 19.0);

var mapIsMoving = false;
var mapIsZooming = false;
var ajaxRequestIsRunning = false;

var aircraft_icon_img = new Image(40, 40);
aircraft_icon_img.src = "images/marker1.png";
var marker_width = 35;

var aircraftSelected_icon_img = new Image(40, 40);
aircraftSelected_icon_img.src = "images/marker1_selected.png";

var aircrafts = [];
var selectedAircraft;
var ldv;

var leaflet_map = L.map("leaflet_map").setView([mapCenterLatLong.Lat, mapCenterLatLong.Lng], zoom);
L.tileLayer('http://map.adsbexchange.com/mapproxy/tiles/1.0.0/osm/osm_grid/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: ''
}).addTo(leaflet_map);

var leaflet_map_pane = document.getElementsByClassName("leaflet-map-pane")[0];

var leaflet_map_div = document.getElementById("leaflet_map");
var aircrafts_canvas = document.getElementById("aircarfts_canvas");
var aircraftTrails_canvas = document.getElementById("aircraftTrails_canvas");
var aircraftSelected_canvas = document.getElementById("aircraftSelected_canvas");

SetCanvasSizeToLeafletMapSize();

var aircraft_cavas_context = aircrafts_canvas.getContext("2d");
var aircraftTrails_canvas_context = aircraftTrails_canvas.getContext("2d");
var aircraftSelected_canvas_context = aircraftSelected_canvas.getContext("2d");
var leaftletMapTopXY = GetLeafletMapTopXY();

leaflet_map.addEventListener("click", function (e) {
    var x = e.containerPoint.x;
    var y = e.containerPoint.y;

    for (var i = 0; i < aircrafts.length; i++) {
        var aircraft = aircrafts[i];
        if (x > (aircraft.MapX - (marker_width / 2)) && x < (aircraft.MapX + (marker_width / 2)) && y > (aircraft.MapY - (marker_width / 2)) && y < (aircraft.MapY + (marker_width / 2))) {
            selectedAircraft = aircraft;

            DrawSelectedAircraft();

            return;
        }
    }

    selectedAircraft = null;
    ClearAircraftTrailCanvas();
    ClearAircrafSelectedlCanvas();

}, true);

GetJsonAndDraw();

setInterval(GetJsonAndDraw, 10000);

/* End of Init*/

/* Events */
window.onresize = function (event) {
    SetCanvasSizeToLeafletMapSize();
};

leaflet_map.on("movestart", function (e) {
    console.log("movestart");
    mapIsMoving = true;
});

leaflet_map.on("moveend", function (e) {
    console.log("moveend");
    mapIsMoving = false;

    GetJsonAndDraw();
});

var moveRedrawRunning = false;
leaflet_map.on("move", function (e) {
    console.log("move");

    if ((mapIsMoving === true || mapIsZooming === true) && moveRedrawRunning === false) {
        moveRedrawRunning = true;

        UpdateAndDrawAircraftsFromMemory();

        moveRedrawRunning = false;
    }
});

leaflet_map.on("zoomstart", function (e) {
    console.log("zoomstart");
    mapIsZooming = true;
});

leaflet_map.on("zoomend", function (e) {
    console.log("zoomend");
    mapIsZooming = false;
});

/* End of events*/

/* Objects */
function Aircraft() {
    var self = this;

    self.Id;
    self.LatLong;
    self.Rotation;
    self.PointXY;

    self.MapX;
    self.MapY;

    self.Icao;
    self.Call;
    self.Reg;
    self.From;
    self.To;
    self.Type;
    self.Op;
    self.OpIcao;
    self.Mdl;

    self.Trail = [];

    self.LastUpdated;
}

/* End of Objects*/

/* Functions */
function SetCanvasSizeToLeafletMapSize() {
    var width = leaflet_map_div.clientWidth;
    var height = leaflet_map_div.clientHeight;
    var ratio = window.devicePixelRatio;

    ScaleCanvasSize(aircrafts_canvas, width, height, ratio);
    ScaleCanvasSize(aircraftTrails_canvas, width, height, ratio);
    ScaleCanvasSize(aircraftSelected_canvas, width, height, ratio);
}

function ScaleCanvasSize(canvas, width, height, ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.getContext("2d").scale(ratio, ratio);
}

function ClearAllCanvas() {
    ClearAircraftCanvas();
    ClearAircraftTrailCanvas();
    ClearAircrafSelectedlCanvas();
}

function ClearAircraftCanvas() {
    aircraft_cavas_context.clearRect(0, 0, aircrafts_canvas.width, aircrafts_canvas.height);
}

function ClearAircraftTrailCanvas() {
    aircraftTrails_canvas_context.clearRect(0, 0, aircraftTrails_canvas.width, aircraftTrails_canvas.height);
}

function ClearAircrafSelectedlCanvas() {
    aircraftSelected_canvas_context.clearRect(0, 0, aircraftTrails_canvas.width, aircraftTrails_canvas.height);
}

function GetLeafletMapTopXY() {
    var leafletMapBounds = leaflet_map.getBounds();
    return GetPointXYFromLatLong(new LatLong(leafletMapBounds._northEast.lat, leafletMapBounds._southWest.lng), leaflet_map._zoom);
}

function MapAircraftDataFromJson(aircraft, ac, leafletTopLeftXY) {
    if(ac.Lat || ac.Long){
        var lat;
        var long;

        if(aircraft.LatLong){
            lat = aircraft.LatLong.Lat;
            long = aircraft.LatLong.Lng;
        }

        if(ac.Lat){
            lat = ac.Lat;
        }

        if(ac.Long){
            long = ac.Long;
        }

        if(lat && long){
            aircraft.LatLong = new LatLong(lat, long);

            aircraft.PointXY = GetPointXYFromLatLong(aircraft.LatLong, leaflet_map._zoom);
            aircraft.MapX = aircraft.PointXY.X - leafletTopLeftXY.X;
            aircraft.MapY = aircraft.PointXY.Y - leafletTopLeftXY.Y;
        }
    }

    if(ac.Trak){
        aircraft.Rotation = GetRotationInRad(ac.Trak);
    }

    if(ac.Call){
        aircraft.Call= ac.Call;
    }

    if(ac.Reg){
        aircraft.Reg = ac.Reg;
    }

    if(ac.From){
        aircraft.From = ac.From;
    }

    if(ac.To){
        aircraft.To = ac.To;
    }

    if(ac.Type){
        aircraft.Type = ac.Type;
    }

    if(ac.Op){
        aircraft.Op = ac.Op;
    }

    if(ac.OpIcao){
        aircraft.OpIcao = ac.OpIcao;
    }

    if(ac.Mdl){
        aircraft.Mdl = ac.Mdl;
    }

    if(ac.Species){
        aircraft.Species = ac.Species;
    }

    if(ac.Cot){
        for(i = 0; i < ac.Cot.length; i++){
            aircraft.Trail.push(ac.Cot[i]);
        }
    }
}

function UpdateAndDrawAircraftsFromJson(data) {
    ClearAllCanvas();

    var leafletTopLeftXY = GetLeafletMapTopXY();

    for (var i = 0; i < data.acList.length; i++) {
        var ac = data.acList[i];

        var match = false;

        // update from received data
        for (var j = 0; j < aircrafts.length; j++) {
            var aircraft = aircrafts[j];
            if (aircraft.Id === ac.Id) {
                match = true;

                MapAircraftDataFromJson(aircraft, ac, leafletTopLeftXY);

                var date = new Date();
                aircraft.LastUpdated = date.getTime();

                break;
            }
        }

        // add new data
        if (match === false) {
            var aircraft = new Aircraft();
            aircraft.Id = ac.Id;
            aircraft.Icao = ac.Icao;

            MapAircraftDataFromJson(aircraft, ac, leafletTopLeftXY);

            var date = new Date();
            aircraft.LastUpdated = date.getTime();

            aircrafts.push(aircraft);
        }
    }

    // remove old data

    for (var i = 0; i < aircrafts.length; i++) {
        if (aircrafts[i].LastUpdated + 1000 * 10 < date.getTime()) {
            if (selectedAircraft) {
                if (selectedAircraft.Id === aircrafts[i].Id) {
                    selectedAircraft = null;
                    ClearAircrafSelectedlCanvas();
                    ClearAircraftTrailCanvas();
                }
            }

            aircrafts.splice(i, 1); // remove aircraft
        }
    }
    
    //Draw
    for (var i = 0; i < aircrafts.length; i++) {
        var aircraft = aircrafts[i];

        DrawAircraft(aircraft);
    }

    DrawSelectedAircraft();
}

function UpdateAndDrawAircraftsFromMemory() {
    ClearAllCanvas();

    var leafletTopLeftXY = GetLeafletMapTopXY();

    for (var i = 0; i < aircrafts.length; i++) {
        var aircraft = aircrafts[i];

        if (mapIsZooming === true) {
            if(aircraft.LatLong){
                aircraft.PointXY = GetPointXYFromLatLong(aircraft.LatLong, leaflet_map._zoom);
            }
        }

        if(aircraft.PointXY){
            aircraft.MapX = aircraft.PointXY.X - leafletTopLeftXY.X;
            aircraft.MapY = aircraft.PointXY.Y - leafletTopLeftXY.Y;
        }

        DrawAircraft(aircraft);

        if (selectedAircraft) {
            if (selectedAircraft.Id === aircraft.Id) {
                selectedAircraft = aircraft;
            }
        }
    }

    DrawSelectedAircraft();
}

function DrawAircraft(aircraft, selected) {
    if (aircraft.Species != 1) {
        return;
    }

    var translateX = aircraft.MapX;
    var translateY = aircraft.MapY;

    var canvas = aircraft_cavas_context;
    var icon = aircraft_icon_img;

    if (selected === true) {
        DrawAircraft(aircraft, false);

        canvas = aircraftSelected_canvas_context;
        icon = aircraftSelected_icon_img;
    }

    canvas.save();
    canvas.translate(translateX, translateY);

    if (aircraft.Rotation) {
        canvas.rotate(aircraft.Rotation);
    }

    canvas.drawImage(icon, -(marker_width / 2), - (marker_width / 2), marker_width, marker_width);
    canvas.restore();

    if (selected === true) {
        var fontSize = 12;
        // draw rectangle
        canvas.save();
        canvas.translate(translateX - marker_width / 2, translateY + marker_width / 2 + 5);

        canvas.fillStyle = "#FFFFFF";
        canvas.strokeStyle = "#ededed";
        canvas.fillRect(00, 0, 90, (fontSize + 2) * 4);
        canvas.strokeRect(0, 0, 90, (fontSize + 2) * 4);

        canvas.restore();

        // draw text
        canvas.save();
        canvas.font = "bold " + fontSize + "px Arial";
        canvas.fillStyle = "#000000";
        canvas.textBaseline = 'top';
        canvas.translate(translateX - marker_width / 2 + 3, translateY + marker_width / 2 + 5 + 3);

        if (aircraft.Reg) {
            canvas.fillText(aircraft.Reg, 2, 2);
        }

        if (aircraft.Call) {
            canvas.fillText(aircraft.Call, 2, fontSize + 2);
        }

        var fromToText;

        if (aircraft.From) {
            var firstWord = aircraft.From.substr(0, aircraft.From.indexOf(" "));
            if (firstWord) {
                fromToText = firstWord;
            }
        }

        if (aircraft.To) {
            var firstWord = aircraft.To.substr(0, aircraft.To.indexOf(" "));
            if (firstWord) {
                fromToText = fromToText + " - " + firstWord;
            }
        }

        if (fromToText) {
            canvas.fillText(fromToText, 2, fontSize * 2 + 2);
        }

        if (aircraft.OpIcao) {
            canvas.fillText(aircraft.OpIcao, 2, fontSize * 3 + 2);
        }

        if (aircraft.Type) {
            canvas.fillText(aircraft.Type, 30, fontSize * 3 + 2);
        }

        canvas.restore();
    }

    /*var text = "";
    if (aircraft.Reg) {
        text = aircraft.Reg;
    }

    if (aircraft.Call) {
        if (text != "") {
            text += " / ";
        }

        text += aircraft.Call;
    }

    if (selected === true) {
        if (text != "") {
            var x = translateX + marker_width / 2 + 5;
            var y = translateY + marker_width / 4 - 6;

            canvas.save();
            canvas.font = "bold 12px Arial";
            canvas.translate(x, y);
            canvas.fillText(text, 0, 0);
            canvas.restore();
        }
    }*/
}

function GetJsonAndDraw() {
    if (ajaxRequestIsRunning === false && mapIsMoving === false) {
        ajaxRequestIsRunning = true;
        var bounds = leaflet_map.getBounds();

        var url = vrsServerUrl + 'AircraftList.json?fNBnd=' + bounds._northEast.lat
            + '&fSBnd=' + bounds._southWest.lat
            + '&fWBnd=' + bounds._southWest.lng
            + '&fEBnd=' + bounds._northEast.lng
            + '&trFmt=fa'; //&refreshTrails=1';

        if (ldv) {
            url += '&ldv=' + ldv;
        }

        console.log(url);

        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState == 4) {
                //ajaxRequestIsRunning = false;

                if (this.status == 200) {
                    var json = JSON.parse(this.responseText);
                    console.log("Aircraft count: " + json.acList.length);

                    UpdateAndDrawAircraftsFromJson(json);

                    ldv = json.lastDv;
                    console.log("Ldv: " + ldv);

                    ajaxRequestIsRunning = false;
                }
            }
        };

        var icaos = [];

        for(i = 0; i < aircrafts.length; i++){
            var aircraft = aircrafts[i];
            if(aircraft.Icao){
                icaos.push(aircraft.Icao);
            }
        }

        xhttp.open("POST", url, true);

        if(icaos && icaos.length > 0){
            var formData = "icaos=" + icaos.join("-");

            xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            //xhttp.setRequestHeader("Content-length", formData.length);

            xhttp.send(formData);
        }
        else{
            xhttp.send();
        }
    }
}

function DrawSelectedAircraft() {
    if (selectedAircraft) {
        ClearAircrafSelectedlCanvas();
        var leafletTopLeftXY = GetLeafletMapTopXY();

        if (mapIsZooming === true) {
            selectedAircraft.PointXY = GetPointXYFromLatLong(selectedAircraft.LatLong, leaflet_map._zoom);
        }

        selectedAircraft.MapX = selectedAircraft.PointXY.X - leafletTopLeftXY.X;
        selectedAircraft.MapY = selectedAircraft.PointXY.Y - leafletTopLeftXY.Y;

        DrawAircraft(selectedAircraft, true);
        // aircraft_cavas_context.save();

        // aircraft_cavas_context.beginPath();
        // aircraft_cavas_context.arc(selectedAircraft.MapX, selectedAircraft.MapY, 20, 0, 2 * Math.PI);
        // aircraft_cavas_context.stroke();

        // aircraft_cavas_context.restore();

        if (selectedAircraft.Trail) {
            ClearAircraftTrailCanvas();
            aircraftTrails_canvas_context.lineWidth = 3;
            aircraftTrails_canvas_context.strokeStyle = "#0039ff";

            aircraftTrails_canvas_context.save();

            aircraftTrails_canvas_context.beginPath();

            for (var i = 0; i < selectedAircraft.Trail.length; i += 4) {
                var pointXY = GetPointXYFromLatLong(new LatLong(selectedAircraft.Trail[i], selectedAircraft.Trail[i + 1]), leaflet_map._zoom);

                var x = pointXY.X - leafletTopLeftXY.X;
                var y = pointXY.Y - leafletTopLeftXY.Y;

                if (i === 0) {
                    aircraftTrails_canvas_context.moveTo(x, y);
                }
                else {
                    aircraftTrails_canvas_context.lineTo(x, y);
                }
            }

            aircraftTrails_canvas_context.stroke();

            aircraftTrails_canvas_context.restore();
        }
    }
}

/* End of functions */