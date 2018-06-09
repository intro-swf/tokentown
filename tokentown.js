define([], function() {

  'use strict';
  
  const NULL_ITER = function*(){};
  
  function LazyEvaluator(initialValue, valueCount) {
    this.value = initialValue;
    this.stop_i = valueCount;
  }
  LazyEvaluator.prototype = {
    i: 0,
    next_i: 1,
  };

  function Scope() {
    this.entryTypes = Object.create(null);
    this.constantEntries = Object.create(null);
  }
  Scope.prototype = {
    enclose: function(token) {
      if (!token.isOpen) return token;
      if (token instanceof ScopeAccessToken && token.scope === null && token.name in this.entryTypes) {
        if (token.name in this.constantEntries) return this.constantEntries[token.name];
        return token.bindScope(this);
      }
      var tokens = [];
      var anyClosed = false;
      for (var sub of token.eachToken()) {
        var enclosed = this.enclose(sub);
        tokens.push(enclosed);
        anyClosed = anyClosed || (enclosed !== sub);
      }
      if (anyClosed) return token.withTokens(tokens);
      return token;
    },
  };
  
  function Token() {
  }
  Token.prototype = {
    isOpen: false,
    eachToken: function() {
      throw new Error('NYI');
    },
    withTokens: function() {
      throw new Error('NYI');
    },
    get isImmediate() {
      for (var token of this.eachToken()) {
        if (!token.isImmediate) return false;
      }
      return true;
    },
    get isStateless() {
      for (var token of this.eachToken()) {
        if (!token.isStateless) return false;
      }
      return true;
    },
    get isSideEffectFree() {
      for (var token of this.eachToken()) {
        if (!token.isSideEffectFree) return false;
      }
      return true;
    },
  };
  
  function ScopeAccessToken(scope, name) {
    if (typeof name !== 'string') throw new Error('name must be a string');
    if (!/^\S+$/.test(name)) throw new Error('name must contain at least 1 character and no whitespace');
    this.name = name;
    if (scope) this.scope = scope;
  }
  ScopeAccessToken.prototype = Object.create(Token.prototype);
  Object.assign(ScopeAccessToken.prototype, {
    scope: null,
  });
  Object.defineProperties(ScopeAccessToken.prototype, {
    isOpen: {
      get: function() {
        return this.scope === null;
      },
    },
  });
  
  function ScopeLookupToken(scope, name) {
    ScopeAccessToken.apply(this, arguments);
  }
  ScopeLookupToken.prototype = Object.create(ScopeAccessToken.prototype);
  Object.assign(ScopeLookupToken.prototype, {
    eachToken: NULL_ITER,
    bindScope: function(scope) {
      return new ScopeLookupToken(scope, this.name);
    },
    isSideEffectFree: true,
  });
  
  function ScopeAssignToken(scope, name, op, value) {
    ScopeAccessToken.call(this, scope, name);
    this.operator = op;
    this.value = value;
  }
  ScopeAssignToken.prototype = Object.create(ScopeAccessToken.prototype);
  Object.assign(ScopeAssignToken.prototype, {
    operator: '=',
    eachToken: function*() {
      if (this.value instanceof Token) yield this.value;
    },
    withTokens: function(tokens) {
      return new ScopeAssignToken(this.scope, this.name, this.operator, tokens[0]);
    },
    bindScope: function(scope) {
      return new ScopeAssignToken(scope, this.name, this.operator, this.value);
    },
  });
  Object.defineProperties(ScopeAssignToken.prototype, {
    isImmediate: {
      get: function() {
        if (this.value instanceof Token && !this.value.isImmediate) return false;
        return true;
      },
      enumerable: true,
    },
    isStateless: {
    },
  });
  
  function IndexAccessToken(object, index) {
    this.object = object;
    this.index = index;
  }
  IndexAccessToken.prototype = Object.create(Token.prototype);
  Object.assign(IndexAccessToken.prototype, {
    eachToken: function*() {
      if (this.object instanceof Token) yield this.object;
      if (this.index instanceof Token) yield this.index;
    },
  });
  
  function IndexLookupToken(object, index) {
    IndexAccessToken.apply(this, arguments);
    this.object = object;
    this.index = index;
  }
  IndexLookupToken.prototype = Object.create(IndexAccessToken.prototype);
  Object.assign(IndexLookupToken.prototype, {
    withTokens: function(tokens) {
      if (tokens.length === 2) {
        return new IndexLookupToken(tokens[0], tokens[1]);
      }
      else if (this.object instanceof Token) {
        return new IndexLookupToken(tokens[0], this.index);
      }
      else {
        return new IndexLookupToken(this.object, tokens[0]);
      }
    }
  });
  Object.defineProperties(IndexLookupToken.prototype, {
    isImmediate: {
      get: function() {
        if (this.object instanceof Token && !this.object.isImmediate) return false;
        if (this.index instanceof Token && !this.index.isImmediate) return false;
        return true;
      },
      enumerable: true,
    },
  });

  function IndexAssignToken(object, index) {
    IndexAssignToken.apply(this, arguments);
    this.object = object;
    this.index = index;
  }
  IndexLookupToken.prototype = Object.create(IndexAccessToken.prototype);
  Object.assign(IndexLookupToken.prototype, {
    withTokens: function(tokens) {
      if (tokens.length === 2) {
        return new IndexLookupToken(tokens[0], tokens[1]);
      }
      else if (this.object instanceof Token) {
        return new IndexLookupToken(tokens[0], this.index);
      }
      else {
        return new IndexLookupToken(this.object, tokens[0]);
      }
    }
  });

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
    Scope: Scope,
    Token: Token,
    CallToken: CallToken,
    MethodCallToken: MethodCallToken,
    FunctionCallToken: FunctionCallToken,
    LookupToken: LookupToken,
  };

});
