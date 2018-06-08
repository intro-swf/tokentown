define([], function() {

  function Token() {
  }
  
  function CallToken() {
  }
  CallToken.prototype = Object.create(Token.prototype);
  
  function MethodCallToken() {
  }
  MethodCallToken.prototype = Object.create(CallToken.prototype);

  function FunctionCallToken() {
  }
  FunctionCallToken.prototype = Object.create(CallToken.prototype);
  
  function LookupToken() {
  }
  LookupToken.prototype = Object.create(Token.prototype);

  return {
    Token: Token,
    CallToken: CallToken,
    MethodCallToken: MethodCallToken,
    FunctionCallToken: FunctionCallToken,
    LookupToken: LookupToken,
  };

});
