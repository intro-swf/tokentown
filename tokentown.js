define([], function() {

  'use strict';
  
  function Token() {
  }
  Token.prototype = {
    eachToken: function() {
      throw new Error('NYI');
    },
    withTokens: function() {
      throw new Error('NYI');
    },
  };
  
  function Scope() {
    this.entryTypes = Object.create(null);
    this.constantEntries = Object.create(null);
  }
  Scope.prototype = {
    enclose: function(token) {
      if (!token.isOpen) return token;
      var tokens = [];
      var anyClosed = false;
      for (var sub of token.eachToken()) {
        var enclosed = this.enclose(sub);
        tokens.push(enclosed);
        if (enclosed !== sub) anyClosed = true;
      }
      if (!anyClosed) return token.withTokens(tokens);
      return token;
    },
  };
  
  function CallToken() {
  }
  CallToken.prototype = Object.create(Token.prototype);
  
  function MethodCallToken(targetObject, targetMethodName, parameters) {
    this.targetObject = targetObject;
    this.targetMethodName = targetMethodName;
    this.parameters = [].slice.apply(parameters || []);
  }
  MethodCallToken.prototype = Object.create(CallToken.prototype);

  function FunctionCallToken(targetFunction, parameters) {
    this.targetFunction = targetFunction;
    this.parameters = [].slice.apply(parameters || []);
  }
  FunctionCallToken.prototype = Object.create(CallToken.prototype);
  
  function LookupToken() {
  }
  LookupToken.prototype = Object.create(Token.prototype);
  
  function Scope() {
    this.entryTypes = Object.create(null);
    this.constantEntries = Object.create(null);
  }
  
  function and() {
    var value = true;
    for (var i = 0; i < arguments.length; i++) {
      value = value && arguments[i];
      if (!value) break;
    }
    return value;
  }
  and.lazy = function(obj) {
    if (!obj.value) {
      obj.next_i = obj.stop_i;
    }
    return obj.value;
  };
  
  function or() {
    var value = false;
    for (var i = 0; i < arguments.length; i++) {
      value = value || arguments[i];
      if (value) break;
    }
    return value;
  }
  or.lazy = function(obj) {
    if (obj.value) {
      obj.next_i = obj.stop_i;
    }
    return obj.value;
  };
  
  function conditional(condition, thenValue, elseValue) {
    return condition ? thenValue : elseValue;
  }
  conditional.lazy = function(obj) {
    if (obj.next_i > 1) obj.next_i = obj.stop_i;
    else if (!obj.value) obj.next_i = 2;
  }
  
  function valueSwitch(value) {
    if (arguments.length % 2) {
      const default_i = arguments.length-1;
      for (var i = 1; i < default_i; i += 2) {
        if (value === arguments[i]) return arguments[i+1];
      }
      return arguments[default_i];
    }
    else {
      for (var i = 1; i < arguments.length; i += 2) {
        if (value === arguments[i]) return arguments[i+1];
      }
      // no default case
      return void 0;
    }
  }
  valueSwitch.lazy = function(obj) {
    const theValue = obj.value;
    obj.func = function(obj) {
      if (obj.next_i === obj.stop_i) return obj.value;
      else if (obj.value === theValue) {
        obj.func = function(obj) { return obj.value; };
      }
      else obj.next_i++;
    };
  }
  
  return {
    Token: Token,
    CallToken: CallToken,
    MethodCallToken: MethodCallToken,
    FunctionCallToken: FunctionCallToken,
    LookupToken: LookupToken,
    Scope: Scope,
  };

});
