define(function() {

  'use strict';
  
  const fieldDefs = Object.create(null);
  
  function StructFactory() {
    this.fieldDefs = Object.create(this.fieldDefs);
  }
  StructFactory.prototype = {
    fieldDefs: fieldDefs,
  };
  
  return {
    Factory: StructFactory,
    fieldDefs: fieldDefs,
  };

});
