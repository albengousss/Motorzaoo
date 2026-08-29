const toJS = (node) => {
    if (typeof node === 'number') return node.toString();
    if (typeof node === 'string') {
        const cleanNode = node.trim();
        if (cleanNode === 'x') return 'x'; 
        if (cleanNode === 'y') return 'y';
        return `(scope['${cleanNode}'] || 0)`;
    }
    if (Array.isArray(node)) {
        const op = node[0];
        if (op === 'Add') return `(${toJS(node[1])} + ${toJS(node[2])})`;
        // ...
    }
    return '0';
};

const jsCode = toJS(1);
console.log("jsCode:", jsCode);
const rawFunc = new Function('x', 'y', 'scope', 'funcs', `return ${jsCode};`);
console.log("rawFunc(10, 0, {}, {}):", rawFunc(10, 0, {}, {}));
