# Bundled datasets

Hand-curated datasets live in `public/data/` with a version in the file name, so a cached copy is never confused with a newer one. They are downloaded by a developer with `node scripts/refresh-data.ts <dataset>` and committed. The build never downloads anything, and the site only loads these files from its own origin through `src/lib/load-local-asset.ts`.

To refresh a dataset:

1. Run `node scripts/refresh-data.ts <dataset>`. It writes the new file, deletes the old version and updates the entry below.
2. Run `npm run format`, then `npm test` and the e2e suite.
3. Commit the data file, this document and any constant the script updated.

## Datasets

<!-- dataset:gitignore -->

### gitignore

| Field     | Value                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Tool      | `gitignore-generator`                                                                                  |
| File      | `public/data/gitignore-0e5d690.json`                                                                   |
| Source    | github/gitignore (<https://github.com/github/gitignore/tree/0e5d690153ca3da8a4a1aef2d053406f408f531c>) |
| Version   | commit 0e5d690 (0e5d690153ca3da8a4a1aef2d053406f408f531c)                                              |
| License   | CC0-1.0                                                                                                |
| Retrieved | 2026-10-24                                                                                             |
| SHA-256   | `f9245684d30a8da06f46666049867c7aa69adae1545c01077b4d68b03215302d`                                     |
| Refresh   | `node scripts/refresh-data.ts gitignore`                                                               |

312 templates: root `*.gitignore` (Languages & frameworks), `Global/*.gitignore` (Editors, tools & OS) and `community/**/*.gitignore` (Community).
<!-- /dataset:gitignore -->

<!-- dataset:k8s -->

### k8s

| Field     | Value                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool      | `k8s-manifest`                                                                                                                                |
| File      | `public/data/k8s-v1.37.1.json`                                                                                                                |
| Source    | kubernetes/kubernetes `api/openapi-spec/swagger.json` (<https://github.com/kubernetes/kubernetes/blob/v1.37.1/api/openapi-spec/swagger.json>) |
| Version   | v1.37.1                                                                                                                                       |
| License   | Apache-2.0                                                                                                                                    |
| Retrieved | 2026-10-24                                                                                                                                    |
| SHA-256   | `fbfdded0dfe0f39a7eeecbfeda1ba321403a45bf04542fd4cd2f28d0794c04e5`                                                                            |
| Refresh   | `node scripts/refresh-data.ts k8s`                                                                                                            |

Draft-4 JSON Schemas for 28 built-in kinds (Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, Service, Ingress, IngressClass, ConfigMap, Secret, PersistentVolume, PersistentVolumeClaim, StorageClass, Namespace, ServiceAccount, Role, RoleBinding, ClusterRole, ClusterRoleBinding, NetworkPolicy, HorizontalPodAutoscaler, PodDisruptionBudget, LimitRange, ResourceQuota, PriorityClass, EndpointSlice), reduced to the definitions they reference. Descriptions and formats are stripped, IntOrString and Quantity become string-or-number, objects with declared properties reject unknown fields, and each kind has a `.root` schema that requires its apiVersion and kind.
<!-- /dataset:k8s -->

<!-- dataset:oui -->

### oui

| Field     | Value                                                                      |
| --------- | -------------------------------------------------------------------------- |
| Tool      | `mac-vendor`                                                               |
| File      | `public/data/oui-2026-10.json`                                             |
| Source    | IEEE Registration Authority (<https://standards-oui.ieee.org/oui/oui.csv>) |
| Version   | 2026-10                                                                    |
| License   | IEEE public registry data                                                  |
| Retrieved | 2026-10-24                                                                 |
| SHA-256   | `a5d279b01545cc0803231e60a91600a871e96b4bc2994e414c111dd26591fbd9`         |
| Refresh   | `node scripts/refresh-data.ts oui`                                         |

54289 prefixes: MA-L, MA-M and MA-S assignment lists. Lookup uses the longest matching prefix, so a 28-bit or 36-bit assignment wins over the 24-bit block it was carved from. The site loads this file through `loadLocalAsset` and never requests the IEEE URLs.
<!-- /dataset:oui -->
