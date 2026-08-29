const Module = require('./public/giacwasm.js');

Module().then(m => {
    const evaluateGiac = m.cwrap('caseval', 'string', ['string']);
    console.log("diff(x, x) =", evaluateGiac("diff(x, x)"));
    console.log("g(x):=diff(x, x) =", evaluateGiac("g(x):=diff(x, x)"));
    console.log("g(x) =", evaluateGiac("g(x)"));
});
