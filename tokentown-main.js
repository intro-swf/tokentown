
requirejs.config({
  waitSeconds: 0,
});

define(['tokentown'], function(tt) {

  window.tt = tt;
  
  console.log('hello world');

});
