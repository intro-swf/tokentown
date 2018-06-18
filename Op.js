define(function() {

  'use strict';

  function Op() {
  }
  Op.prototype = {
    length: 0,
    evaluator: function() {
      throw new Error('undefined operation');
    },
    toJSON: function() {
      if (typeof this.name !== 'string') {
        throw new Error('cannot serialize nameless op');
      }
      var list = [this.name];
      for (var i = 0; i < this.length; i++) {
        list.push(this[i]);
      }
      return list;
    },
    getConstantOp: function() {
      const fn = this.evaluator;
      if (!fn.doesNotModify || !fn.doesNotBlock || !fn.isDeterministic) {
        return null;
      }
      if (this.length === 0) return Constant.from(fn.apply(this));
      var values = new Array(this.length);
      for (var i = 0; i < this.length; i++) {
        var c = this[i].getConstantOp();
        if (!c) return null;
        values[i] = c.value;
      }
      return Constant.from(fn.apply(this, values));
    },
    getJSONPrimitiveOrSelf: function() {
      var c = this.getConstantOp();
      return c ? c.getJSONPrimitiveOrSelf() : this;
    },
    simplify: function() {
      return this;
    },
    get hasSideEffects() {
      if (!this.evaluator.doesNotModify || !this.evaluator.doesNotBlock) return true;
      for (var i = 0; i < this.length; i++) {
        if (this[i].hasSideEffects) return true;
      }
      return false;
    },
    comma: function() {
      var ops = Array.prototype.slice.apply(arguments);
      ops.splice(0, 0, this);
      return new Block(ops);
    },
    comma_if: function(ifOp, thenOp) {
      return this.comma(new IfElseIf(ifOp, thenOp));
    },
    call: function() {
      var args = [].slice.apply(arguments);
      for (var i = 0; i < args.length; i++) {
        if (!(args[i] instanceof Op)) {
          args[i] = Constant.from(args[i]);
        }
      }
      return new FunctionCall(this, args);
    },
    methodCall: function(methodName) {
      var args = [].slice.call(arguments, 1);
      for (var i = 0; i < args.length; i++) {
        if (!(args[i] instanceof Op)) {
          args[i] = Constant.from(args[i]);
        }
      }
      return new MethodCall(this, methodName, args);
    },
  };
  
  function Block(ops) {
    for (var i = 0; i < ops.length; i++) {
      this[this.length++] = ops[i];
    }
  }
  Block.prototype = Object.create(Op.prototype);
  Object.assign(Block.prototype, {
    toJSON: function() {
      return Array.prototype.slice.apply(this);
    },
    simplify: function() {
      var i;
      for (i = 0; i < this.length; i++) {
        if (typeof this[i] instanceof Block) break;
        if (!this[i].hasSideEffects && i+1 < this.length) {
          break;
        }
      }
      if (i === this.length) {
        if (i === 0) return Block.EMPTY;
        return this;
      }
      var copy = [];
      for (var i = 0; i < this.length; i++) {
        if (this[i] instanceof Block) {
          copy.splice(copy.length, 0, this[i].simplify());
        }
        else if (this[i].hasSideEffects || i+1 === this.length) {
          copy.push(this[i]);
        }
      }
      switch (copy.length) {
        case 0: return Block.EMPTY;
        case 1:
          copy = copy[0];
          var c = copy.getConstantOp();
          if (c && typeof c.value === 'undefined') return Block.EMPTY;
          return copy;
        default:
          return new Block(copy);
      }
    },
    evaluator: Object.assign(function BLOCK() {
      return arguments[arguments.length-1];
    }, {
      isDeterministic: true,
      doesNotBlock: true,
      doesNotModify: true,
      lazy: function LAZY_BLOCK(lazifier) {
        // pass through lazifier.value unchanged
      },
    }),
  });
  Op.NO_OP = Block.EMPTY = new Block([]);
  
  function Constant(value) {
    this.value = value;
  }
  Constant.prototype = Object.create(Op.prototype);
  Object.assign(Constant.prototype, {
    toJSON: function() {
      return {"c":this.value};
    },
    getConstantOp: function() {
      return this;
    },
    getJSONPrimitiveOrSelf: function() {
      switch (typeof this.value) {
        case 'number':
          if (!isFinite(this.value)) return this;
          if (isNaN(this.value)) return this;
          return this.value;
        case 'boolean':
        case 'string':
          return this.value;
        case 'object':
          if (this.value === null) return null;
          return this;
      }
      return this;
    },
    evaluator: Object.assign(function() {
      return this.value;
    }, {isDeterministic:true, doesNotBlock:true, doesNotModify:true}),
  });
  Constant.TRUE = new Constant(true);
  Constant.FALSE = new Constant(false);
  Constant.NULL = new Constant(null);
  Constant.UNDEFINED = Object.assign(new Constant(void 0), {
    toJSON: function() { return ['undefined']; },
  });
  Constant.ZERO = new Constant(0);
  Constant.ONE = new Constant(1);
  Constant.NAN = Object.assign(new Constant(NaN), {
    toJSON: function() { return ['NaN']; },
  });
  Constant.INFINITY = Object.assign(new Constant(Infinity), {
    toJSON: function() { return ['Infinity']; },
  });
  Constant.NEGATIVE_INFINITY = Object.assign(new Constant(-Infinity), {
    toJSON: function() { return ['-Infinity']; },
  });
  Constant._FIELD = Symbol('constant');
  Constant.from = function(value) {
    switch (typeof value) {
      case 'undefined': return Constant.UNDEFINED;
      case 'boolean': return value ? Constant.TRUE : Constant.FALSE;
      case 'number':
        if (isNaN(value)) return Constant.NAN;
        switch (value) {
          case 0: return Constant.ZERO;
          case 1: return Constant.ONE;
          case +Infinity: return Constant.INFINITY;
          case -Infinity: return Constant.NEGATIVE_INFINITY;
        }
        break;
      case 'object':
        if (value === null) return Constant.NULL;
        if (Constant._FIELD in value) return value[Constant._FIELD];
        break;
    }
    return new Constant(value);
  };
  
  function Read(targetOp, keyOp) {
    this[0] = targetOp;
    this[1] = keyOp;
  }
  Read.prototype = Object.create(Op.prototype);
  Object.assign(Read.prototype, {
    length: 2,
    toJSON: function() {
      const o = this[0].getJSONPrimitiveOrSelf(), k = this[1].getJSONPrimitiveOrSelf();
      if (o instanceof ScopeRead) {
        return {v:o.varName, k:k};
      }
      return {o:o, k:k};
    },
    evaluator: Object.assign(function(target, key) {
      return target[key];
    }, {
      doesNotBlock: true,
    }),
  });
  
  function ScopeRead(scope, varName) {
    this.scope = scope;
    if (typeof varName !== 'string') {
      throw new Error('variable name must be a string');
    }
    this.varName = varName;
  }
  ScopeRead.prototype = Object.create(Op.prototype);
  Object.assign(ScopeRead.prototype, {
    toJSON: function() {
      return {"v":this.varName};
    },
    evaluator: Object.assign(function() {
      if (!this.scope) throw new Error('variable not bound to scope');
      return this.scope[this.varName];
    }, {
      doesNotBlock: true,
      doesNotModify: true, // ! scopes must not allow arbitrary setter functions
    }),
  });
  
  function Write(targetOp, keyOp, operator, rhsOp) {
    this[0] = targetOp;
    this[1] = keyOp;
    this.operator = operator;
    this[2] = rhsOp;
  }
  Write.prototype = Object.create(Op.prototype);
  Object.assign(Write.prototype, {
    length: 3,
    toJSON: function() {
      const o = this[0].getJSONPrimitiveOrSelf(), k = this[1].getJSONPrimitiveOrSelf();
      var json;
      if (o instanceof ScopeRead) {
        json = {v:o.varName, k:k};
      }
      else {
        json = {o:o, k:k};
      }
      json[this.operator] = this[2].getJSONPrimitiveOrSelf();
      return json;
    },
    evaluator: Object.assign(function(target, key, rhs) {
      switch (this.operator) {
        case '=': return target[key] = rhs;
        case '+=': return target[key] += rhs;
        case '-=': return target[key] -= rhs;
        case '/=': return target[key] /= rhs;
        case '*=': return target[key] *= rhs;
        case '%=': return target[key] %= rhs;
        case '&=': return target[key] &= rhs;
        case '^=': return target[key] ^= rhs;
        case '|=': return target[key] |= rhs;
        case '<<=': return target[key] <<= rhs;
        case '>>=': return target[key] >>= rhs;
        case '>>>=': return target[key] >>>= rhs;
        default: throw new Error('unknown write operator: ' + this.operator);
      }
    }, {
      doesNotBlock: true,
    }),
  });
  
  function ScopeWrite(scope, varName, operator, rhsOp) {
    this[0] = Constant.from(scope);
    if (typeof varName !== 'string') {
      throw new Error('variable name must be string');
    }
    this[1] = Constant.from(varName);
    this.operator = operator;
    this[2] = rhsOp;
  }
  ScopeWrite.prototype = Object.create(Write.prototype);
  Object.assign(ScopeWrite.prototype, {
    toJSON: function() {
      var json = {v:this[1].getJSONPrimitiveOrSelf()};
      json[this.operator] = this[2].getJSONPrimitiveOrSelf();
      return json;
    },
  });
  
  function IfElseIf(ops) {
    if (ops.length < 2) {
      throw new Error('IfElseIf requires at least 2 arguments');
    }
    this.length = arguments.length;
    for (var i = 0; i < ops.length; i++) {
      this[i] = ops[i];
    }
  }
  IfElseIf.prototype = Object.create(Op.prototype);
  Object.assign(IfElseIf.prototype, {
    name: 'if',
    else: function(elseOp) {
      if (this.length % 2) throw new Error('else clause already specified');
      return new IfElseIf(Array.prototype.slice.apply(this).concat(elseOp));
    },
    else_if: function(ifOp, thenOp) {
      return this.else(new IfElseIf(ifOp, thenOp));
    },
    evaluator: Object.assign(function IF() {
      for (var i = 0; i < arguments.length; i += 2) {
        if (arguments[i]) return arguments[i+1];
      }
    }, {
      isDeterministic: true,
      doesNotBlock: true,
      doesNotModify: true,
      lazy: function LAZY_IF(lazifier) {
        if (lazifier.i % 2) {
          // this must be a "then" case
          // short-circuit to the end
          lazifier.next_i = lazifier.stop_i;
        }
        else if (!lazifier.value && lazifier.next_i < lazifier.stop_i) {
          // this is a condition that turned out to be false, so
          // skip over the "then" value
          if (++lazifier.next_i === lazifier.stop_i) {
            // no conditions met and there is no "else"
            lazifier.value = void 0;
          }
        }
        else {
          // this must either be a condition or the final "else" case
          // either way, pass through the value and continue
        }
      },
    }),
  });
  
  function FunctionCall(targetOp, argOps) {
    argOps = argOps || [];
    this.length = 1 + argOps.length;
    this[0] = targetOp;
    for (var i = 0; i < argOps.length; i++) {
      this[1+i] = argOps[i];
    }
  }
  FunctionCall.prototype = Object.create(Op.prototype);
  Object.assign(FunctionCall.prototype, {
    toJSON: function() {
      var args = [];
      for (var i = 1; i < this.length; i++) {
        args.push(this[i].getJSONPrimitiveOrSelf());
      }
      if (this[0] instanceof ScopeRead) {
        args.splice(0, 0, this[0].varName);
        return args;
      }
      else {
        var json = {o:this[0].getJSONPrimitiveOrSelf(), '()':args};
      }
      return json;
    },
    evaluator: function(func, a, b, c) {
      switch (arguments.length) {
        case 1: return func();
        case 2: return func(a);
        case 3: return func(a, b);
        case 4: return func(a, b, c);
        default: return func.apply(null, Array.slice.call(arguments, 1));
      }
    },
  });
  
  function MethodCall(targetOp, methodName, argOps) {
    argOps = argOps || [];
    this.length = 1 + argOps.length;
    this.methodName = methodName;
    this[0] = targetOp;
    for (var i = 0; i < argOps.length; i++) {
      this[1+i] = argOps[i];
    }
  }
  MethodCall.prototype = Object.create(Op.prototype);
  Object.assign(MethodCall.prototype, {
    toJSON: function() {
      var args = [];
      for (var i = 1; i < this.length; i++) {
        args.push(this[i].getJSONPrimitiveOrSelf());
      }
      if (this[0] instanceof ScopeRead) {
        return {v:this[0].varName, k:this.methodName, '()':args};
      }
      return {o:this[0].getJSONPrimitiveOrSelf(), k:this.methodName, '()':args};
    },
    evaluator: function(target) {
      return target[this.methodName].apply(target, Array.prototype.slice.call(arguments, 1));
    },
  });
  
  return Object.assign(Op, {
    Block: Block,
    Constant: Constant,
    Read: Read,
    Write: Write,
    ScopeRead: ScopeRead,
    ScopeWrite: ScopeWrite,
    IfElseIf: IfElseIf,
    FunctionCall: FunctionCall,
    MethodCall: MethodCall,
  });

});
