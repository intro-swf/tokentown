
requirejs.config({
  waitSeconds: 0,
});

require('tokentown', function(tt) {

  window.tt = tt;
  
  console.log('hello world');

});
