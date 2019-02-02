function LatLong(lat, lng) {
    var self = this;

    self.Lat = lat;
    self.Lng = lng;
}

function PointXY(x, y) {
    var self = this;

    self.X = x;
    self.Y = y;
}

function GetRotationInRad(deg) {
    if (deg) {
        return deg * Math.PI / 180;
    }

    return 0;
}

function GetPixelX(longtitude, zoom) {
    return Math.floor(((longtitude + 180) / 360) * 256 * Math.pow(2, zoom));
}

function GetPixelY(latitude, zoom) {
    var sinLatitude = Math.sin(latitude * Math.PI / 180)

    return Math.floor((0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * 256 * Math.pow(2, zoom));
}

function GetPointXYFromLatLong(latLong, zoom) {
    var x = GetPixelX(latLong.Lng, zoom);
    var y = GetPixelY(latLong.Lat, zoom);

    return new PointXY(x, y);
}
