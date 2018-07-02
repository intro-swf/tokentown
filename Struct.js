define(function() {

  'use strict';
  
  const fieldDefs = Object.create(null);
  
  function Struct() {
    throw new Error('invalid constructor, see documentation');
  }
  Struct.prototype = Object.create(null);
  
  Struct.Object = function StructObject() {
    throw new Error('invalid constructor, see documentation');
  };
  Struct.Object.prototype = Object.create(Struct.prototype, {
  });
  
  Struct.Buffered = function BufferedStructObject() {
    throw new Error('invalid constructor, see documentation');
  };
  Struct.Buffered.prototype = Object.create(Struct.prototype, {
    buffer: {value: null, configurable:true},
    byteOffset: {value: 0, configurable:true},
    byteLength: {value: NaN, configurable:true},
    dv: {
      get: function() {
        var dv = new DataView(this.buffer, this.byteOffset, this.byteLength);
        Object.defineProperty(this, 'dv', {value:dv});
        return dv;
      },
      configurable: true,
    },
    bytes: {
      get: function() {
        var bytes = new Uint8Array(this.buffer, this.byteOffset, this.byteLength);
        Object.defineProperty(this, 'bytes', {value:bytes});
        return bytes;
      },
      configurable: true,
    },
  });
  
  Struct.FieldDef = function StructFieldDef(name, settings) {
    if (!new.target) {
      if (name in fieldDefs) {
        throw new Error('field name in use: ' + name);
      }
      return fieldDefs[name] = new StructFieldDef(name, settings);
    }
    if (typeof name !== 'string' || !/^[a-z_$][a-z_$0-9]*$/i.test(name)) {
      throw new Error('invalid name');
    }
    this.name = name;
    if (settings) Object.assign(this, settings);
  };
  Struct.FieldDef.prototype = Object.create(null, {
    minByteLength: {value:NaN, writable:true, enumerable:true, configurable:true},
    maxByteLength: {value:NaN, writable:true, enumerable:true, configurable:true},
    fixedByteLength: {
      get: function() {
        if (isNaN(this.minByteLength) || !isFinite(this.minByteLength) || this.minByteLength !== this.maxByteLength) {
          return NaN;
        }
        return this.minByteLength;
      },
      set: function(n) {
        this.minByteLength = this.maxByteLength = n;
      },
      enumerable: true,
      configurable: true,
    },
  });
  Object.assign(Struct.FieldDef.prototype, {
    name: undefined,
    endian: undefined,
    charset: 'x-bytestring',
    getDataView: function(buffer, byteOffset) {
      const byteLength = this.fixedByteLength;
      if (!isNaN(byteLength)) {
        return new DataView(buffer, byteOffset, byteLength);
      }
      throw new Error('getDataView not implemented');
    },
    defaultValue: undefined,
    getByteLengthForValue: function(value) {
      const byteLength = this.fixedByteLength;
      if (!isNaN(byteLength)) return byteLength;
      throw new Error('getByteLengthForValue not implemented');
    },
    getValueError: function(value) {
      return null;
    },
    readValue: function(dataView, byteOffset) {
      throw new Error('readValue not implemented');
    },
    writeValue: function(dataView, byteOffset) {
      throw new Error('writeValue not implemented');
    },
    paddingAlignment: 1,
    addObjectPropertyDescriptors: function(obj, name) {
      const symb = Symbol.for(name);
      const valuator = this.getValueError.bind(this);
      obj[symb] = {
        value: this.defaultValue,
        writable: true,
      };
      obj[name] = {
        get: function() {
          return this[symb];
        },
        set: function(v) {
          var e = valuator(v);
          if (e) throw e;
          this[symb] = v;
        },
        enumerable: true,
      };
    },
    addBufferedPropertyDescriptors: function(obj, struct, field_i) {
      if (!(struct instanceof Struct.Def)) {
        throw new Error('generating descriptor requires struct def');
      }
      const name = struct.fieldOrder[field_i];
      if (typeof name !== 'string') {
        throw new Error('generating descriptor requires field name');
      }
      let byteOffset = -1;
      let prevName = null;
      let firstAnon_i = field_i;
      while (firstAnon_i > 0 && typeof struct.fieldOrder[firstAnon_i] === 'object') {
        firstAnon_i--;
      }
      if (firstAnon_i < field_i) {
        if (firstAnon_i === 0) {
          byteOffset = 0;
        }
        else {
          prevName = struct.fieldOrder[firstAnon_i-1];
          const prevOffset = obj['byteOffset<' + prevName + '>'];
          const prevLength = obj['byteLength<' + prevName + '>'];
          if (prevOffset && prevLength && typeof prevOffset.value === 'number' && typeof prevLength.value === 'number') {
            byteOffset = prevOffset.value + prevLength.value;
          }
        }
        let anonLength = 0;
        for (let j = firstAnon_i; j < field_i; j++) {
          const anon = struct.fieldOrder[j];
          const byteLength = anon.fixedByteLength;
          if (isNaN(byteLength)) {
            anonLength = -1;
            break;
          }
          anonLength += byteLength;
        }
        if (byteOffset !== -1 && anonLength !== -1) {
          byteOffset += anonLength;
          obj['byteOffset<'+name+'>'] = {value:byteOffset};
        }
        else {
          obj['byteOffset<'+name+'>'] = {
            get: function() {
              if (byteOffset === -1) {
                byteOffset = this['byteOffset<'+prevName+'>'];
              }
              for (let j = firstAnon_i; j < field_i; j++) {
                const anon = struct.fieldOrder[j];
                const anonLength = anon.fixedByteLength;
                if (!isNaN(anonLength)) {
                  byteOffset += anonLength;
                }
                else {
                  byteOffset += anon.getDataView(this.buffer, byteOffset).byteLength;
                }
              }
              Object.defineProperty(this, 'byteOffset<'+name+'>', {value:byteOffset});
              return byteOffset;
            },
            configurable: true,
          };
        }
      }
      else {
        if (field_i === 0) {
          byteOffset = 0;
          obj['byteOffset<'+name+'>'] = {value:0};
        }
        else {
          prevName = struct.fieldOrder[field_i-1];
          const prevOffset = obj['byteOffset<'+prevName+'>'];
          const prevLength = obj['byteLength<'+prevName+'>'];
          if (prevOffset && prevLength && typeof prevOffset.value === 'number' && typeof prevLength.value === 'number') {
            byteOffset = prevOffset.value + prevLength.value;
            obj['byteOffset<'+name+'>'] = {value:byteOffset};
          }
          else {
            byteOffset = -1;
            obj['byteOffset<'+name+'>'] = {
              get: function() {
                let byteOffset = this['byteOffset<'+prevName+'>'] + this['byteLength<'+prevName+'>'];
                Object.defineProperty(this, 'byteOffset<'+name+'>', {value:byteOffset});
                return byteOffset;
              },
              configurable: true,
            };
          }
        }
      }
      const byteLength = this.fixedByteLength;
      if (isNaN(byteLength)) {
        const fn = this.getDataView.bind(this);
        obj['byteLength<' + name + '>'] = {
          get: function() {
            if (byteOffset === -1) {
              byteOffset = this['byteOffset<' + name + '>'];
            }
            byteLength = fn(this.buffer, byteOffset).length;
            Object.defineProperty(this, 'byteLength<'+name+'>', {value:byteLength});
            return byteLength;
          },
        };
      }
      else {
        obj['byteLength<'+name+'>'] = {value:byteLength};
      }
      const getter = this.readValue.bind(this);
      const setter = this.writeValue.bind(this);
      const valuator = this.getValueError.bind(this);
      obj[name] = {
        get: function() {
          return getter(this.dv, this['byteOffset<'+name+'>']);
        },
        set: function(value) {
          var e = valuator(value);
          if (e) throw e;
          setter(this.dv, this['byteOffset<'+name+'>'], value);
        },
        enumerable: true,
      };
    },
  });
  
  Struct.FieldDef('u8', {
    fixedByteLength: 1,
    defaultValue: 0,
    readValue: function(dv, o) {
      return dv.getUint8(o);
    },
    writeValue: function(dv, o, v) {
      dv.setUint8(o, v);
    },
    getValueError: function(value) {
      if ((value&0xff) !== value) {
        return new Error('invalid u8 value: ' + value);I
      }
      return null;
    },
  });
  
  Struct.FieldDef('i8', {
    fixedByteLength: 1,
    defaultValue: 0,
    readValue: function(dv, o) {
      return dv.getInt8(o);
    },
    writeValue: function(dv, o, v) {
      dv.setInt8(o, v);
    },
    getValueError: function(value) {
      if ((value<<24>>24) !== value) {
        return new Error('invalid i8 value: ' + value);
      }
      return null;
    },
  });
  
  Struct.Def = function StructDef(name, settings) {
    if (!new.target) {
      if (name in fieldDefs) {
        throw new Error('field name in use: ' + name);
      }
      return fieldDefs[name] = new StructDef(name, settings);
    }
    if (typeof name !== 'string' || !/^[a-z_$][a-z_$0-9]*$/i.test(name)) {
      throw new Error('invalid name');
    }
    this.name = name;
    this.fieldDefs = Object.create(this.fieldDefs);
    this.fieldOrder = [];
    this.namedFields = Object.create(this.namedFields);
  };
  Struct.Def.prototype = Object.create(Struct.FieldDef.prototype, {
    minByteLength: {
      get: function() {
        var b = 0;
        for (var i = 0; i < this.fieldOrder.length; i++) {
          var field = this.fieldOrder[i];
          if (typeof field === 'string') {
            field = this.namedFields[field];
          }
          b += field.minByteLength;
        }
        return b;
      },
    },
    maxByteLength: {
      get: function() {
        var b = 0;
        for (var i = 0; i < this.fieldOrder.length; i++) {
          var field = this.fieldOrder[i];
          if (typeof field === 'string') {
            field = this.namedFields[field];
          }
          b += field.maxByteLength;
        }
        return b;
      },
    },
    isFinalized: {
      value: false,
      configurable: true,
    },
    Object: {
      get: function() {
        if (!this.isFinalized) return null;
        function StructObject(src) {
          if (src) {
            if (src instanceof ArrayBuffer) {
              var byteOffset = arguments[1];
              if (isNaN(byteOffset)) byteOffset = 0;
              var byteLength = arguments[2];
              if (isNaN(byteLength)) byteLength = src.byteLength - byteOffset;
              src = new this.struct.Buffered(src, byteOffset, byteLength);
            }
            for (var i = 0; i < this.struct.fieldOrder.length; i++) {
              var field = this.struct.fieldOrder[i];
              if (typeof field === 'string') {
                // TODO: handle recursion into objects
                if (field in src) {
                  this[field] = src[field];
                }
              }
            }
          }
        }
        var properties = {struct:{value:this}};
        for (var k in this.namedFields) {
          this.namedFields[k].addObjectPropertyDescriptors(properties, k);
        }
        StructObject.prototype = Object.create(Struct.Object.prototype, properties);
        var nameProp = Object.getOwnPropertyDescriptor(StructObject, 'name');
        if (nameProp && nameProp.configurable) {
          Object.defineProperty(StructObject, 'name', Object.assign(nameProp, {
            value: this.name + '.Object',
          }));
        }
        Object.defineProperty(this, 'Object', {value:StructObject, enumerable:true});
        return StructObject;
      },
      enumerable: true,
      configurable: true,
    },
    Buffered: {
      get: function() {
        if (!this.isFinalized) return null;
        function BufferedStructObject(src) {
          var buffer, byteOffset, byteLength, setValues=true;
          if (src) {
            if (src instanceof ArrayBuffer) {
              buffer = src;
              byteOffset = arguments[1];
              if (isNaN(byteOffset)) byteOffset = 0;
              byteLength = arguments[2];
              if (isNaN(byteLength)) byteLength = buffer.byteLength - byteOffset;
              setValues = false;
            }
            else if (src instanceof this.struct.Buffered) {
              buffer = new ArrayBuffer(src.byteLength);
              new Uint8Array(buffer).set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
              byteOffset = 0;
              byteLength = buffer.byteLength;
              setValues = false;
            }
            else {
              byteOffset = 0;
              byteLength = 0;
              for (var i = 0; i < this.struct.fieldOrder.length; i++) {
                var field = this.struct.fieldOrder[i];
                if (typeof field === 'string') {
                  var def = this.struct.namedFields[field];
                  byteLength += def.getByteLengthForValue(field in src ? src[field] : def.defaultValue);
                }
                else {
                  byteLength += field.getByteLengthForValue(field.defaultValue);
                }
              }
              buffer = new ArrayBuffer(byteLength);
            }
          }
          else {
            byteOffset = 0;
            byteLength = 0;
            for (var i = 0; i < this.struct.fieldOrder.length; i++) {
              var field = this.struct.fieldOrder[i];
              if (typeof field === 'string') {
                field = this.struct.namedFields[field];
              }
              byteLength += field.getByteLengthForValue(field.defaultValue);
            }
            buffer = new ArrayBuffer(byteLength);
          }
          Object.defineProperty(this, 'buffer', {value:buffer});
          if (byteOffset !== 0) {
            Object.defineProperty(this, 'byteOffset', {value:byteOffset});
          }
          Object.defineProperty(this, 'byteLength', {value:byteLength});
          if (setValues) {
            if (src) {
              for (var i = 0; i < this.struct.fieldOrder.length; i++) {
                var field = this.struct.fieldOrder[i];
                if (typeof field === 'string') {
                  // TODO: complex fields
                  this[field] = field in src ? src[field] : this.struct.namedFields[field].defaultValue;
                }
              }
            }
            else {
              for (var i = 0; i < this.struct.fieldOrder.length; i++) {
                var field = this.struct.fieldOrder[i];
                if (typeof field === 'string') {
                  // TODO: complex fields
                  this[field] = this.struct.namedFields[field].defaultValue;
                }
              }
            }
          }
        }
        var properties = {struct:{value:this}};
        for (var i = 0; i < this.fieldOrder.length; i++) {
          if (typeof this.fieldOrder[i] === 'string') {
            var field = this.namedFields[this.fieldOrder[i]];
            field.addBufferedPropertyDescriptors(properties, this, i);
          }
        }
        BufferedStructObject.prototype = Object.create(Struct.Buffered.prototype, properties);
        var nameProp = Object.getOwnPropertyDescriptor(BufferedStructObject, 'name');
        if (nameProp && nameProp.configurable) {
          Object.defineProperty(BufferedStructObject, 'name', Object.assign(nameProp, {
            value: this.name + '.Buffered',
          }));
        }
        Object.defineProperty(this, 'Buffered', {
          value: BufferedStructObject,
          enumerable: true,
        });
        return BufferedStructObject;
      },
      enumerable: true,
      configurable: true,
    },
    namedFields: {
      value: Object.create(null, {
        // reserved field names
        buffer: {value:null},
        byteOffset: {value:null},
        byteLength: {value:null},
        struct: {value:null},
        bytes: {value:null},
        dv: {value:null},
      }),
      writable: true,
      configurable: true,
      enumerable: true,
    },
    fieldDefs: {
      value: fieldDefs,
      writable: true,
      configurable: true,
      enumerable: true,
    },
  });
  Object.assign(Struct.Def.prototype, {
    endian: undefined,
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
        if (name in this.namedFields) {
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
    finalize: function() {
      if (this.isFinalized) return;
      for (var i = 0; i < this.fieldOrder; i++) {
        var field = this.fieldOrder[i];
        if (typeof field === 'string') {
          field = this.namedFields[field];
        }
        if (field instanceof StructDef && !field.isFinalized) {
          throw new Error('field structs must be finalized before parent struct');
        }
      }
      Object.freeze(this.fieldOrder);
      Object.freeze(this.namedFields);
      Object.defineProperty(this, 'isFinalized', {
        value: true,
      });
      return this;
    },
  });
  
  return Struct;

});
