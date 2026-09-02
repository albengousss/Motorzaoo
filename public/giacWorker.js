// Web Worker para o Giac WebAssembly
let isReady = false;
const queryQueue = [];

self.Module = {
    onRuntimeInitialized: function() {
        isReady = true;
        self.postMessage({ type: 'READY' });
        processQueue();
    },
    print: function(text) {
        console.log('[Giac Worker]', text);
    },
    printErr: function(text) {
        console.warn('[Giac Worker Err]', text);
    }
};

try {
    importScripts('/giacwasm.js');
} catch (e) {
    console.error('[Giac Worker] Falha ao carregar giacwasm.js:', e);
}

// Fallback caso onRuntimeInitialized não dispare
const pollInterval = setInterval(() => {
    if (!isReady && self.Module && (typeof self.Module.cwrap === 'function' || typeof self.Module._caseval === 'function')) {
        isReady = true;
        self.postMessage({ type: 'READY' });
        clearInterval(pollInterval);
        processQueue();
    } else if (isReady) {
        clearInterval(pollInterval);
    }
}, 300);

function executeGiac(query) {
    const m = self.Module;
    if (!m) return 'Erro: Módulo Giac indisponível';
    try {
        if (typeof m.cwrap === 'function') {
            const evaluateGiac = m.cwrap('caseval', 'string', ['string']);
            return evaluateGiac(query);
        } else if (typeof m._caseval === 'function') {
            const ptr = m.allocate(m.intArrayFromString(query), 'i8', 0);
            const resPtr = m._caseval(ptr);
            const res = m.UTF8ToString(resPtr);
            m._free(ptr);
            return res;
        } else {
            return 'Erro: Função caseval não encontrada';
        }
    } catch (err) {
        return `Erro: ${err && err.message ? err.message : String(err)}`;
    }
}

function processQueue() {
    while (queryQueue.length > 0) {
        const item = queryQueue.shift();
        const result = executeGiac(item.query);
        self.postMessage({ id: item.id, result });
    }
}

self.onmessage = function(e) {
    const data = e.data;
    if (!data || !data.id) return;
    
    if (!isReady) {
        queryQueue.push(data);
        return;
    }

    const result = executeGiac(data.query);
    self.postMessage({ id: data.id, result });
};
