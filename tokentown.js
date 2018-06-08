define([], function() {

  'use strict';
  
  function Token() {
  }
  
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
  
  return {
    Token: Token,
    CallToken: CallToken,
    MethodCallToken: MethodCallToken,
    FunctionCallToken: FunctionCallToken,
    LookupToken: LookupToken,
    Scope: Scope,
  };

});
