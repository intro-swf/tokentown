
requirejs.config({
  waitSeconds: 0,
});

define(['Op'], function(Op) {

  'use strict';
  
  console.log(window.Op = Op);

});
