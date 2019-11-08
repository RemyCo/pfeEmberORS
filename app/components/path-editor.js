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
  // Keep track of the indexes of the start of the different segments of the polylines
  previousIndex: [],

  isEnabled: computed('polyline.@each.lat', 'polyline.@each.lon', function () {
    if (this.get('polyline').length > 1){
      return false;
    } else {
      return true;
    }
  }),

 // Compute the full distance for the polyline by summing the distance of each segment
  distance: computed('polyline.@each.lat', 'polyline.@each.lon', function () {
    return this.get('polyline').map(t => (t.dist)).reduce(function(a,b) {return a+b;},0.0);
  }),

  startPoint: computed('polyline', function () {
    return this.get('polyline').get('firstObject');
  }),

  actions: {
    // The different action are rather self explanatory
    updateCenter(e) {
      let center = e.target.getCenter();
      this.set('lat', center.lat);
      this.set('lng', center.lng);
    },
    deleteAll() {
        this.set("polyline", A([]));
        this.set('firstClick', false);
      },
    deleteLastPoint() {
      this.get("polyline").popObject();
    },
    deleteLastSegment() {
      if (this.get("previousIndex").length > 0) {
        this.set("polyline", this.get("polyline").slice(0, this.get('previousIndex').pop()));
      }
    },
    updatePolyline(e) {
      let url;
      let ctx = this;
      if (!this.get("firstClick")) {
        url = "/nearest/v1/biking/"+e.latlng.lng+","+e.latlng.lat+"?number=1";
        fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data){
          if (data.code == "Ok") {
            ctx.get("polyline").pushObject({
              lat: data.waypoints[0].location[1],
              lon: data.waypoints[0].location[0],
              alt: 0
            });
            ctx.set("firstClick", true);
          }
        });
      } else {
        let prevLat = this.get('polyline').objectAt(ctx.get('polyline').length-1).lat;
        let prevLon = this.get('polyline').objectAt(ctx.get('polyline').length-1).lon;
        // Calling OSRM for a polyline segment joining the given two coordinates
        url = "/route/v1/biking/"+prevLon+","+prevLat+";"+e.latlng.lng+","+e.latlng.lat+"?steps=true&geometries=geojson";
        console.log(url);
        fetch(url)
          .then(function(response) { return response.json(); })
          .then(function(data){
            console.log(data);
          if (data.code == "Ok") {
            ctx.get('previousIndex').push(ctx.get('polyline').length+1);
            // Only consider the first route
            let dist = data.routes[0].legs[0].distance;
            console.log(dist);
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
          }
        });
      }
    },
    textChooseAddress(text){
      let url;
      url = "http://nominatim.openstreetmap.org/search?q="+text.replace(" ", "+")+"&format=xml&polygon=1&addressdetails=1";
      fetch(url)
      .then(function(response) { return response.json(); })
      .then(function(data){
        lat: data.lat;
        lon: data.lon;
      }
    },
  },
});