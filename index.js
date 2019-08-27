const http = require("http")
const axios = require("axios")
const { Readable } = require('stream');
require('dotenv').config()
const appHostname = process.env.APP_HOSTNAME || require("os").hostname()

const server = http.createServer(async (req, res) => {
    let error = null
    let proxiedRes = null
    try {
        const { url } = req
        const { host, referer } = req.headers

        const match = host.match(new RegExp(`^echo_-_(.*)\.${appHostname}$`, 'i'))
        const targetHost = match && match[1].replace(/_\-_/g, '.')
        const scheme = referer && referer.startsWith('https') ? 'https' : 'http'

        if(!targetHost)
            throw new Error(`couldn't get target host from Host header ${host}`)

        proxiedRes = await axios.get(`${scheme}://${targetHost}${url}`, { responseType: 'stream' })

    } catch(e) {
        if(e && e.response) {
            proxiedRes = e.response
        } else if(e) {
            error = e
        } else {
            error = new Error(`got ${e} for error`)
        }
    }

    if(proxiedRes != null && error == null) {
        res.writeHead(proxiedRes.status, {
            ...proxiedRes.headers,
            'access-control-allow-origin': appHostname
        });
        if(proxiedRes.headers['content-type'].startsWith('text/html')) {
            proxiedRes.data.pipe(res, { end: false });
            proxiedRes.data.on('end', () => {
              res.end(`<script type="text/javascript">document.domain="${ appHostname }"</script>\n`);
            });
        } else {
            proxiedRes.data.pipe(res)
        }
    } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('' + error);
    }
});

server.listen(3000);
