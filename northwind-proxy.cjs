const http = require("node:http");
const https = require("node:https");

http.createServer((req, res) => {
  if (!req.url.startsWith("/V4/")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const headers = {
    ...req.headers,
    host: "services.odata.org",
    "accept-encoding": "identity"
  };

  const upstream = https.request({
    hostname: "services.odata.org",
    path: req.url,
    method: req.method,
    headers
  }, (response) => {
    const chunks = [];

    response.on("data", (chunk) => chunks.push(chunk));

    response.on("end", () => {
      const responseHeaders = { ...response.headers };
      let body = Buffer.concat(chunks);

      // Corrige o cabeçalho HTTP.
      if (responseHeaders["odata-version"]?.trim() === "4.0;") {
        responseHeaders["odata-version"] = "4.0";
      }

      // Corrige também os cabeçalhos internos de respostas batch.
      const contentType = responseHeaders["content-type"] || "";

      if (contentType.includes("multipart/mixed")) {
        body = Buffer.from(
          body.toString("utf8").replace(
            /^(OData-Version:[ \t]*)4\.0;[ \t]*\r?$/gim,
            "$14.0\r"
          )
        );
      }

      delete responseHeaders["transfer-encoding"];
      responseHeaders["content-length"] = String(body.length);

      res.writeHead(response.statusCode, responseHeaders);
      res.end(body);
    });

    response.on("error", () => res.destroy());
  });

  upstream.on("error", (error) => {
    console.error(error.message);
    res.writeHead(502);
    res.end("Falha ao acessar o Seriço OData upstream.");
  });

  req.pipe(upstream);
}).listen(8081, "127.0.0.1", () => {
  console.log("Proxy Odata Service iniciando em http://127.0.0.1:8081");
  if (process.send) process.send("ready");
});
