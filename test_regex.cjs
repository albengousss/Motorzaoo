const str = 'g(x)=Derivative(x,x)'; 
const regex = /^(?:([a-zA-Z_][a-zA-Z0-9_\{\}]*(?:\([a-zA-Z_]\))?)=)?([A-Za-z]+)\((.*)\)$/;
console.log(str.match(regex));
