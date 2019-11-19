import { computed } from '@ember/object';
import { A } from '@ember/array';
import Component from '@ember/component';


export default Component.extend({

  // Attributes binding the center of the map and its zoom
  lat: 47.494620,
  lng: -0.552049,
  zoom: 15,
  // Ember array containing the polyline to be displayed on top of the map
  polylineRecommended: A([]),
  polylineFastest: A([]),
  polylineShortest: A([]),
  // Boolean indicating if the target for next action is the starter marker or a polyline
  firstClick: false,
  lastClick: false,
  // Keep track of the indexes of the start of the different segments of the polylines
  previousIndex: [],

  firstAddress: "",
  secondAddress: "",

  firstAddressLat: 0,
  firstAddressLon: 0,

  preference: "recommended",
  profile: "cycling-regular",

  tileUrl: "http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",

  isEnabled: computed('polyline.@each.lat', 'polyline.@each.lon', function () {
    if (this.get('polylineRecommended').length > 1){
      return false;
    } else {
      return true;
    }
  }),

  distance: 0,
  duration: 0,

  distanceKm: computed('distance', function () {
    var distance = this.get('distance');
    if (distance < 1000){
      distance = Math.round(distance/10)*10 + " m";  //To have a multipier of 10 for the meters
    } else {
      distance = Math.round(distance /100)/10 + ' km';  //To have just a number after the dot.
    }
    return distance;
  }),

  durationS: computed('duration', function () {
    return Math.round(this.get('duration')/60) + ' min';
  }),

  startPoint: computed('polylineRecommended', function () {
    return this.get('polylineRecommended').get('firstObject');
  }),
  endPoint: computed('polylineRecommended', function () {
    return this.get('polylineRecommended').get('lastObject');
  }),
  middlePoint: computed('polylineRecommended', function () {
    return this.get('polylineRecommended').objectAt(Math.round(this.get('polylineRecommended').length/2));
  }),

  actions: {
    // The different action are rather self explanatory
    updateCenter(e){
      let center = e.target.getCenter();
      this.set('lat', center.lat);
      this.set('lng', center.lng);
    },

    deleteAll() {
      this.set("polylineRecommended", A([]));
      this.set("polylineFastest", A([]));
      this.set("polylineShortest", A([]));
      this.set('firstClick', false);
      this.set('lastClick', false);
      this.set('firstAddress', "");
      this.set('secondAddress', "");
    },
    changeDarkMode(){
      this.set("tileUrl", "http://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png");
    },
    changeGMMode(){
      this.set("tileUrl", "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
    },
    changeNormalMode(){
      this.set("tileUrl", "http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png");
    },

    /*
    deleteLastPoint() {
      this.get("polyline").popObject();
    },
    deleteLastSegment() {
      if (this.get("previousIndex").length > 0) {
        this.set("polyline", this.get("polyline").slice(0, this.get('previousIndex').pop()));
      }
    },
    */

    addPolyline(latitude, longitude, altitude, polyline){
      let ctx = this;
      ctx.get(polyline).pushObject({
        lat: latitude,
        lon: longitude,
        alt: altitude,
      });
    },

    pathCreation(latitude, longitude, preference, profile, polyline){
      let ctx = this;
      let prevLat = this.get(polyline).objectAt(ctx.get(polyline).length-1).lat;
      let prevLon = this.get(polyline).objectAt(ctx.get(polyline).length-1).lon;
      // Calling ORS for a polyline segment joining the given two coordinates
      let url = "http://localhost:8080/ors/routes/?profile=" + profile + "&coordinates="+prevLon+","+prevLat+"|"+longitude+","+latitude+"&format=geojson&preference=" + preference + "&language=fr";
      fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data){
          ctx.get('previousIndex').push(ctx.get(polyline).length+1);
          // Only consider the first route
          ctx.set("distance", data.features[0].properties.summary[0].distance);
          ctx.set("duration", data.features[0].properties.summary[0].duration);
          for (var i = 1; i < data.features[0].geometry.coordinates.length; i++) {
            ctx.send("addPolyline", data.features[0].geometry.coordinates[i][1], data.features[0].geometry.coordinates[i][0],0, polyline);
            prevLat = data.features[0].geometry.coordinates[i][1];
            prevLon = data.features[0].geometry.coordinates[i][0];
          }
          ctx.set("lastClick", true);
       });
    },


    onMapClick(e) {
      let url;
      let ctx = this;
      if (!this.get("firstClick")) {
        url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + e.latlng.lat + "&lon=" + e.latlng.lng + "&zoom=18&addressdetails=1";
        fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            ctx.set("firstAddress", data.display_name);
        });
        ctx.send("addPolyline", e.latlng.lat, e.latlng.lng,0, "polylineRecommended");
        ctx.send("addPolyline", e.latlng.lat, e.latlng.lng,0, "polylineFastest");
        ctx.send("addPolyline", e.latlng.lat, e.latlng.lng,0, "polylineShortest");
        ctx.set("firstClick", true);
      } else if (!this.get("lastClick")){
        url = "https://nominatim.openstreetmap.org/reverse?format=json&lat=" + e.latlng.lat + "&lon=" + e.latlng.lng + "&zoom=18&addressdetails=1";
        let profile = this.get('profile');
        fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            ctx.set("secondAddress", data.display_name);
        });
        ctx.send("pathCreation", e.latlng.lat, e.latlng.lng, "recommended", profile, "polylineRecommended");
        //ctx.send("pathCreation", e.latlng.lat, e.latlng.lng, "shortest", profile, "polylineShortest");
        //ctx.send("pathCreation", e.latlng.lat, e.latlng.lng, "fastest", profile, "polylineFastest");
      }
    },

    // On Nominatim, we are able to make a request every seconds, so we can't have a research at the same time for the 2 addresses
    searchFirstAddress(){
      let ctx = this;
      if (!this.get("firstClick")){
        let url = "https://nominatim.openstreetmap.org/search?q=" + this.firstAddress + "&format=json&polygon=1&addressdetails=1";
        fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data){
          ctx.send("addPolyline", data[0].lat, data[0].lon, 0, "polylineRecommended");
          ctx.send("addPolyline", data[0].lat, data[0].lon, 0, "polylineFastest");
          ctx.send("addPolyline", data[0].lat, data[0].lon, 0, "polylineShortest");
          ctx.set("firstClick", true);
          ctx.set("lat", data[0].lat);
          ctx.set("lng", data[0].lon);
        });
      } else {
        this.set("polylineRecommended", A([]));
        this.set("polylineFastest", A([]));
        this.set("polylineShortest", A([]));
        this.set('firstClick', false);
        this.set('lastClick', false);
        ctx.send("searchFirstAddress");
      }
    },

    searchSecondAddress(){
      let ctx = this;
      if (this.get("firstClick")){
        if (!ctx.get("lastClick")){
          let url = "https://nominatim.openstreetmap.org/search?q=" + this.secondAddress + "&format=json&polygon=1&addressdetails=1";
          fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            let profile = ctx.get('profile');
            // Calling ORS for a polyline segment joining the given two coordinates
            ctx.send("pathCreation", data[0].lat, data[0].lon, "recommended", profile, "polylineRecommended");
            ctx.send("pathCreation", data[0].lat, data[0].lon, "shortest", profile, "polylineShortest");
            ctx.send("pathCreation", data[0].lat, data[0].lon, "fastest", profile, "polylineFastest");
            ctx.set("lastClick", true);
          });
        } else {
          ctx.set("polylineRecommended", A([ctx.get("polylineRecommended").firstObject]));
          ctx.set("polylineFastest", A([ctx.get("polylineFastest").firstObject]));
          ctx.set("polylineShortest", A([ctx.get("polylineShortest").firstObject]));
          ctx.set("lastClick", false);
          ctx.send("searchSecondAddress");
        }
      }
    },
  },
});