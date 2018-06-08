
requirejs.config({
  waitSeconds: 0,
});

define(['tokentown'], function(tt) {

  'use strict';
  
  window.tt = tt;
  
  console.log('hello world');

});
