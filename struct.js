define(function() {

  'use strict';
  
  const fieldDefs = Object.create(null);
  
  function StructFieldDef(name) {
    this.name = name;
  }
  StructFieldDef.prototype = {
    name: undefined,
  };
  
  function StructFactory() {
    this.fieldDefs = Object.create(this.fieldDefs);
    this.fieldOrder = [];
    this.namedFields = Object.create(null);
  }
  StructFactory.prototype = {
    fieldDefs: fieldDefs,
    endian: undefined,
    fieldOrder: undefined,
    namedFields: undefined,
    packed: true,
    padAlignBytes: 1,
    
    field: function(TDef, name) {
      if (typeof TDef === 'string') {
        if (!(TDef in this.fieldDefs)) {
          throw new Error('unknown field def: ' + TDef);
        }
        TDef = this.fieldDefs[TDef];
      }
      else if (!(TDef instanceof StructFieldDef)) {
        throw new TypeError('not a valid field def: ' + TDef);
      }
      const field = TDef;
      if (name) {
        if (name in this.fieldsByName) {
          throw new Error('duplicate field name: ' + name);
        }
        this.fieldOrder.push(name);
        this.namedFields[name] = field;
      }
      else {
        this.fieldOrder.push(field);
      }
      return this;
    },
  };
  
  return {
    FieldDef: StructFieldDef,
    Factory: StructFactory,
    fieldDefs: fieldDefs,
  };

});
