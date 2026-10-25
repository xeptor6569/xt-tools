# Air-gapped install

The image has everything the site needs. After it is loaded, the container does not fetch pages, libraries or datasets.

## On a machine that has internet

```sh
git clone https://github.com/xeptor6569/xt-tools.git && cd xt-tools
make build          # or: docker pull ghcr.io/xeptor6569/xt-tools:latest && docker tag ghcr.io/xeptor6569/xt-tools:latest xt-tools:local
make export         # writes xt-tools.tar.gz
sha256sum xt-tools.tar.gz > xt-tools.tar.gz.sha256
```

`make export` saves the local image name (`xt-tools:local` unless `IMAGE` is set). Copy `xt-tools.tar.gz` and the checksum to the offline machine. A USB disk is enough. Do not use a channel that unpacks or recompresses the file.

## On the offline machine

Check the checksum, then load and start:

```sh
sha256sum -c xt-tools.tar.gz.sha256
# clone or copy the repo so compose.yaml and the Makefile are present
make import
make up
```

`make import` runs `docker load`. `make up` uses the loaded image when `XT_TAG` is unset and retags it for Compose.

Docker itself, and the Compose plugin, have to be installed before the machine is disconnected. This repository does not vendor the Docker engine.

## Updates

Build or pull the new image on a connected machine, run `make export` again, and repeat the copy and `make import`. `make up` recreates the container from the new image. The old container's files are the image, not a volume, so there is no data to migrate.

A release zip (`xt-tools-<version>-site.zip`) is the same site without Docker. Copy the zip, check `SHA256SUMS`, and unpack it onto a static server that is already installed. See [deployment.md](deployment.md) and [server-configs](../server-configs/README.md).
