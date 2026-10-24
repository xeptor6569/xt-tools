# Self-hosted runner and Compose deployment

CI (`.github/workflows/ci.yml`) runs on self-hosted GitHub Actions runners and deploys every green push to `main` with Docker Compose on the runner's machine.

| Event                                     | Runs on                       | Deploys |
| ----------------------------------------- | ----------------------------- | ------- |
| Push to `main`                            | self-hosted                   | yes     |
| Manual run (Actions → CI → Run) on `main` | self-hosted                   | yes     |
| Pull request (including forks)            | GitHub-hosted `ubuntu-latest` | no      |

Pull requests stay on GitHub-hosted runners because this repository is public: a self-hosted runner would execute a stranger's code on your machine. The workflow file in a pull request can still be edited to target self-hosted labels, so also set **Settings → Actions → General → Fork pull request workflows from outside collaborators** to **Require approval for all external contributors**, and only approve runs after reading the changes.

## Runner requirements

- Linux x64 with the labels `self-hosted`, `linux` and `x64`. They are the defaults; set `XT_RUNNER_LABELS` to use others.
- Docker Engine with the Compose v2 plugin and Buildx. The runner's user must be able to use Docker (member of the `docker` group). No root or `sudo` is needed.
- `git`, `bash`, `tar` and outbound HTTPS. These are needed for checkout, npm, image pulls and the GitHub Actions cache. Node 26 is installed by `actions/setup-node`.
- About 15 GB of free disk space. CI removes its own containers and images after each job. Prune the build cache now and then with `docker builder prune --filter until=168h`.

Every CI job uses unique Compose project, image and container names. Several runners can share one Docker host, and CI never touches the deployed site. Browsers come from the Playwright image, so Playwright e2e and Lighthouse need nothing installed on the host. Reports written by containers are handed back to the runner user, so the next checkout can clean the workspace.

Register the runner under **Settings → Actions → Runners → New self-hosted runner**. Then install it as a service (`sudo ./svc.sh install <user>`) so deployments survive reboots. Containers started by the deploy job keep running after the job ends; Compose's `restart: unless-stopped` brings them back after a reboot.

## Deployment

The `deploy` job runs after all other jobs pass, on `main` only, one at a time (concurrency group `deploy-production`). It uses the GitHub environment `production`. Add required reviewers there if you want to approve each deploy.

It runs `node scripts/deploy.ts`, which:

1. builds `xt-tools:sha-<short commit>` with the host's Docker, whose layer cache persists between deploys;
2. copies `compose.yaml` into the deploy directory and writes its `.env` from the settings below;
3. runs `docker compose -p xt-tools-prod up -d --wait` and checks that `/healthz` and the base path answer 200 on the host port;
4. starts the previous image again if any of that fails, and fails the job;
5. keeps the live and previous images for rollback and removes older `xt-tools:sha-*` images.

### Settings

Set these as repository variables: **Settings → Secrets and variables → Actions → Variables**. For `make deploy`, set them as environment variables instead.

| Variable           | Default                         | Meaning                                                                                                                                  |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `XT_PORT`          | `3125`                          | Host port                                                                                                                                |
| `XT_BIND`          | `0.0.0.0`                       | Host address. Use `127.0.0.1` behind a reverse proxy on the same machine.                                                                |
| `BASE_PATH`        | `/`                             | Sub-path such as `/tools/`; compiled into the image, so changing it rebuilds the site                                                    |
| `SITE_URL`         | (empty)                         | Public URL for canonical links, also shown as the environment URL                                                                        |
| `XT_DEPLOY_DIR`    | `~/xt-tools` of the runner user | Where `compose.yaml`, `.env` and `.deployed-tag` live                                                                                    |
| `XT_PROJECT`       | `xt-tools-prod`                 | Compose project name                                                                                                                     |
| `XT_DEPLOY`        | (unset)                         | Set to `false` to keep CI on self-hosted runners but skip deploys                                                                        |
| `XT_RUNNER_LABELS` | `["self-hosted","linux","x64"]` | JSON array of labels for the build and test jobs                                                                                         |
| `XT_DEPLOY_LABELS` | `XT_RUNNER_LABELS`              | JSON array of labels for the deploy job. Use a dedicated label if you have several runner machines and the site must run on one of them. |

Change a variable, then redeploy with **Actions → CI → Run workflow** on `main`.

### Operating the deployed site

```sh
cd ~/xt-tools                                # or your XT_DEPLOY_DIR
docker compose -p xt-tools-prod ps
docker compose -p xt-tools-prod logs -f
docker compose -p xt-tools-prod down         # stop; the next deploy starts it again
```

To roll back by hand, set `XT_TAG` in `.env` to an image listed by `docker image ls xt-tools`, then run `docker compose -p xt-tools-prod up -d`. The next deploy rewrites `.env`.

To deploy without CI, run `make deploy` (or `node scripts/deploy.ts`) on the target machine from a checkout. `--no-build --tag sha-abc1234` reuses an existing image, and `--dry-run` prints the plan.
