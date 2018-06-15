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
  };
  
  function Block(ops) {
    for (var i = 0; i < ops.length; i++) {
      if (ops[i] instanceof Block) {
        for (var j = 0; j < ops[i].length; j++) {
          this[this.length++] = ops[i][j];
        }
      }
      else this[this.length++] = ops[i];
    }
  }
  Block.prototype = Object.create(Op.prototype);
  Object.assign(Block.prototype, {
    toJSON: function() {
      return Array.prototype.slice.apply(this);
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
    });
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
  
  return Object.assign(Op, {
    Block: Block,
    Constant: Constant,
    Read: Read,
    Write: Write,
    ScopeRead: ScopeRead,
    ScopeWrite: ScopeWrite,
  });

});
