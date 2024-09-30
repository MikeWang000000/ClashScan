// scannerWorker.js
self.onmessage = async function (e) {
    const { port, timeout } = e.data;
    let foundPort = 0;

    const controller = new AbortController();
    const signal = controller.signal;

    async function checkIsClash(port) {
        try {
            const response = await fetch(
                "http://127.0.0.1:" + port,
                { method: "GET", signal: signal }
            );
            const dat = await response.json();
            if (Object.keys(dat).length === 1 && (dat.message === "Unauthorized" || dat.hello)) {
                return true;
            }
            return false;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted');
            }
            return false;
        }
    }

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (await checkIsClash(port)) {
        foundPort = port;
    }

    clearTimeout(timeoutId);
    self.postMessage({ foundPort, port });
};

self.onterminate = function () {
    controller.abort();
};