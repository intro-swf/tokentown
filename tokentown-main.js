
requirejs.config({
  waitSeconds: 0,
});

define(['BlottoParser'], function(BlottoParser) {

  'use strict';
  
  console.log(window.BlottoParser = BlottoParser);

});
