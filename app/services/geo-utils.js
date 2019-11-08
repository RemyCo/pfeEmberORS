// app/services/geo-utils.js
import Ember from 'ember';
import Service from '@ember/service';

export default Service.extend({
 // Implementation of the Haversine formula: https://en.wikipedia.org/wiki/Haversine_formula
 haversine(lat1, lon1, lat2, lon2) {
     let AVERAGE_RADIUS_OF_EARTH_METER = 6371000.0;

     let dLat = Math.PI*(lat1 - lat2)/180.0;
     let dLon = Math.PI*(lon1 - lon2)/180.0;

     let a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0)
       + Math.cos(Math.PI*lat1/180.0) * Math.cos(Math.PI*lat2/180.0) * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

     let c = 2.0*Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

     let dist = Math.round(AVERAGE_RADIUS_OF_EARTH_METER * c);
     return dist;
   }
});