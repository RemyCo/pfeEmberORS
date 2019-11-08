import Ember from 'ember';
export default Ember.Component.extend({
 // Inject the services containing the haversine formula
 geoUtils: Ember.inject.service('geo-utils'),

 // Attributes binding the center of the map and its zoom
 lat: 48.874885,
 lng: 2.291342,
 zoom: 16,
 // Ember array containing the polyline to be displayed on top of the map
 polyline: Ember.A([]),
 // Boolean indicating if the target for next action is the starter marker or a polyline
 firstClick: false,
 // Keep track of the indexes of the start of the different segments of the polylines
 previousIndex: [],

 isEnabled: Ember.computed('polyline.@each.lat', 'polyline.@each.lon', function () {
   if (this.get('polyline').length > 1){
     return false;
   } else {
     return true;
   }
 }),

 // Compute the full distance for the polyline by summing the distance of each segment
 distance: Ember.computed('polyline.@each.lat', 'polyline.@each.lon', function () {
   return this.get('polyline').map(t => (t.dist)).reduce(function(a,b) {return a+b;},0.0);
 }),

 startPoint: Ember.computed('polyline', function () {
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
       this.set("polyline", Ember.A([]));
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
         var response = {"code":"Ok","waypoints":[{"nodes":[1085865240,497166046],"location":[-0.534363,46.36166],"name":"","distance":245420.384406,"hint":"2JAVgIycAoAAAAAA_AAAAAAAAAD5EgAAAAAAANQdqEIAAAAARNXKRAAAAAD8AAAAAAAAAPkSAAASAAAApdj3_zxswwJ8cyQA7Yi2AgAAHxLjV4Xe"}]};
       // Calling OSRM for nearest road from the given coordinates
         if (response.code == "Ok") {
           ctx.get("polyline").pushObject({
             lat: response.waypoints[0].location[1],
             lon: response.waypoints[0].location[0],
             alt: 0,
             dist: 0
           });
           ctx.set("firstClick", true);
         }
     } else {
       let prevLat = this.get('polyline').objectAt(ctx.get('polyline').length-1).lat;
       let prevLon = this.get('polyline').objectAt(ctx.get('polyline').length-1).lon;
       // Calling OSRM for a polyline segment joining the given two coordinates
       url = "/route/v1/driving/"+prevLon+","+prevLat+";"+e.latlng.lng+","+e.latlng.lat+"?steps=true&geometries=geojson";
       Ember.$.ajax({
         url: url,
         type: 'GET',
         }).then((response) => {
         if (response.code == "Ok") {
           ctx.get('previousIndex').push(ctx.get('polyline').length+1);
           // Only consider the first route
           for (var i = 1; i < response.routes[0].geometry.coordinates.length; i++) {
             // Compute distance between coordinates
             let dist = this.get("geoUtils").haversine(prevLat, prevLon,
               response.routes[0].geometry.coordinates[i][1], response.routes[0].geometry.coordinates[i][0]);
             ctx.get("polyline").pushObject({
               lat: response.routes[0].geometry.coordinates[i][1],
               lon: response.routes[0].geometry.coordinates[i][0],
               alt: 0,
               dist:dist
             });
             prevLat = response.routes[0].geometry.coordinates[i][1];
             prevLon = response.routes[0].geometry.coordinates[i][0];
           }
         }
       });
     }
   },
 },
});