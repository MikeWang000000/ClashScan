// scannerWorker.js
self.onmessage = async function (e) {
    const { port, timeout } = e.data;
    let foundPort = 0;

    async function checkIsClash(port) {
        try {
            const response = await fetch(
                "http://127.0.0.1:" + port,
                { method: "GET", signal: AbortSignal.timeout(timeout) }
            );
            const dat = await response.json();
            if (Object.keys(dat).length === 1 && (dat.message === "Unauthorized" || dat.hello)) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    if (await checkIsClash(port)) {
        foundPort = port;
    }

    self.postMessage({ foundPort, port });
};