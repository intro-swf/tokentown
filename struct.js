define(function() {

  'use strict';
  
  const fieldDefs = Object.create(null);
  
  function StructFieldDef(name) {
    this.name = name;
  }
  StructFieldDef.prototype = {
    name: undefined,
    getDataView: function(buffer, byteOffset) {
      const byteLength = this.fixedByteLength;
      if (!isNaN(byteLength)) {
        return new DataView(buffer, byteOffset, byteLength);
      }
      throw new Error('getDataView not implemented');
    },
    readValue: function(dataView, byteOffset) {
      throw new Error('readValue not implemented');
    },
    writeValue: function(dataView, byteOffset) {
      throw new Error('writeValue not implemented');
    },
    minByteLength: NaN,
    maxByteLength: NaN,
    get fixedByteLength() {
      if (isNaN(this.minByteLength) || !this.isFinite(this.minByteLength) || this.minByteLength !== this.maxByteLength) {
        return NaN;
      }
      return this.minByteLength;
    },
    set fixedByteLength(n) {
      this.minByteLength = this.maxByteLength = n;
    },
    paddingAlignment: 1,
    addPropertyDescriptors: function(obj, struct, name) {
      if (!(struct instanceof StructDef)) {
        throw new Error('generating descriptor requires struct def');
      }
      if (typeof name !== 'string') {
        throw new Error('generating descriptor requires field name');
      }
      const i = struct.fieldOrder.indexOf(name);
      if (i === -1) {
        throw new Error('field not found: ' + name);
      }
      let byteOffset = -1;
      let prevName = null;
      let firstAnon_i = i;
      while (firstAnon_i > 0 && typeof struct.fieldOrder[firstAnon_i] === 'object') {
        firstAnon_i--;
      }
      if (firstAnon_i < i) {
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
        for (let j = firstAnon_i; j < i; j++) {
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
              for (let j = firstAnon_i; j < i; j++) {
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
        if (i === 0) {
          byteOffset = 0;
          obj['byteOffset<'+name+'>'] = {value:0};
        }
        else {
          prevName = struct.fieldOrder[i-1];
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
      obj[name] = {
        get: function() {
          return getter(this.dv, this['byteOffset<'+name+'>']);
        },
        set: function(value) {
          setter(this.dv, this['byteOffset<'+name+'>'], value);
        },
      };
    },
  };
  
  fieldDefs.u8 = Object.assign(new StructFieldDef('u8'), {
    fixedByteLength: 1,
    readValue: function(dv, o) {
      return dv.getUint8(o);
    },
    writeValue: function(dv, o, v) {
      dv.setUint8(o, v);
    },
  });
  
  function StructDef(name) {
    this.name = name;
    this.fieldDefs = Object.create(this.fieldDefs);
    this.fieldOrder = [];
    this.namedFields = Object.create(null);
  }
  StructDef.prototype = Object.create(StructFieldDef, {
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
  });
  Object.assign(StructDef.prototype, {
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
  });
  
  return {
    Def: StructDef,
    FieldDef: StructFieldDef,
    fieldDefs: fieldDefs,
  };

});
