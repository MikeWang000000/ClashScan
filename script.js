if (!AbortSignal.timeout) {
    AbortSignal.timeout = function (ms) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException("TimeoutError")), ms);
        return controller.signal;
    };
}

function range(start, end) {
    return Array.from({ length: end - start }, (v, i) => i + start);
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function guessClashVersion(port) {
    let hasError = false;
    let version = "Clash Core Unknown";
    async function pathExists(path) {
        try {
            const response = await fetch(
                "http://127.0.0.1:" + port + path,
                { method: "GET", signal: AbortSignal.timeout(500) }
            );
            if (response.ok || response.status === 401) {
                return true;
            }
            return false;
        } catch (error) {
            hasError = true;
            return false;
        }
    }
    if (await pathExists("/memory")) {
        version = "Clash Meta Core v1.14.4 ~ Latest (guessed)";
    } else if (await pathExists("/restart")) {
        version = "Clash Meta Core v1.14.3 (guessed)";
    } else if (await pathExists("/dns")) {
        version = "Clash Meta Core v1.14.2 (guessed)";
    } else if (await pathExists("/group")) {
        version = "Clash Meta Core v1.12.0 ~ v1.14.1 (guessed)";
    } else if (await pathExists("/cache")) {
        version = "Clash Meta Core v1.10.0 ~ v1.11.8 (guessed)";
    } else if (await pathExists("/script")) {
        version = "Clash Meta Core v1.9.1 (guessed)";
    } else if (await pathExists("/providers/rules")) {
        version = "Clash Meta Core v1.8.0 ~ v1.9.0 (guessed)";
    } else if (await pathExists("/providers/proxies")) {
        version = "Clash Core v0.17.0 ~ Latest (guessed)";
    } else if (await pathExists("/version")) {
        version = "Clash Core v0.16.0 (guessed)";
    } else {
        version = "Clash Core Unknown";
    }
    if (hasError) {
        version = "Clash Core Unknown";
    }
    return version;
}

async function getClashVersion(port) {
    try {
        const response = await fetch(
            "http://127.0.0.1:" + port + "/version",
            { method: "GET", signal: AbortSignal.timeout(500) }
        );
        const dat = await response.json();
        if (response.ok) {
            let brand = "Clash Core";
            if (dat.meta) {
                brand = "Clash Meta Core";
            } else if (dat.premium) {
                brand = "Clash Core Premium";
            }
            return brand + " " + dat.version;
        }
        return await guessClashVersion(port);
    } catch (error) {
        return "Clash Core Unknown";
    }
}

async function getClashTraffic(port) {
    try {
        const hostlist = [];
        const response = await fetch(
            "http://127.0.0.1:" + port + "/connections",
            { method: "GET", signal: AbortSignal.timeout(500) }
        );
        const dat = await response.json();
        if (Array.isArray(dat.connections)) {
            dat.connections.forEach((conn) => {
                let addr = conn.metadata.host ? conn.metadata.host : conn.metadata.destinationIP;
                let port = parseInt(conn.metadata.destinationPort, 10);
                if (port !== 80 && port !== 443) {
                    addr += (":" + port);
                }
                hostlist.push(addr);
            });
            return hostlist;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getClashProxies(port) {
    try {
        const response = await fetch(
            "http://127.0.0.1:" + port + "/proxies",
            { method: "GET", signal: AbortSignal.timeout(500) }
        );
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        return null;
    }
}

function scanLocalhost(workerNum) {
    window.scanning = true;

    let workerDone = 0;
    let scannedPorts = 0;
    let foundPort = 0;

    const ports = [9090]
        .concat(range(9091, 10000))
        .concat(range(2000, 9090).reverse())
        .concat(range(10000, 65536))
        .concat(range(1, 2000).reverse());

    async function checkIsClash(port) {
        try {
            const response = await fetch(
                "http://127.0.0.1:" + port,
                { method: "GET", signal: AbortSignal.timeout(120) }
            );
            const dat = await response.json();
            if (Object.keys(dat).length === 1 && dat.message === "Unauthorized") {
                return true;
            }
            if (Object.keys(dat).length === 1 && dat.hello) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async function scanLocalhostWorker(n) {
        let i;
        for (i = n; i < ports.length && !foundPort; i += workerNum) {
            let win = await checkIsClash(ports[i]);
            await sleep(5);
            scannedPorts++;
            if (win) {
                foundPort = ports[i];
                break;
            }
        }
        workerDone++;
    }

    async function updateInfoWorker() {
        const commonPortLength = 3200;
        let percentage = 0;

        document.querySelector("#txt_version").innerText = "暂无数据";
        document.querySelector("#txt_hosts").innerHTML = "";
        document.querySelector("#div_hosts").style.display = "none";
        document.querySelector("#txt_servers").innerHTML = "";
        document.querySelector("#div_servers").style.display = "none";        

        while (!foundPort && workerDone !== workerNum) {
            if (scannedPorts < commonPortLength) {
                percentage = Math.round(100 * scannedPorts / commonPortLength);
                document.querySelector("#title").innerText =
                    "扫描中... " + percentage + "%";
                document.querySelector(".progress-done").style.width = percentage + "%";
            } else {
                percentage = Math.round(
                    100 * (scannedPorts - commonPortLength) / ports.length
                );
                document.querySelector("#title").innerText =
                    "扩展扫描中... " + percentage + "%";
                document.querySelector(".progress-done").style.width = percentage + "%";
            }
            await sleep(500);
        }
        window.scanning = false;
        document.querySelector(".progress-done").style.width = "100%";

        if (foundPort) {
            document.querySelector("#title").innerText =
                "您在使用 Clash：TCP/" + foundPort;
            document.querySelector("#txt_version").innerText =
                await getClashVersion(foundPort);
            const hostlist = await getClashTraffic(foundPort);
            if (hostlist && Array.isArray(hostlist)) {
                document.querySelector("#txt_hosts").innerHTML = hostlist.join("<br/>");
                document.querySelector("#div_hosts").style.display = "inherit";
            }
            const proxies = await getClashProxies(foundPort);
            if (proxies) {
                document.querySelector("#txt_servers").innerHTML =
                    JSON.stringify(proxies, null, 4);
                document.querySelector("#div_servers").style.display = "inherit";
            }
        } else {
            document.querySelector("#title").innerText = "未发现 Clash";
        }
    }
    updateInfoWorker();
    let wn;
    for (wn = 0; wn < workerNum; wn++) {
        scanLocalhostWorker(wn);
    }
}

function startScan() {
    if (!AbortSignal || !AbortSignal.timeout) {
        alert("您的浏览器版本较低，检测结果可能不准确。");
    }
    if (window.scanning) {
        alert("正在扫描中。");
    } else {
        scanLocalhost(20);
    }
}
