define(function() {

  'use strict';
  
  const DEFAULT_SETTINGS = {members:true, macros:true};
  
  function Scope() {
    Object.defineProperties(this, {
      members: {value: Object.create(null)},
      memberTypes: {value: Object.create(null)},
      macros: {value: Object.create(null)},
      parentScope: {value: null},
    });
  }
  Scope.prototype = {
    defineConstant: function(name, value, type) {
      Object.defineProperty(this.members, name, {
        value: value,
        enumerable: true,
      });
      Object.defineProperty(this.memberTypes, name, {
        value: type,
      });
    },
    declareVariable: function(name, initialValue, type) {
      this.members[name] = initialValue;
      this.memberTypes[name] = type;
    },
    openCount: 0,
    close: function() {
      if (this.openCount) {
        if (this.openCount === -1) return this;
        throw new Error('unable to close scope until ' + this.openCount + ' child scope(s) are closed first');
      }
      Object.seal(this.macros);
      Object.seal(this.functions);
      Object.seal(this.values);
      this.openCount = -1;
      if (this.parentScope) {
        this.parentScope.openCount--;
      }
      return this;
    },
    open: function(settings) {
      settings = settings || DEFAULT_SETTINGS;
      var macros, functions, values;
      if (settings.macros) {
        macros = Object.create(this.macros);
      }
      return Object.defineProperties(Object.create(Scope.prototype), {
        macros: {value:macros},
        functions: {value:functions},
        values: {value:values},
        parentScope: {value:this},
      });
    },
  };
  
  return Scope;

});
