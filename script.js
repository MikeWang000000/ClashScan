if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, error => {
          console.log('ServiceWorker registration failed: ', error);
        });
    });
  }


if (!AbortSignal.timeout) {
    AbortSignal.timeout = function (ms) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException("TimeoutError")), ms);
        return controller.signal;
    };
}

function avg (arr) {
    let sum = 0;
    arr.forEach((k) => { sum += k; })
    return sum / arr.length;
}

function shuffle(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function randArr(start, end, length) {
    return shuffle(range(start, end)).slice(0, length);
}

function range(start, end) {
    return Array.from({ length: end - start }, (v, i) => i + start);
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function portTime(port) {
    const st = performance.now();
    try {
        await fetch(
            "http://127.0.0.1:" + port,
            { signal: AbortSignal.timeout(3000) }
        );
    } catch (error) {}
    const et = performance.now();
    return et - st;
}

async function guessOpenProxyPort() {
    const promList = [];
    const randTime = [];
    const msThresh = 300;

    randArr(41000, 49000, 8).forEach((port) => {
        promList.push(portTime(port));
    });
    const prom7890 = portTime(7890);
    const prom7897 = portTime(7897);

    for (const prom of promList) {
        randTime.push(await prom);
    }
    closedAvg = avg(randTime);

    if (Math.abs(await prom7890 - closedAvg) > msThresh) {
        return 7890;
    }
    if (Math.abs(await prom7897 - closedAvg) > msThresh) {
        return 7897;
    }
    return 0;
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

async function scanLocalhost(workerNum) {
    window.scanning = true;
    let proxyPort = 0;
    let workerDone = 0;
    let totalScannedPorts = 0;
    let foundPort = 0;

    const ports = [9090]
        .concat(range(9091, 10000))
        .concat(range(2000, 9090).reverse())
        .concat(range(10000, 65536))
        .concat(range(1, 2000).reverse());

    const workers = [];
    const commonPortLength = 3200;
    let percentage = 0;
    let currentPortIndex = 0;

    function updateProgress() {
        let preInfo = "";
        if (proxyPort === 7890) {
            preInfo = "TCP/7890 开放 (Clash?) | ";
        } else if (proxyPort === 7897) {
            preInfo = "TCP/7897 开放 (Clash Verge?) | ";
        }
        if (totalScannedPorts < commonPortLength) {
            percentage = Math.round(100 * totalScannedPorts / commonPortLength);
            document.querySelector("#title").innerText =
                preInfo + "扫描中... " + percentage + "%";
            document.querySelector(".progress-done").style.width = percentage + "%";
        } else {
            percentage = Math.round(
                100 * (totalScannedPorts - commonPortLength) / ports.length
            );
            document.querySelector("#title").innerText =
                preInfo + "扩展扫描中... " + percentage + "%";
            document.querySelector(".progress-done").style.width = percentage + "%";
        }
    }

    async function updateInfoWorker() {
        let preInfo = "";
        if (proxyPort === 7890) {
            preInfo = "TCP/7890 开放 (Clash?) | ";
        } else if (proxyPort === 7897) {
            preInfo = "TCP/7897 开放 (Clash Verge?) | ";
        }

        document.querySelector("#txt_version").innerText = "暂无数据";
        document.querySelector("#txt_hosts").innerHTML = "";
        document.querySelector("#div_hosts").style.display = "none";
        document.querySelector("#txt_servers").innerHTML = "";
        document.querySelector("#div_servers").style.display = "none";        

        while (!foundPort && workerDone !== workerNum) {
            updateProgress();
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
        } else if (proxyPort) {
            document.querySelector("#title").innerText = preInfo + "扫描完毕";
        }
        else {
            document.querySelector("#title").innerText = "未发现 Clash";
        }
    }



    function terminateAllWorkers() {
        workers.forEach(worker => worker.terminate());
    }

    updateInfoWorker();
    proxyPort = await guessOpenProxyPort();

    const portChunks = Array.from({ length: workerNum }, () => []);
    
    for (let i = 0; i < ports.length; i++) {
        portChunks[i % workerNum].push(ports[i]);
    }
    
    for (let wn = 0; wn < workerNum; wn++) {
        const worker = new Worker('scannerWorker.js');
        worker.onmessage = function (e) {
            const { foundPort: port } = e.data;
            if (port) {
                foundPort = port;
                terminateAllWorkers();
            }
            totalScannedPorts++;
            if (portChunks[wn].length > 0) {
                worker.postMessage({ port: portChunks[wn].shift(), timeout: 120 });
            } else {
                workerDone++;
            }
        };
        workers.push(worker);
        if (portChunks[wn].length > 0) {
            worker.postMessage({ port: portChunks[wn].shift(), timeout: 120 });
        }
    }

    // 确保在窗口关闭或刷新时终止所有 Web Worker
    window.addEventListener('beforeunload', terminateAllWorkers);
}

function startScan() {
    if (!AbortSignal || !AbortSignal.timeout) {
        alert("您的浏览器版本较低，检测结果可能不准确。");
    }
    if (window.scanning) {
        alert("正在扫描中。");
    } else {
        scanLocalhost(128);
    }
}