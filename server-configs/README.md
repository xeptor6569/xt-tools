# Server configs

The release zip contains the built site at its root and this directory beside it. `csp.txt`, `csp.conf`, `apache.htaccess` and `Caddyfile` in the zip are generated for that exact build. They carry the hashes the pages need. A header that omits those hashes blocks the site's own scripts.

Without these headers the `<meta>` Content Security Policy still applies. What you lose is `frame-ancestors` (a meta tag cannot set it) and the policy on worker scripts, which do not see the page's meta tag.

Copy the rest of the zip to the web root. Do not put this README on the public site.

## nginx

Start from `nginx.conf`. It expects `csp.conf` from this directory at `/etc/nginx/snippets/csp.conf`. Keep that include if you replace the header file. `gzip_static on` serves the `.gz` files that ship in the zip. The stock nginx MIME list has no type for `.mjs` or `.webmanifest`; `mime-extra.conf` adds them.

## Apache

`apache.htaccess` sets the generated policy and the other headers. It needs `mod_headers`. Allow overrides for the site directory, or paste the file into the virtual host.

## Caddy

Import the generated `Caddyfile` snippet inside your site block:

```caddy
example.com {
	import /path/to/server-configs/Caddyfile
	root * /var/www/xt-tools
	file_server
	encode gzip zstd
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
	}
}
```

Put HSTS on the TLS terminator, not on a plain-HTTP site. The Docker HTTPS overlay is `deploy/Caddyfile`, which proxies to the container instead of serving the files itself.
