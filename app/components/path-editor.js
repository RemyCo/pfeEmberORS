import Ember from 'ember';
import { computed } from '@ember/object';
import { A } from '@ember/array';
import Component from '@ember/component';


export default Component.extend({
 // Inject the services containing the haversine formula
  geoUtils: Ember.inject.service('geo-utils'),

  // Attributes binding the center of the map and its zoom
  lat: 47.494620,
  lng: -0.552049,
  zoom: 15,
  // Ember array containing the polyline to be displayed on top of the map
  polyline: A([]),
  // Boolean indicating if the target for next action is the starter marker or a polyline
  firstClick: false,
  lastClick: false,
  // Keep track of the indexes of the start of the different segments of the polylines
  previousIndex: [],

  firstAddress: "",
  secondAddress: "",

  firstAddressLat: 0,
  firstAddressLon: 0,

  preference: "fastest",
  profile: "cycling-regular",

  tileUrl: "http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",

  isEnabled: computed('polyline.@each.lat', 'polyline.@each.lon', function () {
    if (this.get('polyline').length > 1){
      return false;
    } else {
      return true;
    }
  }),

 // Compute the full distance for the polyline by summing the distance of each segment
  distance: 0,
  duration: 0,

  startPoint: computed('polyline', function () {
    return this.get('polyline').get('firstObject');
  }),

  endPoint: computed('polyline', function () {
    return this.get('polyline').get('lastObject');
  }),
  middlePoint: computed('polyline', function () {
    return this.get('polyline').objectAt(Math.round(this.get('polyline').length/2));
  }),

  actions: {
    // The different action are rather self explanatory
    updateCenter(e){
      let center = e.target.getCenter();
      this.set('lat', center.lat);
      this.set('lng', center.lng);
    },

    deleteAll() {
      this.set("polyline", A([]));
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

    updatePolyline(e) {
      let url;
      let ctx = this;
      if (!this.get("firstClick")) {
        ctx.get("polyline").pushObject({
          lat: e.latlng.lat,
          lon: e.latlng.lng,
          alt: 0
        });
        ctx.set("firstClick", true);
      } else if (!this.get("lastClick")){
        let prevLat = this.get('polyline').objectAt(ctx.get('polyline').length-1).lat;
        let prevLon = this.get('polyline').objectAt(ctx.get('polyline').length-1).lon;
        let preference = this.get('preference');
        let profile = this.get('profile');
        // Calling ORS for a polyline segment joining the given two coordinates
        url = "/ors/routes/?profile=" + profile + "&coordinates="+prevLon+","+prevLat+"|"+e.latlng.lng+","+e.latlng.lat+"&format=geojson&preference=" + preference + "&language=fr";
        fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            ctx.get('previousIndex').push(ctx.get('polyline').length+1);
            // Only consider the first route
            ctx.set("distance", data.features[0].properties.summary[0].distance);
            ctx.set("duration", data.features[0].properties.summary[0].duration);
            for (var i = 1; i < data.features[0].geometry.coordinates.length; i++) {
              // Compute distance between coordinates
              /*
              let dist = this.geoUtils.haversine(prevLat, prevLon,
                data.features[0].geometry.coordinates[i][1], data.features[0].geometry.coordinates[i][0]);
                */
              ctx.get("polyline").pushObject({
                lat: data.features[0].geometry.coordinates[i][1],
                lon: data.features[0].geometry.coordinates[i][0],
                alt: 0,
              });
              prevLat = data.features[0].geometry.coordinates[i][1];
              prevLon = data.features[0].geometry.coordinates[i][0];
            }
            //ctx.set("secondAddress", data.waypoints[1].name);
            ctx.set("lastClick", true);
        });
      }
    },
    // On Nominatim, we are able to make a request every seconds, so we can't have a research at the same time for the 2 addresses
    searchFirstAddress(){
      let ctx = this;
      if (!this.get("firstClick")){
        let url1 = "https://nominatim.openstreetmap.org/search?q=" + this.firstAddress + "&format=json&polygon=1&addressdetails=1";
        let latitude, longitude;
        fetch(url1)             // Nomintatim does not work on Safari because of CORS
        .then(function(response) { return response.json(); })
        .then(function(data){
          let url = "/nearest/v1/biking/"+data[0].lon+","+data[0].lat+"?number=1";
          fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            if (data.code == "Ok") {
              latitude = data.waypoints[0].location[1];
              longitude = data.waypoints[0].location[0]
              ctx.get("polyline").pushObject({
                lat: latitude,
                lon: longitude,
                alt: 0
              });
            ctx.set("firstClick", true);
            ctx.set("lat", latitude);
            ctx.set("lng", longitude);
            }
          });
        });
      }
      else {
        this.set("polyline", A([]));
        this.set('firstClick', false);
        this.set('lastClick', false);
        if (!this.get("firstClick")){
          let url1 = "https://nominatim.openstreetmap.org/search?q=" + this.firstAddress + "&format=json&polygon=1&addressdetails=1";
          let latitude, longitude;
          fetch(url1)             // Nomintatim does not work on Safari because of CORS
          .then(function(response) { return response.json(); })
          .then(function(data){
            let url = "/nearest/v1/biking/"+data[0].lon+","+data[0].lat+"?number=1";
            fetch(url)
            .then(function(response) { return response.json(); })
            .then(function(data){
              if (data.code == "Ok") {
                latitude = data.waypoints[0].location[1];
                longitude = data.waypoints[0].location[0]
                ctx.get("polyline").pushObject({
                  lat: latitude,
                  lon: longitude,
                  alt: 0
                });
              ctx.set("firstClick", true);
              ctx.set("lat", latitude);
              ctx.set("lng", longitude);
              }
            });
          });
        }
      }
    },

    searchSecondAddress(){
      let ctx = this;
      if (this.get("firstClick")){
        if (!ctx.get("lastClick")){
          let url2 = "https://nominatim.openstreetmap.org/search?q=" + this.secondAddress + "&format=json&polygon=1&addressdetails=1";
          fetch(url2)             // Nomintatim does not work on Safari because of CORS
          .then(function(response) { return response.json(); })
          .then(function(data){
            let prevLat = ctx.get('polyline').objectAt(ctx.get('polyline').length-1).lat;
            let prevLon = ctx.get('polyline').objectAt(ctx.get('polyline').length-1).lon;
            // Calling OSRM for a polyline segment joining the given two coordinates
            let url = "/route/v1/biking/"+prevLon+","+prevLat+";"+data[0].lon+","+data[0].lat+"?steps=true&geometries=geojson";
            fetch(url)
              .then(function(response) { return response.json(); })
              .then(function(data){
              if (data.code == "Ok") {
                ctx.get('previousIndex').push(ctx.get('polyline').length+1);
                // Only consider the first route
                let dist = data.routes[0].legs[0].distance;
                let dur = data.routes[0].duration;
                for (var i = 1; i < data.routes[0].geometry.coordinates.length; i++) {
                  // Compute distance between coordinates
                  /*
                  let dist = this.geoUtils.haversine(prevLat, prevLon,
                    data.routes[0].geometry.coordinates[i][1], data.routes[0].geometry.coordinates[i][0]);
                    */
                  ctx.get("polyline").pushObject({
                    lat: data.routes[0].geometry.coordinates[i][1],
                    lon: data.routes[0].geometry.coordinates[i][0],
                    alt: 0,
                    dist:dist,
                    dur:dur
                  });
                  prevLat = data.routes[0].geometry.coordinates[i][1];
                  prevLon = data.routes[0].geometry.coordinates[i][0];
                }
              ctx.set("lastClick", true);
              }
            });
          });
        } else {
          ctx.set("polyline", A([ctx.get("polyline").firstObject]));
          ctx.set("lastClick", false);
          ctx.send("searchSecondAddress");
        }
      }
    },
  },
});