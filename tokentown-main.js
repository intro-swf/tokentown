
requirejs.config({
  waitSeconds: 0,
});

define([
  'BlottoParser'
  ,'Struct'
],
function(
  BlottoParser
  ,Struct
) {

  'use strict';
  
  window.BlottoParser = BlottoParser;
  window.Struct = Struct;
  
  /*
  var JC = new Struct.Def('JClass', {endian:'big', charset:'x-modified-utf-8'})
    .signature('CAFEBABE', 'hex32')
    .field('versionMinor', 'u16')
    .field('versionMajor', 'u16')
    .field('constants.length', 'u16')
    .sequence('constants',
      new Struct.Def('JConstant')
        .field('type', new Struct.Enum('JConstantType', 'u8', {
          STRING_DATA: 1,
          INT32: 3,
          FLOAT32: 4,
          INT64: 5,
          FLOAT64: 6,
          CLASS: 7,
          STRING: 8,
          FIELD_REF: 9,
          METHOD_REF: 10,
          INTERFACE_METHOD_REF: 11,
          NAME_AND_TYPE: 12,
          METHOD_HANDLE: 15,
          METHOD_TYPE: 16,
          INVOKE_DYNAMIC: 18,
        }))
        .beginSwitch('type')
          .beginCase('STRING_DATA')
            .field('u16', 'value.length')
            .field('string', 'value')
          .end()
          .beginCase('INT32')
            .field('i32', 'value')
          .endCase()
          .beginCase('FLOAT32')
            .field('f32', 'value')
          .endCase()
          .beginCase('INT64')
            .field('i64', 'value')
          .endCase()
          .beginCase('FLOAT64')
            .field('f64', 'value')
          .endCase()
          .beginCase('CLASS')
            .field('u16', 'name_i')
          .endCase()
          .beginCase('STRING')
            .field('u16', 'data_i')
          .endCase()
        .end()
        .finalize()
    )
    .finalize();
    */

});
